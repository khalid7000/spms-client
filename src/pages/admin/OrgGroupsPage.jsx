import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getOrgGroups, createOrgGroup, updateOrgGroup, deleteOrgGroup, getUsers } from '../../api/admin'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'

export default function OrgGroupsPage() {
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['admin-org-groups'],
    queryFn: getOrgGroups,
  })
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (g) => {
    setEditing(g)
    form.setFieldsValue({
      title: g.title,
      headTitle: g.headTitle,
      parentId: g.parentId,
      headUserId: g.headUserId,
    })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing ? updateOrgGroup(editing.id, values) : createOrgGroup(values),
    onSuccess: () => {
      message.success(editing ? t('orgGroups.groupUpdated') : t('orgGroups.groupCreated'))
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-org-groups'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('tree.operationFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteOrgGroup,
    onSuccess: () => {
      message.success(t('orgGroups.groupDeleted'))
      qc.invalidateQueries({ queryKey: ['admin-org-groups'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('orgGroups.deleteFailed')),
  })

  // Groups available as parents (exclude self when editing)
  const parentOptions = groups
    .filter((g) => !editing || g.id !== editing.id)
    .map((g) => ({ value: g.id, label: g.title }))

  const columns = [
    {
      title: t('orgGroups.groupNameCol'),
      dataIndex: 'title',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
      sorter: (a, b) => compareStrings(a.title, b.title),
    },
    {
      title: t('orgGroups.headTitleCol'),
      dataIndex: 'headTitle',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    { title: t('orgGroups.currentHeadCol'), dataIndex: 'headUserName', render: (v) => v || '—' },
    { title: t('orgGroups.parentGroupCol'), dataIndex: 'parentTitle', render: (v) => v || '—' },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            {t('goalSetting.editButton')}
          </Button>
          <Popconfirm
            title={t('orgGroups.deleteConfirmTitle')}
            onConfirm={() => deleteMutation.mutate(r.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              {t('strategiesAdmin.deleteOkText')}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('nav.orgGroups')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#13223a' }}>
          {t('orgGroups.newGroupButton')}
        </Button>
      </div>

      <TableTotal count={groups.length} />
      <Table
        dataSource={groups}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={editing ? t('orgGroups.editGroupTitle') : t('orgGroups.createGroupTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="title" label={t('orgGroups.groupNameCol')} rules={[{ required: true }]}>
            <Input placeholder={t('orgGroups.groupNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="headTitle" label={t('orgGroups.headTitleCol')} rules={[{ required: true }]}
            tooltip={t('orgGroups.headTitleTooltip')}>
            <Input placeholder={t('orgGroups.headTitlePlaceholder')} />
          </Form.Item>
          <Form.Item name="parentId" label={t('orgGroups.parentGroupCol')}
            tooltip={t('orgGroups.parentGroupTooltip')}>
            <Select allowClear placeholder={t('orgGroups.noneTopLevelPlaceholder')} options={parentOptions} />
          </Form.Item>
          <Form.Item name="headUserId" label={t('orgGroups.groupHeadLabel')}>
            <Select allowClear placeholder={t('strategyDetailAdmin.selectUserPlaceholder')} showSearch
              optionFilterProp="label"
              options={users.map((u) => ({
                value: u.id,
                label: `${u.fname} ${u.lname} (${u.email})`,
              }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
