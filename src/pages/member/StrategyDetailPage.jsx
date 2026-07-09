import { useState, useEffect, useRef } from 'react'
import {
  Tabs, Button, Card, Modal, Form, Input, InputNumber, Select,
  Descriptions, message, Tag, Space, Spin, Popconfirm, Table,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, SettingOutlined, EditOutlined,
  DeleteOutlined, DownloadOutlined, LockOutlined, UnlockOutlined,
  TeamOutlined, RocketOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getStrategy, changeState, setThreshold, createGoal, createArea, updateArea, deleteArea,
  downloadPdf, downloadExcel, getMembers, assignMember, revokeMember, searchUsers,
  getStrategyAuditLog,
} from '../../api/strategies'
import { getAcademicYears, getMostRecentAcademicYear, lockAcademicYear, unlockAcademicYear } from '../../api/academicYears'
import { getComments } from '../../api/comments'
import { getDashboard } from '../../api/dashboard'
import { getStrategyApprovalStatus, approveStrategy } from '../../api/approvals'
import { getSwotStatus } from '../../api/swot'
import { useAuth } from '../../auth/AuthContext'
import StateChip from '../../components/StateChip'
import RoleChip from '../../components/RoleChip'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import StrategyTree from './StrategyTree'
import CommentDrawer from '../../components/CommentDrawer'
import ReportPage from './ReportPage'

function computeValidationErrors(strategy) {
  const areaIds = new Set()
  const goalIds = new Set()
  const objectiveIds = new Set()
  const initiativeIds = new Set()

  const goalsPerArea = {}
  for (const goal of strategy?.goals ?? []) {
    if (goal.areaId) goalsPerArea[goal.areaId] = true
  }
  for (const area of strategy?.areas ?? []) {
    if (!goalsPerArea[area.id]) areaIds.add(area.id)
  }

  for (const goal of strategy?.goals ?? []) {
    if (!goal.objectives?.length) { goalIds.add(goal.id); continue }
    for (const obj of goal.objectives) {
      if (!obj.initiatives?.length) { objectiveIds.add(obj.id); continue }
      for (const ini of obj.initiatives) {
        if (!ini.measurements?.length) initiativeIds.add(ini.id)
      }
    }
  }
  return { areaIds, goalIds, objectiveIds, initiativeIds }
}

const STATE_TRANSITIONS = {
  CREATION: ['REVIEW'],
  REVIEW: ['CREATION', 'DEPLOYED'],
  APPROVAL_PENDING: [],
  DEPLOYED: ['FROZEN'],
  FROZEN: ['DEPLOYED'],
}

function canComment(role, state) {
  if (state === 'APPROVAL_PENDING') return false
  if (state === 'FROZEN') return role === 'OWNER'
  return role === 'OWNER' || role === 'EDITOR' || role === 'COMMENTER'
}

