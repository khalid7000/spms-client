import { useState, useEffect } from 'react'
import { Card, Form, Button, Input, Select, Table, Modal, Space, Tag, message, Empty, Spin, Alert, Divider, Typography, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, BulbOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/portfolio'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import ReviewControl from '../../components/ReviewControl'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { RubricPopover } from './evaluationDisplay'

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
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// Inline 3-level rubric editor for an AI-drafted (or leader-authored) suggestion card -- saves all
// 3 fields together on blur, same pattern as evaluationDisplay.jsx's CommentsInput.
function SuggestionRubricEditor({ suggestion, onSave }) {
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
        3-Level Rubric (required before submitting)
      </Text>
      <Input.TextArea rows={2} value={u} placeholder="Unsatisfactory"
        onChange={(ev) => setU(ev.target.value)} onBlur={save} style={{ marginBottom: 4 }} />
      <Input.TextArea rows={2} value={m} placeholder="Meets Expectations"
        onChange={(ev) => setM(ev.target.value)} onBlur={save} style={{ marginBottom: 4 }} />
      <Input.TextArea rows={2} value={e} placeholder="Exceeds Expectations"
        onChange={(ev) => setE(ev.target.value)} onBlur={save} />
    </div>
  )
}

export default function GoalSettingPage() {
  const [academicYear, setAcademicYear] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [cycleId, setCycleId] = useState(null)
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
    onError: (err) => message.error(err.response?.data?.message || 'Could not open goal cycle'),
  })

  // Opening the cycle is a no-op once one already exists for this employee/year (createOrGetCycle
  // just returns it), so there's no reason to make the head click a separate button for it --
  // picking both fields is enough.
  useEffect(() => {
    if (academicYear && selectedEmployee && !cycleId && !openCycleMut.isPending) {
      openCycleMut.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear, selectedEmployee, cycleId])

  const [notesForm] = Form.useForm()

  // Auto-saves on blur (no submit button) -- see the Form below.
  const saveNotesMut = useMutation({
    mutationFn: (values) => api.updateCycleNotes(cycleId, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal-cycle', cycleId] }),
    onError: (err) => message.error(err.response?.data?.message || 'Could not save notes'),
  })

  const generateMut = useMutation({
    mutationFn: () => api.generateSuggestions(cycleId),
    onSuccess: () => {
      message.success('Generation started — this can take a minute or two')
      qc.invalidateQueries({ queryKey: ['goal-cycle', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not start generation — try again'),
  })

  const reviewSuggestionMut = useMutation({
    mutationFn: ({ suggestionId, payload }) => api.reviewSuggestion(cycleId, suggestionId, payload),
    onError: (err) => message.error(err.response?.data?.message || 'Could not save review'),
  })

  const handleSaveSuggestionReview = (_targetType, suggestionId, payload) => {
    setDrafts((prev) => ({ ...prev, [suggestionId]: payload }))
    reviewSuggestionMut.mutate({ suggestionId, payload })
  }

  const updateSuggestionRubricMut = useMutation({
    mutationFn: ({ suggestionId, payload }) => api.updateSuggestionRubric(cycleId, suggestionId, payload),
    onError: (err) => message.error(err.response?.data?.message || 'Could not save rubric'),
  })

  const handleSaveSuggestionRubric = (suggestionId, payload) => {
    updateSuggestionRubricMut.mutate({ suggestionId, payload })
  }

  const addSuggestionMut = useMutation({
    mutationFn: (values) => api.addSuggestion(cycleId, values),
    onSuccess: () => {
      message.success('Goal added')
      setAddGoalOpen(false)
      addGoalForm.resetFields()
      qc.invalidateQueries({ queryKey: ['goal-suggestions', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not add goal'),
  })

  const deleteSuggestionMut = useMutation({
    mutationFn: (suggestionId) => api.deleteSuggestion(cycleId, suggestionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal-suggestions', cycleId] }),
  })

  const submitForReviewMut = useMutation({
    mutationFn: () => api.submitCycleForReview(cycleId),
    onSuccess: () => {
      message.success('Submitted for employee review')
      qc.invalidateQueries({ queryKey: ['goal-cycle', cycleId] })
      qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not submit for review'),
  })

  const resubmitMut = useMutation({
    mutationFn: () => api.resubmitCycleForReview(cycleId),
    onSuccess: () => {
      message.success('Resubmitted for employee review')
      qc.invalidateQueries({ queryKey: ['goal-cycle', cycleId] })
      qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not resubmit'),
  })

  const addGoalDirectMut = useMutation({
    mutationFn: (values) => api.addGoal(cycleId, values),
    onSuccess: () => {
      message.success('Goal added')
      setAddGoalOpen(false)
      addGoalForm.resetFields()
      qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not add goal'),
  })

  const updateGoalMut = useMutation({
    mutationFn: ({ goalId, values }) => api.updateGoal(cycleId, goalId, values),
    onSuccess: () => {
      message.success('Goal updated')
      setEditingGoalId(null)
      qc.invalidateQueries({ queryKey: ['goal-cycle-goals', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not update goal'),
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

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>Team Goal Setting</h1>
        <Paragraph type="secondary">
          Set annual improvement goals for a direct report. Enter your notes on their strengths and areas for
          improvement, generate AI-assisted suggestions, then review each one before submitting for the employee's review.
        </Paragraph>

        <Form layout="inline" style={{ marginBottom: 24 }}>
          <Form.Item label="Academic Year">
            <Select style={{ width: 200 }} placeholder="Select year" value={academicYear} onChange={(v) => { setAcademicYear(v); setCycleId(null) }}
              loading={yearsLoading} options={academicYears.map((y) => ({ value: y.id, label: y.name }))} />
          </Form.Item>
          <Form.Item label="Employee">
            <Select style={{ width: 250 }} placeholder="Select a direct report" value={selectedEmployee}
              onChange={(v) => { setSelectedEmployee(v); setCycleId(null) }}
              showSearch filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
              loading={teamLoading} options={employeeOptions}
              notFoundContent={<Empty description="No direct reports found -- you must head a department to set goals" image={Empty.PRESENTED_IMAGE_SIMPLE} />} />
          </Form.Item>
        </Form>

        {!cycleId && (openCycleMut.isPending ? <Spin /> : <Empty description="Select an academic year and employee to view their goals" />)}

        {cycle && (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Text strong>{cycle.employeeName}</Text>
              <Tag color={STATE_COLORS[cycle.state]}>{cycle.state}</Tag>
            </Space>

            {isDraft && (
              <Card size="small" title="Strengths & Areas for Improvement" style={{ marginBottom: 16 }}>
                <Form form={notesForm} layout="vertical" initialValues={{ leaderStrengths: cycle.leaderStrengths, leaderWeaknesses: cycle.leaderWeaknesses }}>
                  <Form.Item label="Strengths" name="leaderStrengths"
                    extra="Saved automatically. Private to you -- never shown to the employee or anyone else.">
                    <Input.TextArea rows={2} placeholder="Note strengths to build upon"
                      onBlur={() => saveNotesMut.mutate(notesForm.getFieldsValue())} />
                  </Form.Item>
                  <Form.Item label="Areas for Improvement" name="leaderWeaknesses"
                    extra="Saved automatically. Private to you -- never shown to the employee or anyone else.">
                    <Input.TextArea rows={2} placeholder="Note areas where the employee can grow (AI will suggest goals from this)"
                      onBlur={() => saveNotesMut.mutate(notesForm.getFieldsValue())} />
                  </Form.Item>
                  {!generating && !cycle.generationFailureReason && (
                    <Button icon={<BulbOutlined />} loading={generateMut.isPending} onClick={() => generateMut.mutate()}>
                      Generate AI Suggestions
                    </Button>
                  )}
                </Form>

                {(generating || cycle.generationFailureReason) && (
                  <div style={{ marginTop: 12 }}>
                    {cycle.generationFailureReason ? (
                      <Alert type="error" showIcon style={{ marginBottom: 8 }}
                        message="AI generation failed" description={cycle.generationFailureReason} />
                    ) : (
                      <div style={{ color: '#6b7280', marginBottom: 8 }}>
                        AI is generating suggested goals in the background. This page checks automatically
                        and will show them once ready.
                        {cycle.generationRequestedAt && (
                          <>
                            {' '}Submitted at {new Date(cycle.generationRequestedAt).toLocaleTimeString()}
                            {' — '}{formatElapsed(cycle.generationRequestedAt)} elapsed.
                          </>
                        )}
                      </div>
                    )}
                    <Button loading={generateMut.isPending} onClick={() => generateMut.mutate()}>
                      {cycle.generationFailureReason ? 'Retry Generation' : 'Cancel & Retry Generation'}
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {isDraft && (
              <>
                {suggestionsLoading ? <Spin /> : suggestions.length === 0 ? (
                  <Empty description="No goals yet — generate AI suggestions or add one manually" />
                ) : (
                  suggestions.map((s) => {
                    const draft = drafts[s.id] || { actionType: s.leaderActionType, editedTitle: s.editedTitle, editedDescription: s.editedDescription }
                    return (
                      <Card key={s.id} size="small" style={{ marginBottom: 12 }}
                        title={<>{s.suggestedTitle} <Tag>{s.categoryName}</Tag></>}
                        extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => deleteSuggestionMut.mutate(s.id)} />}>
                        <Paragraph type="secondary" style={{ marginBottom: 4 }}>{s.suggestedDescription}</Paragraph>
                        {s.rationale && <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>Rationale: {s.rationale}</Paragraph>}
                        <ReviewControl targetType="SUGGESTION" targetId={s.id} defaultTitle={s.suggestedTitle}
                          defaultDescription={s.suggestedDescription} draft={draft} onSave={handleSaveSuggestionReview}
                          alternativeLabel="Edit the title/description above with your own goal instead." />
                        <SuggestionRubricEditor suggestion={s} onSave={(payload) => handleSaveSuggestionRubric(s.id, payload)} />
                      </Card>
                    )
                  })
                )}

                <Button type="dashed" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => setAddGoalOpen(true)}>
                  Add a New Goal
                </Button>

                <div>
                  <Popconfirm title="Submit for employee review?" onConfirm={() => submitForReviewMut.mutate()}>
                    <Button type="primary" icon={<SendOutlined />} disabled={!allSuggestionsReviewed} loading={submitForReviewMut.isPending}>
                      Submit for Employee Review
                    </Button>
                  </Popconfirm>
                  {!allSuggestionsReviewed && suggestions.length > 0 && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>Review every goal above before submitting</Text>
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
                    { title: 'Goal', dataIndex: 'goalTitle', key: 'goalTitle', sorter: (a, b) => compareStrings(a.goalTitle, b.goalTitle) },
                    { title: 'Category', dataIndex: 'categoryName', key: 'categoryName' },
                    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
                    {
                      title: 'Rubric', key: 'rubric',
                      render: (_, g) => <RubricPopover criteria={{
                        criteriaName: 'View',
                        rubricUnsatisfactory: g.rubricUnsatisfactory,
                        rubricMeetsExpectations: g.rubricMeetsExpectations,
                        rubricExceedsExpectations: g.rubricExceedsExpectations,
                      }} />,
                    },
                    {
                      title: 'Employee Review', key: 'employeeActionType',
                      render: (_, g) => g.employeeActionType ? <Tag color="blue">{g.employeeActionType}</Tag> : <Tag>Pending</Tag>,
                    },
                  ]}
                />
              </>
            )}

            {isEmployeeSubmitted && (
              <>
                <Alert type="info" showIcon style={{ marginBottom: 16 }}
                  message="The employee sent these goals back for more consideration"
                  description="Edit, add, or remove goals below based on their feedback, then resubmit." />
                <TableTotal count={goals.length} />
                <Table
                  dataSource={goals}
                  rowKey="id"
                  pagination={false}
                  style={{ marginBottom: 16 }}
                  columns={[
                    { title: 'Goal', dataIndex: 'goalTitle', key: 'goalTitle', sorter: (a, b) => compareStrings(a.goalTitle, b.goalTitle) },
                    { title: 'Category', dataIndex: 'categoryName', key: 'categoryName' },
                    {
                      title: 'Rubric', key: 'rubric',
                      render: (_, g) => <RubricPopover criteria={{
                        criteriaName: 'View',
                        rubricUnsatisfactory: g.rubricUnsatisfactory,
                        rubricMeetsExpectations: g.rubricMeetsExpectations,
                        rubricExceedsExpectations: g.rubricExceedsExpectations,
                      }} />,
                    },
                    {
                      title: "Employee's Feedback", key: 'feedback',
                      render: (_, g) => g.employeeEditedTitle || g.employeeEditedDescription ? (
                        <div>
                          {g.employeeEditedTitle && <div><Text strong>{g.employeeEditedTitle}</Text></div>}
                          {g.employeeEditedDescription && <Text type="secondary">{g.employeeEditedDescription}</Text>}
                        </div>
                      ) : <Text type="secondary">No edits suggested</Text>,
                    },
                    {
                      title: 'Actions', key: 'actions',
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
                          }}>Edit</Button>
                          <Popconfirm title="Remove this goal?" onConfirm={() => deleteGoalMut.mutate(g.id)}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
                <Space>
                  <Button icon={<PlusOutlined />} onClick={() => setAddGoalOpen(true)}>Add a Goal</Button>
                  <Button type="primary" icon={<SendOutlined />} loading={resubmitMut.isPending} onClick={() => resubmitMut.mutate()}>
                    Resubmit for Employee Review
                  </Button>
                </Space>
              </>
            )}
          </>
        )}
      </Card>

      <Modal title="Add a New Goal" open={addGoalOpen} onCancel={() => setAddGoalOpen(false)} destroyOnClose
        onOk={() => addGoalForm.submit()} confirmLoading={addSuggestionMut.isPending || addGoalDirectMut.isPending}>
        <Form form={addGoalForm} layout="vertical"
          onFinish={(values) => (isEmployeeSubmitted ? addGoalDirectMut.mutate(values) : addSuggestionMut.mutate(values))}>
          <Form.Item label="Category" name="categoryId" rules={[{ required: true }]}>
            <Select options={categoryOptions} placeholder="Select category" />
          </Form.Item>
          <Form.Item label="Goal Title" name={isEmployeeSubmitted ? 'goalTitle' : 'title'} rules={[{ required: true }]}>
            <Input placeholder="e.g., Develop advanced statistical analysis skills" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label="Rubric — Unsatisfactory (1)" name="rubricUnsatisfactory" rules={[{ required: true }]}
            extra="What the head should see to rate this goal as Unsatisfactory"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label="Rubric — Meets Expectations (3)" name="rubricMeetsExpectations" rules={[{ required: true }]}
            extra="What the head should see to rate this goal as Meets Expectations"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label="Rubric — Exceeds Expectations (5)" name="rubricExceedsExpectations" rules={[{ required: true }]}
            extra="What the head should see to rate this goal as Exceeds Expectations"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Edit Goal" open={!!editingGoalId} onCancel={() => setEditingGoalId(null)} destroyOnClose
        onOk={() => editGoalForm.submit()} confirmLoading={updateGoalMut.isPending}>
        <Form form={editGoalForm} layout="vertical"
          onFinish={(values) => updateGoalMut.mutate({ goalId: editingGoalId, values })}>
          <Form.Item label="Goal Title" name="goalTitle" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label="Rubric — Unsatisfactory (1)" name="rubricUnsatisfactory" rules={[{ required: true }]}
            extra="What the head should see to rate this goal as Unsatisfactory"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label="Rubric — Meets Expectations (3)" name="rubricMeetsExpectations" rules={[{ required: true }]}
            extra="What the head should see to rate this goal as Meets Expectations"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label="Rubric — Exceeds Expectations (5)" name="rubricExceedsExpectations" rules={[{ required: true }]}
            extra="What the head should see to rate this goal as Exceeds Expectations"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
