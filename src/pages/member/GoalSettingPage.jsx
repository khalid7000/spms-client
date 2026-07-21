import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Form, Button, Input, Select, Table, Modal, Space, Tag, message, Empty, Spin, Alert, Divider, Typography, Popconfirm, Checkbox } from 'antd'
import { PlusOutlined, DeleteOutlined, BulbOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as api from '../../api/portfolio'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import ReviewControl from '../../components/ReviewControl'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { RubricPopover } from './evaluationDisplay'
import { useTerminology } from '../../TerminologyContext'

const { Paragraph, Text } = Typography

const STATE_COLORS = {
  DRAFT: 'default',
  LEADER_SUBMITTED: 'processing',
  EMPLOYEE_REVIEW: 'warning',
  EMPLOYEE_SUBMITTED: 'warning',
  DEPLOYED: 'success',
  ARCHIVED: 'default',
}

// mm:ss (or ss) since `sinceIso` -- same helper as SwotLandingPage, shows "submitted at X, Y
// elapsed" while generation is still in flight so waiting looks different from stuck.
function formatElapsed(sinceIso) {
  if (!sinceIso) return null
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000))
  const m = Math.floor(diffSec / 60)
  const s = diffSec % 60
  return { m, s }
}

// Inline 3-level rubric editor for an AI-drafted (or leader-authored) suggestion card -- saves all
// 3 fields together on blur, same pattern as evaluationDisplay.jsx's CommentsInput.
function SuggestionRubricEditor({ suggestion, onSave }) {
  const { t } = useTranslation()
  const [u, setU] = useState(suggestion.rubricUnsatisfactory || '')
  const [m, setM] = useState(suggestion.rubricMeetsExpectations || '')
  const [e, setE] = useState(suggestion.rubricExceedsExpectations || '')
  useEffect(() => {
    setU(suggestion.rubricUnsatisfactory || '')
    setM(suggestion.rubricMeetsExpectations || '')
    setE(suggestion.rubricExceedsExpectations || '')
  }, [suggestion.id, suggestion.rubricUnsatisfactory, suggestion.rubricMeetsExpectations, suggestion.rubricExceedsExpectations])

  const save = () => onSave({ rubricUnsatisfactory: u, rubricMeetsExpectations: m, rubricExceedsExpectations: e })

  return (
    <div style={{ marginTop: 8 }}>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
        {t('goalSetting.threeLevelRubricRequired')}
      </Text>
      <Input.TextArea rows={2} value={u} placeholder={t('evalDisplay.rubricUnsatisfactory')}
        onChange={(ev) => setU(ev.target.value)} onBlur={save} style={{ marginBottom: 4 }} />
      <Input.TextArea rows={2} value={m} placeholder={t('evalDisplay.rubricMeets')}
        onChange={(ev) => setM(ev.target.value)} onBlur={save} style={{ marginBottom: 4 }} />
      <Input.TextArea rows={2} value={e} placeholder={t('evalDisplay.rubricExceeds')}
        onChange={(ev) => setE(ev.target.value)} onBlur={save} />
    </div>
  )
}

