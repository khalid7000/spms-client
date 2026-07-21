import { Row, Col, Card, Statistic, Spin } from 'antd'
import {
  TeamOutlined,
  ApartmentOutlined,
  OrderedListOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getUsers } from '../../api/admin'
import { getAdminStrategies } from '../../api/admin'
import { getDepartments, getPlanningCycles } from '../../api/admin'
import StateChip from '../../components/StateChip'
import { useNavigate } from 'react-router-dom'

export default function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers })
  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: getAdminStrategies,
  })
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  })
  const { data: cycles = [] } = useQuery({
    queryKey: ['admin-cycles'],
    queryFn: getPlanningCycles,
  })

  const stateCount = strategies.reduce((acc, s) => {
    acc[s.state] = (acc[s.state] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('adminDash.title')}</h1>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('adminDash.totalUsers')}
              value={users.length}
              prefix={<TeamOutlined style={{ color: '#13223a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('nav.strategies')}
              value={strategies.length}
              prefix={<OrderedListOutlined style={{ color: '#c9a24b' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('nav.departments')}
              value={departments.length}
              prefix={<ApartmentOutlined style={{ color: '#2563eb' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('nav.planningCycles')}
              value={cycles.length}
              prefix={<CalendarOutlined style={{ color: '#059669' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card title={t('adminDash.allStrategiesTitle')} bodyStyle={{ padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8faff', borderBottom: '1px solid #e8eef6' }}>
                {[t('common.title'), t('common.type'), t('common.status'), t('common.department'), t('strategyCreation.colPlanningCycle')].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: 12,
                      color: '#6b7280',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {strategies.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/admin/strategies/${s.id}`)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f2f5',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8faff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{s.title}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: s.strategyType === 'UNIVERSITY' ? '#eef2ff' : '#f0fdf4',
                        color: s.strategyType === 'UNIVERSITY' ? '#3730a3' : '#166534',
                        padding: '2px 8px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {s.strategyType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StateChip state={s.state} />
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                    {s.departmentName || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                    {s.planningCycleName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
