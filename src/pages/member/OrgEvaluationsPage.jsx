// Read-only rollup for a head at any level of the org hierarchy (e.g. a Dean over several
// departments): every employee's Annual Evaluation status beneath them, not just the ones where
// they're literally the rater -- with a drill-down into the full evaluation content, view-only.
import { useState, useEffect } from 'react'
import { Card, Select, Table, Tag, Button, Descriptions, Alert, Empty, Space, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import { getRankLabels } from '../../api/portfolio'
import { getHierarchyEvaluations, getEvaluation } from '../../api/annualEvaluations'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'
import {
  STATE_COLORS, orderedCategoryResults, categoryColor, UNLINKED_COLOR,
  AchievementList, rankLabelText, RubricPopover, GoalsSection, HeadCommentsBlock, EmployeeReflectionBlock,
  NextCycleGoalsSection, EvaluationScoreSummary, CriteriaInfoToolButton,
} from './evaluationDisplay'
import { useTerminology } from '../../TerminologyContext'

const { Paragraph, Text } = Typography

const TABLE_PREFS_KEY = 'spms.orgEvaluationsTable.prefs'

export default function OrgEvaluationsPage() {
  const { t } = useTranslation()
  const { defaultHeadTitleLabel, academicYearLabel } = useTerminology()
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
      title: t('goalSetting.employeeLabel'), dataIndex: 'employeeName', key: 'employeeName',
      sorter: (a, b) => compareStrings(a.employeeName, b.employeeName), sortOrder: sortOrderFor('employeeName'),
    },
    {
      title: t('common.department'), dataIndex: 'departmentName', key: 'departmentName',
      sorter: (a, b) => compareStrings(a.departmentName, b.departmentName), sortOrder: sortOrderFor('departmentName'),
    },
    { title: defaultHeadTitleLabel, dataIndex: 'headName', key: 'headName' },
    { title: t('common.status'), dataIndex: 'state', key: 'state', render: (s) => <Tag color={STATE_COLORS[s]}>{s}</Tag> },
    {
      title: t('orgEval.overallRankColLabel'), dataIndex: 'headOverallRank', key: 'headOverallRank',
      render: (rank) => rank ? <Tag color="green">{rank}</Tag> : <Tag>—</Tag>,
    },
    {
      title: '', key: 'actions',
      render: (_, row) => <Button size="small" onClick={() => setEvaluationId(row.id)}>{t('evalDisplay.viewButton')}</Button>,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>{t('orgEval.title')}</h1>
        <Paragraph type="secondary">
          {t('orgEval.intro')}
        </Paragraph>

        <Select
          style={{ width: 220, marginBottom: 24 }} placeholder={academicYearLabel} value={academicYearId}
          onChange={(v) => { setAcademicYearId(v); setEvaluationId(null) }}
          options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
        />

        {!academicYearId ? (
          <Empty description={t('goalReview.selectYearEmpty', { yearLabel: academicYearLabel })} />
        ) : !evaluationId ? (
          <Table
            dataSource={evaluations} columns={columns} rowKey="id" loading={isLoading}
            locale={{ emptyText: t('orgEval.noEvaluationsFound') }}
            pagination={{
              current: prefs.current, pageSize: prefs.pageSize, showSizeChanger: true,
              showTotal: (total) => t('achievementLog.totalCount', { count: total }),
            }}
            onChange={handleTableChange}
          />
        ) : evaluation && (
          <>
            <Button style={{ marginBottom: 16 }} onClick={() => setEvaluationId(null)}>&larr; {t('orgEval.backToList')}</Button>
            <Descriptions column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('goalSetting.employeeLabel')}>{evaluation.employeeName}</Descriptions.Item>
              <Descriptions.Item label={evaluation.headTitle ?? defaultHeadTitleLabel}>{evaluation.headName}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}><Tag color={STATE_COLORS[evaluation.state]}>{evaluation.state}</Tag></Descriptions.Item>
            </Descriptions>

            <EvaluationScoreSummary evaluation={evaluation} rankLabels={rankLabels} />

            <Card size="small" title={t('annualEval.evaluationDetailsTitle')} style={{ marginBottom: 16 }} />

            {orderedCategoryResults(evaluation.categoryResults).map((cat, idx) => {
              const color = categoryColor(idx)
              const unlinked = evaluation.entries.filter((e) => e.categoryId === cat.categoryId && !e.criteriaId)
              return (
                <Card key={cat.categoryId} type="inner" title={cat.categoryName}
                  style={{ marginBottom: 16, borderTop: `4px solid ${color.accent}` }}
                  styles={{ header: { background: color.tint } }}
                  extra={
                    <Space>
                      <Tag color="green">{t('annualEval.headRankLabel', { rank: cat.headCategoryRank ? rankLabelText(rankLabels, cat.headCategoryRank) : t('annualEval.notYetRated') })}</Tag>
                      <Tag color="magenta">{t('teamEval.selfLabel', { rank: cat.employeeSelfRank ? rankLabelText(rankLabels, cat.employeeSelfRank) : '—' })}</Tag>
                    </Space>
                  }
                >
                  {evaluation.criteriaResults.filter((c) => c.categoryId === cat.categoryId).map((crit) => (
                    <div key={crit.criteriaId} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eef6' }}>
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>{t('annualEval.criterionLabel')} </Text>
                        <RubricPopover criteria={crit} />
                        {crit.employeeNothingToReport && <Tag color="gold" style={{ marginLeft: 8 }}>{t('evalDisplay.employeeNothingToReport')}</Tag>}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <Text strong style={{ display: 'block', marginBottom: 4 }}>{t('annualEval.criterionAchievementsLabel')}</Text>
                        <AchievementList
                          entries={evaluation.entries.filter((e) => e.criteriaId === crit.criteriaId)}
                          emptyText={crit.employeeNothingToReport ? t('teamEval.employeeReportedNothingCriteria') : t('annualEval.noAchievementsTaggedCriteria')}
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
                      <div style={{ textAlign: 'right' }}>
                        <Tag color="green">{crit.headRank ? rankLabelText(rankLabels, crit.headRank) : '—'}</Tag>
                      </div>
                    </div>
                  ))}
                  {unlinked.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                        <Tag color="gold" style={{ marginRight: 6 }}>{t('teamEval.needsReviewTag')}</Tag>{t('teamEval.notLinkedToCriteria')}
                      </Text>
                      <AchievementList entries={unlinked} emptyText="" color={UNLINKED_COLOR} />
                    </div>
                  )}
                  <EmployeeReflectionBlock comments={cat.employeeComments} sectionName={cat.categoryName} required />
                  <HeadCommentsBlock strengths={cat.headCommentsStrengths} improvements={cat.headCommentsImprovements} />
                </Card>
              )
            })}

            <GoalsSection evaluation={evaluation} rankLabels={rankLabels} canEdit={false} />

            <EmployeeReflectionBlock comments={evaluation.employeeFinalSummary} heading={t('annualEval.finalSummaryHeading')} required />

            <NextCycleGoalsSection
              evaluationId={evaluationId} evaluation={evaluation} canHeadEdit={false} canEmployeeReview={false}
            />

            {evaluation.employeeRefused && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={t('orgEval.employeeRefusedToSign')}
                description={evaluation.employeeRefusalRationale} />
            )}
            {evaluation.headSignedAt && (
              <Alert type="success" showIcon style={{ marginBottom: 8 }}
                message={t('orgEval.headSignature', { name: evaluation.headSignatureName, date: new Date(evaluation.headSignedAt).toLocaleDateString() })} />
            )}
            {evaluation.employeeSignedAt && (
              <Alert type="success" showIcon style={{ marginBottom: 8 }}
                message={t('orgEval.employeeSignature', { name: evaluation.employeeSignatureName, date: new Date(evaluation.employeeSignedAt).toLocaleDateString() })} />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
