import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  DashboardOutlined,
  TeamOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  CalendarOutlined,
  BookOutlined,
  OrderedListOutlined,
  AuditOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getDashboard } from '../api/dashboard'

const { Sider, Header, Content } = Layout

const ADMIN_MENU_ITEMS = [
  { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Admin Dashboard</Link> },
  { key: '/admin/users', icon: <TeamOutlined />, label: <Link to="/admin/users">Users</Link> },
  {
    key: '/admin/org-groups',
    icon: <ClusterOutlined />,
    label: <Link to="/admin/org-groups">Org Groups</Link>,
  },
  {
    key: '/admin/departments',
    icon: <ApartmentOutlined />,
    label: <Link to="/admin/departments">Departments</Link>,
  },
  {
    key: '/admin/planning-cycles',
    icon: <CalendarOutlined />,
    label: <Link to="/admin/planning-cycles">Planning Cycles</Link>,
  },
  {
    key: '/admin/academic-years',
    icon: <BookOutlined />,
    label: <Link to="/admin/academic-years">Academic Years</Link>,
  },
  {
    key: '/admin/strategies',
    icon: <OrderedListOutlined />,
    label: <Link to="/admin/strategies">Strategies</Link>,
  },
  {
    key: '/admin/audit-logs',
    icon: <AuditOutlined />,
    label: <Link to="/admin/audit-logs">Audit Logs</Link>,
  },
]

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const { data: dashboardItems = [] } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  const menuItems = [
    ...(dashboardItems.length > 0
      ? [{ key: '/dashboard', icon: <HomeOutlined />, label: <Link to="/dashboard">My Strategies</Link> }]
      : []),
    ...ADMIN_MENU_ITEMS,
  ]

  const selectedKey =
    menuItems
      .map((m) => m.key)
      .filter((k) => location.pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] ?? '/admin'

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
              <div className="sidebar-logo-sub">Admin Console</div>
            </>
          )}
          {collapsed && (
            <div className="sidebar-logo-text" style={{ fontSize: 16 }}>
              SA
            </div>
          )}
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
