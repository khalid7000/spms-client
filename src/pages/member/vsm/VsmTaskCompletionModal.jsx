// The "log an achievement to complete an Improvement task" step (Phase 4 of the VSM module).
// Mirrors AchievementModal.jsx's category/criteria/goal/rating/evidence field set, but -- unlike
// every existing achievement-logging entry point, which always already has one specific measurement
// in context from the Strategy Tree -- this is the first place in the app that needs its own
// Initiative/Measurement picker, since a VSM task has no measurement of its own unless a leader
// linked one at creation time.
import { useEffect } from 'react'
import { Modal, Form, Input, Select, Rate, Alert } from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAchievementTypes, getAssessmentPeriods } from '../../../api/strategies'
import { getMyCategories, getCriteria, getMyCycles, getCycleGoals } from '../../../api/portfolio'
import { getAcademicYears } from '../../../api/academicYears'
import { getAchievableMeasurements, logTaskAchievement } from '../../../api/vsmTasks'

export default function VsmTaskCompletionModal({ task, onClose, onSuccess }) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const open = !!task

  const { data: achievementTypes = [] } = useQuery({
    queryKey: ['achievement-types'], queryFn: getAchievementTypes, enabled: open,
  })
  const { data: measurements = [] } = useQuery({
    queryKey: ['vsm-achievable-measurements'], queryFn: getAchievableMeasurements, enabled: open,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['portfolio-categories-for-achievement', 'me'], queryFn: getMyCategories, enabled: open,
  })
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'], queryFn: getAcademicYears, enabled: open,
  })

  const selectedMeasurementId = Form.useWatch('measurementId', form)
  const selectedMeasurement = measurements.find((m) => m.measurementId === selectedMeasurementId)

  // Base (not-yet-year-copied) initiatives -- the common case -- have no assessment period of
  // their own (see VsmTaskAchievementService's javadoc), so the completer picks one explicitly for
  // this achievement, the same list the Strategy Tree's own period filter offers for this strategy.
  const { data: assessmentPeriods = [] } = useQuery({
    queryKey: ['assessment-periods', selectedMeasurement?.planningCycleId],
    queryFn: () => getAssessmentPeriods(selectedMeasurement.planningCycleId),
    enabled: open && !!selectedMeasurement?.planningCycleId,
  })

  const selectedPeriodId = Form.useWatch('assessmentPeriodId', form)
  const selectedPeriodName = assessmentPeriods.find((p) => p.id === selectedPeriodId)?.name
  const effectiveAcademicYearId = selectedPeriodName
    ? academicYears.find((y) => y.name === selectedPeriodName)?.id
    : undefined

  const { data: myCycles = [] } = useQuery({
    queryKey: ['my-goal-cycles', effectiveAcademicYearId],
    queryFn: () => getMyCycles(effectiveAcademicYearId),
    enabled: open && !!effectiveAcademicYearId,
  })
  const deployedCycle = myCycles.find((c) => c.state === 'DEPLOYED')
  const { data: myGoals = [] } = useQuery({
    queryKey: ['my-deployed-goals-for-achievement', deployedCycle?.id],
    queryFn: () => getCycleGoals(deployedCycle.id),
    enabled: open && !!deployedCycle,
  })

  const selectedCategoryId = Form.useWatch('categoryId', form)
  const { data: criteria = [] } = useQuery({
    queryKey: ['portfolio-criteria-for-achievement', selectedCategoryId],
    queryFn: () => getCriteria(selectedCategoryId),
    enabled: open && !!selectedCategoryId,
  })

  const selectedAchievementTypeId = Form.useWatch('achievementTypeId', form)
  const otherType = achievementTypes.find((ty) => ty.systemCode === 'OTHER')
  const isOtherType = !!otherType && selectedAchievementTypeId === otherType.id

  useEffect(() => {
    if (open) form.resetFields()
  }, [open, task?.id, form])

  const logMut = useMutation({
    mutationFn: (values) => logTaskAchievement(task.id, {
      measurementId: values.measurementId,
      achievementTitle: values.achievementTitle,
      achievementTypeId: values.achievementTypeId,
      customTypeName: values.customTypeName,
      details: values.details,
      privateNotes: values.privateNotes,
      assessmentPeriodId: values.assessmentPeriodId,
      categoryId: values.categoryId,
      criteriaId: values.criteriaId,
      categoryRating: values.categoryRating,
      goalId: values.goalId,
      evidenceUrl: values.evidenceUrl,
    }),
    onSuccess: (updatedTask) => onSuccess(updatedTask),
  })

  return (
    <Modal
      title={t('vsm.logAchievementTitle')}
      open={open}
      onCancel={onClose}
      onOk={() => form.validateFields().then((v) => logMut.mutate(v)).catch(() => {})}
      confirmLoading={logMut.isPending}
      destroyOnClose
      width={560}
    >
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('vsm.logAchievementHint')} />
      <Form form={form} layout="vertical">
        <Form.Item name="measurementId" label={t('vsm.initiativeMeasurementLabel')} rules={[{ required: true }]}>
          <Select
            placeholder={t('vsm.selectMeasurementPlaceholder')}
            options={measurements.map((m) => ({
              value: m.measurementId,
              label: `${m.strategyTitle} — ${m.initiativeTitle} — ${m.measurementDescription}`,
            }))}
            showSearch
            filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
            onChange={() => form.setFieldValue('assessmentPeriodId', undefined)}
          />
        </Form.Item>
        {measurements.length === 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={t('vsm.noAchievableMeasurements')} />
        )}
        {selectedMeasurement && (
          <Form.Item name="assessmentPeriodId" label={t('achievementModal.assessmentPeriodLabel')} rules={[{ required: true }]}>
            <Select
              placeholder={t('vsm.selectAssessmentPeriodPlaceholder')}
              options={assessmentPeriods.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
        )}

        <Form.Item name="achievementTitle" label={t('common.title')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="achievementTypeId" label={t('common.type')} rules={[{ required: true }]}>
          <Select
            options={achievementTypes.filter((ty) => ty.active).map((ty) => ({ value: ty.id, label: ty.name }))}
          />
        </Form.Item>
        {isOtherType && (
          <Form.Item name="customTypeName" label={t('achievementModal.customTypeLabel')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        )}
        <Form.Item name="details" label={t('achievementModal.detailsLabel')}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="privateNotes" label={t('achievementModal.privateNotesLabel')}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="categoryId" label={t('achievementModal.evaluationCategoryLabel')} rules={[{ required: true }]}>
          <Select
            placeholder={t('achievementModal.selectCategoryPlaceholder')}
            options={categories.map((c) => ({ value: c.id, label: c.categoryName }))}
            onChange={() => form.setFieldValue('criteriaId', undefined)}
          />
        </Form.Item>
        <Form.Item name="criteriaId" label={t('achievementModal.criteriaLabel')} rules={[{ required: true }]}>
          <Select
            disabled={!selectedCategoryId}
            placeholder={selectedCategoryId ? t('achievementModal.selectCriteriaPlaceholder') : t('achievementModal.selectCategoryFirstPlaceholder')}
            options={criteria.map((c) => ({ value: c.id, label: c.criteriaName }))}
          />
        </Form.Item>
        <Form.Item name="goalId" label={t('achievementModal.relatedGoalLabel')}>
          <Select allowClear placeholder={t('achievementModal.linkToGoalPlaceholder')}
            options={myGoals.map((g) => ({ value: g.id, label: g.goalTitle }))} />
        </Form.Item>
        <Form.Item name="categoryRating" label={t('achievementModal.selfAssessmentRatingLabel')}>
          <Rate />
        </Form.Item>
        <Form.Item name="evidenceUrl" label={t('achievementModal.evidenceLinkLabel')} rules={[{ required: true }]}>
          <Input placeholder={t('achievementModal.evidenceUrlPlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
