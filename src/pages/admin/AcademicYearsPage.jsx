import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Tag, Popconfirm, message, DatePicker } from 'antd'
import { PlusOutlined, LockOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createAcademicYear, closeAcademicYear } from '../../api/admin'
import { getAcademicYears } from '../../api/academicYears'
import dayjs from 'dayjs'

export default function AcademicYearsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: years = [], isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: getAcademicYears,
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      createAcademicYear({
        name: values.name,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
      }),
    onSuccess: () => {
      message.success('Academic year created')
      setModalOpen(false)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to create'),
  })

  const closeMutation = useMutation({
    mutationFn: closeAcademicYear,
    onSuccess: () => {
      message.success('Academic year closed')
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to close'),
  })

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      render: (v) => (v ? dayjs(v).format('MMM D, YYYY') : '—'),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      render: (v) => (v ? dayjs(v).format('MMM D, YYYY') : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'closed',
      render: (closed) =>
        closed ? <Tag color="red">Closed</Tag> : <Tag color="green">Open</Tag>,
    },
    {
      title: '',
      render: (_, row) =>
        !row.closed ? (
          <Popconfirm
            title="Close this academic year?"
            description="This will block new achievements for all initiatives in this year."
            onConfirm={() => closeMutation.mutate(row.id)}
            okText="Close"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<LockOutlined />}>
              Close Year
            </Button>
          </Popconfirm>
        ) : null,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Academic Years</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
          style={{ background: '#13223a' }}
        >
          New Academic Year
        </Button>
      </div>

      <Table
        dataSource={years}
        rowKey="id"
        loading={isLoading}
        columns={columns}
        pagination={false}
      />

      <Modal
        title="Create Academic Year"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={createMutation.mutate}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. 2023-2024" />
          </Form.Item>
          <Form.Item name="startDate" label="Start Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endDate" label="End Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
