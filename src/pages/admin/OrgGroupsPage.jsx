import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrgGroups, createOrgGroup, updateOrgGroup, deleteOrgGroup, getUsers } from '../../api/admin'

export default function OrgGroupsPage() {
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
      message.success(editing ? 'Group updated' : 'Group created')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-org-groups'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Operation failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteOrgGroup,
    onSuccess: () => {
      message.success('Group deleted')
      qc.invalidateQueries({ queryKey: ['admin-org-groups'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Delete failed'),
  })

  // Groups available as parents (exclude self when editing)
  const parentOptions = groups
    .filter((g) => !editing || g.id !== editing.id)
    .map((g) => ({ value: g.id, label: g.title }))

  const columns = [
    {
      title: 'Group Name',
      dataIndex: 'title',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Head Title',
      dataIndex: 'headTitle',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    { title: 'Current Head', dataIndex: 'headUserName', render: (v) => v || '—' },
    { title: 'Parent Group', dataIndex: 'parentTitle', render: (v) => v || '—' },
    {
      title: 'Actions',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this group? Departments and sub-groups will be unassigned."
            onConfirm={() => deleteMutation.mutate(r.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Org Groups</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#13223a' }}>
          New Group
        </Button>
      </div>

      <Table
        dataSource={groups}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={editing ? 'Edit Org Group' : 'Create Org Group'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="title" label="Group Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. College of Engineering" />
          </Form.Item>
          <Form.Item name="headTitle" label="Head Title" rules={[{ required: true }]}
            tooltip="Title of the person who leads this group">
            <Input placeholder="e.g. Dean, Director, VP" />
          </Form.Item>
          <Form.Item name="parentId" label="Parent Group"
            tooltip="Leave blank for a top-level group">
            <Select allowClear placeholder="None (top-level)" options={parentOptions} />
          </Form.Item>
          <Form.Item name="headUserId" label="Group Head">
            <Select allowClear placeholder="Select a user" showSearch
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
