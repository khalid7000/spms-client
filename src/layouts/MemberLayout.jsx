// Main member-facing shell: side nav grouped into role-based consoles (Strategy Console,
// Strategy Creation Console, Portfolio Console, plus Admin/HR links), header user menu, and
// the routed page content via <Outlet/>. The nav itself is plain markup rather than AntD's
// <Menu> -- Menu recomputes its ink-bar/indicator against the `items` array identity, so
// rebuilding that array on every render (as role/dashboard queries settle one by one) reads
// as sections flickering in and out. Plain elements only change when the boolean they render
// from actually changes.
import { useState } from 'react'
import { Layout, Avatar, Dropdown, Button, Badge, Switch, Empty } from 'antd'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  DashboardOutlined,
  CheckSquareOutlined,
  LogoutOutlined,
  LockOutlined,
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
  CheckCircleOutlined,
  UndoOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  NodeIndexOutlined,
  UserSwitchOutlined,
  FundProjectionScreenOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { useTerminology } from '../TerminologyContext'
import { getMyPendingApprovals } from '../api/approvals'
import { getMySwotPendingActions } from '../api/swot'
import { getPendingVsmAuthorGrantsForMe, getMyVsmAuthorGrants } from '../api/vsmAuthorGrants'
import { listMyVsmMaps } from '../api/vsmMaps'
import { getApprovalDelegationsPendingForMe, getApprovalDelegationsDelegatedToMe } from '../api/approvalDelegations'
import {
  getMyNotifications, getUnreadCount, markNotificationRead, markNotificationUnread, markAllNotificationsRead,
} from '../api/notifications'
import { getMyLeadershipProfile } from '../api/leadership'
import { getDashboard } from '../api/dashboard'
import Logo, { LogoMark } from '../components/Logo'
import LanguageSwitcher from '../components/LanguageSwitcher'

const NOT_DEPLOYED_STATES = ['CREATION', 'REVIEW', 'APPROVAL_PENDING']

const { Sider, Header, Content } = Layout

