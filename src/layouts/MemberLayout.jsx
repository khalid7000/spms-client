import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button, Badge } from 'antd'
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
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getMyPendingApprovals } from '../api/approvals'
import { getMySwotPendingActions } from '../api/swot'

const { Sider, Header, Content } = Layout

export default function MemberLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const { data: pending = [] } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: getMyPendingApprovals,
    refetchInterval: 60_000,
  })
  const pendingCount = pending.length

  const { data: swotPending = [] } = useQuery({
    queryKey: ['swot-pending'],
    queryFn: getMySwotPendingActions,
    refetchInterval: 60_000,
  })
  const swotPendingCount = swotPending.length

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">My Strategies</Link>,
    },
    ...(pendingCount > 0
      ? [
          {
            key: '/approvals',
            icon: <CheckSquareOutlined />,
            label: (
              <Link to="/approvals">
                Approvals
                <Badge count={pendingCount} size="small" style={{ marginLeft: 6 }} />
              </Link>
            ),
          },
        ]
      : []),
    ...(swotPendingCount > 0
      ? [
          {
            key: `/strategies/${swotPending[0].strategyId}/swot`,
            icon: <RocketOutlined />,
            label: (
              <Link to={`/strategies/${swotPending[0].strategyId}/swot`}>
                SWOT Action Needed
                <Badge count={swotPendingCount} size="small" style={{ marginLeft: 6 }} />
              </Link>
            ),
          },
        ]
      : []),
    ...(user?.isAdmin
      ? [
          {
            key: '/admin',
            icon: <SettingOutlined />,
            label: <Link to="/admin">Admin Console</Link>,
          },
        ]
      : []),
  ]

  const selectedKey =
    menuItems
      .map((m) => m.key)
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
              <div className="sidebar-logo-text">StratAlign</div>
              <div className="sidebar-logo-sub">Strategic Planning</div>
            </>
          )}
          {collapsed && <div className="sidebar-logo-text" style={{ fontSize: 16 }}>SA</div>}
        </div>
        <Menu
          className="app-sidebar"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ background: 'transparent', border: 'none', marginTop: 8 }}
        />
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
        </Header>

        <Content style={{ padding: '24px', background: '#f5f7fa', flex: 1, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