// Modal for managing academic year locks
function FreezeYearModal({ open, onClose, academicYears, onToggle, isPending }) {
  return (
    <Modal
      title="Freeze / Unfreeze Academic Years"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={480}
    >
      {academicYears.length === 0 ? (
        <div style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
          No academic years have been created yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {academicYears.map((year) => (
            <div
              key={year.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8,
                background: year.closed ? '#fff1f0' : '#f6ffed',
                border: `1px solid ${year.closed ? '#ffccc7' : '#b7eb8f'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {year.closed
                  ? <LockOutlined style={{ color: '#ff4d4f' }} />
                  : <UnlockOutlined style={{ color: '#52c41a' }} />}
                <span style={{ fontWeight: 500 }}>{year.name}</span>
                <Tag color={year.closed ? 'error' : 'success'} style={{ margin: 0 }}>
                  {year.closed ? 'Frozen' : 'Open'}
                </Tag>
              </div>
              <Popconfirm
                title={year.closed ? `Unfreeze ${year.name}?` : `Freeze ${year.name}?`}
                description={year.closed
                  ? 'Achievement recording will be re-enabled for this year.'
                  : 'No new achievements can be added for this year across all initiatives.'}
                onConfirm={() => onToggle(year.id, year.closed)}
                okText={year.closed ? 'Unfreeze' : 'Freeze'}
                okButtonProps={{ danger: !year.closed }}
              >
                <Button
                  size="small"
                  icon={year.closed ? <UnlockOutlined /> : <LockOutlined />}
                  danger={!year.closed}
                  loading={isPending}
                >
                  {year.closed ? 'Unfreeze' : 'Freeze'}
                </Button>
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function AuditLogTab({ strategyId }) {
  const [page, setPage] = useState(0)
  const { data: logsPage, isLoading } = useQuery({
    queryKey: ['strategy-audit-log', strategyId, page],
    queryFn: () => getStrategyAuditLog(strategyId, { page, size: 50 }),
  })
  const logs = logsPage?.content ?? []
  const total = logsPage?.totalElements ?? 0

  const columns = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      width: 160,
      render: (v) => (
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#6b7280' }}>
          {v ? new Date(v).toLocaleString() : '—'}
        </span>
      ),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 180,
      render: (v) => (
        <span style={{
          fontFamily: 'monospace', fontSize: 12,
          background: '#eff6ff', color: '#1d4ed8',
          padding: '2px 6px', borderRadius: 4,
        }}>
          {v}
        </span>
      ),
    },
    {
      title: 'User',
      dataIndex: 'userName',
      width: 160,
      render: (v) => v || '—',
    },
    {
      title: 'Entity',
      width: 120,
      render: (_, r) => r.entityType ? `${r.entityType} #${r.entityId}` : '—',
    },
    {
      title: 'Details',
      dataIndex: 'details',
      ellipsis: true,
    },
  ]

  return (
    <Table
      dataSource={logs}
      columns={columns}
      rowKey="id"
      loading={isLoading}
      size="small"
      pagination={{
        current: page + 1,
        pageSize: 50,
        total,
        onChange: (p) => setPage(p - 1),
        showTotal: (t) => `${t} entries`,
      }}
    />
  )
}

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'COMMENTER', label: 'Commenter' },
  { value: 'VIEWER', label: 'Viewer' },
]

function MembersTab({ strategyId }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [addForm] = Form.useForm()
  const [userOptions, setUserOptions] = useState([])
  const [searching, setSearching] = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', strategyId],
    queryFn: () => getMembers(strategyId),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['members', strategyId] })

  const assignMut = useMutation({
    mutationFn: (values) => assignMember(strategyId, values),
    onSuccess: () => { message.success('Member updated'); setAddOpen(false); addForm.resetFields(); refresh() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed'),
  })

  const revokeMut = useMutation({
    mutationFn: (userId) => revokeMember(strategyId, userId),
    onSuccess: () => { message.success('Access revoked'); refresh() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed'),
  })

  const handleSearch = async (q) => {
    if (!q || q.length < 2) { setUserOptions([]); return }
    setSearching(true)
    try {
      const users = await searchUsers(q)
      setUserOptions(users.map((u) => ({
        value: u.id,
        label: `${u.fname} ${u.lname} — ${u.email}${u.department ? ' (' + u.department.name + ')' : ''}`,
      })))
    } finally {
      setSearching(false)
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'userName', key: 'name', sorter: (a, b) => compareStrings(a.userName, b.userName) },
    { title: 'Email', dataIndex: 'userEmail', key: 'email' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => <RoleChip role={role} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, record) => {
        if (record.role === 'OWNER') {
          return <span style={{ color: '#9ca3af', fontSize: 12 }}>Strategy Owner</span>
        }
        return (
          <Space>
            <Select
              size="small"
              value={record.role}
              style={{ width: 120 }}
              options={ROLE_OPTIONS.filter((o) => o.value !== 'OWNER')}
              loading={assignMut.isPending}
              onChange={(newRole) => assignMut.mutate({ userId: record.userId, role: newRole })}
            />
            <Popconfirm
              title="Revoke access?"
              description={`Remove ${record.userName}'s access to this strategy?`}
              onConfirm={() => revokeMut.mutate(record.userId)}
              okText="Revoke"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} loading={revokeMut.isPending} />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { addForm.resetFields(); setUserOptions([]); setAddOpen(true) }}
          style={{ background: '#13223a' }}
        >
          Add Member
        </Button>
      </div>
      <TableTotal count={members.length} />
      <Table
        dataSource={members}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={false}
      />
      <Modal
        title="Add / Update Member"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => addForm.submit()}
        confirmLoading={assignMut.isPending}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={assignMut.mutate}>
          <Form.Item name="userId" label="User" rules={[{ required: true, message: 'Select a user' }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={handleSearch}
              loading={searching}
              options={userOptions}
              placeholder="Type name or email to search..."
              notFoundContent={searching ? <Spin size="small" /> : 'No results'}
            />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} placeholder="Select role" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function StrategyDetailPage() {
  const { strategyId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const [academicYearId, setAcademicYearId] = useState(null)
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
  const [freezeYearOpen, setFreezeYearOpen] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const stratKey = ['strategy', strategyId, academicYearId]
  const commentsKey = ['comments', strategyId]

  const { data: strategy, isLoading } = useQuery({
    queryKey: stratKey,
    queryFn: () => getStrategy(strategyId, academicYearId),
  })

  const { data: comments = [] } = useQuery({
    queryKey: commentsKey,
    queryFn: () => getComments(strategyId),
    enabled: !!strategy,
  })

  // Deliberately does NOT touch showValidation: computeValidationErrors is recomputed live from
  // `strategy` on every render while showValidation is true, so once the user has attempted a
  // CREATION -> REVIEW transition and been blocked, the missing-item highlights should track
  // reality on their own as items get created — this used to unconditionally clear
  // showValidation, wiping every row's highlight (even unrelated ones) after any single create.
  const refreshStrategy = () => {
    qc.invalidateQueries({ queryKey: stratKey })
    qc.invalidateQueries({ queryKey: commentsKey })
  }

  const { data: allAcademicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: getAcademicYears,
    enabled: !!strategy && (strategy.state === 'DEPLOYED' || strategy.state === 'FROZEN'),
  })
  // Academic years belong to one university strategy's cycle -- only years under this strategy's
  // own planning cycle apply here (a department strategy shares its cycle with the university
  // strategy overseeing it). Without this, every strategy's picker would list every academic year
  // in the system, including ones from unrelated cycles with nothing actually copied for it.
  const academicYears = allAcademicYears.filter((y) => y.planningCycleId === strategy?.planningCycleId)

  // Default to the most recent year instead of leaving the tree on "Base Plan (no year)" --
  // achievements/initiatives added while no year is selected attach to the year-less base
  // structure and become invisible under every specific year filter afterward (see
  // AcademicYearService.backfillInitiativeCopiesForNewlyDeployedStrategy for the backend half of
  // this fix). The user still has full control to switch back to "Base Plan" manually.
  //
  // yearManagedRef guards BOTH effects below against looping: it's a ref (not state), so flipping
  // it never itself triggers a re-render/re-run, and once it's true neither effect touches
  // academicYearId again -- whether because the user picked a year themselves (see the Select's
  // onChange) or because the auto-pick's fallback below already ran once.
  const yearManagedRef = useRef(false)
  useEffect(() => {
    if (!academicYearId && !yearManagedRef.current && academicYears.length > 0) {
      setAcademicYearId(getMostRecentAcademicYear(academicYears).id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId, academicYears.length])

  // Safety net for strategies that were never actually frozen/copied for any academic year (e.g.
  // seeded directly rather than through the normal deploy flow): if the year we auto-picked above
  // comes back with zero initiatives anywhere in the tree, that's not "nothing to show for this
  // year" -- it's "this strategy has no year-scoped copies at all", and its real plan/achievements
  // live entirely in the Base Plan. Fall back there once, rather than silently rendering an empty
  // tree that looks like the whole plan vanished. Only applies to the auto-pick -- a year the user
  // deliberately chose themselves (yearManagedRef already true by then) is left alone even if
  // it's genuinely empty.
  useEffect(() => {
    if (!yearManagedRef.current && academicYearId && strategy) {
      const hasAnyInitiative = (strategy.goals ?? []).some((g) =>
        (g.objectives ?? []).some((o) => (o.initiatives ?? []).length > 0)
      )
      if (!hasAnyInitiative) {
        yearManagedRef.current = true
        setAcademicYearId(null)
      }
    }
  }, [academicYearId, strategy])

  const assessmentPeriods = strategy?.assessmentPeriods ?? []

  const { data: dashboardData = [] } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  const myDashEntry = dashboardData.find((d) => String(d.strategyId) === String(strategyId))
  const myRole = myDashEntry?.role ?? null

  // Drives whether/how the "Collaborate on this strategy's SWOT analysis" card below appears:
  // once the workflow is COMPLETED, Editors are done with it entirely, but the Owner still wants
  // a way back into the vote results/word board for reference — see the card's render logic.
  const { data: swotStatus } = useQuery({
    queryKey: ['swot-status', strategyId],
    queryFn: () => getSwotStatus(strategyId),
    enabled: !!strategy && strategy.state === 'CREATION' && (myRole === 'OWNER' || myRole === 'EDITOR'),
  })
  const swotCompleted = swotStatus?.phase === 'COMPLETED'

  const { data: approvalStatus = [] } = useQuery({
    queryKey: ['approvals', strategyId],
    queryFn: () => getStrategyApprovalStatus(strategyId),
    enabled: !!strategy && strategy.state === 'APPROVAL_PENDING',
  })

  const iAmPendingApprover = approvalStatus.some(
    (a) => !a.approved && a.requiredApproverEmail === user?.email
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
      setShowValidation(false)
      refreshStrategy()
    },
    onError: (err) => message.error(err.response?.data?.message || 'State change failed'),
  })

  const validationErrors = showValidation ? computeValidationErrors(strategy) : null

  const handleChangeState = (newState) => {
    if (newState === 'REVIEW' && strategy.state === 'CREATION') {
      const errors = computeValidationErrors(strategy)
      if (errors.areaIds.size || errors.goalIds.size || errors.objectiveIds.size || errors.initiativeIds.size) {
        setShowValidation(true)
        message.error('Some items are incomplete — review the highlighted items before advancing.')
        return
      }
    }
    changeStateMut.mutate(newState)
  }

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
    onError: (err) => message.error(err.response?.data?.message || 'Create failed'),
  })

  const addAreaMut = useMutation({
    mutationFn: (values) => createArea(strategyId, values),
    onSuccess: () => {
      message.success('Vision area created')
      setAddAreaOpen(false)
      refreshStrategy()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Create failed'),
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
    // The backend now rejects this (400) if the area still has goals assigned, instead of
    // silently ungrouping them — surface that reason instead of failing silently.
    onError: (err) => message.error(err.response?.data?.message || 'Could not delete area'),
  })

  // Lock/unlock by specific year ID (used from the Freeze modal)
  const lockMut = useMutation({
    mutationFn: (id) => lockAcademicYear(id),
    onSuccess: () => {
      message.success('Academic year frozen')
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to freeze year'),
  })

  const unlockMut = useMutation({
    mutationFn: (id) => unlockAcademicYear(id),
    onSuccess: () => {
      message.success('Academic year unfrozen')
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to unfreeze year'),
  })

  const handleToggleYearLock = (id, currentlyClosed) => {
    if (currentlyClosed) unlockMut.mutate(id)
    else lockMut.mutate(id)
  }

  const openComment = (entityType, entityId) => {
    const label =
      entityType === 'GOAL'
        ? strategy?.goals?.find((g) => g.id === entityId)?.title
        : entityType === 'OBJECTIVE' ? 'Objective'
        : entityType === 'INITIATIVE' ? 'Initiative'
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
  const selectedYear = academicYears.find((y) => y.id === academicYearId) ?? null
  const yearLocked = selectedYear?.closed ?? false

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
              <Button key={ns} size="small"
                onClick={() => handleChangeState(ns)}
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
                <Button size="small" type="primary" loading={approveMut.isPending}
                  style={{ background: '#52c41a', borderColor: '#52c41a', fontSize: 12 }}>
                  Approve Deployment
                </Button>
              </Popconfirm>
            )}
            <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload('pdf')}>PDF</Button>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload('excel')}>Excel</Button>
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
          column={3} size="small"
        >
          <Descriptions.Item label="Type">
            <Tag color={strategy.strategyType === 'UNIVERSITY' ? 'geekblue' : 'green'}>
              {strategy.strategyType}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Planning Cycle">{strategy.planningCycleName}</Descriptions.Item>
          <Descriptions.Item label="Department">{strategy.departmentName || '—'}</Descriptions.Item>
          {strategy.description && (
            <Descriptions.Item label="Description" span={3}>{strategy.description}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Once SWOT is COMPLETED, Editors have nothing left to do here — the workflow gave way to
          the normal objectives/initiatives editing below, so the card disappears for them. The
          Owner keeps it (reworded) as a way back into the vote results/word board for reference;
          SwotLandingPage no longer bounces the Owner straight back out once phase is COMPLETED. */}
      {strategy.state === 'CREATION' && (myRole === 'OWNER' || myRole === 'EDITOR')
        && (!swotCompleted || myRole === 'OWNER') && (
        <Card
          size="small"
          style={{ marginBottom: 20, background: '#f8faff', borderColor: '#c9d6ea' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#13223a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RocketOutlined /> {swotCompleted ? "This strategy's SWOT analysis" : "Collaborate on this strategy's SWOT analysis"}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {swotCompleted
                  ? 'The SWOT workflow is complete. Revisit the vote results or word board any time for reference.'
                  : "Run a guided SWOT analysis with your team, vote on the strongest ideas, and let AI suggest focus areas and goals to review before drafting this strategy."}
              </div>
            </div>
            <Button onClick={() => navigate(`/strategies/${strategyId}/swot`)}
              style={{ borderColor: '#13223a', color: '#13223a' }}>
              {swotCompleted ? 'View SWOT Reports' : 'Open SWOT Workflow'}
            </Button>
          </div>
        </Card>
      )}

      <Tabs
        defaultActiveKey={requestedTab || 'plan'}
        onChange={(key) => setSearchParams(key === 'plan' ? {} : { tab: key }, { replace: true })}
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
                    title={<span style={{ fontSize: 13, fontWeight: 600, color: '#13223a' }}>Vision Concentration Areas</span>}
                    extra={
                      <Space>
                        <Button size="small" icon={<PlusOutlined />}
                          onClick={() => { areaForm.resetFields(); setAddAreaOpen(true) }}>
                          Add Area
                        </Button>
                        <Button size="small" icon={<SettingOutlined />}
                          onClick={() => { thresholdForm.setFieldsValue({ threshold: strategy.achievementThreshold }); setThresholdOpen(true) }}>
                          Threshold: {strategy.achievementThreshold}
                        </Button>
                        {(strategy.state === 'DEPLOYED' || strategy.state === 'FROZEN') && (
                          <Button size="small" icon={<LockOutlined />}
                            onClick={() => setFreezeYearOpen(true)}>
                            Freeze Academic Year
                          </Button>
                        )}
                      </Space>
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(strategy.areas || []).map((area) => (
                        <div key={area.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: '#1a3a6b', color: '#fff',
                          padding: '4px 12px', borderRadius: 16, fontSize: 13,
                        }}>
                          <span>{area.name}</span>
                          <Button type="text" size="small" icon={<EditOutlined />}
                            style={{ color: '#c9a24b', padding: 0, height: 'auto' }}
                            onClick={() => {
                              setEditingArea(area)
                              areaForm.setFieldsValue({ name: area.name, sortOrder: area.sortOrder })
                              setEditAreaOpen(true)
                            }} />
                          <Popconfirm title="Delete this area?"
                            description="Only possible if it has no goals assigned — move or delete its goals first."
                            onConfirm={() => deleteAreaMut.mutate(area.id)}>
                            <Button type="text" size="small" icon={<DeleteOutlined />}
                              style={{ color: '#ef4444', padding: 0, height: 'auto' }} />
                          </Popconfirm>
                        </div>
                      ))}
                      {(strategy.areas || []).length === 0 && (
                        <span style={{ color: '#9ca3af', fontSize: 13 }}>No areas defined yet</span>
                      )}
                    </div>
                  </Card>
                )}

                {/* Add goal button */}
                {(myRole === 'OWNER' || myRole === 'EDITOR') && strategy.state !== 'REVIEW' && strategy.state !== 'DEPLOYED' && (
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button icon={<PlusOutlined />}
                      onClick={() => { goalForm.resetFields(); setAddGoalOpen(true) }}
                      style={{ borderColor: '#13223a', color: '#13223a' }}>
                      Add Goal
                    </Button>
                  </div>
                )}

                {/* Academic year selector */}
                {(strategy.state === 'DEPLOYED' || strategy.state === 'FROZEN') && (
                  <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Academic Year:</span>
                    <Select
                      placeholder="Base plan (no year)"
                      allowClear
                      value={academicYearId ?? undefined}
                      onChange={(v) => { yearManagedRef.current = true; setAcademicYearId(v ?? null) }}
                      style={{ width: 240 }}
                      options={academicYears.map((y) => ({
                        value: y.id,
                        label: y.name + (y.closed ? ' 🔒' : ''),
                      }))}
                    />
                    {yearLocked && (
                      <Tag icon={<LockOutlined />} color="warning">
                        Frozen — achievement recording disabled
                      </Tag>
                    )}
                  </div>
                )}

                <StrategyTree
                  strategy={strategy}
                  comments={comments}
                  role={myRole}
                  onComment={openComment}
                  onRefresh={refreshStrategy}
                  academicYearId={academicYearId}
                  yearLocked={yearLocked}
                  academicYears={academicYears}
                  assessmentPeriods={assessmentPeriods}
                  validationErrors={validationErrors}
                />
              </div>
            ),
          },
          {
            key: 'report',
            label: 'Report',
            children: <ReportPage strategy={strategy} embedded />,
          },
          ...(isOwner ? [
            {
              key: 'members',
              label: (
                <span>
                  <TeamOutlined style={{ marginRight: 6 }} />
                  Members
                </span>
              ),
              children: <MembersTab strategyId={strategyId} />,
            },
            {
              key: 'audit-log',
              label: 'Audit Log',
              children: <AuditLogTab strategyId={strategyId} />,
            },
          ] : []),
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
      <Modal title="Add Goal" open={addGoalOpen} onCancel={() => setAddGoalOpen(false)}
        onOk={() => goalForm.submit()} confirmLoading={addGoalMut.isPending} destroyOnClose>
        <Form form={goalForm} layout="vertical" onFinish={addGoalMut.mutate}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          {(strategy.areas || []).length > 0 && (
            <Form.Item name="visionAreaId" label="Vision Concentration Area">
              <Select
                allowClear
                placeholder="No area (assign later)"
                options={(strategy.areas || []).map((a) => ({ value: a.id, label: a.name }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Add Area Modal */}
      <Modal title="Create Vision Area" open={addAreaOpen} onCancel={() => setAddAreaOpen(false)}
        onOk={() => areaForm.submit()} confirmLoading={addAreaMut.isPending} destroyOnClose>
        <Form form={areaForm} layout="vertical" onFinish={addAreaMut.mutate}>
          <Form.Item name="name" label="Area Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sortOrder" label="Sort Order" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Area Modal */}
      <Modal title="Edit Vision Area" open={editAreaOpen} onCancel={() => setEditAreaOpen(false)}
        onOk={() => areaForm.submit()} confirmLoading={updateAreaMut.isPending} destroyOnClose>
        <Form form={areaForm} layout="vertical" onFinish={updateAreaMut.mutate}>
          <Form.Item name="name" label="Area Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sortOrder" label="Sort Order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Threshold Modal */}
      <Modal title="Set Achievement Threshold" open={thresholdOpen} onCancel={() => setThresholdOpen(false)}
        onOk={() => thresholdForm.submit()} confirmLoading={setThresholdMut.isPending} destroyOnClose>
        <Form form={thresholdForm} layout="vertical" onFinish={setThresholdMut.mutate}>
          <Form.Item name="threshold" label="Threshold value (minimum achievements for green status)"
            rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Freeze Academic Year Modal */}
      <FreezeYearModal
        open={freezeYearOpen}
        onClose={() => setFreezeYearOpen(false)}
        academicYears={academicYears}
        onToggle={handleToggleYearLock}
        isPending={lockMut.isPending || unlockMut.isPending}
      />
    </div>
  )
}