export default function GoalSettingPage() {
  const { t } = useTranslation()
  const { academicYearLabel } = useTerminology()
  const [searchParams] = useSearchParams()
  // Seeded from ?cycleId= when arriving via a "leader" notification (e.g. an employee just
  // deployed or sent back their goals) -- opens that cycle directly instead of the employee picker.
  // The ref survives re-renders so the employee/year backfill effect below only fires once.
  const deepLinkCycleId = useRef(searchParams.get('cycleId'))
  const [academicYear, setAcademicYear] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [cycleId, setCycleId] = useState(() => (deepLinkCycleId.current ? Number(deepLinkCycleId.current) : null))
  const [drafts, setDrafts] = useState({})
  const [addGoalOpen, setAddGoalOpen] = useState(false)
  const [addGoalForm] = Form.useForm()
  const [editGoalForm] = Form.useForm()
  const [editingGoalId, setEditingGoalId] = useState(null)
  const qc = useQueryClient()

  const { data: teamMembers = [], isLoading: teamLoading } = useQuery({
    queryKey: ['my-direct-reports'],
    queryFn: api.getMyDirectReports,
  })
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

  const { data: titles = [] } = useQuery({
    queryKey: ['employee-titles'],
    queryFn: api.getAllTitles,
  })

  const selectedEmployeeObj = teamMembers.find((e) => e.id === selectedEmployee)
  const matchedTitle = titles.find((t) => t.titleName?.toLowerCase() === selectedEmployeeObj?.title?.toLowerCase())

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-for-title', matchedTitle?.id],
    queryFn: () => api.getCategoriesByTitle(matchedTitle.id),
    enabled: !!matchedTitle,
  })

  const { data: cycle } = useQuery({
    queryKey: ['goal-cycle', cycleId],
    queryFn: () => api.getCycle(cycleId),
    enabled: !!cycleId,
    refetchInterval: 10_000,
  })

  // Once a deep-linked cycle loads, sync the employee/year selection to match it (overriding
  // whatever the "default to most recent year" effect above may have already set) so downstream
  // logic that keys off selectedEmployee/academicYear -- title/category lookup, the DRAFT-state
  // suggestion UI -- behaves exactly as if the leader had picked this employee/year manually.
  useEffect(() => {
    if (deepLinkCycleId.current && cycle) {
      setSelectedEmployee(cycle.employeeId)
      setAcademicYear(cycle.academicYearId)
      deepLinkCycleId.current = null
    }
  }, [cycle])

  // Before auto-opening a fresh DRAFT cycle, check whether this employee has unused Next Cycle
  // Goals from a past, concluded Annual Evaluation (drafted/reviewed by both head and employee
  // during that evaluation's own review exchange -- see AnnualEvaluationNextCycleGoal) and offer to
  // deploy them directly instead of starting from scratch.
  const [reuseDismissed, setReuseDismissed] = useState(false)
  const [selectedReuseIds, setSelectedReuseIds] = useState([])
  useEffect(() => { setReuseDismissed(false) }, [selectedEmployee, academicYear])

  const { data: reusableGroups = [], isFetched: reusableFetched } = useQuery({
    queryKey: ['reusable-next-cycle-goals', selectedEmployee],
    queryFn: () => api.getReusableNextCycleGoals(selectedEmployee),
    enabled: !!selectedEmployee && !!academicYear && !cycleId,
  })

  useEffect(() => {
    if (reusableFetched && reusableGroups.length > 0 && !reuseDismissed && !cycleId) {
      setSelectedReuseIds(reusableGroups.flatMap((g) => g.goals.map((x) => x.id)))
    }
  }, [reusableFetched, reusableGroups, reuseDismissed, cycleId])

  const reuseModalOpen = reusableFetched && reusableGroups.length > 0 && !reuseDismissed && !cycleId

  const useReuseGoalsMut = useMutation({
    mutationFn: () => api.useNextCycleGoals(selectedEmployee, academicYear, selectedReuseIds),
    onSuccess: (created) => {
      message.success(t('goalSetting.deployedFromPriorEval'))
      setReuseDismissed(true)
      setCycleId(created.id)
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotUseGoals')),
  })

  // AI goal-suggestion generation runs in the background (a model call can take a minute or
  // more) -- same shape as the SWOT suggestion workflow. "Generating" has no dedicated state of
  // its own (the cycle just stays DRAFT), so it's derived from the timestamps: requested but not
  // yet (re)completed, and not already failed.
  const generating = !!cycle?.generationRequestedAt && !cycle?.generationFailureReason
    && (!cycle?.suggestionsGeneratedAt || new Date(cycle.suggestionsGeneratedAt) < new Date(cycle.generationRequestedAt))

  // Forces a re-render every second so the "elapsed" clock ticks while generation is running,
  // independent of the 10s cycle poll.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!generating) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [generating])

  // The suggestions query below only fetches once (no poll of its own); re-trigger it the moment
  // the cycle poll shows generation actually completed.
  useEffect(() => {
    if (cycle?.suggestionsGeneratedAt) {
      qc.invalidateQueries({ queryKey: ['goal-suggestions', cycleId] })
    }
  }, [cycle?.suggestionsGeneratedAt, cycleId, qc])

  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ['goal-suggestions', cycleId],
    queryFn: () => api.getSuggestions(cycleId),
    enabled: !!cycleId && cycle?.state === 'DRAFT',
  })

  const { data: goals = [] } = useQuery({
    queryKey: ['goal-cycle-goals', cycleId],
    queryFn: () => api.getCycleGoals(cycleId),
    enabled: !!cycleId && cycle?.state !== 'DRAFT',
  })

  const openCycleMut = useMutation({
    mutationFn: () => api.createCycle(selectedEmployee, academicYear),
    onSuccess: (created) => {
      setCycleId(created.id)
      setDrafts({})
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotOpenCycle')),
  })

  // Opening the cycle is a no-op once one already exists for this employee/year (createOrGetCycle
  // just returns it), so there's no reason to make the head click a separate button for it --
  // picking both fields is enough. Held off until the reuse check above has resolved, so the
  // reuse modal (if any) gets first say instead of a race between the two.
  useEffect(() => {
    if (academicYear && selectedEmployee && !cycleId && !openCycleMut.isPending
        && reusableFetched && (reusableGroups.length === 0 || reuseDismissed)) {
      openCycleMut.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear, selectedEmployee, cycleId, reusableFetched, reusableGroups.length, reuseDismissed])

  const [notesForm] = Form.useForm()

  // Auto-saves on blur (no submit button) -- see the Form below.
  const saveNotesMut = useMutation({
    mutationFn: (values) => api.updateCycleNotes(cycleId, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal-cycle', cycleId] }),
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotSaveNotes')),
  })

  const generateMut = useMutation({
    mutationFn: () => api.generateSuggestions(cycleId),
    onSuccess: () => {
      message.success(t('swot.generationStarted'))
      qc.invalidateQueries({ queryKey: ['goal-cycle', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('swot.generationStartFailed')),
  })

  const reviewSuggestionMut = useMutation({
    mutationFn: ({ suggestionId, payload }) => api.reviewSuggestion(cycleId, suggestionId, payload),
    onError: (err) => message.error(err.response?.data?.message || t('swot.saveReviewFailed')),
  })

  const handleSaveSuggestionReview = (_targetType, suggestionId, payload) => {
    setDrafts((prev) => ({ ...prev, [suggestionId]: payload }))
    reviewSuggestionMut.mutate({ suggestionId, payload })
  }

  const updateSuggestionRubricMut = useMutation({
    mutationFn: ({ suggestionId, payload }) => api.updateSuggestionRubric(cycleId, suggestionId, payload),
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotSaveRubric')),
  })

  const handleSaveSuggestionRubric = (suggestionId, payload) => {
    updateSuggestionRubricMut.mutate({ suggestionId, payload })
  }

  const addSuggestionMut = useMutation({
    mutationFn: (values) => api.addSuggestion(cycleId, values),
    onSuccess: () => {
      message.success(t('swot.goalAdded'))
      setAddGoalOpen(false)
      addGoalForm.resetFields()
      qc.invalidateQueries({ queryKey: ['goal-suggestions', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotAddGoal')),
  })

  const deleteSuggestionMut = useMutation({
    mutationFn: (suggestionId) => api.deleteSuggestion(cycleId, suggestionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal-suggestions', cycleId] }),
  })

  const submitForReviewMut = useMutation({
    mutationFn: () => api.submitCycleForReview(cycleId),
    onSuccess: () => {
      message.success(t('goalSetting.submittedForEmployeeReview'))
      qc.invalidateQueries({ queryKey: ['goal-cycle', cycleId] })
      qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotSubmitForReview')),
  })

  const resubmitMut = useMutation({
    mutationFn: () => api.resubmitCycleForReview(cycleId),
    onSuccess: () => {
      message.success(t('goalSetting.resubmittedForEmployeeReview'))
      qc.invalidateQueries({ queryKey: ['goal-cycle', cycleId] })
      qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotResubmit')),
  })

  const addGoalDirectMut = useMutation({
    mutationFn: (values) => api.addGoal(cycleId, values),
    onSuccess: () => {
      message.success(t('swot.goalAdded'))
      setAddGoalOpen(false)
      addGoalForm.resetFields()
      qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotAddGoal')),
  })

  const updateGoalMut = useMutation({
    mutationFn: ({ goalId, values }) => api.updateGoal(cycleId, goalId, values),
    onSuccess: () => {
      message.success(t('goalSetting.goalUpdated'))
      setEditingGoalId(null)
      qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.couldNotUpdateGoal')),
  })

  const deleteGoalMut = useMutation({
    mutationFn: (goalId) => api.deleteGoal(cycleId, goalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] }),
  })

  const employeeOptions = teamMembers.map((emp) => ({ value: emp.id, label: `${emp.fname} ${emp.lname}` }))
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.categoryName }))
  const isDraft = cycle?.state === 'DRAFT'
  const isEmployeeSubmitted = cycle?.state === 'EMPLOYEE_SUBMITTED'
  const allSuggestionsReviewed = suggestions.length > 0 && suggestions.every((s) => (drafts[s.id]?.actionType ?? s.leaderActionType))

  // Batch version of the single-employee reuse check above -- runs it across every direct report
  // at once instead of one at a time.
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchForm] = Form.useForm()
  const [batchResults, setBatchResults] = useState(null)

  const batchMut = useMutation({
    mutationFn: ({ targetAcademicYearId, sourceAcademicYearId }) => api.batchUseNextCycleGoals(targetAcademicYearId, sourceAcademicYearId),
    onSuccess: (results) => {
      setBatchResults(results)
      qc.invalidateQueries({ queryKey: ['goal-cycle'] })
      const deployedCount = results.filter((r) => r.status === 'DEPLOYED').length
      message.success(t('goalSetting.batchCheckComplete', { count: deployedCount }))
    },
    onError: (err) => message.error(err.response?.data?.message || t('goalSetting.batchCheckFailed')),
  })

  const closeBatchModal = () => {
    setBatchModalOpen(false)
    setBatchResults(null)
    batchForm.resetFields()
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>{t('goalSetting.title')}</h1>
        <Paragraph type="secondary">
          {t('goalSetting.intro')}
        </Paragraph>

        <Form layout="inline" style={{ marginBottom: 24 }}>
          <Form.Item label={academicYearLabel}>
            <Select style={{ width: 200 }} placeholder={t('goalReview.selectYearPlaceholder')} value={academicYear} onChange={(v) => { setAcademicYear(v); setCycleId(null) }}
              loading={yearsLoading} options={academicYears.map((y) => ({ value: y.id, label: y.name }))} />
          </Form.Item>
          <Form.Item label={t('goalSetting.employeeLabel')}>
            <Select style={{ width: 250 }} placeholder={t('goalSetting.selectDirectReportPlaceholder')} value={selectedEmployee}
              onChange={(v) => { setSelectedEmployee(v); setCycleId(null) }}
              showSearch filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
              loading={teamLoading} options={employeeOptions}
              notFoundContent={<Empty description={t('goalSetting.noDirectReportsFound')} image={Empty.PRESENTED_IMAGE_SIMPLE} />} />
          </Form.Item>
        </Form>

        <Button style={{ marginBottom: 24 }} onClick={() => setBatchModalOpen(true)}>
          {t('goalSetting.batchCheckButton')}
        </Button>

        {!cycleId && (openCycleMut.isPending ? <Spin /> : <Empty description={t('goalSetting.selectYearAndEmployee', { yearLabel: academicYearLabel.toLowerCase() })} />)}

        {cycle && (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Text strong>{cycle.employeeName}</Text>
              <Tag color={STATE_COLORS[cycle.state]}>{cycle.state}</Tag>
            </Space>

            {isDraft && (
              <Card size="small" title={t('evalDisplay.strengthsAndAreasForImprovement')} style={{ marginBottom: 16 }}>
                <Form form={notesForm} layout="vertical" initialValues={{ leaderStrengths: cycle.leaderStrengths, leaderWeaknesses: cycle.leaderWeaknesses }}>
                  <Form.Item label={t('evalDisplay.strengths')} name="leaderStrengths"
                    extra={t('goalSetting.savedAutomaticallyPrivateHint')}>
                    <Input.TextArea rows={2} placeholder={t('evalDisplay.noteStrengthsPlaceholder')}
                      onBlur={() => saveNotesMut.mutate(notesForm.getFieldsValue())} />
                  </Form.Item>
                  <Form.Item label={t('evalDisplay.areasForImprovement')} name="leaderWeaknesses"
                    extra={t('goalSetting.savedAutomaticallyPrivateHint')}>
                    <Input.TextArea rows={2} placeholder={t('evalDisplay.noteAreasPlaceholder')}
                      onBlur={() => saveNotesMut.mutate(notesForm.getFieldsValue())} />
                  </Form.Item>
                  {!generating && !cycle.generationFailureReason && (
                    <Button icon={<BulbOutlined />} loading={generateMut.isPending} onClick={() => generateMut.mutate()}>
                      {t('evalDisplay.generateAiSuggestions')}
                    </Button>
                  )}
                </Form>

                {(generating || cycle.generationFailureReason) && (
                  <div style={{ marginTop: 12 }}>
                    {cycle.generationFailureReason ? (
                      <Alert type="error" showIcon style={{ marginBottom: 8 }}
                        message={t('evalDisplay.aiGenerationFailed')} description={cycle.generationFailureReason} />
                    ) : (
                      <div style={{ color: '#6b7280', marginBottom: 8 }}>
                        {t('evalDisplay.generatingGoalsBackgroundHint')}
                        {cycle.generationRequestedAt && (() => {
                          const elapsed = formatElapsed(cycle.generationRequestedAt)
                          return (
                            <>
                              {' '}{t('swot.submittedAt', { time: new Date(cycle.generationRequestedAt).toLocaleTimeString() })}
                              {' — '}{elapsed.m > 0 ? t('swot.elapsedMinSec', elapsed) : t('swot.elapsedSec', elapsed)}
                            </>
                          )
                        })()}
                      </div>
                    )}
                    <Button loading={generateMut.isPending} onClick={() => generateMut.mutate()}>
                      {cycle.generationFailureReason ? t('swot.retryGeneration') : t('swot.cancelRetryGeneration')}
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {isDraft && (
              <>
                {suggestionsLoading ? <Spin /> : suggestions.length === 0 ? (
                  <Empty description={t('goalSetting.noGoalsYet')} />
                ) : (
                  suggestions.map((s) => {
                    const draft = drafts[s.id] || { actionType: s.leaderActionType, editedTitle: s.editedTitle, editedDescription: s.editedDescription }
                    return (
                      <Card key={s.id} size="small" style={{ marginBottom: 12 }}
                        title={<>{s.suggestedTitle} <Tag>{s.categoryName}</Tag></>}
                        extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => deleteSuggestionMut.mutate(s.id)} />}>
                        <Paragraph type="secondary" style={{ marginBottom: 4 }}>{s.suggestedDescription}</Paragraph>
                        {s.rationale && <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>{t('evalDisplay.rationaleLabel', { rationale: s.rationale })}</Paragraph>}
                        <ReviewControl targetType="SUGGESTION" targetId={s.id} defaultTitle={s.suggestedTitle}
                          defaultDescription={s.suggestedDescription} draft={draft} onSave={handleSaveSuggestionReview}
                          alternativeLabelKey="goalSetting.editAboveInstead" />
                        <SuggestionRubricEditor suggestion={s} onSave={(payload) => handleSaveSuggestionRubric(s.id, payload)} />
                      </Card>
                    )
                  })
                )}

                <Button type="dashed" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => setAddGoalOpen(true)}>
                  {t('evalDisplay.addNewGoal')}
                </Button>

                <div>
                  <Popconfirm title={t('goalSetting.submitForReviewConfirmTitle')} onConfirm={() => submitForReviewMut.mutate()}>
                    <Button type="primary" icon={<SendOutlined />} disabled={!allSuggestionsReviewed} loading={submitForReviewMut.isPending}>
                      {t('goalSetting.submitForEmployeeReviewButton')}
                    </Button>
                  </Popconfirm>
                  {!allSuggestionsReviewed && suggestions.length > 0 && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{t('goalSetting.reviewEveryGoalBeforeSubmit')}</Text>
                  )}
                </div>
              </>
            )}

            {(cycle.state === 'LEADER_SUBMITTED' || cycle.state === 'EMPLOYEE_REVIEW' || cycle.state === 'DEPLOYED') && (
              <>
                <TableTotal count={goals.length} />
                <Table
                  dataSource={goals}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: t('common.goal'), dataIndex: 'goalTitle', key: 'goalTitle', sorter: (a, b) => compareStrings(a.goalTitle, b.goalTitle) },
                    { title: t('achievementLog.colCategory'), dataIndex: 'categoryName', key: 'categoryName' },
                    { title: t('common.description'), dataIndex: 'description', key: 'description', ellipsis: true },
                    {
                      title: t('goalSetting.rubricColLabel'), key: 'rubric',
                      render: (_, g) => <RubricPopover criteria={{
                        criteriaName: t('evalDisplay.viewButton'),
                        rubricUnsatisfactory: g.rubricUnsatisfactory,
                        rubricMeetsExpectations: g.rubricMeetsExpectations,
                        rubricExceedsExpectations: g.rubricExceedsExpectations,
                      }} />,
                    },
                    {
                      title: t('goalSetting.employeeReviewColLabel'), key: 'employeeActionType',
                      render: (_, g) => g.employeeActionType ? <Tag color="blue">{g.employeeActionType}</Tag> : <Tag>{t('goalSetting.pendingTag')}</Tag>,
                    },
                  ]}
                />
              </>
            )}

            {isEmployeeSubmitted && (
              <>
                <Alert type="info" showIcon style={{ marginBottom: 16 }}
                  message={t('goalSetting.employeeSentBackTitle')}
                  description={t('goalSetting.employeeSentBackDescription')} />
                <TableTotal count={goals.length} />
                <Table
                  dataSource={goals}
                  rowKey="id"
                  pagination={false}
                  style={{ marginBottom: 16 }}
                  columns={[
                    { title: t('common.goal'), dataIndex: 'goalTitle', key: 'goalTitle', sorter: (a, b) => compareStrings(a.goalTitle, b.goalTitle) },
                    { title: t('achievementLog.colCategory'), dataIndex: 'categoryName', key: 'categoryName' },
                    {
                      title: t('goalSetting.rubricColLabel'), key: 'rubric',
                      render: (_, g) => <RubricPopover criteria={{
                        criteriaName: t('evalDisplay.viewButton'),
                        rubricUnsatisfactory: g.rubricUnsatisfactory,
                        rubricMeetsExpectations: g.rubricMeetsExpectations,
                        rubricExceedsExpectations: g.rubricExceedsExpectations,
                      }} />,
                    },
                    {
                      title: t('goalSetting.employeeFeedbackColLabel'), key: 'feedback',
                      render: (_, g) => g.employeeEditedTitle || g.employeeEditedDescription ? (
                        <div>
                          {g.employeeEditedTitle && <div><Text strong>{g.employeeEditedTitle}</Text></div>}
                          {g.employeeEditedDescription && <Text type="secondary">{g.employeeEditedDescription}</Text>}
                        </div>
                      ) : <Text type="secondary">{t('goalSetting.noEditsSuggested')}</Text>,
                    },
                    {
                      title: t('common.actions'), key: 'actions',
                      render: (_, g) => (
                        <Space>
                          <Button size="small" onClick={() => {
                            setEditingGoalId(g.id)
                            editGoalForm.setFieldsValue({
                              goalTitle: g.goalTitle, description: g.description,
                              rubricUnsatisfactory: g.rubricUnsatisfactory,
                              rubricMeetsExpectations: g.rubricMeetsExpectations,
                              rubricExceedsExpectations: g.rubricExceedsExpectations,
                            })
                          }}>{t('goalSetting.editButton')}</Button>
                          <Popconfirm title={t('goalSetting.removeGoalConfirmTitle')} onConfirm={() => deleteGoalMut.mutate(g.id)}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
                <Space>
                  <Button icon={<PlusOutlined />} onClick={() => setAddGoalOpen(true)}>{t('goalSetting.addAGoalButton')}</Button>
                  <Button type="primary" icon={<SendOutlined />} loading={resubmitMut.isPending} onClick={() => resubmitMut.mutate()}>
                    {t('goalSetting.resubmitButton')}
                  </Button>
                </Space>
              </>
            )}
          </>
        )}
      </Card>

      <Modal
        title={t('goalSetting.reuseModalTitle')}
        open={reuseModalOpen}
        onCancel={() => setReuseDismissed(true)}
        footer={[
          <Button key="not-now" onClick={() => setReuseDismissed(true)}>{t('goalSetting.notNowButton')}</Button>,
          <Button key="use" type="primary" disabled={selectedReuseIds.length === 0}
            loading={useReuseGoalsMut.isPending} onClick={() => useReuseGoalsMut.mutate()}>
            {t('goalSetting.useSelectedGoalsButton')}
          </Button>,
        ]}
      >
        <Paragraph type="secondary">
          {t('goalSetting.reuseModalIntro')}
        </Paragraph>
        {reusableGroups.map((group) => (
          <div key={group.evaluationId} style={{ marginBottom: 16 }}>
            <Text strong>{t('goalSetting.fromEvaluationLabel', { yearName: group.academicYearName })}</Text>
            <div style={{ marginTop: 8 }}>
              {group.goals.map((g) => (
                <Card key={g.id} size="small" style={{ marginBottom: 8 }}>
                  <Checkbox
                    checked={selectedReuseIds.includes(g.id)}
                    onChange={(e) => setSelectedReuseIds((prev) => e.target.checked
                      ? [...prev, g.id] : prev.filter((id) => id !== g.id))}
                  >
                    <Text strong>{g.title}</Text> <Tag>{g.categoryName}</Tag>
                  </Checkbox>
                  {g.description && <Paragraph type="secondary" style={{ marginLeft: 24, marginBottom: 0 }}>{g.description}</Paragraph>}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </Modal>

      <Modal
        title={t('goalSetting.batchCheckButton')}
        open={batchModalOpen}
        onCancel={closeBatchModal}
        destroyOnClose
        footer={batchResults ? [
          <Button key="close" onClick={closeBatchModal}>{t('evalDisplay.closeButton')}</Button>,
        ] : [
          <Button key="cancel" onClick={closeBatchModal}>{t('common.cancel')}</Button>,
          <Button key="run" type="primary" loading={batchMut.isPending} onClick={() => batchForm.submit()}>{t('goalSetting.runCheckButton')}</Button>,
        ]}
      >
        {!batchResults ? (
          <Form form={batchForm} layout="vertical" onFinish={(values) => batchMut.mutate(values)}>
            <Paragraph type="secondary">
              {t('goalSetting.batchCheckIntro')}
            </Paragraph>
            <Form.Item label={t('goalSetting.setGoalsForYearLabel', { yearLabel: academicYearLabel.toLowerCase() })} name="targetAcademicYearId" rules={[{ required: true }]}>
              <Select placeholder={t('goalSetting.yearWithNoGoalsPlaceholder')} options={academicYears.map((y) => ({ value: y.id, label: y.name }))} />
            </Form.Item>
            <Form.Item label={t('goalSetting.checkConcludedEvalsFromYearLabel', { yearLabel: academicYearLabel.toLowerCase() })} name="sourceAcademicYearId" rules={[{ required: true }]}>
              <Select placeholder={t('goalSetting.yearToCheckPlaceholder')} options={academicYears.map((y) => ({ value: y.id, label: y.name }))} />
            </Form.Item>
          </Form>
        ) : (
          <Table
            dataSource={batchResults}
            rowKey="employeeId"
            pagination={false}
            size="small"
            columns={[
              { title: t('goalSetting.employeeLabel'), dataIndex: 'employeeName', key: 'employeeName' },
              {
                title: t('goalSetting.resultColLabel'), key: 'status',
                render: (_, r) => {
                  if (r.status === 'DEPLOYED') {
                    return <Tag color="green">{t('goalSetting.deployedGoalsCount', { count: r.goalsDeployed })}</Tag>
                  }
                  if (r.status === 'ALREADY_HAS_GOALS') {
                    return <Tag>{t('goalSetting.alreadyHasGoalsForYear')}</Tag>
                  }
                  return <Tag>{t('goalSetting.noEligibleGoalsFound')}</Tag>
                },
              },
            ]}
          />
        )}
      </Modal>

      <Modal title={t('evalDisplay.addNewGoal')} open={addGoalOpen} onCancel={() => setAddGoalOpen(false)} destroyOnClose
        onOk={() => addGoalForm.submit()} confirmLoading={addSuggestionMut.isPending || addGoalDirectMut.isPending}>
        <Form form={addGoalForm} layout="vertical"
          onFinish={(values) => (isEmployeeSubmitted ? addGoalDirectMut.mutate(values) : addSuggestionMut.mutate(values))}>
          <Form.Item label={t('evalDisplay.categoryLabel')} name="categoryId" rules={[{ required: true }]}>
            <Select options={categoryOptions} placeholder={t('achievementModal.selectCategoryPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('evalDisplay.goalTitleFieldLabel')} name={isEmployeeSubmitted ? 'goalTitle' : 'title'} rules={[{ required: true }]}>
            <Input placeholder={t('evalDisplay.goalTitleExamplePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('common.description')} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label={t('evalDisplay.rubricUnsatisfactoryFieldLabel')} name="rubricUnsatisfactory" rules={[{ required: true }]}
            extra={t('goalSetting.rubricUnsatisfactoryHint')}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label={t('evalDisplay.rubricMeetsFieldLabel')} name="rubricMeetsExpectations" rules={[{ required: true }]}
            extra={t('goalSetting.rubricMeetsHint')}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label={t('evalDisplay.rubricExceedsFieldLabel')} name="rubricExceedsExpectations" rules={[{ required: true }]}
            extra={t('goalSetting.rubricExceedsHint')}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('goalSetting.editGoalTitle')} open={!!editingGoalId} onCancel={() => setEditingGoalId(null)} destroyOnClose
        onOk={() => editGoalForm.submit()} confirmLoading={updateGoalMut.isPending}>
        <Form form={editGoalForm} layout="vertical"
          onFinish={(values) => updateGoalMut.mutate({ goalId: editingGoalId, values })}>
          <Form.Item label={t('evalDisplay.goalTitleFieldLabel')} name="goalTitle" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('common.description')} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label={t('evalDisplay.rubricUnsatisfactoryFieldLabel')} name="rubricUnsatisfactory" rules={[{ required: true }]}
            extra={t('goalSetting.rubricUnsatisfactoryHint')}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label={t('evalDisplay.rubricMeetsFieldLabel')} name="rubricMeetsExpectations" rules={[{ required: true }]}
            extra={t('goalSetting.rubricMeetsHint')}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label={t('evalDisplay.rubricExceedsFieldLabel')} name="rubricExceedsExpectations" rules={[{ required: true }]}
            extra={t('goalSetting.rubricExceedsHint')}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
