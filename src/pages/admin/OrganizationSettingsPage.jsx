// Fixed, small set of admin-editable display labels (e.g. "Academic Year" -> "Fiscal Year") that
// adapt the app's wording to whatever organization it's deployed at -- see TerminologyContext.jsx
// for how the rest of the app reads these. Edit-only: the key set itself is seeded by migration
// (V72__organization_settings.sql), not created/deleted here.
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrganizationSettings, updateOrganizationSetting } from '../../api/admin'
import TableTotal from '../../components/TableTotal'

export default function OrganizationSettingsPage() {
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['admin-organization-settings'],
    queryFn: getOrganizationSettings,
  })

  const openEdit = (s) => {
    setEditing(s)
    form.setFieldsValue({ value: s.value })
  }

  const saveMutation = useMutation({
    mutationFn: (values) => updateOrganizationSetting(editing.key, values),
    onSuccess: () => {
      message.success('Setting updated')
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['admin-organization-settings'] })
      qc.invalidateQueries({ queryKey: ['organization-settings-public'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Update failed'),
  })

  const columns = [
    { title: 'Setting', dataIndex: 'description', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: 'Current Value', dataIndex: 'value' },
    {
      title: 'Actions',
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Organization Settings</h1>
      </div>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        These labels are used throughout the app in place of the university-specific terms they
        default to, so the system reads naturally for any organization it's deployed at.
      </p>

      <TableTotal count={settings.length} />
      <Table
        dataSource={settings}
        columns={columns}
        rowKey="key"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title="Edit Setting"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>{editing?.description}</p>
          <Form.Item name="value" label="Value" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
