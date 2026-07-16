// Head-facing Annual Evaluation view: pick a direct report's evaluation for an academic year,
// rate every criterion and category plus an overall rank, then either Sign and Submit in one
// action (goes to the employee for signature/refusal) or Return to Employee for Review and
// Update first for one extra round of edits/comments before doing so.
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Select, Table, Tag, Button, message, Descriptions, Alert, Empty, Space, Typography, Modal, Form, Input, Popconfirm } from 'antd'
import { CheckCircleOutlined, UndoOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import { getRankLabels } from '../../api/portfolio'
import {
  getTeamEvaluations, getEvaluation, updateCriteriaRank, updateCategoryHeadRank, updateCategoryHeadComments,
  updateGoalHeadRank, updateGoalsHeadComments, updateGoalsHeadRank, updateOverallRank,
  submitAndSignHeadEvaluation, returnToEmployeeForReview,
  getNextCycleGoals,
} from '../../api/annualEvaluations'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'
import {
  STATE_COLORS, orderedCategoryResults, categoryColor, UNLINKED_COLOR,
  AchievementList, rankLabelText, RubricPopover, GoalsSection, HeadCommentsBlock, EmployeeReflectionBlock, RatingAssistantModal,
  NextCycleGoalsSection, EvaluationScoreSummary, CriteriaInfoToolButton,
} from './evaluationDisplay'
import { useTerminology } from '../../TerminologyContext'

const { Paragraph, Text } = Typography

const TABLE_PREFS_KEY = 'spms.teamEvaluationsTable.prefs'

export default function TeamEvaluationsPage() {
  const { academicYearLabel } = useTerminology()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [academicYearId, setAcademicYearId] = useState(null)
  // Seeded from ?evaluationId= when arriving via a "head" notification (e.g. an employee just
  // submitted their self-assessment) -- opens that evaluation directly instead of the team list.
  const [evaluationId, setEvaluationId] = useState(() => {
    const fromUrl = searchParams.get('evaluationId')
    return fromUrl ? Number(fromUrl) : null
  })
  const [submitSignOpen, setSubmitSignOpen] = useState(false)
  const [signForm] = Form.useForm()
  const [assistant, setAssistant] = useState(null)
  // Set true when the head clicks Submit while something's still missing -- reddens every unset
  // field instead of just leaving the button inert. Cleared once everything's filled in, or when
  // switching to a different employee's evaluation.
  const [highlightMissing, setHighlightMissing] = useState(false)
  const { prefs, sortOrderFor, handleTableChange } = useTablePrefs(TABLE_PREFS_KEY)

  const { data: academicYears = [] } = useQuery({ queryKey: ['academic-years'], queryFn: getAcademicYears })

  // Default to the most recent year instead of leaving the selector blank.
  useEffect(() => {
    if (!academicYearId && academicYears.length > 0) {
      setAcademicYearId(getMostRecentAcademicYear(academicYears).id)
    }
  }, [academicYearId, academicYears])

  const { data: teamEvaluations = [], isLoading: teamLoading } = useQuery({
    queryKey: ['team-evaluations', academicYearId],
    queryFn: () => getTeamEvaluations(academicYearId),
    enabled: !!academicYearId,
  })

  const { data: evaluation } = useQuery({
    queryKey: ['evaluation', evaluationId],
    queryFn: () => getEvaluation(evaluationId),
    enabled: !!evaluationId,
  })

  // The employee's title's rank labels apply -- the head's 1-5 grade is expressed in that title's wording.
  const { data: rankLabels = [] } = useQuery({
    queryKey: ['rank-labels-for-eval', evaluation?.titleId],
    queryFn: () => getRankLabels(evaluation.titleId),
    enabled: !!evaluation?.titleId,
  })

  // Shares its cache key with NextCycleGoalsSection's own query -- just here to gate the submit button.
  const { data: nextCycleGoals = [] } = useQuery({
    queryKey: ['next-cycle-goals', evaluationId],
    queryFn: () => getNextCycleGoals(evaluationId),
    enabled: !!evaluationId,
  })

  // Live, in-memory drafts of the category/goals comments -- updated on every keystroke (not just
  // on blur-save), purely so NextCycleGoalsSection can mirror them into its own notes fields as the
  // head types, without waiting for a network round-trip. Reset whenever the evaluation changes.
  const [draftCategoryComments, setDraftCategoryComments] = useState({})
  const [draftGoalsComments, setDraftGoalsComments] = useState({ strengths: null, improvements: null })
  useEffect(() => {
    setDraftCategoryComments({})
    setDraftGoalsComments({ strengths: null, improvements: null })
    setHighlightMissing(false)
  }, [evaluationId])

  const liveEvaluation = useMemo(() => {
    if (!evaluation) return evaluation
    return {
      ...evaluation,
      categoryResults: (evaluation.categoryResults ?? []).map((c) => ({
        ...c,
        headCommentsStrengths: draftCategoryComments[c.categoryId]?.strengths ?? c.headCommentsStrengths,
        headCommentsImprovements: draftCategoryComments[c.categoryId]?.improvements ?? c.headCommentsImprovements,
      })),
      goalsHeadCommentsStrengths: draftGoalsComments.strengths ?? evaluation.goalsHeadCommentsStrengths,
      goalsHeadCommentsImprovements: draftGoalsComments.improvements ?? evaluation.goalsHeadCommentsImprovements,
    }
  }, [evaluation, draftCategoryComments, draftGoalsComments])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['evaluation', evaluationId] })
    qc.invalidateQueries({ queryKey: ['team-evaluations', academicYearId] })
  }

  const criteriaRankMut = useMutation({
    mutationFn: ({ criteriaId, rank }) => updateCriteriaRank(evaluationId, criteriaId, rank),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update rank'),
  })
  const categoryRankMut = useMutation({
    mutationFn: ({ categoryId, rank }) => updateCategoryHeadRank(evaluationId, categoryId, rank),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update rank'),
  })
  const categoryCommentsMut = useMutation({
    mutationFn: ({ categoryId, strengths, improvements }) => updateCategoryHeadComments(evaluationId, categoryId, strengths, improvements),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to save comments'),
  })
  const goalRankMut = useMutation({
    mutationFn: ({ goalId, rank }) => updateGoalHeadRank(evaluationId, goalId, rank),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update rank'),
  })
  const goalsCommentsMut = useMutation({
    mutationFn: ({ strengths, improvements }) => updateGoalsHeadComments(evaluationId, strengths, improvements),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to save comments'),
  })
  const goalsRankMut = useMutation({
    mutationFn: (rank) => updateGoalsHeadRank(evaluationId, rank),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update rank'),
  })
  const overallRankMut = useMutation({
    mutationFn: (rank) => updateOverallRank(evaluationId, rank),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update rank'),
  })
  const submitAndSignMut = useMutation({
    mutationFn: (signatureName) => submitAndSignHeadEvaluation(evaluationId, signatureName),
    onSuccess: () => { message.success('Evaluation signed and submitted'); setSubmitSignOpen(false); signForm.resetFields(); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to submit'),
  })
  const returnToEmployeeMut = useMutation({
    mutationFn: () => returnToEmployeeForReview(evaluationId),
    onSuccess: () => { message.success('Returned to employee for review and update'); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to return to employee'),
  })

  const canEdit = evaluation?.state === 'EMPLOYEE_SUBMITTED' && !evaluation.locked

  const missingCategoryRank = (evaluation?.categoryResults ?? []).some((c) => !c.headCategoryRank)
  const missingComments = (evaluation?.categoryResults ?? []).some((c) =>
    !c.headCommentsStrengths || !c.headCommentsStrengths.trim() || !c.headCommentsImprovements || !c.headCommentsImprovements.trim())
  const missingCriteriaRank = (evaluation?.criteriaResults ?? []).some((c) => !c.headRank)
  const missingGoalRank = (evaluation?.goalResults ?? []).some((g) => !g.headGoalRank)
  const missingGoalsHeadRank = (evaluation?.goalResults?.length ?? 0) > 0 && !evaluation?.goalsHeadRank
  const missingGoalComments = (evaluation?.goalResults?.length ?? 0) > 0
    && (!evaluation?.goalsHeadCommentsStrengths || !evaluation.goalsHeadCommentsStrengths.trim()
      || !evaluation?.goalsHeadCommentsImprovements || !evaluation.goalsHeadCommentsImprovements.trim())
  const missingOverallRank = !evaluation?.headOverallRank
  const missingNextCycleGoal = nextCycleGoals.length === 0
  const canSubmit = evaluation?.state === 'EMPLOYEE_SUBMITTED'
  const readyToSubmit = canSubmit && !missingCategoryRank && !missingComments && !missingCriteriaRank
    && !missingGoalRank && !missingGoalsHeadRank && !missingGoalComments && !missingOverallRank && !missingNextCycleGoal

  // Clears the highlight once everything's actually filled in -- no reason to keep fields red
  // after the head has addressed them.
  useEffect(() => {
    if (readyToSubmit) setHighlightMissing(false)
  }, [readyToSubmit])

  // The Sign and Submit button is never truly `disabled` -- clicking it while something's missing
  // just switches on the red highlighting below instead of silently doing nothing, so the head can
  // see exactly what's left rather than guessing. Once everything's filled in, clicking it opens
  // the name-entry modal -- typing a name there is what actually signs and submits in one action.
  const handleSubmitClick = () => {
    if (!readyToSubmit) {
      setHighlightMissing(true)
      message.warning('Complete the highlighted fields below before submitting')
      return
    }
    setSubmitSignOpen(true)
  }

  const teamColumns = [
    {
      title: 'Employee', dataIndex: 'employeeName', key: 'employeeName',
      sorter: (a, b) => compareStrings(a.employeeName, b.employeeName), sortOrder: sortOrderFor('employeeName'),
    },
    { title: 'Status', dataIndex: 'state', key: 'state', render: (s) => <Tag color={STATE_COLORS[s]}>{s}</Tag> },
    {
      title: 'Actions', key: 'actions',
      render: (_, row) => <Button size="small" onClick={() => setEvaluationId(row.id)}>Review</Button>,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>Team Annual Evaluations</h1>
        <Paragraph type="secondary">
          Rate each direct report's achievements against every criterion, give an overall category rank, then an
          overall annual performance rank. Optionally return the evaluation to the employee once for another round
          of edits before you Sign and Submit, which sends it to them for signature or refusal.
        </Paragraph>

        <Select
          style={{ width: 220, marginBottom: 24 }} placeholder={academicYearLabel} value={academicYearId}
          onChange={(v) => { setAcademicYearId(v); setEvaluationId(null) }}
          options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
        />

        {!academicYearId ? (
          <Empty description={`Select a ${academicYearLabel}`} />
        ) : !evaluationId ? (
          <Table
            dataSource={teamEvaluations} columns={teamColumns} rowKey="id" loading={teamLoading}
            locale={{ emptyText: 'No direct reports have an evaluation for this year yet' }}
            pagination={{
              current: prefs.current, pageSize: prefs.pageSize, showSizeChanger: true,
              showTotal: (total) => `Total: ${total}`,
            }}
            onChange={handleTableChange}
          />
        ) : evaluation && (
          <>
            <Button style={{ marginBottom: 16 }} onClick={() => setEvaluationId(null)}>&larr; Back to team</Button>
            <Descriptions column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Employee">{evaluation.employeeName}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATE_COLORS[evaluation.state]}>{evaluation.state}</Tag></Descriptions.Item>
            </Descriptions>

            <EvaluationScoreSummary
              evaluation={evaluation} rankLabels={rankLabels}
              onOverallRankChange={canEdit ? (v) => overallRankMut.mutate(v) : undefined}
              highlightMissing={highlightMissing}
            />

            <Card size="small" title="Evaluation Details" style={{ marginBottom: 16 }} />

            {orderedCategoryResults(evaluation.categoryResults).map((cat, idx) => {
              const color = categoryColor(idx)
              const unlinked = evaluation.entries.filter((e) => e.categoryId === cat.categoryId && !e.criteriaId)
              return (
                <Card key={cat.categoryId} type="inner" title={cat.categoryName}
                  style={{ marginBottom: 16, borderTop: `4px solid ${color.accent}` }}
                  styles={{ header: { background: color.tint } }}
                  extra={
                    <Space>
                      <span>Category rank:</span>
                      {canEdit ? (
                        <Select style={{ width: 240 }} value={cat.headCategoryRank} placeholder="Rank"
                          status={highlightMissing && !cat.headCategoryRank ? 'error' : undefined}
                          options={[1, 2, 3, 4, 5].map((r) => ({ value: r, label: rankLabelText(rankLabels, r) }))}
                          onChange={(v) => categoryRankMut.mutate({ categoryId: cat.categoryId, rank: v })} />
                      ) : (cat.headCategoryRank ? (
                        <Tag color="green">{rankLabelText(rankLabels, cat.headCategoryRank)}</Tag>
                      ) : <Tag>Not yet rated</Tag>)}
                      <Tag color="magenta">Self: {cat.employeeSelfRank ? rankLabelText(rankLabels, cat.employeeSelfRank) : '—'}</Tag>
                    </Space>
                  }
                >
                  {evaluation.criteriaResults.filter((c) => c.categoryId === cat.categoryId).map((crit) => (
                    <div key={crit.criteriaId} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eef6' }}>
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>Criterion: </Text>
                        <RubricPopover criteria={crit} />
                        {crit.employeeNothingToReport && <Tag color="gold" style={{ marginLeft: 8 }}>Employee: nothing to report</Tag>}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <Text strong style={{ display: 'block', marginBottom: 4 }}>Criterion Achievements:</Text>
                        <AchievementList
                          entries={evaluation.entries.filter((e) => e.criteriaId === crit.criteriaId)}
                          emptyText={crit.employeeNothingToReport ? 'Employee reported nothing for this criteria' : 'No achievements tagged to this criteria'}
                          color={color}
                        />
                      </div>
                      <EmployeeReflectionBlock comments={crit.employeeComments} sectionName={crit.criteriaName} color={color} />
                      {crit.infoToolAssignments?.length > 0 && (
                        <Space style={{ marginBottom: 8 }} wrap>
                          {crit.infoToolAssignments.map((a) => (
                            <CriteriaInfoToolButton
                              key={`${a.toolCode}-${a.repositorySourceType}`}
                              evaluationId={evaluationId} criteriaId={crit.criteriaId}
                              repositorySourceType={a.repositorySourceType}
                              displayName={a.displayName}
                            />
                          ))}
                        </Space>
                      )}
                      <Space align="center" style={{ width: '100%', justifyContent: 'flex-end' }}>
                        <Tag color="magenta">Self: {cat.employeeSelfRank ? rankLabelText(rankLabels, cat.employeeSelfRank) : '—'}</Tag>
                        {canEdit && (
                          <Button size="small"
                            disabled={!crit.rubricUnsatisfactory && !crit.rubricMeetsExpectations && !crit.rubricExceedsExpectations}
                            title={!crit.rubricUnsatisfactory && !crit.rubricMeetsExpectations && !crit.rubricExceedsExpectations
                              ? 'No rubric defined for this criterion' : undefined}
                            onClick={() => setAssistant({
                              targetType: 'CRITERIA', targetId: crit.criteriaId,
                              title: crit.criteriaName,
                              rubric: { unsatisfactory: crit.rubricUnsatisfactory, meets: crit.rubricMeetsExpectations, exceeds: crit.rubricExceedsExpectations },
                              entries: evaluation.entries.filter((e) => e.criteriaId === crit.criteriaId),
                              onApply: (score) => criteriaRankMut.mutate({ criteriaId: crit.criteriaId, rank: score }),
                            })}>
                            Rating Assistant
                          </Button>
                        )}
                        <span>Rank:</span>
                        {canEdit ? (
                          <Select style={{ width: 220 }} value={crit.headRank} placeholder="Rank"
                            status={highlightMissing && !crit.headRank ? 'error' : undefined}
                            options={[1, 2, 3, 4, 5].map((r) => ({ value: r, label: rankLabelText(rankLabels, r) }))}
                            onChange={(v) => criteriaRankMut.mutate({ criteriaId: crit.criteriaId, rank: v })} />
                        ) : (crit.headRank ? (
                          <Tag color="green">{rankLabelText(rankLabels, crit.headRank)}</Tag>
                        ) : <Tag>—</Tag>)}
                      </Space>
                    </div>
                  ))}
                  {unlinked.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                        <Tag color="gold" style={{ marginRight: 6 }}>Needs review</Tag>Not linked to a specific criteria
                      </Text>
                      <AchievementList entries={unlinked} emptyText="" color={UNLINKED_COLOR} />
                    </div>
                  )}
                  <EmployeeReflectionBlock comments={cat.employeeComments} sectionName={cat.categoryName} required />
                  <HeadCommentsBlock
                    strengths={cat.headCommentsStrengths}
                    improvements={cat.headCommentsImprovements}
                    onSave={canEdit ? (strengths, improvements) => categoryCommentsMut.mutate({ categoryId: cat.categoryId, strengths, improvements }) : undefined}
                    onChange={canEdit ? (strengths, improvements) => setDraftCategoryComments((prev) => ({ ...prev, [cat.categoryId]: { strengths, improvements } })) : undefined}
                    highlightMissing={highlightMissing}
                  />
                </Card>
              )
            })}

            <GoalsSection
              evaluation={evaluation} rankLabels={rankLabels} canEdit={canEdit}
              onRankChange={(goalId, rank) => goalRankMut.mutate({ goalId, rank })}
              onHeadRankChange={canEdit ? (rank) => goalsRankMut.mutate(rank) : undefined}
              onCommentsChange={canEdit ? (strengths, improvements) => goalsCommentsMut.mutate({ strengths, improvements }) : undefined}
              onCommentsLiveChange={canEdit ? (strengths, improvements) => setDraftGoalsComments({ strengths, improvements }) : undefined}
              onOpenAssistant={canEdit ? (g, goalEntries) => setAssistant({
                targetType: 'GOAL', targetId: g.goalId,
                title: g.goalTitle,
                rubric: { unsatisfactory: g.rubricUnsatisfactory, meets: g.rubricMeetsExpectations, exceeds: g.rubricExceedsExpectations },
                entries: goalEntries,
                onApply: (score) => goalRankMut.mutate({ goalId: g.goalId, rank: score }),
              }) : undefined}
              highlightMissing={highlightMissing}
            />

            <EmployeeReflectionBlock comments={evaluation.employeeFinalSummary} heading="General Final Summary Statement" required />

            <NextCycleGoalsSection
              evaluationId={evaluationId} evaluation={liveEvaluation} canHeadEdit={canEdit} canEmployeeReview={false}
              onAfterMutate={invalidate}
            />

            <RatingAssistantModal
              open={!!assistant} onClose={() => setAssistant(null)}
              evaluationId={evaluationId} targetType={assistant?.targetType} targetId={assistant?.targetId}
              title={assistant?.title} rubric={assistant?.rubric} entries={assistant?.entries}
              onApplyToRank={assistant ? (score) => { assistant.onApply(score); setAssistant(null) } : undefined}
            />

            {canSubmit && (
              <Space>
                <Button
                  type="primary" loading={submitAndSignMut.isPending} onClick={handleSubmitClick}
                  icon={<CheckCircleOutlined />}
                  style={readyToSubmit
                    ? { background: '#13223a' }
                    : { background: '#f5f5f5', color: 'rgba(0, 0, 0, 0.45)', borderColor: '#d9d9d9' }}
                >
                  Sign and Submit
                </Button>
                {!evaluation.returnedToEmployeeAt && (
                  <Popconfirm
                    title="Return this evaluation to the employee?"
                    description="They'll be able to edit their self-assessment, add missed achievements, and comment on the Next Cycle Goals, then resubmit. This can only be done once."
                    onConfirm={() => returnToEmployeeMut.mutate()}
                  >
                    <Button icon={<UndoOutlined />} loading={returnToEmployeeMut.isPending}>
                      Return to Employee for Review and Update
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            )}
            {canSubmit && !readyToSubmit && (
              <Alert type="info" showIcon style={{ marginTop: 12 }}
                message="Rank every category, criteria, and goal, plus an overall rank for the Annual Goals section, fill in comments for every category and the Annual Goals section, and add at least one Next Cycle Goal before submitting."
                description="Click Sign and Submit to highlight exactly which fields are still missing." />
            )}
            {evaluation.state === 'RETURNED_TO_EMPLOYEE' && (
              <Alert type="info" showIcon
                message="Waiting for the employee to review and resubmit their self-assessment." />
            )}
            {evaluation.state === 'HEAD_SUBMITTED' && (
              <Alert type="info" showIcon
                message={`Signed and submitted by you${evaluation.headSignatureName ? ` as ${evaluation.headSignatureName}` : ''}. Waiting for the employee to sign or refuse.`} />
            )}
            {evaluation.state === 'CONCLUDED' && (
              <Alert type="success" showIcon
                message={evaluation.headSignatureName
                  ? `This evaluation is concluded. Signed by ${evaluation.headSignatureName}.`
                  : 'This evaluation is concluded.'} />
            )}
          </>
        )}
      </Card>

      <Modal
        title="Sign and Submit Evaluation" open={submitSignOpen} onCancel={() => setSubmitSignOpen(false)} destroyOnClose
        onOk={() => signForm.submit()} confirmLoading={submitAndSignMut.isPending} okText="Sign and Submit"
      >
        <Paragraph type="secondary">
          Type your full name below to sign and submit this evaluation. It will then go to the employee for their
          signature or refusal.
        </Paragraph>
        <Form form={signForm} layout="vertical" onFinish={(values) => submitAndSignMut.mutate(values.signatureName)}>
          <Form.Item name="signatureName" label="Type your name to sign" rules={[{ required: true, message: 'Type your name to sign' }]}>
            <Input placeholder="Your full name" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
