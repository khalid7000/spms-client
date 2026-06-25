import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Alert, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { changePassword } from '../api/auth'
import { useAuth } from '../auth/AuthContext'

const { Title, Text } = Typography

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function onFinish({ currentPassword, newPassword }) {
    setError(null)
    setLoading(true)
    try {
      const data = await changePassword(currentPassword, newPassword)
      updateUser(data)
      navigate(user?.isAdmin ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--sidebar-bg)',
    }}>
      <Card style={{ width: 420, borderRadius: 8 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LockOutlined style={{ fontSize: 36, color: 'var(--gold)' }} />
          <Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>
            Change Your Password
          </Title>
          <Text type="secondary">
            You must set a new password before continuing.
          </Text>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
        )}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            label="Current password"
            name="currentPassword"
            rules={[{ required: true, message: 'Enter your current password' }]}
          >
            <Input.Password placeholder="Current password" />
          </Form.Item>

          <Form.Item
            label="New password"
            name="newPassword"
            rules={[
              { required: true, message: 'Enter a new password' },
              { min: 8, message: 'At least 8 characters' },
            ]}
          >
            <Input.Password placeholder="New password" />
          </Form.Item>

          <Form.Item
            label="Confirm new password"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
            >
              Set New Password
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
