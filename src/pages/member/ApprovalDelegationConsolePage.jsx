// General-purpose approval-authority delegation console: lets a department/org-group head hand
// off their approval authority (Strategy chains, VSM author-grant approval, and any future type --
// see PermissionService#resolveEffectiveApprover on the backend) to another employee for a bounded
// window. Delegating to an ancestor head or a direct report activates immediately; anyone else
// needs the delegator's own manager to sign off first (skipped if the delegator is at the top of
// the org pyramid). Also surfaces the two other roles a user can play in this flow: deciding a
// pending delegation as someone's manager, and seeing what's been delegated to them.
import { useState } from 'react'
import { Card, Button, Modal, Form, Select, DatePicker, Table, Tag, Empty, message, Popconfirm, Typography, Tabs } from 'antd'
import { UserSwitchOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { getMyLeadershipProfile } from '../../api/leadership'
import { searchUsers } from '../../api/strategies'
import {
  createApprovalDelegation, getMyApprovalDelegations, getApprovalDelegationsDelegatedToMe,
  getApprovalDelegationsPendingForMe, approveApprovalDelegation, rejectApprovalDelegation, cancelApprovalDelegation,
} from '../../api/approvalDelegations'

const { Paragraph } = Typography

const STATUS_COLORS = { PENDING_MANAGER_APPROVAL: 'gold', ACTIVE: 'green', REJECTED: 'red', CANCELLED: 'default' }
const MAX_DURATION = { amount: 4, unit: 'month', extraDays: 15 } // "no longer than 4.5 months"

export default function ApprovalDelegationConsolePage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [activeRole, setActiveRole] = useState(null) // { scopeType, scopeId, label }
  const [form] = Form.useForm()
  const [userOptions, setUserOptions] = useState([])
  const [searching, setSearching] = useState(false)
  const startDate = Form.useWatch('startDate', form)

  const { data: leadership } = useQuery({ queryKey: ['my-leadership'], queryFn: getMyLeadershipProfile })
  const { data: mine = [], isLoading: mineLoading } = useQuery({ queryKey: ['approval-delegations-mine'], queryFn: getMyApprovalDelegations })
  const { data: delegatedToMe = [], isLoading: delegatedLoading } = useQuery({ queryKey: ['approval-delegations-delegated-to-me'], queryFn: getApprovalDelegationsDelegatedToMe })
  const { data: pendingForMe = [], isLoading: pendingLoading } = useQuery({ queryKey: ['approval-delegations-pending-for-me'], queryFn: getApprovalDelegationsPendingForMe })

  const roles = [
    ...((leadership?.headedDepartments ?? []).map((d) => ({ scopeType: 'DEPARTMENT', scopeId: d.id, label: d.name }))),
    ...((leadership?.headedOrgGroups ?? []).map((g) => ({ scopeType: 'ORG_GROUP', scopeId: g.id, label: g.title }))),
  ]

  const handleUserSearch = async (q) => {
    if (!q || q.length < 2) { setUserOptions([]); return }
    setSearching(true)
    try {
      const users = await searchUsers(q)
      setUserOptions(users.map((u) => ({ value: u.id, label: `${u.fname} ${u.lname} — ${u.email}` })))
    } finally {
      setSearching(false)
    }
  }

  const openDelegateModal = (role) => {
    setActiveRole(role)
    form.resetFields()
    setUserOptions([])
    setModalOpen(true)
  }

  const createMut = useMutation({
    mutationFn: (values) => createApprovalDelegation({
      delegateId: values.delegateId,
      scopeType: activeRole.scopeType,
      scopeId: activeRole.scopeId,
      startDate: values.startDate.format('YYYY-MM-DD'),
      endDate: values.endDate.format('YYYY-MM-DD'),
    }),
    onSuccess: () => {
      message.success(t('approvalDelegation.createSuccess'))
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['approval-delegations-mine'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('approvalDelegation.createError')),
  })

  const decideMut = useMutation({
    mutationFn: ({ id, approved }) => (approved ? approveApprovalDelegation(id) : rejectApprovalDelegation(id)),
    onSuccess: () => {
      message.success(t('approvalDelegation.decideSuccess'))
      qc.invalidateQueries({ queryKey: ['approval-delegations-pending-for-me'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('approvalDelegation.decideError')),
  })

  const cancelMut = useMutation({
    mutationFn: cancelApprovalDelegation,
    onSuccess: () => {
      message.success(t('approvalDelegation.cancelSuccess'))
      qc.invalidateQueries({ queryKey: ['approval-delegations-mine'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('approvalDelegation.cancelError')),
  })

  const disabledEndDate = (current) => {
    if (!startDate) return false
    const min = startDate.startOf('day')
    const max = startDate.add(MAX_DURATION.amount, MAX_DURATION.unit).add(MAX_DURATION.extraDays, 'day')
    return current && (current < min || current > max)
  }

  const roleColumns = [
    { title: t('approvalDelegation.colRole'), render: (_, r) => r.label },
    { title: t('common.type'), render: (_, r) => (r.scopeType === 'DEPARTMENT' ? t('common.department') : t('vsm.orgGroup')) },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <Button size="small" type="primary" ghost onClick={() => openDelegateModal(r)}>
          {t('approvalDelegation.delegate')}
        </Button>
      ),
    },
  ]

  const mineColumns = [
    { title: t('approvalDelegation.colScope'), render: (_, r) => r.departmentName || r.orgGroupName },
    { title: t('approvalDelegation.colDelegate'), dataIndex: 'delegateName' },
    { title: t('approvalDelegation.colDates'), render: (_, r) => `${r.startDate} — ${r.endDate}` },
    { title: t('common.status'), dataIndex: 'status', render: (s) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    {
      title: t('common.actions'),
      render: (_, r) => ['ACTIVE', 'PENDING_MANAGER_APPROVAL'].includes(r.status) && (
        <Popconfirm title={t('approvalDelegation.cancelConfirm')} onConfirm={() => cancelMut.mutate(r.id)}>
          <Button danger size="small">{t('approvalDelegation.cancel')}</Button>
        </Popconfirm>
      ),
    },
  ]

  const pendingColumns = [
    { title: t('approvalDelegation.colDelegator'), dataIndex: 'delegatorName' },
    { title: t('approvalDelegation.colScope'), render: (_, r) => r.departmentName || r.orgGroupName },
    { title: t('approvalDelegation.colDelegate'), dataIndex: 'delegateName' },
    { title: t('approvalDelegation.colDates'), render: (_, r) => `${r.startDate} — ${r.endDate}` },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Popconfirm title={t('approvalDelegation.approveConfirm')} onConfirm={() => decideMut.mutate({ id: r.id, approved: true })}>
            <Button size="small" type="primary">{t('approvalDelegation.approve')}</Button>
          </Popconfirm>
          <Popconfirm title={t('approvalDelegation.rejectConfirm')} onConfirm={() => decideMut.mutate({ id: r.id, approved: false })}>
            <Button size="small" danger>{t('approvalDelegation.reject')}</Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  const delegatedToMeColumns = [
    { title: t('approvalDelegation.colDelegator'), dataIndex: 'delegatorName' },
    { title: t('approvalDelegation.colScope'), render: (_, r) => r.departmentName || r.orgGroupName },
    { title: t('approvalDelegation.colDates'), render: (_, r) => `${r.startDate} — ${r.endDate}` },
    { title: t('common.status'), dataIndex: 'status', render: (s) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h1>{t('approvalDelegation.title')}</h1>
        <Paragraph type="secondary">{t('approvalDelegation.subtitle')}</Paragraph>

        <h3>{t('approvalDelegation.myRolesTitle')}</h3>
        {roles.length === 0 ? (
          <Empty description={t('approvalDelegation.noRoles')} />
        ) : (
          <Table dataSource={roles} columns={roleColumns} rowKey={(r) => `${r.scopeType}-${r.scopeId}`} pagination={false} style={{ marginBottom: 24 }} />
        )}

        <Tabs
          items={[
            {
              key: 'mine',
              label: t('approvalDelegation.tabMine'),
              children: mine.length === 0
                ? <Empty description={t('approvalDelegation.nothingYet')} />
                : <Table dataSource={mine} columns={mineColumns} rowKey="id" loading={mineLoading} pagination={false} />,
            },
            {
              key: 'pending',
              label: t('approvalDelegation.tabPendingMyApproval', { count: pendingForMe.length }),
              children: pendingForMe.length === 0
                ? <Empty description={t('approvalDelegation.nothingAwaiting')} />
                : <Table dataSource={pendingForMe} columns={pendingColumns} rowKey="id" loading={pendingLoading} pagination={false} />,
            },
            {
              key: 'delegatedToMe',
              label: t('approvalDelegation.tabDelegatedToMe'),
              children: delegatedToMe.length === 0
                ? <Empty description={t('approvalDelegation.nothingDelegatedToYou')} />
                : <Table dataSource={delegatedToMe} columns={delegatedToMeColumns} rowKey="id" loading={delegatedLoading} pagination={false} />,
            },
          ]}
        />
      </Card>

      <Modal
        title={activeRole ? t('approvalDelegation.delegateModalTitle', { role: activeRole.label }) : ''}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.validateFields().then((v) => createMut.mutate(v)).catch(() => {})}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="delegateId" label={t('approvalDelegation.delegateLabel')} rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              loading={searching}
              onSearch={handleUserSearch}
              options={userOptions}
              placeholder={t('approvalDelegation.delegateSearchPlaceholder')}
            />
          </Form.Item>
          <Form.Item name="startDate" label={t('approvalDelegation.startDateLabel')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d < dayjs().startOf('day')} />
          </Form.Item>
          <Form.Item
            name="endDate"
            label={t('approvalDelegation.endDateLabel')}
            extra={t('approvalDelegation.endDateHelp')}
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} disabled={!startDate} disabledDate={disabledEndDate} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
