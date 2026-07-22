// Admin console for VSM author delegation (Phase 4): grant "VSM author" rights over a unit to any
// employee -- it stays PENDING_APPROVAL until the top-of-hierarchy head above them approves it (see
// VsmAuthorGrantApprovalsPage for that side), so this page never activates a grant by itself.
import { useState } from 'react'
import { Card, Button, Modal, Form, Select, Table, Tag, message, Popconfirm, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getDepartments, getOrgGroups } from '../../api/admin'
import { searchUsers } from '../../api/strategies'
import { createVsmAuthorGrant, getAllVsmAuthorGrants, revokeVsmAuthorGrant } from '../../api/vsmAuthorGrants'

const { Paragraph } = Typography

const STATUS_COLORS = { PENDING_APPROVAL: 'gold', ACTIVE: 'green', REJECTED: 'red', REVOKED: 'default' }

export default function VsmAuthorGrantsAdminPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [userOptions, setUserOptions] = useState([])
  const [searching, setSearching] = useState(false)
  const scopeType = Form.useWatch('scopeType', form)

  const { data: grants = [], isLoading } = useQuery({ queryKey: ['vsm-author-grants'], queryFn: getAllVsmAuthorGrants })
  const { data: departments = [] } = useQuery({ queryKey: ['admin-departments'], queryFn: getDepartments })
  const { data: orgGroups = [] } = useQuery({ queryKey: ['admin-org-groups'], queryFn: getOrgGroups })

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

  const createMut = useMutation({
    mutationFn: (values) => createVsmAuthorGrant(values),
    onSuccess: () => {
      message.success(t('vsmGrants.createSuccess'))
      setModalOpen(false)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['vsm-author-grants'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('vsmGrants.createError')),
  })

  const revokeMut = useMutation({
    mutationFn: revokeVsmAuthorGrant,
    onSuccess: () => {
      message.success(t('vsmGrants.revokeSuccess'))
      qc.invalidateQueries({ queryKey: ['vsm-author-grants'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('vsmGrants.revokeError')),
  })

  const columns = [
    { title: t('vsmGrants.colEmployee'), dataIndex: 'employeeName' },
    { title: t('vsmGrants.colScope'), render: (_, r) => r.departmentName || r.orgGroupName },
    { title: t('vsmGrants.colApprover'), dataIndex: 'approverTitle' },
    { title: t('common.status'), dataIndex: 'status', render: (s) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    {
      title: t('common.actions'),
      render: (_, r) => r.status === 'ACTIVE' && (
        <Popconfirm title={t('vsmGrants.revokeConfirm')} onConfirm={() => revokeMut.mutate(r.id)}>
          <Button danger size="small">{t('vsmGrants.revoke')}</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{t('vsmGrants.adminTitle')}</h1>
            <Paragraph type="secondary">{t('vsmGrants.adminSubtitle')}</Paragraph>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} style={{ background: '#13223a' }}>
            {t('vsmGrants.newGrant')}
          </Button>
        </div>
        <Table dataSource={grants} columns={columns} rowKey="id" loading={isLoading} pagination={false} />
      </Card>

      <Modal
        title={t('vsmGrants.newGrant')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.validateFields().then((v) => createMut.mutate(v)).catch(() => {})}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="employeeId" label={t('vsmGrants.employeeLabel')} rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              loading={searching}
              onSearch={handleUserSearch}
              options={userOptions}
              placeholder={t('vsmGrants.employeeSearchPlaceholder')}
            />
          </Form.Item>
          <Form.Item name="scopeType" label={t('vsm.scopeTypeLabel')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'DEPARTMENT', label: t('common.department') },
                { value: 'ORG_GROUP', label: t('vsm.orgGroup') },
              ]}
            />
          </Form.Item>
          {scopeType === 'DEPARTMENT' && (
            <Form.Item name="scopeId" label={t('common.department')} rules={[{ required: true }]}>
              <Select options={departments.map((d) => ({ value: d.id, label: d.name }))} />
            </Form.Item>
          )}
          {scopeType === 'ORG_GROUP' && (
            <Form.Item name="scopeId" label={t('vsm.orgGroup')} rules={[{ required: true }]}>
              <Select options={orgGroups.map((g) => ({ value: g.id, label: g.title }))} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
