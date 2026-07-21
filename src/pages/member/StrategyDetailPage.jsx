import { useState, useEffect } from 'react'
import {
  Tabs, Button, Card, Modal, Form, Input, InputNumber, Select,
  Descriptions, message, Tag, Space, Spin, Popconfirm, Table,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, SettingOutlined, EditOutlined,
  DeleteOutlined, DownloadOutlined, LockOutlined, UnlockOutlined,
  TeamOutlined, RocketOutlined, SwapOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  changeState, setThreshold, createGoal, createArea, updateArea, deleteArea,
  downloadPdf, downloadExcel, getMembers, assignMember, revokeMember, transferOwnership, searchUsers,
  getStrategyAuditLog,
} from '../../api/strategies'
import { lockAcademicYear, unlockAcademicYear } from '../../api/academicYears'
import { getComments } from '../../api/comments'
import { getDashboard } from '../../api/dashboard'
import { getStrategyApprovalStatus, approveStrategy } from '../../api/approvals'
import { getSwotStatus } from '../../api/swot'
import { useAuth } from '../../auth/AuthContext'
import { useTerminology } from '../../TerminologyContext'
import { useStrategyYearContext } from '../../hooks/useStrategyYearContext'
import { recordStrategyVisit } from '../../hooks/useRecentStrategyVisits'
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

// DEPLOYED gets its own "Request Deployment" copy (handled separately); the rest just show the
// translated state name.
const STATE_LABEL_KEYS = {
  CREATION: 'state.creation',
  REVIEW: 'state.review',
  FROZEN: 'state.frozen',
}

function canComment(role, state) {
  if (state === 'APPROVAL_PENDING') return false
  if (state === 'FROZEN') return role === 'OWNER'
  return role === 'OWNER' || role === 'EDITOR' || role === 'COMMENTER'
}

