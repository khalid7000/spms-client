// Super Admin login -- same shell/shape as the tenant LoginPage, but posts through
// PlatformAuthContext (a wholly separate token/identity space, see that file's header comment).
import { useState } from 'react'
import { Form, Input, Button, Card, Alert } from 'antd'
import { MailOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatformAuth } from '../PlatformAuthContext'
import Logo from '../../components/Logo'

export default function PlatformLoginPage() {
  const { t } = useTranslation()
  const { login } = usePlatformAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async ({ email, password }) => {
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/console/organizations', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || t('login.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #13223a 0%, #1a3a6b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        style={{ width: 380, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: 'none' }}
        bodyStyle={{ padding: '36px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo size={44} textSize={28} textColor="#13223a" style={{ justifyContent: 'center' }} />
          <div style={{ color: '#6b7280', fontSize: 14, marginTop: 8 }}>
            {t('platformConsole.consoleLabel')}
          </div>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 20 }} />
        )}

        <Form layout="vertical" onFinish={handleSubmit} size="large">
          <Form.Item
            name="email"
            rules={[{ required: true, type: 'email', message: t('login.emailRequired') }]}
          >
            <Input prefix={<MailOutlined style={{ color: '#9ca3af' }} />} placeholder={t('login.emailPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: t('login.passwordRequired') }]}
            style={{ marginBottom: 24 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder={t('login.passwordPlaceholder')}
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{ background: '#13223a', borderColor: '#13223a', height: 44, fontWeight: 600, fontSize: 15 }}
          >
            {t('login.signIn')}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
