// Minimal shell for the Super Admin console -- deliberately not MemberLayout (that's full of
// tenant-scoped assumptions: department/role nav, TerminologyContext labels, etc.). Just a
// header with the console's identity and a logout button, then whatever page is routed in.
import { Outlet, Link } from 'react-router-dom'
import { Button } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import Logo from '../components/Logo'
import { usePlatformAuth } from './PlatformAuthContext'

export default function PlatformLayout() {
  const { t } = useTranslation()
  const { admin, logout } = usePlatformAuth()

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', background: '#13223a', color: '#fff',
      }}>
        <Link to="/console/organizations" style={{ display: 'flex', alignItems: 'center' }}>
          <Logo size={30} textSize={19} textColor="#fff" />
          <span style={{ marginInlineStart: 12, opacity: 0.7, fontSize: 13 }}>{t('platformConsole.consoleLabel')}</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{admin?.email}</span>
          <Button size="small" icon={<LogoutOutlined />} onClick={logout}>{t('nav.signOut')}</Button>
        </div>
      </div>
      <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>
        <Outlet />
      </div>
    </div>
  )
}
