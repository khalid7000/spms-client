// Strategy Creation Console: where department/university heads start a new strategy, and
// everyone with a not-yet-deployed strategy relationship (owner, or invited SWOT participant)
// tracks it through SWOT and drafting until it's deployed -- at which point it moves into the
// Strategy Console for everyone assigned to it. Reuses the existing /strategies/:id page and
// SWOT flow entirely; this page only adds the missing "start one" entry point.
import { useState } from 'react'
import { Card, Button, Modal, Form, Input, Select, Table, Tag, Empty, message, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getDashboard } from '../../api/dashboard'
import { getMyLeadershipProfile } from '../../api/leadership'
import { getPlanningCyclesPublic } from '../../api/admin'
import { createDepartmentStrategy, createUniversityStrategy } from '../../api/strategies'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { useTerminology } from '../../TerminologyContext'

const { Paragraph } = Typography

const NOT_DEPLOYED_STATES = ['CREATION', 'REVIEW', 'APPROVAL_PENDING']

export default function StrategyCreationConsolePage() {
  const { topLevelStrategyLabel } = useTerminology()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const strategyType = Form.useWatch('strategyType', form)

  const { data: leadership } = useQuery({ queryKey: ['my-leadership'], queryFn: getMyLeadershipProfile })
  const { data: dashboard = [], isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const { data: planningCycles = [] } = useQuery({ queryKey: ['planning-cycles-public'], queryFn: getPlanningCyclesPublic })

  const headedDepartments = leadership?.headedDepartments ?? []
  const canCreateUniversity = (leadership?.headedOrgGroups ?? []).some((g) => g.isRoot)
  const canCreateDepartment = headedDepartments.length > 0

  const inProgress = dashboard.filter((item) => NOT_DEPLOYED_STATES.includes(item.state))

  const createMut = useMutation({
    mutationFn: (values) => {
      const payload = { planningCycleId: values.planningCycleId, title: values.title, description: values.description }
      return values.strategyType === 'UNIVERSITY'
        ? createUniversityStrategy(payload)
        : createDepartmentStrategy({ ...payload, departmentId: values.departmentId })
    },
    onSuccess: (strategy) => {
      message.success('Strategy created')
      setModalOpen(false)
      form.resetFields()
      navigate(`/strategies/${strategy.id}`)
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to create strategy'),
  })

  const columns = [
    {
      title: 'Title', dataIndex: 'strategyTitle', key: 'strategyTitle', ellipsis: true,
      sorter: (a, b) => compareStrings(a.strategyTitle, b.strategyTitle),
    },
    { title: 'Type', dataIndex: 'strategyType', key: 'strategyType' },
    { title: 'Your Role', dataIndex: 'role', key: 'role' },
    { title: 'Status', dataIndex: 'state', key: 'state', render: (s) => <Tag>{s}</Tag> },
    { title: 'Planning Cycle', dataIndex: 'planningCycleName', key: 'planningCycleName' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Strategy Creation Console</h1>
            <Paragraph type="secondary">
              Start a new strategy for a department or the university, run it through SWOT and drafting, and track
              anything still in progress -- including strategies you've been invited to participate in. Once a
              strategy is deployed, it moves to the Strategy Console for everyone assigned to it.
            </Paragraph>
          </div>
          {(canCreateDepartment || canCreateUniversity) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} style={{ background: '#13223a' }}>
              New Strategy
            </Button>
          )}
        </div>

        <h3>In Progress</h3>
        {inProgress.length === 0 ? (
          <Empty description="Nothing in progress right now" />
        ) : (
          <>
            <TableTotal count={inProgress.length} />
            <Table
              dataSource={inProgress} columns={columns} rowKey="strategyId" loading={isLoading} pagination={false}
              onRow={(row) => ({ onClick: () => navigate(`/strategies/${row.strategyId}`), style: { cursor: 'pointer' } })}
            />
          </>
        )}
      </Card>

      <Modal
        title="New Strategy" open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={() => form.validateFields().then((v) => createMut.mutate(v)).catch(() => {})}
        confirmLoading={createMut.isPending} destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="strategyType" label="Strategy Type" rules={[{ required: true }]}>
            <Select
              placeholder="Select type"
              options={[
                ...(canCreateDepartment ? [{ value: 'DEPARTMENT', label: 'Department Strategy' }] : []),
                ...(canCreateUniversity ? [{ value: 'UNIVERSITY', label: topLevelStrategyLabel }] : []),
              ]}
            />
          </Form.Item>
          {strategyType === 'DEPARTMENT' && (
            <Form.Item name="departmentId" label="Department" rules={[{ required: true }]}>
              <Select
                placeholder="Select department"
                options={headedDepartments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          )}
          <Form.Item name="planningCycleId" label="Planning Cycle" rules={[{ required: true }]}>
            <Select
              placeholder="Select planning cycle"
              options={planningCycles.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
