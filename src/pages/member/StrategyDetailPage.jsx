import { useState } from 'react'
import {
  Tabs, Button, Card, Modal, Form, Input, InputNumber, Select,
  Descriptions, message, Tag, Space, Spin, Tooltip, Popconfirm,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, SettingOutlined, EditOutlined,
  DeleteOutlined, DownloadOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStrategy, changeState, setThreshold, createGoal, createArea, updateArea, deleteArea, downloadPdf, downloadExcel } from '../../api/strategies'
import { getComments } from '../../api/comments'
import { getDashboard } from '../../api/dashboard'
import { getStrategyApprovalStatus, approveStrategy } from '../../api/approvals'
import { useAuth } from '../../auth/AuthContext'
import StateChip from '../../components/StateChip'
import RoleChip from '../../components/RoleChip'
import StrategyTree from './StrategyTree'
import CommentDrawer from '../../components/CommentDrawer'
import ReportPage from './ReportPage'

const STATE_TRANSITIONS = {
  CREATION: ['REVIEW'],
  REVIEW: ['CREATION', 'DEPLOYED'],
  APPROVAL_PENDING: [],
  DEPLOYED: ['FROZEN'],
  FROZEN: [],
}

function canComment(role, state) {
  if (state === 'DEPLOYED') return false
  if (state === 'FROZEN') return role === 'OWNER'
  return role === 'OWNER' || role === 'EDITOR' || role === 'COMMENTER'
}

