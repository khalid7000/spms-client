import { useEffect, useState } from 'react'
import { Card, Button, Table, Space, Tag, message, Empty, Spin, Alert, Select, Form, Input, Modal, Typography, Popconfirm } from 'antd'
import { CheckCircleOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as api from '../../api/portfolio'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import ReviewControl, { ALL_REVIEW_ACTION_KEYS } from '../../components/ReviewControl'
import { useTerminology } from '../../TerminologyContext'

const { Paragraph, Text } = Typography

// Employees cannot reject a goal outright -- they can accept it, accept it with edits, or
// propose an alternative and then submit the whole cycle back to their department head.
const EMPLOYEE_ACTION_KEYS = ALL_REVIEW_ACTION_KEYS.filter((a) => a.value !== 'REJECT')

const STATE_COLORS = {
  DRAFT: 'default',
  LEADER_SUBMITTED: 'processing',
  EMPLOYEE_REVIEW: 'warning',
  EMPLOYEE_SUBMITTED: 'processing',
  DEPLOYED: 'success',
  ARCHIVED: 'default',
}

// A stable reference so `goals` doesn't become a brand-new [] on every render when the query
// is disabled (no cycle yet) -- that would make the effect below depend on an ever-changing
// reference and loop forever, since a disabled query's `data` never settles into a cached value.
const EMPTY_ARRAY = []

export default function GoalReviewPage() {
  const { t } = useTranslation()
  const { academicYearLabel, defaultHeadTitleLabel } = useTerminology()
  const [academicYear, setAcademicYear] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [signOpen, setSignOpen] = useState(false)
  const [signForm] = Form.useForm()
  const qc = useQueryClient()

  const { data: academicYears = [], isLoading: yearsLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: getAcademicYears,
  })

  // Default to the most recent year instead of leaving the selector blank.
  useEffect(() => {
    if (!academicYear && academicYears.length > 0) {
      setAcademicYear(getMostRecentAcademicYear(academicYears).id)
    }
  }, [academicYear, academicYears])

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery({
    queryKey: ['my-goal-cycles', academicYear],
    queryFn: () => api.getMyCycles(academicYear),
    enabled: !!academicYear,
  })
  const cycle = cycles[0]

  const { data: goals = EMPTY_ARRAY, isLoading: goalsLoading } = useQuery({
    queryKey: ['my-goal-cycle-goals', cycle?.id],
    queryFn: () => api.getCycleGoals(cycle.id),
    enabled: !!cycle && cycle.state !== 'DRAFT' && cycle.state !== 'LEADER_SUBMITTED',
  })

  useEffect(() => {
    const map = {}
    for (const g of goals) {
      if (g.employeeActionType) {
        map[g.id] = { actionType: g.employeeActionType, editedTitle: g.employeeEditedTitle, editedDescription: g.employeeEditedDescription }
      }
    }
    setDrafts(map)
  }, [goals])

  const startReviewMut = useMutation({
    mutationFn: () => api.startEmployeeReview(cycle.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-goal-cycles', academicYear] })
      qc.invalidateQueries({ queryKey: ['my-goal-cycle-goals', cycle.id] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalReview.couldNotStartReview')),
  })

  const reviewGoalMut = useMutation({
    mutationFn: ({ goalId, payload }) => api.reviewGoal(cycle.id, goalId, payload),
    onError: (err) => message.error(err.response?.data?.message || t('swot.saveReviewFailed')),
  })

  const handleSave = (_targetType, goalId, payload) => {
    setDrafts((prev) => ({ ...prev, [goalId]: payload }))
    reviewGoalMut.mutate({ goalId, payload })
  }

  const acceptMut = useMutation({
    mutationFn: (signatureName) => api.acceptCycle(cycle.id, signatureName),
    onSuccess: () => {
      message.success(t('goalReview.acceptedSignedDeployed', { yearLabel: academicYearLabel.toLowerCase() }))
      setSignOpen(false)
      signForm.resetFields()
      qc.invalidateQueries({ queryKey: ['my-goal-cycles', academicYear] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalReview.couldNotAcceptGoals')),
  })

  const submitBackMut = useMutation({
    mutationFn: () => api.submitCycleBack(cycle.id),
    onSuccess: () => {
      message.success(t('goalReview.sentBackToHead'))
      qc.invalidateQueries({ queryKey: ['my-goal-cycles', academicYear] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalReview.couldNotSubmitBack')),
  })

  const allReviewed = goals.length > 0 && goals.every((g) => drafts[g.id]?.actionType)

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>{t('goalReview.title')}</h1>
        <Paragraph type="secondary">
          {t('goalReview.intro')}
        </Paragraph>

        <Form layout="inline" style={{ marginBottom: 24 }}>
          <Form.Item label={academicYearLabel}>
            <Select style={{ width: 200 }} placeholder={t('goalReview.selectYearPlaceholder')} value={academicYear} onChange={setAcademicYear}
              loading={yearsLoading} options={academicYears.map((y) => ({ value: y.id, label: y.name }))} />
          </Form.Item>
        </Form>

        {!academicYear && <Empty description={t('goalReview.selectYearEmpty', { yearLabel: academicYearLabel })} />}

        {academicYear && cyclesLoading && <Spin />}

        {academicYear && !cyclesLoading && !cycle && (
          <Empty description={t('goalReview.noGoalsSetYet', { yearLabel: academicYearLabel.toLowerCase() })} />
        )}

        {cycle && (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Text strong>{cycle.leaderName}</Text>
              <Tag color={STATE_COLORS[cycle.state]}>{cycle.state}</Tag>
            </Space>

            {cycle.state === 'DRAFT' && (
              <Alert type="info" showIcon message={t('goalReview.headStillPreparing')} />
            )}

            {cycle.state === 'LEADER_SUBMITTED' && (
              <Alert type="info" showIcon
                message={t('goalReview.headSubmittedForReview')}
                action={<Button size="small" type="primary" loading={startReviewMut.isPending} onClick={() => startReviewMut.mutate()}>{t('goalReview.startReviewButton')}</Button>} />
            )}

            {cycle.state === 'EMPLOYEE_SUBMITTED' && (
              <Alert type="info" showIcon message={t('goalReview.sentBackToHead')} />
            )}

            {cycle.state === 'DEPLOYED' && cycle.employeeSignatureName && (
              <Alert type="success" showIcon style={{ marginBottom: 16 }}
                message={t('goalReview.signedAndAcceptedByOn', { name: cycle.employeeSignatureName, date: new Date(cycle.employeeAcceptedAt).toLocaleDateString() })} />
            )}

            {(cycle.state === 'EMPLOYEE_REVIEW' || cycle.state === 'DEPLOYED') && (
              goalsLoading ? <Spin /> : goals.length === 0 ? <Empty description={t('goalReview.noGoalsFound')} /> : (
                <>
                  {goals.map((g) => (
                    <Card key={g.id} size="small" style={{ marginBottom: 12 }} title={<>{g.goalTitle} <Tag>{g.categoryName}</Tag></>}>
                      <Paragraph type="secondary" style={{ marginBottom: cycle.state === 'DEPLOYED' ? 0 : undefined }}>{g.description}</Paragraph>
                      {cycle.state === 'EMPLOYEE_REVIEW' && (
                        <ReviewControl targetType="GOAL" targetId={g.id} defaultTitle={g.goalTitle} defaultDescription={g.description}
                          draft={drafts[g.id]} onSave={handleSave} actionKeys={EMPLOYEE_ACTION_KEYS}
                          alternativeLabelKey="goalReview.editAboveAndResubmit" />
                      )}
                    </Card>
                  ))}

                  {cycle.state === 'EMPLOYEE_REVIEW' && (
                    <Space>
                      <Button type="primary" icon={<CheckCircleOutlined />} disabled={!allReviewed} onClick={() => setSignOpen(true)}>
                        {t('goalReview.acceptSignDeployButton')}
                      </Button>
                      <Popconfirm title={t('goalReview.submitBackConfirmTitle')} onConfirm={() => submitBackMut.mutate()}>
                        <Button icon={<SendOutlined />} loading={submitBackMut.isPending}>{t('goalReview.submitBackButton', { headTitle: defaultHeadTitleLabel })}</Button>
                      </Popconfirm>
                      {!allReviewed && <Text type="secondary" style={{ fontSize: 12 }}>{t('goalReview.reviewEveryGoalFirst')}</Text>}
                    </Space>
                  )}
                </>
              )
            )}
          </>
        )}
      </Card>

      <Modal title={t('goalReview.acceptSignDeployButton')} open={signOpen} onCancel={() => setSignOpen(false)} destroyOnClose
        onOk={() => signForm.submit()} confirmLoading={acceptMut.isPending} okText={t('goalReview.acceptSignDeployButton')}>
        <Paragraph type="secondary">
          {t('goalReview.deployedAsActiveGoalsHint', { yearLabel: academicYearLabel.toLowerCase() })}
        </Paragraph>
        <Form form={signForm} layout="vertical" onFinish={(values) => acceptMut.mutate(values.signatureName)}>
          <Form.Item name="signatureName" label={t('annualEval.typeNameToSignLabel')} rules={[{ required: true, message: t('annualEval.typeNameToSignLabel') }]}>
            <Input placeholder={t('annualEval.yourFullNamePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
