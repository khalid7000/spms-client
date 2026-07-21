import { useState, useEffect } from 'react'
import { Card, Select, Table, Space, Tag, Statistic, Row, Col, Rate, Empty, Spin, Tabs } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as api from '../../api/portfolio'
import { getAcademicYears, getMostRecentAcademicYear } from '../../api/academicYears'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { useTerminology } from '../../TerminologyContext'

export default function AchievementLoggingPage() {
  const { t } = useTranslation()
  const { academicYearLabel } = useTerminology()
  const [academicYear, setAcademicYear] = useState(null)

  const { data: academicYears = [], isLoading: yearsLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: getAcademicYears,
  })

  // Default to the most recent year instead of leaving the selector blank -- the user still owns
  // the choice, but there's no reason to make them pick every visit when there's an obvious answer.
  useEffect(() => {
    if (!academicYear && academicYears.length > 0) {
      setAcademicYear(getMostRecentAcademicYear(academicYears).id)
    }
  }, [academicYear, academicYears])

  const { data: portfolio = [], isLoading: portfolioLoading } = useQuery({
    queryKey: ['my-portfolio', academicYear],
    queryFn: () => api.getMyPortfolio(academicYear),
    enabled: !!academicYear,
  })

  const { data: summary = null } = useQuery({
    queryKey: ['portfolio-summary', academicYear],
    queryFn: () => api.getMyPortfolioSummary(academicYear),
    enabled: !!academicYear,
  })

  const { data: myCycles = [] } = useQuery({
    queryKey: ['my-goal-cycles', academicYear],
    queryFn: () => api.getMyCycles(academicYear),
    enabled: !!academicYear,
  })
  const deployedCycle = myCycles.find((c) => c.state === 'DEPLOYED')
  const { data: cycleGoals = [] } = useQuery({
    queryKey: ['my-deployed-goals', deployedCycle?.id],
    queryFn: () => api.getCycleGoals(deployedCycle.id),
    enabled: !!deployedCycle,
  })

  const portfolioColumns = [
    {
      title: t('achievementLog.colAchievement'), dataIndex: 'achievementTitle', key: 'achievementTitle', ellipsis: true, width: 250,
      sorter: (a, b) => compareStrings(a.achievementTitle, b.achievementTitle),
    },
    { title: t('achievementLog.colCategory'), dataIndex: 'categoryName', key: 'categoryName', width: 150 },
    { title: t('common.type'), dataIndex: 'achievementTypeName', key: 'achievementTypeName', width: 120 },
    {
      title: t('common.goal'), dataIndex: 'goalId', key: 'goalId', width: 150,
      render: (goalId) => {
        const goal = cycleGoals.find((g) => g.id === goalId)
        return goal ? goal.goalTitle : goalId ? <Tag>{t('achievementLog.otherYear')}</Tag> : '-'
      },
    },
    {
      title: t('achievementLog.colRating'), dataIndex: 'categoryRating', key: 'categoryRating', width: 120,
      render: (rating) => rating ? <Rate disabled value={rating} /> : '-',
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>{t('achievementLog.title')}</h1>
        <p>
          {t('achievementLog.intro')}
        </p>

        <Space style={{ marginBottom: 24 }}>
          <Select style={{ width: 200 }} placeholder={academicYearLabel} value={academicYear} onChange={setAcademicYear}
            loading={yearsLoading} options={academicYears.map((y) => ({ value: y.id, label: y.name }))} />
        </Space>

        {academicYear && summary && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={8}>
              <Statistic title={t('achievementLog.totalAchievements')} value={summary.totalEntries} />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Statistic title={t('achievementLog.deployedGoals')} value={summary.deployedGoals} />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Statistic title={t('achievementLog.averageRating')} value={summary.averageRating} precision={1} suffix="/5" />
            </Col>
          </Row>
        )}

        <Tabs
          items={[
            {
              key: 'achievements',
              label: t('achievementLog.myAchievementsTab'),
              children: portfolioLoading ? <Spin /> : portfolio.length === 0 ? (
                <Empty description={t('achievementLog.noneLoggedYet')} />
              ) : (
                <Table
                  dataSource={portfolio} columns={portfolioColumns} rowKey="id"
                  pagination={{ pageSize: 10, showTotal: (total) => t('achievementLog.totalCount', { count: total }) }}
                />
              ),
            },
            {
              key: 'goals',
              label: t('achievementLog.myDeployedGoalsTab'),
              children: cycleGoals.length === 0 ? (
                <Empty description={t('achievementLog.noDeployedGoals', { yearLabel: academicYearLabel.toLowerCase() })} />
              ) : (
                <>
                  <TableTotal count={cycleGoals.length} />
                  <Table
                    dataSource={cycleGoals}
                    rowKey="id"
                    pagination={false}
                    columns={[
                      {
                        title: t('common.goal'), dataIndex: 'goalTitle', key: 'goalTitle', ellipsis: true,
                        sorter: (a, b) => compareStrings(a.goalTitle, b.goalTitle),
                      },
                      { title: t('achievementLog.colCategory'), dataIndex: 'categoryName', key: 'categoryName' },
                    ]}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