export default function StrategyDetailPage() {
  const { strategyId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const [commentOpen, setCommentOpen] = useState(false)
  const [commentEntity, setCommentEntity] = useState({ type: null, id: null, label: '' })
  const [addGoalOpen, setAddGoalOpen] = useState(false)
  const [addAreaOpen, setAddAreaOpen] = useState(false)
  const [editAreaOpen, setEditAreaOpen] = useState(false)
  const [editingArea, setEditingArea] = useState(null)
  const [goalForm] = Form.useForm()
  const [areaForm] = Form.useForm()
  const [thresholdForm] = Form.useForm()
  const [thresholdOpen, setThresholdOpen] = useState(false)

  const stratKey = ['strategy', strategyId]
  const commentsKey = ['comments', strategyId]

  const { data: strategy, isLoading } = useQuery({
    queryKey: stratKey,
    queryFn: () => getStrategy(strategyId),
  })

  const { data: comments = [] } = useQuery({
    queryKey: commentsKey,
    queryFn: () => getComments(strategyId),
    enabled: !!strategy,
  })

  const refreshStrategy = () => {
    qc.invalidateQueries({ queryKey: stratKey })
    qc.invalidateQueries({ queryKey: commentsKey })
  }

  const { data: dashboardData = [] } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  const myDashEntry = dashboardData.find((d) => String(d.strategyId) === String(strategyId))
  const myRole = myDashEntry?.role ?? null

  const { data: approvalStatus = [] } = useQuery({
    queryKey: ['approvals', strategyId],
    queryFn: () => getStrategyApprovalStatus(strategyId),
    enabled: !!strategy && strategy.state === 'APPROVAL_PENDING',
  })

  const myPendingApproval = approvalStatus.find(
    (a) => !a.approved && a.strategyId === Number(strategyId) &&
      approvalStatus.some((x) => x.approverTitle && !x.approved)
  )
  const iAmPendingApprover = approvalStatus.some(
    (a) => !a.approved && a.ownerEmail !== user?.email
  )

  const approveMut = useMutation({
    mutationFn: () => approveStrategy(strategyId),
    onSuccess: () => {
      message.success('Strategy approved')
      qc.invalidateQueries({ queryKey: ['approvals', strategyId] })
      qc.invalidateQueries({ queryKey: ['pending-approvals'] })
      refreshStrategy()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Approval failed'),
  })

  const changeStateMut = useMutation({
    mutationFn: (newState) => changeState(strategyId, newState),
    onSuccess: () => {
      message.success('State updated')
      refreshStrategy()
    },
    onError: (err) => message.error(err.response?.data?.message || 'State change failed'),
  })

  const setThresholdMut = useMutation({
    mutationFn: (values) => setThreshold(strategyId, values.threshold),
    onSuccess: () => {
      message.success('Threshold updated')
      setThresholdOpen(false)
      refreshStrategy()
    },
  })

  const addGoalMut = useMutation({
    mutationFn: (values) => createGoal(strategyId, values),
    onSuccess: () => {
      message.success('Goal added')
      setAddGoalOpen(false)
      refreshStrategy()
    },
    onError: () => message.error('Create failed'),
  })

  const addAreaMut = useMutation({
    mutationFn: (values) => createArea(strategyId, values),
    onSuccess: () => {
      message.success('Vision area created')
      setAddAreaOpen(false)
      refreshStrategy()
    },
    onError: () => message.error('Create failed'),
  })

  const updateAreaMut = useMutation({
    mutationFn: (values) => updateArea(editingArea?.id, values),
    onSuccess: () => {
      message.success('Area updated')
      setEditAreaOpen(false)
      refreshStrategy()
    },
  })

  const deleteAreaMut = useMutation({
    mutationFn: deleteArea,
    onSuccess: () => {
      message.success('Area deleted')
      refreshStrategy()
    },
  })

  const openComment = (entityType, entityId) => {
    const label =
      entityType === 'GOAL'
        ? strategy?.goals?.find((g) => g.id === entityId)?.title
        : entityType === 'OBJECTIVE'
        ? 'Objective'
        : entityType === 'INITIATIVE'
        ? 'Initiative'
        : 'Measurement'
    setCommentEntity({ type: entityType, id: entityId, label: label || entityType })
    setCommentOpen(true)
  }

  const handleDownload = async (type) => {
    try {
      const resp = type === 'pdf' ? await downloadPdf(strategyId) : await downloadExcel(strategyId)
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `strategy-${strategyId}.${type === 'pdf' ? 'pdf' : 'xlsx'}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('Download failed')
    }
  }

  if (isLoading) {
    return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  if (!strategy) return null

  const isOwner = myRole === 'OWNER'
  const nextStates = STATE_TRANSITIONS[strategy.state] || []

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/dashboard')}
        style={{ marginBottom: 16, color: '#6b7280' }}
      >
        My Strategies
      </Button>

      <Card
        style={{ marginBottom: 20 }}
        extra={
          <Space>
            {isOwner && nextStates.map((ns) => (
              <Button
                key={ns}
                size="small"
                onClick={() => changeStateMut.mutate(ns)}
                loading={changeStateMut.isPending}
                style={{ fontSize: 12 }}
              >
                → {ns === 'DEPLOYED' ? 'Request Deployment' : ns}
              </Button>
            ))}
            {strategy.state === 'APPROVAL_PENDING' && iAmPendingApprover && (
              <Popconfirm
                title="Approve deployment?"
                description="Once all required approvers approve, the strategy will be deployed."
                onConfirm={() => approveMut.mutate()}
              >
                <Button
                  size="small"
                  type="primary"
                  loading={approveMut.isPending}
                  style={{ background: '#52c41a', borderColor: '#52c41a', fontSize: 12 }}
                >
                  Approve Deployment
                </Button>
              </Popconfirm>
            )}
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload('pdf')}
            >
              PDF
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload('excel')}
            >
              Excel
            </Button>
          </Space>
        }
      >
        <Descriptions
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {strategy.title}
              <StateChip state={strategy.state} />
              {myRole && <RoleChip role={myRole} />}
            </span>
          }
          column={3}
          size="small"
        >
          <Descriptions.Item label="Type">
            <Tag color={strategy.strategyType === 'UNIVERSITY' ? 'geekblue' : 'green'}>
              {strategy.strategyType}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Planning Cycle">{strategy.planningCycleName}</Descriptions.Item>
          <Descriptions.Item label="Department">{strategy.departmentName || '—'}</Descriptions.Item>
          {strategy.description && (
            <Descriptions.Item label="Description" span={3}>
              {strategy.description}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Tabs
        items={[
          {
            key: 'plan',
            label: 'Strategic Plan',
            children: (
              <div>
                {/* Vision Areas management (Owner only) */}
                {isOwner && (
                  <Card
                    size="small"
                    title={
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#13223a' }}>
                        Vision Concentration Areas
                      </span>
                    }
                    extra={
                      <Space>
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => { areaForm.resetFields(); setAddAreaOpen(true) }}
                        >
                          Add Area
                        </Button>
                        <Button
                          size="small"
                          icon={<SettingOutlined />}
                          onClick={() => { thresholdForm.setFieldsValue({ threshold: strategy.achievementThreshold }); setThresholdOpen(true) }}
                        >
                          Threshold: {strategy.achievementThreshold}
                        </Button>
                      </Space>
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(strategy.areas || []).map((area) => (
                        <div
                          key={area.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#1a3a6b',
                            color: '#fff',
                            padding: '4px 12px',
                            borderRadius: 16,
                            fontSize: 13,
                          }}
                        >
                          <span>{area.name}</span>
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            style={{ color: '#c9a24b', padding: 0, height: 'auto' }}
                            onClick={() => {
                              setEditingArea(area)
                              areaForm.setFieldsValue({ name: area.name, sortOrder: area.sortOrder })
                              setEditAreaOpen(true)
                            }}
                          />
                          <Popconfirm
                            title="Delete area? Goals will be ungrouped."
                            onConfirm={() => deleteAreaMut.mutate(area.id)}
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              style={{ color: '#ef4444', padding: 0, height: 'auto' }}
                            />
                          </Popconfirm>
                        </div>
                      ))}
                      {(strategy.areas || []).length === 0 && (
                        <span style={{ color: '#9ca3af', fontSize: 13 }}>
                          No areas defined yet
                        </span>
                      )}
                    </div>
                  </Card>
                )}

                {/* Add goal button */}
                {(myRole === 'OWNER' || myRole === 'EDITOR') && strategy.state !== 'REVIEW' && strategy.state !== 'DEPLOYED' && (
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => { goalForm.resetFields(); setAddGoalOpen(true) }}
                      style={{ borderColor: '#13223a', color: '#13223a' }}
                    >
                      Add Goal
                    </Button>
                  </div>
                )}

                <StrategyTree
                  strategy={strategy}
                  comments={comments}
                  role={myRole}
                  onComment={openComment}
                  onRefresh={refreshStrategy}
                />
              </div>
            ),
          },
          {
            key: 'report',
            label: 'Report',
            children: <ReportPage strategy={strategy} embedded />,
          },
        ]}
      />

      {/* Comment Drawer */}
      <CommentDrawer
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        strategyId={strategyId}
        entityType={commentEntity.type}
        entityId={commentEntity.id}
        entityLabel={commentEntity.label}
        canComment={canComment(myRole, strategy.state)}
      />

      {/* Add Goal Modal */}
      <Modal
        title="Add Goal"
        open={addGoalOpen}
        onCancel={() => setAddGoalOpen(false)}
        onOk={() => goalForm.submit()}
        confirmLoading={addGoalMut.isPending}
        destroyOnClose
      >
        <Form form={goalForm} layout="vertical" onFinish={addGoalMut.mutate}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Area Modal */}
      <Modal
        title="Create Vision Area"
        open={addAreaOpen}
        onCancel={() => setAddAreaOpen(false)}
        onOk={() => areaForm.submit()}
        confirmLoading={addAreaMut.isPending}
        destroyOnClose
      >
        <Form form={areaForm} layout="vertical" onFinish={addAreaMut.mutate}>
          <Form.Item name="name" label="Area Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort Order" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Area Modal */}
      <Modal
        title="Edit Vision Area"
        open={editAreaOpen}
        onCancel={() => setEditAreaOpen(false)}
        onOk={() => areaForm.submit()}
        confirmLoading={updateAreaMut.isPending}
        destroyOnClose
      >
        <Form form={areaForm} layout="vertical" onFinish={updateAreaMut.mutate}>
          <Form.Item name="name" label="Area Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort Order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Threshold Modal */}
      <Modal
        title="Set Achievement Threshold"
        open={thresholdOpen}
        onCancel={() => setThresholdOpen(false)}
        onOk={() => thresholdForm.submit()}
        confirmLoading={setThresholdMut.isPending}
        destroyOnClose
      >
        <Form form={thresholdForm} layout="vertical" onFinish={setThresholdMut.mutate}>
          <Form.Item
            name="threshold"
            label="Threshold value (minimum achievements for green status)"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
