// Main member-facing shell: side nav grouped into role-based consoles (Strategy Console,
// Strategy Creation Console, Portfolio Console, plus Admin/HR links), header user menu, and
// the routed page content via <Outlet/>. The nav itself is plain markup rather than AntD's
// <Menu> -- Menu recomputes its ink-bar/indicator against the `items` array identity, so
// rebuilding that array on every render (as role/dashboard queries settle one by one) reads
// as sections flickering in and out. Plain elements only change when the boolean they render
// from actually changes.
import { useState } from 'react'
import { Layout, Avatar, Dropdown, Button, Badge } from 'antd'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  DashboardOutlined,
  CheckSquareOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  RocketOutlined,
  AimOutlined,
  TrophyOutlined,
  SolutionOutlined,
  TeamOutlined,
  FileTextOutlined,
  BellOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  CalendarOutlined,
  BookOutlined,
  OrderedListOutlined,
  AuditOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getMyPendingApprovals } from '../api/approvals'
import { getMySwotPendingActions } from '../api/swot'
import { getMyNotifications, getUnreadCount, markNotificationRead } from '../api/notifications'
import { getMyLeadershipProfile } from '../api/leadership'
import { getDashboard } from '../api/dashboard'
import Logo, { LogoMark } from '../components/Logo'

const NOT_DEPLOYED_STATES = ['CREATION', 'REVIEW', 'APPROVAL_PENDING']

const { Sider, Header, Content } = Layout

