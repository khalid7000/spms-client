// Read-only rollup for a head at any level of the org hierarchy (e.g. a Dean over several
// departments): every employee's Annual Evaluation status beneath them, not just the ones where
// they're literally the rater -- with a drill-down into the full evaluation content, view-only.
import { useState, useEffect } from 'react'
import { Card, Select, Table, Tag, Button, Descriptions, Alert, Empty, Space, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import { getRankLabels } from '../../api/portfolio'
import { getHierarchyEvaluations, getEvaluation } from '../../api/annualEvaluations'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'
import {
  STATE_COLORS, orderedCategoryResults, categoryColor, UNLINKED_COLOR,
  AchievementList, rankLabelText, RubricPopover, GoalsSection,
} from './evaluationDisplay'

const { Paragraph, Text } = Typography

const TABLE_PREFS_KEY = 'spms.orgEvaluationsTable.prefs'

export default function OrgEvaluationsPage() {
  const [academicYearId, setAcademicYearId] = useState(null)
  const [evaluationId, setEvaluationId] = useState(null)
  const { prefs, sortOrderFor, handleTableChange } = useTablePrefs(TABLE_PREFS_KEY)

  const { data: academicYears = [] } = useQuery({ queryKey: ['academic-years'], queryFn: getAcademicYears })

  // Default to the most recent year instead of leaving the selector blank.
  useEffect(() => {
    if (!academicYearId && academicYears.length > 0) {
      setAcademicYearId(getMostRecentAcademicYear(academicYears).id)
    }
  }, [academicYearId, academicYears])

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['org-evaluations', academicYearId],
    queryFn: () => getHierarchyEvaluations(academicYearId),
    enabled: !!academicYearId,
  })

  const { data: evaluation } = useQuery({
    queryKey: ['org-evaluation-detail', evaluationId],
    queryFn: () => getEvaluation(evaluationId),
    enabled: !!evaluationId,
  })

  const { data: rankLabels = [] } = useQuery({
    queryKey: ['rank-labels-for-org-eval', evaluation?.titleId],
    queryFn: () => getRankLabels(evaluation.titleId),
    enabled: !!evaluation?.titleId,
  })

  const columns = [
    {
      title: 'Employee', dataIndex: 'employeeName', key: 'employeeName',
      sorter: (a, b) => compareStrings(a.employeeName, b.employeeName), sortOrder: sortOrderFor('employeeName'),
    },
    {
      title: 'Department', dataIndex: 'departmentName', key: 'departmentName',
      sorter: (a, b) => compareStrings(a.departmentName, b.departmentName), sortOrder: sortOrderFor('departmentName'),
    },
    { title: 'Head', dataIndex: 'headName', key: 'headName' },
    { title: 'Status', dataIndex: 'state', key: 'state', render: (s) => <Tag color={STATE_COLORS[s]}>{s}</Tag> },
    {
      title: 'Overall Rank', dataIndex: 'headOverallRank', key: 'headOverallRank',
      render: (rank) => rank ? <Tag color="green">{rank}</Tag> : <Tag>—</Tag>,
    },
    {
      title: '', key: 'actions',
      render: (_, row) => <Button size="small" onClick={() => setEvaluationId(row.id)}>View</Button>,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>Organization Evaluations</h1>
        <Paragraph type="secondary">
          Read-only status of every Annual Evaluation across your organization hierarchy -- every department you
          head directly, plus every department under any org group you head. To rate an evaluation, use Team
          Annual Evaluations instead.
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
            dataSource={evaluations} columns={columns} rowKey="id" loading={isLoading}
            locale={{ emptyText: 'No evaluations found in your organization hierarchy for this year' }}
            pagination={{
              current: prefs.current, pageSize: prefs.pageSize, showSizeChanger: true,
              showTotal: (total) => `Total: ${total}`,
            }}
            onChange={handleTableChange}
          />
        ) : evaluation && (
          <>
            <Button style={{ marginBottom: 16 }} onClick={() => setEvaluationId(null)}>&larr; Back to list</Button>
            <Descriptions column={4} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Employee">{evaluation.employeeName}</Descriptions.Item>
              <Descriptions.Item label="Head">{evaluation.headName}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATE_COLORS[evaluation.state]}>{evaluation.state}</Tag></Descriptions.Item>
              <Descriptions.Item label="Overall Rank">
                {evaluation.headOverallRank ? (
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
                      <Tag color="green">Head: {cat.headCategoryRank ? rankLabelText(rankLabels, cat.headCategoryRank) : 'Not yet rated'}</Tag>
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
                      <div style={{ textAlign: 'right' }}>
                        <Tag color="green">{crit.headRank ? rankLabelText(rankLabels, crit.headRank) : '—'}</Tag>
                      </div>
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
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>Head Comments</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                      {cat.headComments || <Text type="secondary">No comments</Text>}
                    </Paragraph>
                  </div>
                </Card>
              )
            })}

            <GoalsSection evaluation={evaluation} rankLabels={rankLabels} canEdit={false} />

            {evaluation.employeeRefused && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message="Employee refused to sign this evaluation"
                description={evaluation.employeeRefusalRationale} />
            )}
            {evaluation.headSignedAt && (
              <Alert type="success" showIcon style={{ marginBottom: 8 }}
                message={`Head signature: ${evaluation.headSignatureName} on ${new Date(evaluation.headSignedAt).toLocaleDateString()}`} />
            )}
            {evaluation.employeeSignedAt && (
              <Alert type="success" showIcon style={{ marginBottom: 8 }}
                message={`Employee signature: ${evaluation.employeeSignatureName} on ${new Date(evaluation.employeeSignedAt).toLocaleDateString()}`} />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
