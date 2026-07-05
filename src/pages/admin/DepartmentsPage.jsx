import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDepartments, createDepartment, updateDepartment,
  deactivateDepartment, reactivateDepartment, getOrgGroups,
} from '../../api/admin'
import { getUsers } from '../../api/admin'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'

const TABLE_PREFS_KEY = 'spms.adminDepartmentsTable.prefs'

export default function DepartmentsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()
  const { sortOrderFor, handleTableChange } = useTablePrefs(TABLE_PREFS_KEY)

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  })
  const { data: orgGroups = [] } = useQuery({
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

  const openEdit = (dept) => {
    setEditing(dept)
    form.setFieldsValue({
      name: dept.name,
      code: dept.code,
      headTitle: dept.headTitle,
      headUserId: dept.headUserId,
      orgGroupId: dept.orgGroupId,
    })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing ? updateDepartment(editing.id, values) : createDepartment(values),
    onSuccess: () => {
      message.success(editing ? 'Department updated' : 'Department created')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-departments'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Operation failed'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateDepartment,
    onSuccess: () => {
      message.success('Department deactivated')
      qc.invalidateQueries({ queryKey: ['admin-departments'] })
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: reactivateDepartment,
    onSuccess: () => {
      message.success('Department activated')
      qc.invalidateQueries({ queryKey: ['admin-departments'] })
    },
  })

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
      sorter: (a, b) => compareStrings(a.name, b.name),
      sortOrder: sortOrderFor('name'),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (v) => (
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>{v}</span>
      ),
      sorter: (a, b) => compareStrings(a.code, b.code),
      sortOrder: sortOrderFor('code'),
    },
    {
      title: 'Head Title',
      dataIndex: 'headTitle',
      key: 'headTitle',
      render: (v) => v || '—',
      sorter: (a, b) => compareStrings(a.headTitle, b.headTitle),
      sortOrder: sortOrderFor('headTitle'),
    },
    {
      title: 'Head',
      dataIndex: 'headUserName',
      key: 'headUserName',
      render: (v) => v || '—',
      sorter: (a, b) => compareStrings(a.headUserName, b.headUserName),
      sortOrder: sortOrderFor('headUserName'),
    },
    {
      title: 'Group',
      dataIndex: 'orgGroupTitle',
      key: 'orgGroupTitle',
      render: (v) => v || '—',
      sorter: (a, b) => compareStrings(a.orgGroupTitle, b.orgGroupTitle),
      sortOrder: sortOrderFor('orgGroupTitle'),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (v) => (v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
      sorter: (a, b) => Number(a.active) - Number(b.active),
      sortOrder: sortOrderFor('active'),
    },
    {
      title: 'Actions',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            Edit
          </Button>
          {r.active ? (
            <Popconfirm
              title="Deactivate this department?"
              onConfirm={() => deactivateMutation.mutate(r.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                Deactivate
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Reactivate this department?"
              onConfirm={() => reactivateMutation.mutate(r.id)}
            >
              <Button size="small" icon={<CheckCircleOutlined />}
                style={{ color: '#52c41a', borderColor: '#52c41a' }}>
                Activate
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Departments</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#13223a' }}>
          New Department
        </Button>
      </div>

      <Table
        dataSource={departments}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        onChange={handleTableChange}
      />

      <Modal
        title={editing ? 'Edit Department' : 'Create Department'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="name" label="Department Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input placeholder="e.g. CS, ENG" />
          </Form.Item>
          <Form.Item name="headTitle" label="Head Title"
            tooltip="Title of the department head, e.g. Chair, Coordinator">
            <Input placeholder="e.g. Chair" />
          </Form.Item>
          <Form.Item name="headUserId" label="Department Head">
            <Select allowClear placeholder="Select a user" showSearch
              optionFilterProp="label"
              options={users.map((u) => ({
                value: u.id,
                label: `${u.fname} ${u.lname} (${u.email})`,
              }))} />
          </Form.Item>
          <Form.Item name="orgGroupId" label="Org Group">
            <Select allowClear placeholder="Select a group"
              options={orgGroups.map((g) => ({ value: g.id, label: g.title }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