export default function MemberLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const qc = useQueryClient()

  const { data: pending = [] } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: getMyPendingApprovals,
    refetchInterval: 60_000,
  })
  const pendingCount = pending.length

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: getMyNotifications,
    refetchInterval: 30_000,
  })
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  })

  const handleNotificationClick = async (n) => {
    if (!n.isRead) {
      await markNotificationRead(n.id)
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    }
    if (n.type === 'ANNUAL_EVALUATION') {
      navigate('/portfolio/my-evaluation')
    } else if (n.type === 'GOAL_CYCLE') {
      navigate('/portfolio/goals')
    } else if (n.entityId && ['STRATEGY_MEMBERSHIP', 'STRATEGY_APPROVAL', 'SWOT_INVITE'].includes(n.type)) {
      navigate(`/strategies/${n.entityId}`)
    }
  }

  const notificationMenu = {
    items: notifications.length > 0
      ? notifications.slice(0, 10).map((n) => ({
          key: n.id,
          label: (
            <div style={{ maxWidth: 320, whiteSpace: 'normal', opacity: n.isRead ? 0.6 : 1 }}
              onClick={() => handleNotificationClick(n)}>
              {n.message}
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ),
        }))
      : [{ key: 'empty', label: 'No notifications', disabled: true }],
  }

  const swotQuery = useQuery({
    queryKey: ['swot-pending'],
    queryFn: getMySwotPendingActions,
    refetchInterval: 60_000,
  })
  const swotPending = swotQuery.data ?? []
  const swotPendingCount = swotPending.length

  const leadershipQuery = useQuery({ queryKey: ['my-leadership'], queryFn: getMyLeadershipProfile })
  const dashboardQuery = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const leadership = leadershipQuery.data
  const dashboard = dashboardQuery.data ?? []

  // Gates the *optional* consoles/items below -- true once every query they depend on has
  // resolved at least once, so they appear fully-formed in a single pass instead of the
  // Strategy Creation Console (or Team items) popping in piecemeal as each query settles.
  const roleNavReady = !leadershipQuery.isLoading && !dashboardQuery.isLoading && !swotQuery.isLoading

  const headedDepartments = leadership?.headedDepartments ?? []
  const headedOrgGroups = leadership?.headedOrgGroups ?? []
  const canCreateUniversity = headedOrgGroups.some((g) => g.isRoot)
  const canCreateDepartment = headedDepartments.length > 0
  const hasDirectReports = leadership?.hasDirectReports ?? false
  const hasMultiLevelHierarchy = leadership?.hasMultiLevelHierarchy ?? false
  const hasInProgressStrategy = dashboard.some((item) => NOT_DEPLOYED_STATES.includes(item.state))
  const canSeeCreationConsole =
    roleNavReady && (canCreateDepartment || canCreateUniversity || hasInProgressStrategy || swotPendingCount > 0)

  const isAdmin = user?.systemRoles?.includes('ADMIN')
  const isHR = user?.systemRoles?.includes('HR')

  const sections = [
    {
      key: 'strategy',
      label: 'Strategy',
      icon: <DashboardOutlined />,
      items: [
        { key: '/dashboard', icon: <DashboardOutlined />, label: 'My Strategies' },
        ...(pendingCount > 0
          ? [{ key: '/approvals', icon: <CheckSquareOutlined />, label: 'Approvals', badge: pendingCount }]
          : []),
      ],
    },
    canSeeCreationConsole && {
      key: 'creation',
      label: 'Strategy Creation',
      icon: <RocketOutlined />,
      items: [
        { key: '/strategy-creation', icon: <RocketOutlined />, label: 'New Strategy / In Progress' },
        ...(swotPendingCount > 0
          ? [{
              key: `/strategies/${swotPending[0].strategyId}/swot`,
              icon: <RocketOutlined />,
              label: 'SWOT Action Needed',
              badge: swotPendingCount,
            }]
          : []),
      ],
    },
    {
      key: 'portfolio',
      label: 'Portfolio',
      icon: <TrophyOutlined />,
      items: [
        { key: '/portfolio/achievements', icon: <TrophyOutlined />, label: 'My Portfolio' },
        { key: '/portfolio/my-evaluation', icon: <SolutionOutlined />, label: 'My Annual Evaluation' },
        { key: '/portfolio/goals', icon: <TrophyOutlined />, label: 'My Goals' },
      ],
    },
    // Separate section, own header -- everything here is about the people reporting up to this
    // user (either directly, as their evaluator, or across their whole org hierarchy, view-only),
    // never about their own personal portfolio above. Organization Evaluations only appears when
    // the hierarchy actually spans more than one level beyond direct reports (hasMultiLevelHierarchy)
    // -- otherwise it would show the exact same set of people as Team Evaluations, just read-only.
    roleNavReady && (hasDirectReports || hasMultiLevelHierarchy) && {
      key: 'team-portfolio',
      label: 'Portfolio As a Head',
      icon: <TeamOutlined />,
      items: [
        ...(hasDirectReports
          ? [
              { key: '/portfolio/team-goals', icon: <AimOutlined />, label: 'Team Goal Setting' },
              { key: '/portfolio/team-evaluations', icon: <TeamOutlined />, label: 'Team Evaluations' },
            ]
          : []),
        ...(hasMultiLevelHierarchy
          ? [{ key: '/portfolio/org-evaluations', icon: <ClusterOutlined />, label: 'Organization Evaluations' }]
          : []),
      ],
    },
    (isAdmin || isHR) && {
      key: 'admin',
      label: 'Administration',
      icon: <SettingOutlined />,
      items: [
        ...(isAdmin
          ? [
              { key: '/admin', icon: <DashboardOutlined />, label: 'Admin Dashboard' },
              { key: '/admin/users', icon: <TeamOutlined />, label: 'Users' },
              { key: '/admin/org-groups', icon: <ClusterOutlined />, label: 'Org Groups' },
              { key: '/admin/departments', icon: <ApartmentOutlined />, label: 'Departments' },
              { key: '/admin/planning-cycles', icon: <CalendarOutlined />, label: 'Planning Cycles' },
              { key: '/admin/academic-years', icon: <BookOutlined />, label: 'Academic Years' },
              { key: '/admin/strategies', icon: <OrderedListOutlined />, label: 'Strategies' },
              { key: '/admin/audit-logs', icon: <AuditOutlined />, label: 'Audit Logs' },
              { key: '/admin/portfolio/categories', icon: <AppstoreOutlined />, label: 'Portfolio Categories' },
            ]
          : []),
        { key: '/evaluation-reports', icon: <FileTextOutlined />, label: 'Evaluation Reports' },
      ],
    },
  ].filter(Boolean)

  const selectedKey =
    sections
      .flatMap((s) => s.items.map((i) => i.key))
      .filter((k) => location.pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] ?? '/dashboard'

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Sign out',
        onClick: () => {
          logout()
          navigate('/login')
        },
      },
    ],
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        className="app-sidebar"
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={220}
        style={{ overflow: 'auto', height: '100vh', position: 'sticky', top: 0 }}
      >
        <div className="sidebar-logo">
          {!collapsed && (
            <>
              <Logo size={28} />
              <div className="sidebar-logo-sub">Strategic Planning</div>
            </>
          )}
          {collapsed && <LogoMark size={28} style={{ display: 'block', margin: '0 auto' }} />}
        </div>
        <nav className={`side-nav${collapsed ? ' collapsed' : ''}`}>
          {sections.map((section) => (
            <div className="nav-section" key={section.key}>
              <div className="nav-section-header" title={section.label}>
                <span className="nav-section-icon">{section.icon}</span>
                <span className="nav-section-label">{section.label}</span>
              </div>
              <div className="nav-items">
                {section.items.map((item) => (
                  <Link
                    key={item.key}
                    to={item.key}
                    title={item.label}
                    className={`nav-item${selectedKey === item.key ? ' active' : ''}`}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    <span className="nav-item-label">{item.label}</span>
                    {item.badge > 0 && <span className="nav-item-badge">{item.badge}</span>}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {!roleNavReady && (
            <div className="nav-section">
              <div className="nav-skeleton-bar" />
              <div className="nav-skeleton-bar" style={{ width: '70%' }} />
            </div>
          )}
        </nav>
      </Sider>

      <Layout style={{ overflow: 'hidden' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e8eef6',
            height: 56,
            flexShrink: 0,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, color: '#6b7280' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dropdown menu={notificationMenu} placement="bottomRight" trigger={['click']}>
              <Badge count={unreadCount} size="small">
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18, color: '#6b7280' }} />} />
              </Badge>
            </Dropdown>
            <Dropdown menu={userMenu} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: '#1a2035',
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              <Avatar size={28} icon={<UserOutlined />} style={{ background: '#13223a' }} />
              {user?.email}
            </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ padding: '24px', background: '#f5f7fa', flex: 1, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
