// Super Admin dashboard: every organization on the platform with basic stats. Live-queried
// on load (see PlatformDashboardService's javadoc for why a cache isn't needed yet at this scale).
import { useState, useEffect, useRef } from 'react'
import { Table, Button, Tag, Avatar, Modal, Typography, Popconfirm, message, Input, Form } from 'antd'
import { PlusOutlined, ApartmentOutlined, KeyOutlined, EditOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getDashboard, getOrgUsers, resetOrgUserPassword, checkSlugAvailable, renameOrgSlug } from '../../api/platformOrganizations'
import TableTotal from '../../components/TableTotal'

const STATUS_COLORS = {
  ACTIVE: 'green',
  PROVISIONING: 'gold',
  FAILED: 'red',
  SUSPENDED: 'default',
}

function OrgUsersPanel({ orgId, slug }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newPassword, setNewPassword] = useState(null)
  const loginUrl = `${window.location.origin}/${slug}/login`

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['platform-org-users', orgId],
    queryFn: () => getOrgUsers(orgId),
  })

  const resetMutation = useMutation({
    mutationFn: (userId) => resetOrgUserPassword(orgId, userId),
    onSuccess: (data) => {
      setNewPassword(data.newPassword)
      queryClient.invalidateQueries({ queryKey: ['platform-org-users', orgId] })
    },
    onError: (err) => {
      message.error(err.response?.data?.message || t('platformConsole.resetPasswordError'))
    },
  })

  const columns = [
    {
      title: t('common.name'),
      key: 'name',
      render: (_, r) => `${r.fname} ${r.lname}`,
    },
    { title: t('login.emailPlaceholder'), dataIndex: 'email', key: 'email' },
    {
      title: t('platformConsole.rolesCol'),
      dataIndex: 'roles',
      key: 'roles',
      render: (roles) => roles.map((role) => <Tag key={role}>{role}</Tag>),
    },
    {
      title: t('common.status'),
      key: 'status',
      render: (_, r) => (
        <>
          <Tag color={r.active ? 'green' : 'default'}>
            {r.active ? t('platformConsole.userActive') : t('platformConsole.userInactive')}
          </Tag>
          {r.mustChangePassword && (
            <Tag color="gold">{t('platformConsole.mustChangePasswordTag')}</Tag>
          )}
        </>
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Popconfirm
          title={t('platformConsole.resetPasswordConfirmTitle')}
          description={t('platformConsole.resetPasswordConfirmDescription')}
          onConfirm={() => resetMutation.mutate(r.id)}
          okText={t('platformConsole.resetPasswordButton')}
          cancelText={t('common.cancel')}
        >
          <Button size="small" icon={<KeyOutlined />} loading={resetMutation.isPending}>
            {t('platformConsole.resetPasswordButton')}
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary" style={{ marginInlineEnd: 8 }}>
          {t('platformConsole.loginUrlLabel')}
        </Typography.Text>
        <Typography.Text copyable={{ text: loginUrl }} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>
          {loginUrl}
        </Typography.Text>
      </div>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="small"
      />
      <Modal
        open={!!newPassword}
        title={t('platformConsole.resetPasswordSuccessTitle')}
        onCancel={() => setNewPassword(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setNewPassword(null)}>
            {t('common.done')}
          </Button>,
        ]}
      >
        <p>{t('platformConsole.resetPasswordSuccessBody')}</p>
        <Typography.Paragraph
          copyable={{ text: newPassword }}
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 18,
            background: '#f5f5f5',
            padding: '10px 14px',
            borderRadius: 6,
          }}
        >
          {newPassword}
        </Typography.Paragraph>
      </Modal>
    </>
  )
}

function EditSlugModal({ org, onClose }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState(org.slug)
  const [slugStatus, setSlugStatus] = useState(null) // null | 'checking' | 'available' | 'taken' | 'unchanged'
  const debounceRef = useRef(null)

  const checkSlug = (value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value) { setSlugStatus(null); return }
    if (value === org.slug) { setSlugStatus('unchanged'); return }
    setSlugStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkSlugAvailable(value)
        setSlugStatus(available ? 'available' : 'taken')
      } catch {
        setSlugStatus(null)
      }
    }, 400)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const renameMutation = useMutation({
    mutationFn: () => renameOrgSlug(org.id, slug),
    onSuccess: () => {
      message.success(t('platformConsole.slugUpdated'))
      queryClient.invalidateQueries({ queryKey: ['platform-dashboard'] })
      onClose()
    },
    onError: (err) => {
      message.error(err.response?.data?.message || t('platformConsole.slugUpdateError'))
    },
  })

  const canSave = slugStatus === 'available' || slugStatus === 'unchanged'

  return (
    <Modal
      open
      title={t('platformConsole.editSlugTitle', { name: org.name })}
      onCancel={onClose}
      onOk={() => renameMutation.mutate()}
      okButtonProps={{ disabled: !canSave, loading: renameMutation.isPending }}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
    >
      <Form layout="vertical">
        <Form.Item label={t('platformConsole.slugLabel')} extra={t('platformConsole.editSlugWarning')}>
          <Input
            value={slug}
            onChange={(e) => {
              const v = e.target.value.toLowerCase()
              setSlug(v)
              checkSlug(v)
            }}
          />
        </Form.Item>
        {slugStatus === 'checking' && <span>{t('platformConsole.slugChecking')}</span>}
        {slugStatus === 'available' && (
          <span style={{ color: '#52c41a' }}><CheckCircleFilled /> {t('platformConsole.slugAvailable')}</span>
        )}
        {slugStatus === 'taken' && (
          <span style={{ color: '#ef4444' }}><CloseCircleFilled /> {t('platformConsole.slugTaken')}</span>
        )}
      </Form>
    </Modal>
  )
}

export default function OrganizationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [editingOrg, setEditingOrg] = useState(null)

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: getDashboard,
  })

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={24} src={r.logoPath} icon={<ApartmentOutlined />} shape="square" />
          <span style={{ fontWeight: 500 }}>{v}</span>
          {r.isDefault && <Tag color="blue">{t('platformConsole.defaultOrgTag')}</Tag>}
        </div>
      ),
    },
    {
      title: t('platformConsole.slugCol'),
      dataIndex: 'slug',
      key: 'slug',
      render: (v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>{v}</span>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditingOrg(r)}
            aria-label={t('platformConsole.editSlugButton')}
          />
        </div>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
    },
    { title: t('platformConsole.usersCol'), dataIndex: 'userCount', key: 'userCount', align: 'right' },
    { title: t('dashboard.strategiesLabel'), dataIndex: 'strategyCount', key: 'strategyCount', align: 'right' },
    { title: t('platformConsole.notificationsCol'), dataIndex: 'notificationCount', key: 'notificationCount', align: 'right' },
    { title: t('dashboard.initiativesLabel'), dataIndex: 'initiativeCount', key: 'initiativeCount', align: 'right' },
    {
      title: t('platformConsole.createdCol'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('platformConsole.organizationsTitle')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/console/organizations/new')}
          style={{ background: '#13223a' }}>
          {t('platformConsole.newOrganizationButton')}
        </Button>
      </div>

      <TableTotal count={orgs.length} />
      <Table
        dataSource={orgs}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        expandable={{
          expandedRowRender: (org) => <OrgUsersPanel orgId={org.id} slug={org.slug} />,
        }}
      />

      {editingOrg && <EditSlugModal org={editingOrg} onClose={() => setEditingOrg(null)} />}
    </div>
  )
}