// Modal for managing academic year locks
function FreezeYearModal({ open, onClose, academicYears, onToggle, isPending }) {
  const { t } = useTranslation()
  const { academicYearLabel } = useTerminology()
  return (
    <Modal
      title={t('freezeYear.title', { yearLabel: `${academicYearLabel}s` })}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
      width={480}
    >
      {academicYears.length === 0 ? (
        <div style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
          {t('freezeYear.noneCreated', { yearLabel: `${academicYearLabel.toLowerCase()}s` })}
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
                  {year.closed ? t('freezeYear.frozen') : t('freezeYear.open')}
                </Tag>
              </div>
              <Popconfirm
                title={year.closed
                  ? t('freezeYear.confirmUnfreeze', { name: year.name })
                  : t('freezeYear.confirmFreeze', { name: year.name })}
                description={year.closed
                  ? t('freezeYear.unfreezeDescription')
                  : t('freezeYear.freezeDescription')}
                onConfirm={() => onToggle(year.id, year.closed)}
                okText={year.closed ? t('freezeYear.unfreezeAction') : t('freezeYear.freezeAction')}
                okButtonProps={{ danger: !year.closed }}
              >
                <Button
                  size="small"
                  icon={year.closed ? <UnlockOutlined /> : <LockOutlined />}
                  danger={!year.closed}
                  loading={isPending}
                >
                  {year.closed ? t('freezeYear.unfreezeAction') : t('freezeYear.freezeAction')}
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
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const { data: logsPage, isLoading } = useQuery({
    queryKey: ['strategy-audit-log', strategyId, page],
    queryFn: () => getStrategyAuditLog(strategyId, { page, size: 50 }),
  })
  const logs = logsPage?.content ?? []
  const total = logsPage?.totalElements ?? 0

  const columns = [
    {
      title: t('auditLog.colTime'),
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
      title: t('auditLog.colAction'),
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
      title: t('auditLog.colUser'),
      dataIndex: 'userName',
      width: 160,
      render: (v) => v || '—',
    },
    {
      title: t('auditLog.colEntity'),
      width: 120,
      render: (_, r) => r.entityType ? `${r.entityType} #${r.entityId}` : '—',
    },
    {
      title: t('auditLog.colDetails'),
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
        showTotal: (count) => t('auditLog.entriesTotal', { count }),
      }}
    />
  )
}

function MembersTab({ strategyId, onOwnershipTransferred }) {
  const { t } = useTranslation()
  const roleOptions = [
    { value: 'OWNER', label: t('role.owner') },
    { value: 'EDITOR', label: t('role.editor') },
    { value: 'COMMENTER', label: t('role.commenter') },
    { value: 'VIEWER', label: t('role.viewer') },
  ]
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
    onSuccess: () => { message.success(t('members.updateSuccess')); setAddOpen(false); addForm.resetFields(); refresh() },
    onError: (err) => message.error(err.response?.data?.message || t('common.failed')),
  })

  const revokeMut = useMutation({
    mutationFn: (userId) => revokeMember(strategyId, userId),
    onSuccess: () => { message.success(t('members.revokeSuccess')); refresh() },
    onError: (err) => message.error(err.response?.data?.message || t('common.failed')),
  })

  const transferMut = useMutation({
    mutationFn: (userId) => transferOwnership(strategyId, userId),
    onSuccess: () => {
      message.success(t('members.transferSuccess'))
      refresh()
      // myRole/isOwner on the parent page are derived from the 'dashboard' query, not from this
      // tab's own 'members' query -- invalidate it so the Members/Audit Log tabs actually disappear
      // now that this user is no longer Owner, instead of staying visible (and broken -- getMembers
      // requires Owner) until something else happens to refetch the dashboard.
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onOwnershipTransferred?.()
    },
    onError: (err) => message.error(err.response?.data?.message || t('members.transferError')),
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
    { title: t('common.name'), dataIndex: 'userName', key: 'name', sorter: (a, b) => compareStrings(a.userName, b.userName) },
    { title: t('common.email'), dataIndex: 'userEmail', key: 'email' },
    {
      title: t('common.role'),
      dataIndex: 'role',
      key: 'role',
      render: (role) => <RoleChip role={role} />,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 270,
      render: (_, record) => {
        if (record.role === 'OWNER') {
          return <span style={{ color: '#9ca3af', fontSize: 12 }}>{t('members.strategyOwner')}</span>
        }
        return (
          <Space>
            <Select
              size="small"
              value={record.role}
              style={{ width: 120 }}
              options={roleOptions.filter((o) => o.value !== 'OWNER')}
              loading={assignMut.isPending}
              onChange={(newRole) => assignMut.mutate({ userId: record.userId, role: newRole })}
            />
            <Popconfirm
              title={t('members.confirmTransferTitle')}
              description={t('members.confirmTransferDescription', { name: record.userName })}
              onConfirm={() => transferMut.mutate(record.userId)}
              okText={t('members.transferButton')}
            >
              <Button size="small" icon={<SwapOutlined />} loading={transferMut.isPending}
                title={t('members.transferTooltip')} />
            </Popconfirm>
            <Popconfirm
              title={t('members.confirmRevokeTitle')}
              description={t('members.confirmRevokeDescription', { name: record.userName })}
              onConfirm={() => revokeMut.mutate(record.userId)}
              okText={t('members.revokeButton')}
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
          {t('members.addMember')}
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
        title={t('members.addModalTitle')}
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => addForm.submit()}
        confirmLoading={assignMut.isPending}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={assignMut.mutate}>
          <Form.Item name="userId" label={t('common.user')} rules={[{ required: true, message: t('members.selectUserRequired') }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={handleSearch}
              loading={searching}
              options={userOptions}
              placeholder={t('members.searchPlaceholder')}
              notFoundContent={searching ? <Spin size="small" /> : t('members.noResults')}
            />
          </Form.Item>
          <Form.Item name="role" label={t('common.role')} rules={[{ required: true }]}>
            <Select options={roleOptions} placeholder={t('members.selectRolePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function StrategyDetailPage() {
  const { t } = useTranslation()
  const { academicYearLabel } = useTerminology()
  const { strategyId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Controlled (not defaultActiveKey) so we can force navigation back to Strategic Plan when the
  // Members/Audit Log tabs are about to disappear out from under the user -- e.g. right after they
  // transfer ownership away and lose access to both.
  const [activeTab, setActiveTab] = useState(requestedTab || 'plan')
  const goToTab = (key) => {
    setActiveTab(key)
    setSearchParams(key === 'plan' ? {} : { tab: key }, { replace: true })
  }
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
  const [freezeYearOpen, setFreezeYearOpen] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const {
    strategy, strategyLoading: isLoading, stratKey,
    academicYearId, setAcademicYearId, academicYears, assessmentPeriods,
  } = useStrategyYearContext(strategyId)

  useEffect(() => {
    recordStrategyVisit(strategyId)
  }, [strategyId])

  const commentsKey = ['comments', strategyId]

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
      message.success(t('approvals.approveSuccess'))
      qc.invalidateQueries({ queryKey: ['approvals', strategyId] })
      qc.invalidateQueries({ queryKey: ['pending-approvals'] })
      refreshStrategy()
    },
    onError: (err) => message.error(err.response?.data?.message || t('approvals.approveError')),
  })

  const changeStateMut = useMutation({
    mutationFn: (newState) => changeState(strategyId, newState),
    onSuccess: () => {
      message.success(t('strategyDetail.stateUpdated'))
      setShowValidation(false)
      refreshStrategy()
    },
    onError: (err) => message.error(err.response?.data?.message || t('strategyDetail.stateChangeError')),
  })

  const validationErrors = showValidation ? computeValidationErrors(strategy) : null

  const handleChangeState = (newState) => {
    if (newState === 'REVIEW' && strategy.state === 'CREATION') {
      const errors = computeValidationErrors(strategy)
      if (errors.areaIds.size || errors.goalIds.size || errors.objectiveIds.size || errors.initiativeIds.size) {
        setShowValidation(true)
        message.error(t('strategyDetail.validationIncomplete'))
        return
      }
    }
    changeStateMut.mutate(newState)
  }

  const setThresholdMut = useMutation({
    mutationFn: (values) => setThreshold(strategyId, values.threshold),
    onSuccess: () => {
      message.success(t('strategyDetail.thresholdUpdated'))
      setThresholdOpen(false)
      refreshStrategy()
    },
  })

  const addGoalMut = useMutation({
    mutationFn: (values) => createGoal(strategyId, values),
    onSuccess: () => {
      message.success(t('strategyDetail.goalAdded'))
      setAddGoalOpen(false)
      refreshStrategy()
    },
    onError: (err) => message.error(err.response?.data?.message || t('common.createFailed')),
  })

  const addAreaMut = useMutation({
    mutationFn: (values) => createArea(strategyId, values),
    onSuccess: () => {
      message.success(t('strategyDetail.areaCreated'))
      setAddAreaOpen(false)
      refreshStrategy()
    },
    onError: (err) => message.error(err.response?.data?.message || t('common.createFailed')),
  })

  const updateAreaMut = useMutation({
    mutationFn: (values) => updateArea(editingArea?.id, values),
    onSuccess: () => {
      message.success(t('strategyDetail.areaUpdated'))
      setEditAreaOpen(false)
      refreshStrategy()
    },
  })

  const deleteAreaMut = useMutation({
    mutationFn: deleteArea,
    onSuccess: () => {
      message.success(t('strategyDetail.areaDeleted'))
      refreshStrategy()
    },
    // The backend now rejects this (400) if the area still has goals assigned, instead of
    // silently ungrouping them — surface that reason instead of failing silently.
    onError: (err) => message.error(err.response?.data?.message || t('strategyDetail.areaDeleteError')),
  })

  // Lock/unlock by specific year ID (used from the Freeze modal)
  const lockMut = useMutation({
    mutationFn: (id) => lockAcademicYear(id),
    onSuccess: () => {
      message.success(t('strategyDetail.yearFrozen', { yearLabel: academicYearLabel }))
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('strategyDetail.freezeYearError')),
  })

  const unlockMut = useMutation({
    mutationFn: (id) => unlockAcademicYear(id),
    onSuccess: () => {
      message.success(t('strategyDetail.yearUnfrozen', { yearLabel: academicYearLabel }))
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('strategyDetail.unfreezeYearError')),
  })

  const handleToggleYearLock = (id, currentlyClosed) => {
    if (currentlyClosed) unlockMut.mutate(id)
    else lockMut.mutate(id)
  }

  const openComment = (entityType, entityId) => {
    const label =
      entityType === 'GOAL'
        ? strategy?.goals?.find((g) => g.id === entityId)?.title
        : entityType === 'OBJECTIVE' ? t('common.objective')
        : entityType === 'INITIATIVE' ? t('common.initiative')
        : t('common.measurement')
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
      message.error(t('strategyDetail.downloadFailed'))
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
        {t('nav.myStrategies')}
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
                → {ns === 'DEPLOYED' ? t('strategyDetail.requestDeployment') : (STATE_LABEL_KEYS[ns] ? t(STATE_LABEL_KEYS[ns]) : ns)}
              </Button>
            ))}
            {strategy.state === 'APPROVAL_PENDING' && iAmPendingApprover && (
              <Popconfirm
                title={t('strategyDetail.approveDeployTitle')}
                description={t('strategyDetail.approveDeployDescription')}
                onConfirm={() => approveMut.mutate()}
              >
                <Button size="small" type="primary" loading={approveMut.isPending}
                  style={{ background: '#52c41a', borderColor: '#52c41a', fontSize: 12 }}>
                  {t('strategyDetail.approveDeployButton')}
                </Button>
              </Popconfirm>
            )}
            <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload('pdf')}>{t('common.pdf')}</Button>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload('excel')}>{t('common.excel')}</Button>
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
          <Descriptions.Item label={t('common.type')}>
            <Tag color={strategy.strategyType === 'UNIVERSITY' ? 'geekblue' : 'green'}>
              {strategy.strategyType}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('strategyCreation.colPlanningCycle')}>{strategy.planningCycleName}</Descriptions.Item>
          <Descriptions.Item label={t('common.department')}>{strategy.departmentName || '—'}</Descriptions.Item>
          {strategy.description && (
            <Descriptions.Item label={t('common.description')} span={3}>{strategy.description}</Descriptions.Item>
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
                <RocketOutlined /> {swotCompleted ? t('strategyDetail.swotCardTitleDone') : t('strategyDetail.swotCardTitleOpen')}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {swotCompleted
                  ? t('strategyDetail.swotCardBodyDone')
                  : t('strategyDetail.swotCardBodyOpen')}
              </div>
            </div>
            <Button onClick={() => navigate(`/strategies/${strategyId}/swot`)}
              style={{ borderColor: '#13223a', color: '#13223a' }}>
              {swotCompleted ? t('strategyDetail.viewSwotReports') : t('strategyDetail.openSwotWorkflow')}
            </Button>
          </div>
        </Card>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={goToTab}
        items={[
          {
            key: 'plan',
            label: t('strategyDetail.tabPlan'),
            children: (
              <div>
                {/* Vision Areas management (Owner only) */}
                {isOwner && (
                  <Card
                    size="small"
                    title={<span style={{ fontSize: 13, fontWeight: 600, color: '#13223a' }}>{t('strategyDetail.visionAreasTitle')}</span>}
                    extra={
                      <Space>
                        <Button size="small" icon={<PlusOutlined />}
                          onClick={() => { areaForm.resetFields(); setAddAreaOpen(true) }}>
                          {t('strategyDetail.addArea')}
                        </Button>
                        <Button size="small" icon={<SettingOutlined />}
                          onClick={() => { thresholdForm.setFieldsValue({ threshold: strategy.achievementThreshold }); setThresholdOpen(true) }}>
                          {t('strategyDetail.thresholdButton', { value: strategy.achievementThreshold })}
                        </Button>
                        {(strategy.state === 'DEPLOYED' || strategy.state === 'FROZEN') && (
                          <Button size="small" icon={<LockOutlined />}
                            onClick={() => setFreezeYearOpen(true)}>
                            {t('strategyDetail.freezeYearButton', { yearLabel: academicYearLabel })}
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
                          <Popconfirm title={t('strategyDetail.deleteAreaConfirmTitle')}
                            description={t('strategyDetail.deleteAreaConfirmDescription')}
                            onConfirm={() => deleteAreaMut.mutate(area.id)}>
                            <Button type="text" size="small" icon={<DeleteOutlined />}
                              style={{ color: '#ef4444', padding: 0, height: 'auto' }} />
                          </Popconfirm>
                        </div>
                      ))}
                      {(strategy.areas || []).length === 0 && (
                        <span style={{ color: '#9ca3af', fontSize: 13 }}>{t('strategyDetail.noAreasYet')}</span>
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
                      {t('strategyDetail.addGoal')}
                    </Button>
                  </div>
                )}

                {/* Academic year selector */}
                {(strategy.state === 'DEPLOYED' || strategy.state === 'FROZEN') && (
                  <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{academicYearLabel}:</span>
                    <Select
                      placeholder={t('strategyDetail.basePlanNoYear')}
                      allowClear
                      value={academicYearId ?? undefined}
                      onChange={(v) => setAcademicYearId(v ?? null)}
                      style={{ width: 240 }}
                      options={academicYears.map((y) => ({
                        value: y.id,
                        label: y.name + (y.closed ? ' 🔒' : ''),
                      }))}
                    />
                    {yearLocked && (
                      <Tag icon={<LockOutlined />} color="warning">
                        {t('strategyDetail.frozenTagLabel')}
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
            label: t('report.title'),
            children: <ReportPage strategy={strategy} embedded />,
          },
          ...(isOwner ? [
            {
              key: 'members',
              label: (
                <span>
                  <TeamOutlined style={{ marginRight: 6 }} />
                  {t('strategyDetail.tabMembers')}
                </span>
              ),
              children: <MembersTab strategyId={strategyId} onOwnershipTransferred={() => goToTab('plan')} />,
            },
            {
              key: 'audit-log',
              label: t('strategyDetail.tabAuditLog'),
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
      <Modal title={t('strategyDetail.addGoal')} open={addGoalOpen} onCancel={() => setAddGoalOpen(false)}
        onOk={() => goalForm.submit()} confirmLoading={addGoalMut.isPending} destroyOnClose>
        <Form form={goalForm} layout="vertical" onFinish={addGoalMut.mutate}>
          <Form.Item name="title" label={t('common.title')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input.TextArea rows={2} /></Form.Item>
          {(strategy.areas || []).length > 0 && (
            <Form.Item name="visionAreaId" label={t('strategyDetail.visionAreaLabel')}>
              <Select
                allowClear
                placeholder={t('strategyDetail.noAreaPlaceholder')}
                options={(strategy.areas || []).map((a) => ({ value: a.id, label: a.name }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Add Area Modal */}
      <Modal title={t('strategyDetail.createAreaTitle')} open={addAreaOpen} onCancel={() => setAddAreaOpen(false)}
        onOk={() => areaForm.submit()} confirmLoading={addAreaMut.isPending} destroyOnClose>
        <Form form={areaForm} layout="vertical" onFinish={addAreaMut.mutate}>
          <Form.Item name="name" label={t('strategyDetail.areaNameLabel')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sortOrder" label={t('strategyDetail.sortOrderLabel')} initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Area Modal */}
      <Modal title={t('strategyDetail.editAreaTitle')} open={editAreaOpen} onCancel={() => setEditAreaOpen(false)}
        onOk={() => areaForm.submit()} confirmLoading={updateAreaMut.isPending} destroyOnClose>
        <Form form={areaForm} layout="vertical" onFinish={updateAreaMut.mutate}>
          <Form.Item name="name" label={t('strategyDetail.areaNameLabel')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sortOrder" label={t('strategyDetail.sortOrderLabel')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Threshold Modal */}
      <Modal title={t('strategyDetail.setThresholdTitle')} open={thresholdOpen} onCancel={() => setThresholdOpen(false)}
        onOk={() => thresholdForm.submit()} confirmLoading={setThresholdMut.isPending} destroyOnClose>
        <Form form={thresholdForm} layout="vertical" onFinish={setThresholdMut.mutate}>
          <Form.Item name="threshold" label={t('strategyDetail.thresholdFieldLabel')}
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
