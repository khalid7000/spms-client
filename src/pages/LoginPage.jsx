// Login form; on success redirects back to wherever the user was headed, or the admin
// console for ADMIN-role users, otherwise the member dashboard.
import { useState } from 'react'
import { Form, Input, Button, Card, message, Alert } from 'antd'
import { MailOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Logo from '../components/Logo'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const from = location.state?.from?.pathname || null

  const handleSubmit = async ({ email, password }) => {
    setLoading(true)
    setError(null)
    try {
      const user = await login(email, password)
      if (from) {
        navigate(from, { replace: true })
      } else if (user.systemRoles?.includes('ADMIN')) {
        navigate('/admin', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password')
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
        style={{
          width: 380,
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: 'none',
        }}
        bodyStyle={{ padding: '36px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo size={44} textSize={28} textColor="#13223a" style={{ justifyContent: 'center' }} />
          <div style={{ color: '#6b7280', fontSize: 14, marginTop: 8 }}>
            Strategic Planning Management
          </div>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 20 }} />
        )}

        <Form layout="vertical" onFinish={handleSubmit} size="large">
          <Form.Item
            name="email"
            rules={[{ required: true, type: 'email', message: 'Enter your email' }]}
          >
            <Input prefix={<MailOutlined style={{ color: '#9ca3af' }} />} placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Enter your password' }]}
            style={{ marginBottom: 24 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Password"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{
              background: '#13223a',
              borderColor: '#13223a',
              height: 44,
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Sign In
          </Button>
        </Form>
      </Card>
    </div>
  )
}
