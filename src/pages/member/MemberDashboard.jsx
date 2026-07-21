import { useState } from 'react'
import { Card, Row, Col, Spin, Empty, Typography, Tooltip, Button } from 'antd'
import { TeamOutlined, BellOutlined, TrophyOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getDashboard } from '../../api/dashboard'
import StateChip from '../../components/StateChip'
import RoleChip from '../../components/RoleChip'
import SpeedometerGauge from '../../components/SpeedometerGauge'
import AddAchievementWizard from '../../components/AddAchievementWizard'

const { Text } = Typography

const ROLE_ORDER = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER']

function reportPath(item) {
  const base = `/strategies/${item.strategyId}/report`
  return item.mostRecentPeriodName ? `${base}?period=${encodeURIComponent(item.mostRecentPeriodName)}` : base
}

export default function MemberDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [wizardOpen, setWizardOpen] = useState(false)
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Empty
        description={t('dashboard.noStrategies')}
        style={{ paddingTop: 80 }}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  const byRole = ROLE_ORDER.reduce((acc, role) => {
    const group = items.filter((i) => i.role === role)
    if (group.length) acc[role] = group
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('dashboard.title')}</h1>
      </div>

      <div className="add-achievement-banner">
        <Button
          type="primary" icon={<TrophyOutlined />}
          onClick={() => setWizardOpen(true)}
          className="add-achievement-btn"
        >
          {t('dashboard.addAchievement')}
        </Button>
      </div>

      <AddAchievementWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        strategies={items}
      />

      {Object.entries(byRole).map(([role, strategies]) => (
        <div key={role} style={{ marginBottom: 32 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <RoleChip role={role} />
            <Text style={{ color: '#6b7280', fontSize: 13 }}>
              {t('dashboard.strategyCount', { count: strategies.length })}
            </Text>
          </div>
          <Row gutter={[16, 16]}>
            {strategies.map((item) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={item.strategyId}>
                <div
                  className="strategy-card"
                  onClick={() => navigate(`/strategies/${item.strategyId}`)}
                >
                  <div className="strategy-card-title" title={item.strategyTitle}>{item.strategyTitle}</div>
                  <div className="strategy-card-meta">
                    <StateChip state={item.state} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          item.strategyType === 'UNIVERSITY' ? '#eef2ff' : '#f0fdf4',
                        color:
                          item.strategyType === 'UNIVERSITY' ? '#3730a3' : '#166534',
                        padding: '1px 7px',
                        borderRadius: 3,
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.strategyType}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: '#9ca3af',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span className="strategy-card-subtitle" title={item.planningCycleName}>{item.planningCycleName}</span>
                    {item.departmentName && (
                      <span className="strategy-card-department" title={item.departmentName}>{item.departmentName}</span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid #f0f0f0',
                      display: 'flex',
                      gap: 14,
                      fontSize: 12,
                      color: '#6b7280',
                    }}
                  >
                    <Tooltip title={t('dashboard.membersTooltip')}>
                      <span
                        className="strategy-card-stat-link"
                        onClick={(e) => { e.stopPropagation(); navigate(`/strategies/${item.strategyId}?tab=members`) }}
                      >
                        <TeamOutlined /> {item.involvedUserCount}
                      </span>
                    </Tooltip>
                    <Tooltip title={t('dashboard.notificationsTooltip')}>
                      <span style={item.unreadNotificationCount > 0 ? { color: '#c0871a', fontWeight: 600 } : undefined}>
                        <BellOutlined /> {item.unreadNotificationCount}
                      </span>
                    </Tooltip>
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      paddingTop: 6,
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-around',
                      gap: 8,
                    }}
                  >
                    <Tooltip title={t('dashboard.goalsTooltip', { periodSuffix: item.mostRecentPeriodName ? ` (${item.mostRecentPeriodName})` : '' })}>
                      <div
                        className="strategy-card-gauge-link"
                        onClick={(e) => { e.stopPropagation(); navigate(reportPath(item)) }}
                      >
                        <SpeedometerGauge value={item.goalsOnTrack} max={item.totalGoals} label={t('dashboard.goalsLabel')} size={84} />
                      </div>
                    </Tooltip>
                    <Tooltip title={t('dashboard.objectivesTooltip', { periodSuffix: item.mostRecentPeriodName ? ` (${item.mostRecentPeriodName})` : '' })}>
                      <div
                        className="strategy-card-gauge-link"
                        onClick={(e) => { e.stopPropagation(); navigate(reportPath(item)) }}
                      >
                        <SpeedometerGauge value={item.objectivesOnTrack} max={item.totalObjectives} label={t('dashboard.objectivesLabel')} size={84} />
                      </div>
                    </Tooltip>
                    <Tooltip title={t('dashboard.initiativesTooltip', { periodSuffix: item.mostRecentPeriodName ? ` (${item.mostRecentPeriodName})` : '' })}>
                      <div
                        className="strategy-card-gauge-link"
                        onClick={(e) => { e.stopPropagation(); navigate(reportPath(item)) }}
                      >
                        <SpeedometerGauge value={item.initiativesOnTrack} max={item.totalInitiatives} label={t('dashboard.initiativesLabel')} size={84} />
                      </div>
                    </Tooltip>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  )
}
