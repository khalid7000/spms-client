import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  DashboardOutlined,
  TeamOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  CalendarOutlined,
  OrderedListOutlined,
  AuditOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'

const { Sider, Header, Content } = Layout

const menuItems = [
  { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Dashboard</Link> },
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
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        className="app-sidebar"
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={220}
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

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e8eef6',
            height: 56,
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

        <Content style={{ padding: '24px', background: '#f5f7fa', minHeight: 'calc(100vh - 56px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