export default function MemberLayout() {
  const { t } = useTranslation()
  const { academicYearLabel } = useTerminology()
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

  // Unread-only is a display filter over the same already-fetched list -- no separate query.
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const invalidateNotifications = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notifications-unread-count'] })
  }

  const handleNotificationClick = async (n) => {
    if (!n.isRead) {
      await markNotificationRead(n.id)
      invalidateNotifications()
    }
    if (n.type === 'ANNUAL_EVALUATION') {
      navigate('/portfolio/my-evaluation')
    } else if (n.type === 'ANNUAL_EVALUATION_HEAD') {
      navigate(`/portfolio/team-evaluations?evaluationId=${n.entityId}`)
    } else if (n.type === 'GOAL_CYCLE') {
      navigate('/portfolio/goals')
    } else if (n.type === 'GOAL_CYCLE_HEAD') {
      navigate(`/portfolio/team-goals?cycleId=${n.entityId}`)
    } else if (n.entityId && ['STRATEGY_MEMBERSHIP', 'STRATEGY_APPROVAL', 'SWOT_INVITE'].includes(n.type)) {
      navigate(`/strategies/${n.entityId}`)
    }
  }

  // Toggles read/unread on its own, without navigating -- stopPropagation keeps the row's own
  // click (which marks read + navigates) from also firing.
  const handleToggleRead = async (n, e) => {
    e.stopPropagation()
    if (n.isRead) {
      await markNotificationUnread(n.id)
    } else {
      await markNotificationRead(n.id)
    }
    invalidateNotifications()
  }

  const handleMarkAllRead = async (e) => {
    e.stopPropagation()
    await markAllNotificationsRead()
    invalidateNotifications()
  }

  const visibleNotifications = showUnreadOnly ? notifications.filter((n) => !n.isRead) : notifications

  const swotQuery = useQuery({
    queryKey: ['swot-pending'],
    queryFn: getMySwotPendingActions,
    refetchInterval: 60_000,
  })
  const swotPending = swotQuery.data ?? []
  const swotPendingCount = swotPending.length

  // Anyone can end up as a top-of-hierarchy approver for a VSM author grant, not just heads/admins
  // -- e.g. a Provost with no department of their own -- so this is checked independently of
  // canSeeVsm below rather than folded into the same leadership-derived gate.
  const { data: pendingVsmGrants = [] } = useQuery({
    queryKey: ['vsm-author-grant-approvals-nav'],
    queryFn: getPendingVsmAuthorGrantsForMe,
    refetchInterval: 60_000,
  })
  const pendingVsmGrantsCount = pendingVsmGrants.length
  const { data: myVsmGrants = [] } = useQuery({
    queryKey: ['my-vsm-author-grants-nav'], queryFn: getMyVsmAuthorGrants,
  })
  const hasActiveVsmGrant = myVsmGrants.some((g) => g.status === 'ACTIVE')

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
  // Anyone in the same department as an existing map -- not just its head/author -- can view that
  // map and pull tasks off its board (see PermissionService#assertCanViewVsmMap/
  // #assertCanViewDepartmentBoard's same-department checks). Without this, a regular team member
  // has no nav entry point at all to reach a board their head published a task to, even though the
  // backend would happily let them view it and pull -- the exact "backend allows it, UI never
  // shows the option" gap already hit once before with VSM author grants (Phase 4b).
  const { data: myVsmMapsNav = [] } = useQuery({ queryKey: ['my-vsm-maps-nav'], queryFn: listMyVsmMaps })
  // VSM: dept/org-group heads plus Admin (who can see every map), anyone with an ACTIVE "VSM
  // author" delegation grant (Phase 4b, may hold no leadership position at all), anyone with a
  // pending grant approval to decide (e.g. a Provost with no department of their own), or anyone
  // who can already see at least one map (covers plain department membership).
  const canSeeVsm = (roleNavReady && (canCreateDepartment || canCreateUniversity || isAdmin))
    || hasActiveVsmGrant || pendingVsmGrantsCount > 0 || myVsmMapsNav.length > 0

  // Approval Delegation Console: heads can delegate authority they hold; but anyone can also end
  // up on the other two sides of this flow -- a manager asked to approve someone else's delegation
  // to an "anyone else" delegate, or a delegate who received authority -- regardless of whether
  // they themselves head anything.
  const { data: pendingDelegationApprovals = [] } = useQuery({
    queryKey: ['approval-delegation-pending-for-me-nav'],
    queryFn: getApprovalDelegationsPendingForMe,
    refetchInterval: 60_000,
  })
  const pendingDelegationApprovalsCount = pendingDelegationApprovals.length
  const { data: delegatedToMeNav = [] } = useQuery({
    queryKey: ['approval-delegation-delegated-to-me-nav'], queryFn: getApprovalDelegationsDelegatedToMe,
  })
  const hasActiveDelegationToMe = delegatedToMeNav.some((d) => d.status === 'ACTIVE')
  const canSeeApprovalDelegation = (roleNavReady && (canCreateDepartment || canCreateUniversity))
    || pendingDelegationApprovalsCount > 0 || hasActiveDelegationToMe
  // Limited admin: user management only (Users page + CSV import) -- no other console feature,
  // granted only by a true ADMIN. See AdminService.createUser/updateUser for the server-side
  // guard that keeps this role from ever granting ADMIN/HR/USER_ADMIN to anyone.
  const isUserAdmin = user?.systemRoles?.includes('USER_ADMIN')

  const sections = [
    {
      key: 'strategy',
      label: t('nav.strategy'),
      icon: <DashboardOutlined />,
      items: [
        { key: '/dashboard', icon: <DashboardOutlined />, label: t('nav.myStrategies') },
        ...(pendingCount > 0
          ? [{ key: '/approvals', icon: <CheckSquareOutlined />, label: t('nav.approvals'), badge: pendingCount }]
          : []),
      ],
    },
    canSeeCreationConsole && {
      key: 'creation',
      label: t('nav.strategyCreation'),
      icon: <RocketOutlined />,
      items: [
        { key: '/strategy-creation', icon: <RocketOutlined />, label: t('nav.newStrategyInProgress') },
        ...(swotPendingCount > 0
          ? [{
              key: `/strategies/${swotPending[0].strategyId}/swot`,
              icon: <RocketOutlined />,
              label: t('nav.swotActionNeeded'),
              badge: swotPendingCount,
            }]
          : []),
      ],
    },
    canSeeVsm && {
      key: 'vsm',
      label: t('nav.valueStreamMapping'),
      icon: <NodeIndexOutlined />,
      items: [
        { key: '/vsm', icon: <NodeIndexOutlined />, label: t('nav.valueStreamMaps') },
        { key: '/vsm/analytics', icon: <FundProjectionScreenOutlined />, label: t('nav.vsmAnalytics') },
        ...(pendingVsmGrantsCount > 0
          ? [{
              key: '/vsm-author-grant-approvals',
              icon: <CheckSquareOutlined />,
              label: t('nav.vsmAuthorGrantApprovals'),
              badge: pendingVsmGrantsCount,
            }]
          : []),
      ],
    },
    canSeeApprovalDelegation && {
      key: 'approval-delegation',
      label: t('nav.approvalDelegation'),
      icon: <UserSwitchOutlined />,
      items: [
        {
          key: '/approval-delegations',
          icon: <UserSwitchOutlined />,
          label: t('nav.approvalDelegationConsole'),
          ...(pendingDelegationApprovalsCount > 0 ? { badge: pendingDelegationApprovalsCount } : {}),
        },
      ],
    },
    {
      key: 'portfolio',
      label: t('nav.portfolio'),
      icon: <TrophyOutlined />,
      items: [
        { key: '/portfolio/achievements', icon: <TrophyOutlined />, label: t('nav.myPortfolio') },
        { key: '/portfolio/my-evaluation', icon: <SolutionOutlined />, label: t('nav.myAnnualEvaluation') },
        { key: '/portfolio/goals', icon: <TrophyOutlined />, label: t('nav.myGoals') },
      ],
    },
    // Separate section, own header -- everything here is about the people reporting up to this
    // user (either directly, as their evaluator, or across their whole org hierarchy, view-only),
    // never about their own personal portfolio above. Organization Evaluations only appears when
    // the hierarchy actually spans more than one level beyond direct reports (hasMultiLevelHierarchy)
    // -- otherwise it would show the exact same set of people as Team Evaluations, just read-only.
    roleNavReady && (hasDirectReports || hasMultiLevelHierarchy) && {
      key: 'team-portfolio',
      label: t('nav.portfolioAsHead'),
      icon: <TeamOutlined />,
      items: [
        ...(hasDirectReports
          ? [
              { key: '/portfolio/team-goals', icon: <AimOutlined />, label: t('nav.teamGoalSetting') },
              { key: '/portfolio/team-evaluations', icon: <TeamOutlined />, label: t('nav.teamEvaluations') },
            ]
          : []),
        ...(hasMultiLevelHierarchy
          ? [{ key: '/portfolio/org-evaluations', icon: <ClusterOutlined />, label: t('nav.organizationEvaluations') }]
          : []),
      ],
    },
    (isAdmin || isHR || isUserAdmin) && {
      key: 'admin',
      label: t('nav.administration'),
      icon: <SettingOutlined />,
      items: [
        ...(isAdmin
          ? [
              { key: '/admin', icon: <DashboardOutlined />, label: t('nav.adminDashboard') },
              { key: '/admin/users', icon: <TeamOutlined />, label: t('nav.users') },
              { key: '/admin/org-groups', icon: <ClusterOutlined />, label: t('nav.orgGroups') },
              { key: '/admin/departments', icon: <ApartmentOutlined />, label: t('nav.departments') },
              { key: '/admin/planning-cycles', icon: <CalendarOutlined />, label: t('nav.planningCycles') },
              { key: '/admin/academic-years', icon: <BookOutlined />, label: `${academicYearLabel}s` },
              { key: '/admin/strategies', icon: <OrderedListOutlined />, label: t('nav.strategies') },
              { key: '/admin/audit-logs', icon: <AuditOutlined />, label: t('nav.auditLogs') },
              { key: '/admin/portfolio/categories', icon: <AppstoreOutlined />, label: t('nav.portfolioCategories') },
              { key: '/admin/achievement-types', icon: <TrophyOutlined />, label: t('nav.achievementTypes') },
              { key: '/admin/data-repository', icon: <DatabaseOutlined />, label: t('nav.dataRepository') },
              { key: '/admin/organization-settings', icon: <GlobalOutlined />, label: t('nav.organizationSettings') },
              { key: '/admin/vsm-author-grants', icon: <NodeIndexOutlined />, label: t('nav.vsmAuthorGrants') },
            ]
          : []),
        // A pure User Admin (not also a full Admin) only ever sees this one link -- everything
        // else in this section is admin-only above, or admin/HR-only below.
        ...(isUserAdmin && !isAdmin
          ? [{ key: '/admin/users', icon: <TeamOutlined />, label: t('nav.users') }]
          : []),
        ...(isAdmin || isHR
          ? [{ key: '/evaluation-reports', icon: <FileTextOutlined />, label: t('nav.evaluationReports') }]
          : []),
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
      // Hidden entirely when LDAP owns the password -- there's nothing for this app to
      // change (see AuthController.changePassword's server-side rejection for the same rule).
      ...(!user?.ldapEnabled ? [{
        key: 'change-password',
        icon: <LockOutlined />,
        label: t('nav.changePassword'),
        onClick: () => navigate('/change-password'),
      }] : []),
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('nav.signOut'),
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
              <div className="sidebar-logo-sub">{t('nav.sidebarSubtitle')}</div>
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
            <LanguageSwitcher />
            <Dropdown
              placement="bottomRight"
              trigger={['click']}
              popupRender={() => (
                <div style={{
                  width: 360, background: '#fff', borderRadius: 8,
                  boxShadow: '0 6px 16px rgba(0,0,0,0.12)', overflow: 'hidden',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderBottom: '1px solid #f0f0f0',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <Switch size="small" checked={showUnreadOnly} onChange={setShowUnreadOnly} />
                      {t('notifications.unreadOnly')}
                    </label>
                    <Button type="link" size="small" disabled={unreadCount === 0} onClick={handleMarkAllRead}>
                      {t('notifications.markAllRead')}
                    </Button>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {visibleNotifications.length === 0 ? (
                      <Empty
                        description={showUnreadOnly ? t('notifications.noUnread') : t('notifications.none')}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ padding: '24px 0' }}
                      />
                    ) : (
                      visibleNotifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px',
                            borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                            background: n.isRead ? 'transparent' : '#f0f5ff',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0, opacity: n.isRead ? 0.6 : 1 }}>
                            <div style={{ whiteSpace: 'normal' }}>{n.message}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(n.createdAt).toLocaleString()}</div>
                          </div>
                          <Button
                            type="text" size="small"
                            title={n.isRead ? t('notifications.markUnread') : t('notifications.markRead')}
                            icon={n.isRead
                              ? <UndoOutlined style={{ color: '#9ca3af' }} />
                              : <CheckCircleOutlined style={{ color: '#1677ff' }} />}
                            onClick={(e) => handleToggleRead(n, e)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            >
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
