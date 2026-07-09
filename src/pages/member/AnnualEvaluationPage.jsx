// Employee-facing Annual Evaluation view: tag each achievement to a criteria and/or goal,
// self-assess every category, declare "nothing to report" for criteria/goals with no
// achievements, submit for head review; once the head has rated everything, sign or refuse to
// sign (with a required rationale); once concluded, download the final report.
import { useState, useEffect } from 'react'
import { Card, Select, Table, Tag, Button, Modal, Form, Input, Checkbox, message, Descriptions, Alert, Empty, Space, Typography } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import { getRankLabels } from '../../api/portfolio'
import {
  getMyEvaluation, updateEntryDesignation, updateSelfRank, updateGoalsSelfRank, markCriteriaNothingToReport,
  markGoalNothingToReport, submitEmployeeSelfAssessment, signAsEmployee, refuseToSign, downloadEvaluationPdf,
} from '../../api/annualEvaluations'
import { orderedCategoryResults, categoryColor, AchievementList, rankLabelText, GoalsSection } from './evaluationDisplay'

const { Text, Paragraph } = Typography

export default function AnnualEvaluationPage() {
  const qc = useQueryClient()
  const [academicYearId, setAcademicYearId] = useState(null)
  const [refuseOpen, setRefuseOpen] = useState(false)
  const [rationale, setRationale] = useState('')
  const [signOpen, setSignOpen] = useState(false)
  const [signForm] = Form.useForm()

  const { data: academicYears = [] } = useQuery({ queryKey: ['academic-years'], queryFn: getAcademicYears })

  // Default to the most recent year instead of leaving the selector blank.
  useEffect(() => {
    if (!academicYearId && academicYears.length > 0) {
      setAcademicYearId(getMostRecentAcademicYear(academicYears).id)
    }
  }, [academicYearId, academicYears])

  const { data: evaluation, isLoading } = useQuery({
    queryKey: ['my-evaluation', academicYearId],
    queryFn: () => getMyEvaluation(academicYearId),
    enabled: !!academicYearId,
  })

  const { data: rankLabels = [] } = useQuery({
    queryKey: ['rank-labels', evaluation?.titleId],
    queryFn: () => getRankLabels(evaluation.titleId),
    enabled: !!evaluation?.titleId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['my-evaluation', academicYearId] })

  const designationMut = useMutation({
    mutationFn: ({ entryId, categoryId, criteriaId, goalId }) =>
      updateEntryDesignation(evaluation.id, entryId, { categoryId, criteriaId, goalId }),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update designation'),
  })

  const selfRankMut = useMutation({
    mutationFn: ({ categoryId, rank }) => updateSelfRank(evaluation.id, categoryId, rank),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update self-rank'),
  })

  const goalsSelfRankMut = useMutation({
    mutationFn: (rank) => updateGoalsSelfRank(evaluation.id, rank),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update self-rank'),
  })

  const criteriaNtrMut = useMutation({
    mutationFn: ({ criteriaId, nothingToReport }) => markCriteriaNothingToReport(evaluation.id, criteriaId, nothingToReport),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update'),
  })

  const goalNtrMut = useMutation({
    mutationFn: ({ goalId, nothingToReport }) => markGoalNothingToReport(evaluation.id, goalId, nothingToReport),
    onSuccess: invalidate,
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update'),
  })

  const submitMut = useMutation({
    mutationFn: () => submitEmployeeSelfAssessment(evaluation.id),
    onSuccess: () => { message.success('Self-assessment submitted'); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to submit'),
  })

  const signMut = useMutation({
    mutationFn: (signatureName) => signAsEmployee(evaluation.id, signatureName),
    onSuccess: () => { message.success('Signed'); setSignOpen(false); signForm.resetFields(); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to sign'),
  })

  const refuseMut = useMutation({
    mutationFn: () => refuseToSign(evaluation.id, rationale),
    onSuccess: () => { message.success('Refusal recorded'); setRefuseOpen(false); setRationale(''); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to record refusal'),
  })

  const handleDownload = async () => {
    try {
      const resp = await downloadEvaluationPdf(evaluation.id)
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `annual-evaluation-${evaluation.id}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('Failed to download report')
    }
  }

  const isDraft = evaluation?.state === 'DRAFT'
  const isEmployeeSubmitted = evaluation?.state === 'EMPLOYEE_SUBMITTED'
  const isHeadSubmitted = evaluation?.state === 'HEAD_SUBMITTED'
  const isConcluded = evaluation?.state === 'CONCLUDED'
  const employeeHasActed = !!evaluation?.employeeSignedAt || evaluation?.employeeRefused

  const criteriaOptionsFor = (categoryId) =>
    (evaluation?.criteriaResults ?? [])
      .filter((c) => c.categoryId === categoryId)
      .map((c) => ({ value: c.criteriaId, label: c.criteriaName }))

  const goalOptions = (evaluation?.goalResults ?? []).map((g) => ({ value: g.goalId, label: g.goalTitle }))

  const entryColumns = [
    { title: 'Achievement', dataIndex: 'achievementTitle', key: 'achievementTitle', ellipsis: true },
    {
      title: 'Category', dataIndex: 'categoryId', key: 'categoryId', width: 180,
      render: (categoryId, row) => isDraft ? (
        <Select
          style={{ width: '100%' }} value={categoryId} placeholder="Select category"
          options={(evaluation.categoryResults ?? []).map((c) => ({ value: c.categoryId, label: c.categoryName }))}
          onChange={(value) => designationMut.mutate({ entryId: row.entryId, categoryId: value, criteriaId: null, goalId: row.goalId })}
        />
      ) : (evaluation.categoryResults.find((c) => c.categoryId === categoryId)?.categoryName ?? '—'),
    },
    {
      title: 'Criteria', dataIndex: 'criteriaId', key: 'criteriaId', width: 220,
      render: (criteriaId, row) => isDraft ? (
        <Select
          style={{ width: '100%' }} value={criteriaId} placeholder="Select criteria" disabled={!row.categoryId}
          options={criteriaOptionsFor(row.categoryId)}
          onChange={(value) => designationMut.mutate({ entryId: row.entryId, categoryId: row.categoryId, criteriaId: value, goalId: row.goalId })}
        />
      ) : (evaluation.criteriaResults.find((c) => c.criteriaId === criteriaId)?.criteriaName ?? <Tag color="red">Not tagged</Tag>),
    },
    {
      title: 'Goal (optional)', dataIndex: 'goalId', key: 'goalId', width: 220,
      render: (goalId, row) => isDraft ? (
        <Select
          style={{ width: '100%' }} value={goalId} placeholder="Link to a goal" allowClear
          options={goalOptions}
          onChange={(value) => designationMut.mutate({ entryId: row.entryId, categoryId: row.categoryId, criteriaId: row.criteriaId, goalId: value })}
        />
      ) : (evaluation.goalResults?.find((g) => g.goalId === goalId)?.goalTitle ?? '—'),
    },
  ]

  const entriesFor = (criteriaId) => (evaluation?.entries ?? []).filter((e) => e.criteriaId === criteriaId)
  const entriesForGoal = (goalId) => (evaluation?.entries ?? []).filter((e) => e.goalId === goalId)

  const uncategorizedEntries = (evaluation?.entries ?? []).filter(
    (e) => !e.categoryId || !(evaluation?.categoryResults ?? []).some((c) => c.categoryId === e.categoryId))

  const missingSelfRank = (evaluation?.categoryResults ?? []).some((c) => !c.employeeSelfRank)
  const missingGoalsSelfRank = (evaluation?.goalResults?.length ?? 0) > 0 && !evaluation?.goalsEmployeeSelfRank
  const missingCriteria = (evaluation?.entries ?? []).some((e) => !e.criteriaId)
  const uncoveredCriteria = (evaluation?.criteriaResults ?? []).some(
    (c) => !c.employeeNothingToReport && entriesFor(c.criteriaId).length === 0)
  const uncoveredGoals = (evaluation?.goalResults ?? []).some(
    (g) => !g.employeeNothingToReport && entriesForGoal(g.goalId).length === 0)
  const canSubmit = !missingSelfRank && !missingGoalsSelfRank && !missingCriteria && !uncoveredCriteria && !uncoveredGoals

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>My Annual Evaluation</h1>
        <Paragraph type="secondary">
          Review each achievement logged this academic year, confirm which category, criteria, and (optionally) goal
          it counts toward, give yourself a self-assessed rank per category and one overall rank for your annual
          goals, then submit for your head's review. Every criteria and goal needs either an achievement or an
          explicit "nothing to report."
        </Paragraph>

        <Select
          style={{ width: 220, marginBottom: 24 }} placeholder="Academic year" value={academicYearId}
          onChange={setAcademicYearId} options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
        />

        {!academicYearId ? (
          <Empty description="Select an academic year to view your evaluation" />
        ) : isLoading || !evaluation ? null : (
          <>
            <Descriptions column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Head">{evaluation.headName}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag>{evaluation.state}</Tag></Descriptions.Item>
              <Descriptions.Item label="Overall Rank">
                {evaluation.headOverallRank ? rankLabelText(rankLabels, evaluation.headOverallRank) : 'Not yet rated'}
              </Descriptions.Item>
            </Descriptions>

            {(evaluation.entries ?? []).length === 0 && (
              <Empty description="No achievements logged this academic year yet" style={{ marginBottom: 24 }} />
            )}

            {uncategorizedEntries.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Not yet categorized</Text>
                <Table
                  dataSource={uncategorizedEntries} columns={entryColumns} rowKey="entryId"
                  pagination={false} size="small"
                />
              </div>
            )}

            {orderedCategoryResults(evaluation.categoryResults).map((cat) => {
              const color = categoryColor(cat.categoryName)
              const catCriteria = (evaluation.criteriaResults ?? []).filter((c) => c.categoryId === cat.categoryId)
              const catUnlinked = (evaluation.entries ?? []).filter((e) => e.categoryId === cat.categoryId && !e.criteriaId)
              return (
                <Card key={cat.categoryId} type="inner" title={cat.categoryName}
                  style={{ marginBottom: 16, borderTop: `4px solid ${color.accent}` }}
                  styles={{ header: { background: color.tint } }}
                  extra={
                    <Space>
                      <span>Your self-rank:</span>
                      {isDraft ? (
                        <Select style={{ width: 220 }} value={cat.employeeSelfRank} placeholder="Select rank"
                          options={[1, 2, 3, 4, 5].map((r) => ({ value: r, label: rankLabelText(rankLabels, r) }))}
                          onChange={(value) => selfRankMut.mutate({ categoryId: cat.categoryId, rank: value })} />
                      ) : (
                        <Tag color="magenta">{cat.employeeSelfRank ? rankLabelText(rankLabels, cat.employeeSelfRank) : '—'}</Tag>
                      )}
                      <Tag color="green">Head: {cat.headCategoryRank ? rankLabelText(rankLabels, cat.headCategoryRank) : 'Not yet rated'}</Tag>
                    </Space>
                  }
                >
                  {catCriteria.map((crit) => {
                    const critEntries = entriesFor(crit.criteriaId)
                    return (
                      <div key={crit.criteriaId} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eef6' }}>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong>Criterion: </Text>
                          <Text>{crit.criteriaName}</Text>
                          {isDraft ? (
                            <Checkbox
                              checked={crit.employeeNothingToReport} disabled={critEntries.length > 0}
                              onChange={(e) => criteriaNtrMut.mutate({ criteriaId: crit.criteriaId, nothingToReport: e.target.checked })}
                              style={{ marginLeft: 12 }}
                            >
                              Nothing to report
                            </Checkbox>
                          ) : (
                            crit.employeeNothingToReport && <Tag color="gold" style={{ marginLeft: 8 }}>Nothing to report</Tag>
                          )}
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>Criterion Achievements:</Text>
                          {isDraft ? (
                            <div style={{ background: color.tint, borderLeft: `3px solid ${color.accent}`, borderRadius: 4, padding: 10 }}>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                You can change the category, criteria, or goal mapping of any achievement using the dropdowns below.
                              </Text>
                              <Table
                                dataSource={critEntries} columns={entryColumns} rowKey="entryId"
                                pagination={false} size="small"
                                locale={{ emptyText: 'No achievements tagged to this criteria yet' }}
                              />
                            </div>
                          ) : (
                            <AchievementList
                              entries={critEntries}
                              emptyText={crit.employeeNothingToReport ? 'You reported nothing for this criteria' : 'No achievements tagged to this criteria'}
                              color={color}
                            />
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Tag color="green">
                            Head: {crit.headRank ? rankLabelText(rankLabels, crit.headRank) : 'Not yet rated'}
                          </Tag>
                        </div>
                      </div>
                    )
                  })}
                  {catUnlinked.length > 0 && (
                    <div>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                        <Tag color="gold" style={{ marginRight: 6 }}>Needs a criteria</Tag>Not yet linked to a specific criteria
                      </Text>
                      <Table dataSource={catUnlinked} columns={entryColumns} rowKey="entryId" pagination={false} size="small" />
                    </div>
                  )}
                  {!isDraft && (
                    <div style={{ marginTop: catCriteria.length > 0 ? 0 : 8 }}>
                      <Text strong style={{ display: 'block', marginBottom: 4 }}>Head Comments</Text>
                      <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                        {cat.headComments || <Text type="secondary">No comments yet</Text>}
                      </Paragraph>
                    </div>
                  )}
                </Card>
              )
            })}

            <GoalsSection
              evaluation={evaluation} rankLabels={rankLabels} canEdit={false} showComments={!isDraft}
              onNothingToReportChange={isDraft
                ? (goalId, nothingToReport) => goalNtrMut.mutate({ goalId, nothingToReport })
                : undefined}
              onSelfRankChange={isDraft ? (rank) => goalsSelfRankMut.mutate(rank) : undefined}
            />

            {isDraft && (
              <Button type="primary" disabled={!canSubmit} loading={submitMut.isPending}
                onClick={() => submitMut.mutate()} style={{ background: '#13223a' }}>
                Submit for Head Review
              </Button>
            )}
            {isDraft && !canSubmit && (
              <Alert type="info" showIcon style={{ marginTop: 12 }}
                message="Rank every category and your annual goals overall, and give every criteria and goal either an achievement or a 'nothing to report' before submitting." />
            )}

            {isEmployeeSubmitted && (
              <Alert type="info" showIcon message="Submitted -- waiting for your head to complete their review." />
            )}

            {(isHeadSubmitted || isConcluded) && (
              <>
                {evaluation.employeeRefused && (
                  <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                    message="You refused to sign this evaluation"
                    description={evaluation.employeeRefusalRationale} />
                )}
                {isHeadSubmitted && !employeeHasActed && (
                  <Space>
                    <Button type="primary" icon={<CheckCircleOutlined />}
                      onClick={() => setSignOpen(true)} style={{ background: '#13223a' }}>
                      Sign
                    </Button>
                    <Button danger icon={<CloseCircleOutlined />} onClick={() => setRefuseOpen(true)}>
                      Refuse to Sign
                    </Button>
                  </Space>
                )}
                {evaluation.employeeSignedAt && (
                  <Alert type="success" showIcon style={{ marginBottom: 12 }}
                    message={`Signed by ${evaluation.employeeSignatureName} on ${new Date(evaluation.employeeSignedAt).toLocaleDateString()}`} />
                )}
                {employeeHasActed && !evaluation.headSignedAt && (
                  <Alert type="info" showIcon message="Waiting for your head's signature." />
                )}
                {isConcluded && (
                  <>
                    <Alert type="success" showIcon style={{ marginBottom: 12 }} message="This evaluation is concluded." />
                    <Button icon={<DownloadOutlined />} onClick={handleDownload}>Download Report</Button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </Card>

      <Modal
        title="Refuse to Sign" open={refuseOpen} onCancel={() => setRefuseOpen(false)}
        onOk={() => refuseMut.mutate()} confirmLoading={refuseMut.isPending}
        okButtonProps={{ danger: true, disabled: !rationale.trim() }}
      >
        <Text>Please provide a rationale for refusing to sign this evaluation:</Text>
        <Input.TextArea rows={4} style={{ marginTop: 8 }} value={rationale} onChange={(e) => setRationale(e.target.value)} />
      </Modal>

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
