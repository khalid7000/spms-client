// Forced/self-service password change; on success redirects to the admin console for
// ADMIN-role users, otherwise the member dashboard.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Alert, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { changePassword } from '../api/auth'
import { useAuth } from '../auth/AuthContext'

const { Title, Text } = Typography

export default function ChangePasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Defense-in-depth: MemberLayout already hides the menu link that gets here, and the
  // backend rejects the actual submit, but a user can still land on this URL directly (or
  // be forced here by ProtectedRoute if a pre-existing row still has mustChangePassword=true
  // under an LDAP-enabled deployment). Explain why instead of showing a form that's
  // guaranteed to fail.
  if (user?.ldapEnabled) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sidebar-bg)',
      }}>
        <Card style={{ width: 420, borderRadius: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <LockOutlined style={{ fontSize: 36, color: 'var(--gold)' }} />
            <Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>
              {t('changePassword.title')}
            </Title>
            <Text type="secondary">{t('changePassword.ldapManagedMessage')}</Text>
            <Button block style={{ marginTop: 20 }}
              onClick={() => navigate(user?.systemRoles?.includes('ADMIN') ? '/admin' : '/dashboard', { replace: true })}>
              {t('changePassword.backButton')}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  async function onFinish({ currentPassword, newPassword }) {
    setError(null)
    setLoading(true)
    try {
      const data = await changePassword(currentPassword, newPassword)
      updateUser(data)
      navigate(user?.systemRoles?.includes('ADMIN') ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || t('changePassword.genericError'))
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
            {t('changePassword.title')}
          </Title>
          <Text type="secondary">
            {user?.mustChangePassword ? t('changePassword.subtitle') : t('changePassword.voluntarySubtitle')}
          </Text>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
        )}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            label={t('changePassword.currentPasswordLabel')}
            name="currentPassword"
            rules={[{ required: true, message: t('changePassword.currentPasswordRequired') }]}
          >
            <Input.Password placeholder={t('changePassword.currentPasswordLabel')} />
          </Form.Item>

          <Form.Item
            label={t('changePassword.newPasswordLabel')}
            name="newPassword"
            rules={[
              { required: true, message: t('changePassword.newPasswordRequired') },
              { min: 8, message: t('changePassword.newPasswordMinLength') },
            ]}
          >
            <Input.Password placeholder={t('changePassword.newPasswordLabel')} />
          </Form.Item>

          <Form.Item
            label={t('changePassword.confirmLabel')}
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('changePassword.confirmRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error(t('changePassword.passwordMismatch')))
                },
              }),
            ]}
          >
            <Input.Password placeholder={t('changePassword.confirmLabel')} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}
            >
              {t('changePassword.submit')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
