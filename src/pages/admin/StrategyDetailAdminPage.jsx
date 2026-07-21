import { useState } from 'react'
import {
  Card, Tabs, Button, Select, Table, Modal, Form, message,
  Popconfirm, Tag, Descriptions, Space
} from 'antd'
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getAdminStrategy, adminOverrideState, getStrategyAssignments,
  assignRole, deleteAssignment, getUsers, getAuditLogs
} from '../../api/admin'
import StateChip from '../../components/StateChip'
import RoleChip from '../../components/RoleChip'
import { compareStrings } from '../../hooks/useTablePrefs'

const STATES = ['CREATION', 'REVIEW', 'DEPLOYED', 'FROZEN']
const ROLES = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER']

export default function StrategyDetailAdminPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [editForm] = Form.useForm()
  const [form] = Form.useForm()

  const { data: strategy, isLoading } = useQuery({
    queryKey: ['admin-strategy', id],
    queryFn: () => getAdminStrategy(id),
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['strategy-assignments', id],
    queryFn: () => getStrategyAssignments(id),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  })

  const overrideMutation = useMutation({
    mutationFn: (state) => adminOverrideState(id, state),
    onSuccess: () => {
      message.success(t('strategyDetailAdmin.stateOverridden'))
      qc.invalidateQueries({ queryKey: ['admin-strategy', id] })
      qc.invalidateQueries({ queryKey: ['admin-strategies'] })
    },
    onError: () => message.error(t('strategyDetailAdmin.overrideFailed')),
  })

  const assignMutation = useMutation({
    mutationFn: (values) => assignRole(id, values),
    onSuccess: () => {
      message.success(t('strategyDetailAdmin.roleAssigned'))
      setAssignModalOpen(false)
      qc.invalidateQueries({ queryKey: ['strategy-assignments', id] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('common.failed')),
  })

  const editRoleMutation = useMutation({
    mutationFn: (values) => assignRole(id, values),
    onSuccess: () => {
      message.success(t('strategyDetailAdmin.roleUpdated'))
      setEditingAssignment(null)
      qc.invalidateQueries({ queryKey: ['strategy-assignments', id] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('common.failed')),
  })

  const removeMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      message.success(t('strategyDetailAdmin.assignmentRemoved'))
      qc.invalidateQueries({ queryKey: ['strategy-assignments', id] })
    },
  })

  const assignmentColumns = [
    {
      title: t('common.user'),
      render: (_, r) => (
        <span>
          <span style={{ fontWeight: 500 }}>{r.userName}</span>
          <br />
          <span style={{ fontSize: 12, color: '#6b7280' }}>{r.userEmail}</span>
        </span>
      ),
      sorter: (a, b) => compareStrings(a.userName, b.userName),
    },
    { title: t('common.role'), render: (_, r) => <RoleChip role={r.role} /> },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingAssignment(r)
              editForm.setFieldsValue({ role: r.role })
            }}
          />
          <Popconfirm title={t('strategyDetailAdmin.removeAssignmentConfirm')} onConfirm={() => removeMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (isLoading || !strategy) {
    return <div style={{ padding: 48, textAlign: 'center' }}>{t('tree.loadingEllipsis')}</div>
  }

  const assignedUserIds = assignments.map((a) => a.userId)
  const unassignedUsers = users.filter((u) => !assignedUserIds.includes(u.id))

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/admin/strategies')}
        style={{ marginBottom: 16, color: '#6b7280' }}
      >
        {t('strategyDetailAdmin.backToStrategies')}
      </Button>

      <Card
        style={{ marginBottom: 20 }}
        extra={
          <Space>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{t('strategyDetailAdmin.overrideStateLabel')}</span>
            <Select
              value={strategy.state}
              style={{ width: 140 }}
              onChange={(v) => overrideMutation.mutate(v)}
              loading={overrideMutation.isPending}
              options={STATES.map((s) => ({ value: s, label: s }))}
            />
          </Space>
        }
      >
        <Descriptions
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {strategy.title}
              <StateChip state={strategy.state} />
              <Tag color={strategy.strategyType === 'UNIVERSITY' ? 'geekblue' : 'green'}>
                {strategy.strategyType}
              </Tag>
            </span>
          }
          column={2}
        >
          <Descriptions.Item label={t('strategyCreation.colPlanningCycle')}>{strategy.planningCycleName}</Descriptions.Item>
          <Descriptions.Item label={t('common.department')}>{strategy.departmentName || '—'}</Descriptions.Item>
          <Descriptions.Item label={t('strategyDetailAdmin.achievementThresholdLabel')}>
            {strategy.achievementThreshold}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.description')} span={2}>
            {strategy.description || '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Tabs
        items={[
          {
            key: 'assignments',
            label: t('strategyDetailAdmin.roleAssignmentsTab', { count: assignments.length }),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { form.resetFields(); setAssignModalOpen(true) }}
                    style={{ background: '#13223a' }}
                  >
                    {t('strategyDetailAdmin.assignUserButton')}
                  </Button>
                </div>
                <Table
                  dataSource={assignments}
                  columns={assignmentColumns}
                  rowKey="id"
                  pagination={false}
                />
              </div>
            ),
          },
          {
            key: 'areas',
            label: t('strategyDetailAdmin.visionAreasTab', { count: strategy.areas?.length ?? 0 }),
            children: (
              <Table
                dataSource={strategy.areas || []}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: t('strategyDetailAdmin.nameColLabel'), dataIndex: 'name', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
                    sorter: (a, b) => compareStrings(a.name, b.name),
                  },
                  { title: t('strategyDetail.sortOrderLabel'), dataIndex: 'sortOrder', align: 'center' },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal
        title={t('strategyDetailAdmin.assignUserRoleTitle')}
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={assignMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={assignMutation.mutate}>
          <Form.Item name="userId" label={t('common.user')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={unassignedUsers.map((u) => ({
                value: u.id,
                label: `${u.fname} ${u.lname} (${u.email})`,
              }))}
              placeholder={t('strategyDetailAdmin.selectUserPlaceholder')}
            />
          </Form.Item>
          <Form.Item name="role" label={t('common.role')} rules={[{ required: true }]}>
            <Select options={ROLES.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('strategyDetailAdmin.changeRoleTitle', { name: editingAssignment?.userName ?? '' })}
        open={!!editingAssignment}
        onCancel={() => setEditingAssignment(null)}
        onOk={() => editForm.submit()}
        confirmLoading={editRoleMutation.isPending}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) =>
            editRoleMutation.mutate({ userId: editingAssignment.userId, role: values.role })
          }
        >
          <Form.Item name="role" label={t('common.role')} rules={[{ required: true }]}>
            <Select options={ROLES.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
