// Achievement types (e.g. "Curriculum", "Publication", "Grant") shown in the achievement-recording
// Type dropdown throughout the app -- fully admin-configurable so each organization can define its
// own list. Two rows ("Other" and "Course Evaluation") are system-linked (see AchievementType
// .systemCode) and can be renamed but never deactivated, since other code branches on them.
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Tag, message, Popconfirm, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAchievementTypes, createAchievementType, updateAchievementType } from '../../api/admin'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'

export default function AchievementTypesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['admin-achievement-types'],
    queryFn: getAchievementTypes,
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    form.setFieldsValue({ name: t.name })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing
        ? updateAchievementType(editing.id, { name: values.name, active: editing.active })
        : createAchievementType(values),
    onSuccess: () => {
      message.success(editing ? 'Achievement type updated' : 'Achievement type created')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-achievement-types'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Operation failed'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (t) => updateAchievementType(t.id, { name: t.name, active: false }),
    onSuccess: () => {
      message.success('Achievement type deactivated')
      qc.invalidateQueries({ queryKey: ['admin-achievement-types'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Deactivate failed'),
  })

  const reactivateMutation = useMutation({
    mutationFn: (t) => updateAchievementType(t.id, { name: t.name, active: true }),
    onSuccess: () => {
      message.success('Achievement type reactivated')
      qc.invalidateQueries({ queryKey: ['admin-achievement-types'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Reactivate failed'),
  })

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
      sorter: (a, b) => compareStrings(a.name, b.name),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      render: (active) => <Tag color={active ? 'green' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
          {r.systemCode ? (
            <Tooltip title="Used by the app itself (e.g. the 'Other' custom-type flow or the Teaching Evaluations tool) -- can be renamed but not deactivated">
              <Button size="small" icon={<StopOutlined />} disabled>Deactivate</Button>
            </Tooltip>
          ) : r.active ? (
            <Popconfirm title="Deactivate this achievement type?" description="It stays available on any achievement that already uses it." onConfirm={() => deactivateMutation.mutate(r)}>
              <Button size="small" danger icon={<StopOutlined />}>Deactivate</Button>
            </Popconfirm>
          ) : (
            <Button size="small" onClick={() => reactivateMutation.mutate(r)}>Reactivate</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Achievement Types</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#13223a' }}>
          New Achievement Type
        </Button>
      </div>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Shown in the "Type" dropdown wherever an achievement is recorded. Deactivated types stay
        visible on achievements that already use them, but can't be selected for new ones.
      </p>

      <TableTotal count={types.length} />
      <Table
        dataSource={types}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={editing ? 'Edit Achievement Type' : 'Create Achievement Type'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={420}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Publication, Grant, Award" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
