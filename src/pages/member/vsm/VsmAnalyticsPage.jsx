// Phase 6 of the VSM module: a cross-map rollup dashboard over every map the current user can see
// (same visibility as VsmMapListPage). Deliberately a current-state snapshot, not a trend-over-time
// chart -- VsmNode's typed metric columns hold live values, not a time series, so charting fail-rate
// trends would first need a snapshot cadence or an effectiveDate column, a decision the round-1 plan
// deferred until real usage data exists to design it against. See VsmAnalyticsResponse's backend
// class doc for the same reasoning.
import { Card, Row, Col, Statistic, Table, Typography, Empty } from 'antd'
import { NodeIndexOutlined, CheckSquareOutlined, TrophyOutlined, FireOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getVsmAnalytics } from '../../../api/vsmMaps'
import InfoTip from '../../../components/InfoTip'

const { Paragraph } = Typography

export default function VsmAnalyticsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['vsm-analytics'], queryFn: getVsmAnalytics })

  const mapsByState = data?.mapsByState ?? {}
  const tasksByState = data?.tasksByState ?? {}
  const tasksByType = data?.tasksByType ?? {}

  const hotspotColumns = (unit) => [
    { title: t('common.title'), dataIndex: 'nodeTitle' },
    { title: t('vsm.colScope'), dataIndex: 'mapTitle' },
    { title: unit, dataIndex: 'value', width: 120, render: (v) => Number(v).toFixed(1) },
  ]

  return (
    <div style={{ padding: 24 }}>
      <h1>{t('vsm.analyticsTitle')} <InfoTip title={t('vsm.analyticsInfo')} /></h1>
      <Paragraph type="secondary">{t('vsm.analyticsSubtitle')}</Paragraph>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card loading={isLoading}>
            <Statistic title={t('vsm.analyticsTotalMaps')} value={data?.totalMaps ?? 0}
              prefix={<NodeIndexOutlined style={{ color: '#13223a' }} />} />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {t('vsm.mapStateActive')}: {mapsByState.ACTIVE ?? 0} · {t('vsm.mapStateDraft')}: {mapsByState.DRAFT ?? 0} · {t('vsm.mapStateArchived')}: {mapsByState.ARCHIVED ?? 0}
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={isLoading}>
            <Statistic title={t('vsm.analyticsTotalTasks')} value={data?.totalTasks ?? 0}
              prefix={<CheckSquareOutlined style={{ color: '#c9a24b' }} />} />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {t('vsm.boardDone')}: {tasksByState.DONE ?? 0} · {t('vsm.boardInProgress')}: {tasksByState.IN_PROGRESS ?? 0} · {t('vsm.boardPulled')}: {tasksByState.PULLED ?? 0} · {t('vsm.boardAvailable')}: {tasksByState.AVAILABLE ?? 0}
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={isLoading}>
            <Statistic title={t('vsm.analyticsImprovementTasks')} value={data?.improvementTasksTotal ?? 0}
              prefix={<FireOutlined style={{ color: '#d4380d' }} />} />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {t('vsm.taskTypeMinor')}: {tasksByType.MINOR ?? 0}
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={isLoading}>
            <Statistic title={t('vsm.analyticsAchievementsLogged')} value={data?.improvementTasksWithAchievement ?? 0}
              prefix={<TrophyOutlined style={{ color: '#c9a24b' }} />} />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {t('vsm.analyticsAchievementsLoggedHint')}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title={<span>{t('vsm.analyticsTopFailRate')} <InfoTip title={t('vsm.analyticsTopFailRateInfo')} /></span>}>
            {(data?.topFailRateNodes ?? []).length === 0 ? (
              <Empty description={t('vsm.analyticsNoData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                dataSource={data.topFailRateNodes}
                columns={hotspotColumns('%')}
                rowKey={(r) => `${r.mapId}-${r.nodeId}`}
                pagination={false}
                size="small"
                onRow={(r) => ({ onClick: () => navigate(`/vsm/${r.mapId}`), style: { cursor: 'pointer' } })}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<span>{t('vsm.analyticsTopCycleTime')} <InfoTip title={t('vsm.analyticsTopCycleTimeInfo')} /></span>}>
            {(data?.topCycleTimeNodes ?? []).length === 0 ? (
              <Empty description={t('vsm.analyticsNoData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                dataSource={data.topCycleTimeNodes}
                columns={hotspotColumns(t('vsm.minutesAbbrev'))}
                rowKey={(r) => `${r.mapId}-${r.nodeId}`}
                pagination={false}
                size="small"
                onRow={(r) => ({ onClick: () => navigate(`/vsm/${r.mapId}`), style: { cursor: 'pointer' } })}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
