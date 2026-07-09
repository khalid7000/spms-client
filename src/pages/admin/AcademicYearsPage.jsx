import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, DatePicker } from 'antd'
import { PlusOutlined, LockOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createAcademicYear, closeAcademicYear, getAdminStrategies } from '../../api/admin'
import { getAcademicYears } from '../../api/academicYears'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import dayjs from 'dayjs'

export default function AcademicYearsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: years = [], isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: getAcademicYears,
  })

  const { data: strategies = [] } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: getAdminStrategies,
  })
  const universityStrategies = strategies.filter((s) => s.strategyType === 'UNIVERSITY')

  const createMutation = useMutation({
    mutationFn: (values) =>
      createAcademicYear({
        name: values.name,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
        universityStrategyId: values.universityStrategyId,
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
      sorter: (a, b) => compareStrings(a.name, b.name),
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
      title: 'University Strategy',
      dataIndex: 'universityStrategyTitle',
      render: (v) => v || '—',
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

      <TableTotal count={years.length} />
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
          <Form.Item
            name="universityStrategyId" label="University Strategy"
            rules={[{ required: true, message: 'A university-level strategy must be selected' }]}
            extra="Initiatives/measurements and Annual Evaluations for this year are scoped to this strategy's cycle"
          >
            <Select
              placeholder="Select the university-level strategy this year belongs to"
              options={universityStrategies.map((s) => ({ value: s.id, label: s.title }))}
            />
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
