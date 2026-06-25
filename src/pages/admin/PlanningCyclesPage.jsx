import { useState } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch,
  Tag, message, Collapse, Popconfirm, DatePicker,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DownOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPlanningCycles, createPlanningCycle, updatePlanningCycle,
  getPlanningCyclePeriods, createPeriod, deletePeriod,
} from '../../api/admin'
import dayjs from 'dayjs'

const { Panel } = Collapse

function PeriodsPanel({ cycleId }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: periods = [] } = useQuery({
    queryKey: ['periods', cycleId],
    queryFn: () => getPlanningCyclePeriods(cycleId),
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      createPeriod(cycleId, {
        ...values,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
      }),
    onSuccess: () => {
      message.success('Period created')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['periods', cycleId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['periods', cycleId] }),
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Add Period
        </Button>
      </div>
      <Table
        dataSource={periods}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Start', dataIndex: 'startDate' },
          { title: 'End', dataIndex: 'endDate' },
          {
            title: '',
            render: (_, r) => (
              <Popconfirm title="Delete period?" onConfirm={() => deleteMutation.mutate(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
      <Modal
        title="Add Assessment Period"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={createMutation.mutate}>
          <Form.Item name="name" label="Period Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Q1 2025" />
          </Form.Item>
          <Form.Item name="startDate" label="Start Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endDate" label="End Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort Order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function PlanningCyclesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['admin-cycles'],
    queryFn: getPlanningCycles,
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (cycle) => {
    setEditing(cycle)
    form.setFieldsValue({
      name: cycle.name,
      startYear: cycle.startYear,
      endYear: cycle.endYear,
      active: cycle.active,
    })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing
        ? updatePlanningCycle(editing.id, values)
        : createPlanningCycle(values),
    onSuccess: () => {
      message.success(editing ? 'Cycle updated' : 'Cycle created')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-cycles'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Operation failed'),
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Planning Cycles</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#13223a' }}>
          New Cycle
        </Button>
      </div>

      <Collapse accordion>
        {cycles.map((cycle) => (
          <Panel
            key={cycle.id}
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600 }}>{cycle.name}</span>
                <span style={{ color: '#6b7280', fontSize: 13 }}>
                  {cycle.startYear}–{cycle.endYear}
                </span>
                {cycle.active && <Tag color="green">Active</Tag>}
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => { e.stopPropagation(); openEdit(cycle) }}
                  style={{ marginLeft: 'auto' }}
                >
                  Edit
                </Button>
              </div>
            }
          >
            <PeriodsPanel cycleId={cycle.id} />
          </Panel>
        ))}
      </Collapse>

      <Modal
        title={editing ? 'Edit Planning Cycle' : 'Create Planning Cycle'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="name" label="Cycle Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. 2025–2028 Strategic Plan" />
          </Form.Item>
          <Form.Item name="startYear" label="Start Year" rules={[{ required: true }]}>
            <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endYear" label="End Year" rules={[{ required: true }]}>
            <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
          </Form.Item>
          {editing && (
            <Form.Item name="active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
