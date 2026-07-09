// Head-facing Annual Evaluation view: pick a direct report's evaluation for an academic year,
// rate every criterion and category plus an overall rank, submit (the employee is notified),
// and keep editing (each edit notifies the employee) until someone signs -- then sign yourself.
import { useState, useEffect } from 'react'
import { Card, Select, Table, Tag, Button, message, Descriptions, Alert, Empty, Space, Typography, Modal, Form, Input } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import { getRankLabels } from '../../api/portfolio'
import {
  getTeamEvaluations, getEvaluation, updateCriteriaRank, updateCategoryHeadRank, updateCategoryHeadComments,
  updateGoalHeadRank, updateGoalsHeadComments, updateGoalsHeadRank, updateOverallRank, submitHeadEvaluation, signAsHead,
} from '../../api/annualEvaluations'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'
import {
  STATE_COLORS, orderedCategoryResults, categoryColor, UNLINKED_COLOR,
  AchievementList, rankLabelText, RubricPopover, GoalsSection, HeadCommentsBlock, RatingAssistantModal,
} from './evaluationDisplay'

const { Paragraph, Text } = Typography

const TABLE_PREFS_KEY = 'spms.teamEvaluationsTable.prefs'

export default function TeamEvaluationsPage() {
  const qc = useQueryClient()
  const [academicYearId, setAcademicYearId] = useState(null)
  const [evaluationId, setEvaluationId] = useState(null)
  const [signOpen, setSignOpen] = useState(false)
  const [signForm] = Form.useForm()
  const [assistant, setAssistant] = useState(null)
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
    mutationFn: ({ categoryId, comments }) => updateCategoryHeadComments(evaluationId, categoryId, comments),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to save comments'),
  })
  const goalRankMut = useMutation({
    mutationFn: ({ goalId, rank }) => updateGoalHeadRank(evaluationId, goalId, rank),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update rank'),
  })
  const goalsCommentsMut = useMutation({
    mutationFn: (comments) => updateGoalsHeadComments(evaluationId, comments),
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
  const submitMut = useMutation({
    mutationFn: () => submitHeadEvaluation(evaluationId),
    onSuccess: () => { message.success('Evaluation submitted -- ready for signature'); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to submit'),
  })
  const signMut = useMutation({
    mutationFn: (signatureName) => signAsHead(evaluationId, signatureName),
    onSuccess: () => { message.success('Signed'); setSignOpen(false); signForm.resetFields(); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to sign'),
  })

  const canEdit = evaluation && (evaluation.state === 'EMPLOYEE_SUBMITTED' || evaluation.state === 'HEAD_SUBMITTED') && !evaluation.locked
  const canSign = evaluation?.state === 'HEAD_SUBMITTED' && !evaluation.headSignedAt

  const missingCategoryRank = (evaluation?.categoryResults ?? []).some((c) => !c.headCategoryRank)
  const missingComments = (evaluation?.categoryResults ?? []).some((c) => !c.headComments || !c.headComments.trim())
  const missingCriteriaRank = (evaluation?.criteriaResults ?? []).some((c) => !c.headRank)
  const missingGoalRank = (evaluation?.goalResults ?? []).some((g) => !g.headGoalRank)
  const missingGoalsHeadRank = (evaluation?.goalResults?.length ?? 0) > 0 && !evaluation?.goalsHeadRank
  const missingGoalComments = (evaluation?.goalResults?.length ?? 0) > 0
    && (!evaluation?.goalsHeadComments || !evaluation.goalsHeadComments.trim())
  const missingOverallRank = !evaluation?.headOverallRank
  const canSubmit = evaluation?.state === 'EMPLOYEE_SUBMITTED'
  const readyToSubmit = canSubmit && !missingCategoryRank && !missingComments && !missingCriteriaRank
    && !missingGoalRank && !missingGoalsHeadRank && !missingGoalComments && !missingOverallRank

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
          overall annual performance rank. You can keep editing after submitting (each edit notifies them) until
          either of you signs.
        </Paragraph>

        <Select
          style={{ width: 220, marginBottom: 24 }} placeholder="Academic year" value={academicYearId}
          onChange={(v) => { setAcademicYearId(v); setEvaluationId(null) }}
          options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
        />

        {!academicYearId ? (
          <Empty description="Select an academic year" />
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
            <Descriptions column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Employee">{evaluation.employeeName}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATE_COLORS[evaluation.state]}>{evaluation.state}</Tag></Descriptions.Item>
              <Descriptions.Item label="Overall Rank">
                {canEdit ? (
                  <Select style={{ width: 260 }} value={evaluation.headOverallRank} placeholder="Select rank"
                    options={[1, 2, 3, 4, 5].map((r) => ({ value: r, label: rankLabelText(rankLabels, r) }))}
                    onChange={(v) => overallRankMut.mutate(v)} />
                ) : evaluation.headOverallRank ? (
                  <Tag color="green">{rankLabelText(rankLabels, evaluation.headOverallRank)}</Tag>
                ) : <Tag>Not yet rated</Tag>}
              </Descriptions.Item>
            </Descriptions>

            {orderedCategoryResults(evaluation.categoryResults).map((cat) => {
              const color = categoryColor(cat.categoryName)
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
                      <Space align="center" style={{ width: '100%', justifyContent: 'flex-end' }}>
                        <Tag color="magenta">Self: {cat.employeeSelfRank ? rankLabelText(rankLabels, cat.employeeSelfRank) : '—'}</Tag>
                        {canEdit && (
                          <Button size="small"
                            disabled={!crit.rubricUnsatisfactory && !crit.rubricMeetsExpectations && !crit.rubricExceedsExpectations}
                            title={!crit.rubricUnsatisfactory && !crit.rubricMeetsExpectations && !crit.rubricExceedsExpectations
                              ? 'No rubric defined for this criterion' : undefined}
                            onClick={() => setAssistant({
                              key: `criteria-${crit.criteriaId}`,
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
                  <HeadCommentsBlock
                    comments={cat.headComments}
                    onSave={canEdit ? (comments) => categoryCommentsMut.mutate({ categoryId: cat.categoryId, comments }) : undefined}
                  />
                </Card>
              )
            })}

            <GoalsSection
              evaluation={evaluation} rankLabels={rankLabels} canEdit={canEdit}
              onRankChange={(goalId, rank) => goalRankMut.mutate({ goalId, rank })}
              onHeadRankChange={canEdit ? (rank) => goalsRankMut.mutate(rank) : undefined}
              onCommentsChange={canEdit ? (comments) => goalsCommentsMut.mutate(comments) : undefined}
              onOpenAssistant={canEdit ? (g, goalEntries) => setAssistant({
                key: `goal-${g.goalId}`,
                title: g.goalTitle,
                rubric: { unsatisfactory: g.rubricUnsatisfactory, meets: g.rubricMeetsExpectations, exceeds: g.rubricExceedsExpectations },
                entries: goalEntries,
                onApply: (score) => goalRankMut.mutate({ goalId: g.goalId, rank: score }),
              }) : undefined}
            />

            <RatingAssistantModal
              open={!!assistant} onClose={() => setAssistant(null)} resetKey={assistant?.key}
              title={assistant?.title} rubric={assistant?.rubric} entries={assistant?.entries}
              onApplyToRank={assistant ? (score) => { assistant.onApply(score); setAssistant(null) } : undefined}
            />

            {canSubmit && (
              <Button type="primary" disabled={!readyToSubmit} loading={submitMut.isPending}
                onClick={() => submitMut.mutate()} style={{ background: '#13223a' }}>
                Submit Evaluation
              </Button>
            )}
            {canSubmit && !readyToSubmit && (
              <Alert type="info" showIcon style={{ marginTop: 12 }}
                message="Rank every category, criteria, and goal, plus an overall rank for the Annual Goals section, and fill in comments for every category and the Annual Goals section before submitting." />
            )}
            {evaluation.state === 'HEAD_SUBMITTED' && evaluation.locked && !evaluation.headSignedAt && (
              <Alert type="warning" showIcon message="Locked -- the employee has already signed or refused; you can no longer edit, but you can still sign." />
            )}
            {canSign && (
              <Button type="primary" icon={<CheckCircleOutlined />}
                onClick={() => setSignOpen(true)} style={{ background: '#13223a' }}>
                Sign
              </Button>
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
        title="Sign Evaluation" open={signOpen} onCancel={() => setSignOpen(false)} destroyOnClose
        onOk={() => signForm.submit()} confirmLoading={signMut.isPending} okText="Sign"
      >
        <Paragraph type="secondary">
          Type your full name below to sign and confirm this evaluation.
        </Paragraph>
        <Form form={signForm} layout="vertical" onFinish={(values) => signMut.mutate(values.signatureName)}>
          <Form.Item name="signatureName" label="Type your name to sign" rules={[{ required: true, message: 'Type your name to sign' }]}>
            <Input placeholder="Your full name" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
