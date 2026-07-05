import { useState } from 'react'
import {
  Button, Input, InputNumber, Form, Modal, Popconfirm, message, Tooltip, Badge, Select, Tag,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CommentOutlined,
  RightOutlined, DownOutlined, LockOutlined, UnlockOutlined, TrophyOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useMutation, useQueryClient, useQueries, useQuery } from '@tanstack/react-query'
import {
  createGoal, updateGoal, deleteGoal, assignGoalArea,
  createObjective, updateObjective, deleteObjective, setObjectiveFrozen,
  createInitiative, updateInitiative, deleteInitiative,
  createMeasurement, updateMeasurement, deleteMeasurement,
  createArea, updateArea, deleteArea,
  getAchievements, recordAchievement, updateAchievement, deleteAchievement,
  getAchievementTypes,
} from '../../api/strategies'

// ─── helpers ────────────────────────────────────────────────────────────────

function ValidationWarning({ tip }) {
  return (
    <Tooltip title={tip}>
      <ExclamationCircleOutlined style={{ color: '#ef4444', fontSize: 13, flexShrink: 0 }} />
    </Tooltip>
  )
}

function canEdit(role, state) {
  if (state !== 'CREATION') return false
  return role === 'OWNER' || role === 'EDITOR'
}

function canRecordAchievement(role, state) {
  if (state !== 'DEPLOYED') return false
  return role === 'OWNER' || role === 'EDITOR'
}

function totalForEntity(comments, entityType, entityId) {
  return comments.filter((c) => c.entityType === entityType && c.entityId === entityId).length
}

function unreadForEntity(comments, entityType, entityId) {
  return comments.filter((c) => c.entityType === entityType && c.entityId === entityId && c.unread).length
}

// ─── QuickEditModal ───────────────────────────────────────────────────────────

function QuickEditModal({ open, onClose, onSave, loading, title, initialValues, fields }) {
  const [form] = Form.useForm()

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      onSave(values)
    } catch {}
  }

  return (
    <Modal title={title} open={open} onCancel={onClose} onOk={handleOk}
      confirmLoading={loading} destroyOnClose
      afterOpenChange={(v) => { if (v) form.setFieldsValue(initialValues) }}>
      <Form form={form} layout="vertical" initialValues={initialValues}>
        {fields.map((f) =>
          f.type === 'number' ? (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules}>
              <InputNumber style={{ width: '100%' }} {...f.props} />
            </Form.Item>
          ) : f.type === 'textarea' ? (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules}>
              <Input.TextArea rows={2} />
            </Form.Item>
          ) : f.type === 'select' ? (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules}>
              <Select allowClear placeholder="None" options={f.options} />
            </Form.Item>
          ) : (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules}>
              <Input />
            </Form.Item>
          )
        )}
      </Form>
    </Modal>
  )
}

// ─── comment button ───────────────────────────────────────────────────────────

function CommentBtn({ entityType, entityId, comments, onClick }) {
  const total = totalForEntity(comments, entityType, entityId)
  const hasUnread = unreadForEntity(comments, entityType, entityId) > 0
  return (
    <Tooltip title={total > 0 ? `${total} comment${total !== 1 ? 's' : ''}` : 'Comments'}>
      <Badge count={total} size="small" offset={[2, -2]} showZero={false}>
        <Button type="text" size="small" icon={<CommentOutlined />}
          onClick={(e) => { e.stopPropagation(); onClick(entityType, entityId) }}
          style={{ color: hasUnread ? '#c9a24b' : total > 0 ? '#6b7280' : '#d1d5db' }} />
      </Badge>
    </Tooltip>
  )
}

// ─── AchievementModal (add & edit) ───────────────────────────────────────────

function AchievementModal({ open, onClose, onSave, loading, initialValues, assessmentPeriods, title, initialPeriodName }) {
  const [form] = Form.useForm()

  const { data: achievementTypes = [] } = useQuery({
    queryKey: ['achievement-types'],
    queryFn: getAchievementTypes,
    enabled: open,
  })

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      onSave(values)
    } catch {}
  }

  return (
    <Modal title={title} open={open} onCancel={onClose} onOk={handleOk}
      confirmLoading={loading} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="achievementTypeId" label="Type" rules={[{ required: true }]}>
          <Select placeholder="Select type">
            {achievementTypes.map((t) => (
              <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        {initialPeriodName ? (
          <>
            {/* Hidden field carries the ID through validateFields when period is pre-set */}
            <Form.Item name="assessmentPeriodId" hidden><Input /></Form.Item>
            <Form.Item label="Assessment Period">
              <span style={{
                display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: 13,
              }}>
                {initialPeriodName}
              </span>
            </Form.Item>
          </>
        ) : (
          <Form.Item name="assessmentPeriodId" label="Assessment Period">
            <Select placeholder="Select period (optional)" allowClear>
              {assessmentPeriods.map((p) => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}
        <Form.Item name="details" label="Details">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="privateNotes" label="Private Notes" extra="Only visible to you">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── MeasurementNode ─────────────────────────────────────────────────────────

function MeasurementNode({ m, role, state, comments, onComment, onRefresh }) {
  const [editOpen, setEditOpen] = useState(false)
  const editable = canEdit(role, state)

  const updateMut = useMutation({
    mutationFn: (v) => updateMeasurement(m.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: () => message.error('Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteMeasurement(m.id),
    onSuccess: onRefresh,
    onError: () => message.error('Delete failed'),
  })

  const ratio = m.targetValue > 0 ? (m.actualValue ?? 0) / m.targetValue : 0
  const colorClass = ratio >= 1 ? 'green' : ratio >= 0.7 ? 'amber' : 'red'

  return (
    <div className="measurement-row">
      <span className="node-type-badge measurement" style={{ fontSize: 9 }}>KPI</span>
      <span style={{ flex: 1, fontSize: 13 }}>{m.description}</span>
      <div className="measurement-values">
        <span className="measurement-target">Target: {m.targetValue ?? '—'} {m.unit}</span>
        <span className={`measurement-actual ${colorClass}`}>Actual: {m.actualValue ?? '—'} {m.unit}</span>
      </div>
      <div className="node-actions">
        <CommentBtn entityType="MEASUREMENT" entityId={m.id} comments={comments} onClick={onComment} />
        {editable && (
          <>
            <Button type="text" size="small" icon={<EditOutlined />}
              onClick={() => setEditOpen(true)} style={{ color: '#6b7280' }} />
            <Popconfirm title="Delete measurement?" onConfirm={() => deleteMut.mutate()}>
              <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#ef4444' }} />
            </Popconfirm>
          </>
        )}
      </div>
      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title="Edit Measurement"
        initialValues={{ description: m.description, unit: m.unit, targetValue: m.targetValue, actualValue: m.actualValue }}
        fields={[
          { name: 'description', label: 'Description', rules: [{ required: true }] },
          { name: 'unit', label: 'Unit' },
          { name: 'targetValue', label: 'Target Value', type: 'number' },
          { name: 'actualValue', label: 'Actual Value', type: 'number' },
        ]} />
    </div>
  )
}

// ─── AchievementsPanel ───────────────────────────────────────────────────────
// Trophy icon lives here — at each period group header — not on the INI row.

function AchievementsPanel({ measurements, role, state, yearLocked, academicYears, assessmentPeriods, academicYearId, onRefresh, departmentBreakdown }) {
  const [editingAchievement, setEditingAchievement] = useState(null)
  // addingForPeriod: null (closed) | { id: number|undefined, name: string|undefined }
  const [addingForPeriod, setAddingForPeriod] = useState(null)
  const qc = useQueryClient()

  // canAddAch: base eligibility — per-group year lock is checked separately
  const canAddAch = canRecordAchievement(role, state) && (measurements?.length ?? 0) > 0

  // Returns true if the academic year matching this period name is frozen
  const isPeriodLocked = (periodName) => {
    const match = academicYears.find((y) => y.name === periodName)
    return match ? (match.closed ?? false) : yearLocked
  }

  const periodIdForName = (name) => assessmentPeriods.find((p) => p.name === name)?.id

  const queries = useQueries({
    queries: (measurements ?? []).map((m) => ({
      queryKey: ['achievements', m.id],
      queryFn: () => getAchievements(m.id),
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const all = queries.flatMap((q) => q.data ?? [])

  const addAchMut = useMutation({
    mutationFn: (values) => recordAchievement(measurements[0].id, values),
    onSuccess: () => {
      message.success('Achievement recorded')
      setAddingForPeriod(null)
      ;(measurements ?? []).forEach((m) => qc.invalidateQueries({ queryKey: ['achievements', m.id] }))
      onRefresh?.()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to record achievement'),
  })

  const editMut = useMutation({
    mutationFn: (values) => updateAchievement(editingAchievement.id, values),
    onSuccess: () => {
      message.success('Achievement updated')
      setEditingAchievement(null)
      ;(measurements ?? []).forEach((m) => qc.invalidateQueries({ queryKey: ['achievements', m.id] }))
      onRefresh?.()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteAchievement(id),
    onSuccess: () => {
      message.success('Achievement deleted')
      ;(measurements ?? []).forEach((m) => qc.invalidateQueries({ queryKey: ['achievements', m.id] }))
      onRefresh?.()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Delete failed'),
  })

  // Nothing to show and no add capability
  if (!canAddAch && all.length === 0 && academicYears.length === 0 && !departmentBreakdown?.length) return null
  if (isLoading) return (
    <div style={{ padding: '6px 0', fontSize: 12, color: '#9ca3af' }}>Loading achievements…</div>
  )

  // Build per-period dept contribution map from backend data
  const deptByPeriod = {}
  ;(departmentBreakdown ?? []).forEach(({ assessmentPeriodName, departmentName, achievementCount }) => {
    const key = assessmentPeriodName ?? 'Unassigned'
    ;(deptByPeriod[key] = deptByPeriod[key] ?? []).push({ departmentName, achievementCount })
  })

  // Build groups from achievements, then seed every academic year + every dept-contribution period
  const grouped = {}
  all.forEach((a) => {
    const label = a.assessmentPeriodName ?? 'Unassigned'
    ;(grouped[label] = grouped[label] ?? []).push(a)
  })
  academicYears.forEach((y) => { if (!grouped[y.name]) grouped[y.name] = [] })
  Object.keys(deptByPeriod).forEach((p) => { if (!grouped[p]) grouped[p] = [] })

  return (
    <>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #e5e7eb' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Reported Achievements
        </div>

        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([period, items]) => {
          const groupLocked = isPeriodLocked(period)
          const deptContribs = deptByPeriod[period] ?? []
          const deptTotal = deptContribs.reduce((s, d) => s + d.achievementCount, 0)
          const periodTotal = items.length + deptTotal
          return (
          <div key={period} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: groupLocked ? '#fff1f0' : '#eff6ff',
                color: groupLocked ? '#cf1322' : '#1d4ed8',
                padding: '1px 8px', borderRadius: 10,
              }}>
                {period} — {periodTotal} achievement{periodTotal !== 1 ? 's' : ''}
                {groupLocked && <LockOutlined style={{ marginLeft: 4, fontSize: 10 }} />}
              </span>
              {canAddAch && !groupLocked && (
                <Tooltip title={`Add achievement for ${period}`}>
                  <Button type="text" size="small" icon={<TrophyOutlined />}
                    onClick={() => setAddingForPeriod({ name: period, id: items[0]?.assessmentPeriodId ?? periodIdForName(period) })}
                    style={{ color: '#c9a24b', padding: '0 4px', height: 'auto', lineHeight: 1 }} />
                </Tooltip>
              )}
            </div>
            {deptContribs.length > 0 && (
              <div style={{ margin: '0 0 4px 0', padding: '5px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Department Contributions
                </div>
                {deptContribs.map((d) => (
                  <div key={d.departmentName} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#374151', marginBottom: 2 }}>
                    <span>{d.departmentName}</span>
                    <span style={{ fontWeight: 600, color: '#b45309' }}>{d.achievementCount}</span>
                  </div>
                ))}
                {items.length > 0 && (
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#374151', marginBottom: 2 }}>
                    <span>Local (university)</span>
                    <span style={{ fontWeight: 600 }}>{items.length}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, borderTop: '1px solid #fde68a', paddingTop: 3, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total</span>
                  <span style={{ color: '#1d4ed8' }}>{periodTotal}</span>
                </div>
              </div>
            )}
            <ul style={{ margin: '2px 0 0 0', paddingLeft: 18 }}>
              {items.map((a) => (
                <li key={a.id} style={{ fontSize: 12, color: '#374151', marginBottom: 3, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  <span style={{ flex: 1 }}>
                    {a.title}
                    {a.authorName && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>— {a.authorName}</span>
                    )}
                  </span>
                  {!groupLocked && a.canEdit && (
                    <Button type="text" size="small" icon={<EditOutlined />}
                      style={{ color: '#9ca3af', padding: '0 2px', height: 'auto', flexShrink: 0 }}
                      onClick={() => setEditingAchievement(a)} />
                  )}
                  {!groupLocked && a.canDelete && (
                    <Popconfirm title="Delete achievement?" onConfirm={() => deleteMut.mutate(a.id)}>
                      <Button type="text" size="small" icon={<DeleteOutlined />}
                        style={{ color: '#ef4444', padding: '0 2px', height: 'auto', flexShrink: 0 }} />
                    </Popconfirm>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )})}
      </div>

      {/* Edit existing achievement */}
      <AchievementModal
        open={!!editingAchievement}
        onClose={() => setEditingAchievement(null)}
        onSave={editMut.mutate}
        loading={editMut.isPending}
        title="Edit Achievement"
        assessmentPeriods={assessmentPeriods}
        initialValues={editingAchievement ? {
          title: editingAchievement.title,
          achievementTypeId: editingAchievement.achievementTypeId,
          assessmentPeriodId: editingAchievement.assessmentPeriodId,
          details: editingAchievement.details,
          privateNotes: editingAchievement.privateNotes,
        } : {}}
      />

      {/* Add new achievement — period ID baked into initialValues so validateFields always has it */}
      <AchievementModal
        open={!!addingForPeriod}
        onClose={() => setAddingForPeriod(null)}
        onSave={addAchMut.mutate}
        loading={addAchMut.isPending}
        title={addingForPeriod?.name ? `Record Achievement — ${addingForPeriod.name}` : 'Record Achievement'}
        assessmentPeriods={assessmentPeriods}
        initialPeriodName={addingForPeriod?.name}
        initialValues={{ assessmentPeriodId: addingForPeriod?.id }}
      />
    </>
  )
}

// ─── InitiativeNode ───────────────────────────────────────────────────────────

function InitiativeNode({ ini, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, comments, onComment, onRefresh, validationErrors }) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addMeasOpen, setAddMeasOpen] = useState(false)
  const editable = canEdit(role, state)
  const isFrozen = ini.hasAchievements
  const iniInvalid = validationErrors?.initiativeIds?.has(ini.id)

  const updateMut = useMutation({
    mutationFn: (v) => updateInitiative(ini.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: (err) => message.error(err.response?.data?.message || 'Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteInitiative(ini.id),
    onSuccess: onRefresh,
    onError: (err) => message.error(err.response?.data?.message || 'Delete failed'),
  })

  const addMeasMut = useMutation({
    mutationFn: (v) => createMeasurement(ini.id, v),
    onSuccess: () => { setAddMeasOpen(false); onRefresh() },
    onError: () => message.error('Create failed'),
  })

  const hasContent = (ini.measurements?.length ?? 0) > 0 || ini.hasAchievements || ini.mappedAchievementCount > 0

  return (
    <div className="tree-node" style={{ marginLeft: 32 }}>
      <div className="tree-node-header"
        style={{ outline: iniInvalid ? '1px solid #fecaca' : undefined, background: iniInvalid ? '#fff5f5' : undefined }}
        onClick={() => setExpanded(!expanded)}>
        <span style={{ width: 16, color: '#9ca3af', flexShrink: 0 }}>
          {hasContent ? (expanded ? <DownOutlined /> : <RightOutlined />) : null}
        </span>
        <span className="node-type-badge initiative">INI</span>
        <div style={{ flex: 1 }}>
          <div className="node-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {ini.title}
            {iniInvalid && <ValidationWarning tip="Needs at least one measurement (KPI)" />}
            {isFrozen && (
              <Tooltip title="Has recorded achievements — cannot be edited or deleted">
                <LockOutlined style={{ fontSize: 11, color: '#c9a24b' }} />
              </Tooltip>
            )}
          </div>
          {ini.description && <div className="node-desc">{ini.description}</div>}
          {ini.universityInitiativeTitle && (
            <Tooltip title="Mapped to university initiative">
              <Tag color="purple" style={{ fontSize: 10, marginTop: 2, cursor: 'default' }}>
                Uni: {ini.universityInitiativeTitle}
              </Tag>
            </Tooltip>
          )}
          {ini.mappedAchievementCount > 0 && (
            <Tooltip title={`${ini.mappedAchievementCount} achievements from mapped departments + ${ini.achievementCount} local`}>
              <Tag color="gold" style={{ fontSize: 10, marginTop: 2, cursor: 'default' }}>
                {ini.achievementCount + ini.mappedAchievementCount} achievements total
              </Tag>
            </Tooltip>
          )}
        </div>
        <div className="node-actions">
          <CommentBtn entityType="INITIATIVE" entityId={ini.id} comments={comments} onClick={onComment} />
          {editable && (
            <>
              {!isFrozen && (
                <>
                  <Button type="text" size="small" icon={<EditOutlined />}
                    onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                    style={{ color: '#6b7280' }} />
                  <Popconfirm title="Delete initiative?" onConfirm={() => deleteMut.mutate()}>
                    <Button type="text" size="small" icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()} style={{ color: '#ef4444' }} />
                  </Popconfirm>
                </>
              )}
              <Button type="text" size="small" icon={<PlusOutlined />}
                onClick={(e) => { e.stopPropagation(); setAddMeasOpen(true) }}
                style={{ color: '#6b7280' }} title="Add Measurement" />
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="tree-node-body" style={{ padding: '8px 16px 8px 48px' }}>
          {ini.measurements?.map((m) => (
            <MeasurementNode key={m.id} m={m} role={role} state={state}
              comments={comments} onComment={onComment} onRefresh={onRefresh} />
          ))}
          <AchievementsPanel
            measurements={ini.measurements ?? []}
            role={role}
            state={state}
            yearLocked={yearLocked}
            academicYears={academicYears}
            assessmentPeriods={assessmentPeriods}
            academicYearId={academicYearId}
            onRefresh={onRefresh}
            departmentBreakdown={ini.departmentBreakdown}
          />
        </div>
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title="Edit Initiative"
        initialValues={{ title: ini.title, description: ini.description }}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />

      <QuickEditModal open={addMeasOpen} onClose={() => setAddMeasOpen(false)}
        onSave={addMeasMut.mutate} loading={addMeasMut.isPending} title="Add Measurement"
        initialValues={{}}
        fields={[
          { name: 'description', label: 'Description', rules: [{ required: true }] },
          { name: 'unit', label: 'Unit' },
          { name: 'targetValue', label: 'Target Value', type: 'number' },
        ]} />
    </div>
  )
}

// ─── ObjectiveNode ────────────────────────────────────────────────────────────

function ObjectiveNode({ obj, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, comments, onComment, onRefresh, validationErrors }) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addIniOpen, setAddIniOpen] = useState(false)
  const editable = canEdit(role, state)
  const isOwner = role === 'OWNER'

  const updateMut = useMutation({
    mutationFn: (v) => updateObjective(obj.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: () => message.error('Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteObjective(obj.id),
    onSuccess: onRefresh,
    onError: () => message.error('Delete failed'),
  })

  const freezeMut = useMutation({
    mutationFn: () => setObjectiveFrozen(obj.id, !obj.frozen),
    onSuccess: onRefresh,
    onError: () => message.error('Operation failed'),
  })

  const addIniMut = useMutation({
    mutationFn: (v) => createInitiative(obj.id, { ...v, academicYearId }),
    onSuccess: () => { setAddIniOpen(false); onRefresh() },
    onError: (err) => message.error(err.response?.data?.message || 'Create failed'),
  })

  const iniCount = obj.initiatives?.length ?? 0
  const objInvalid = validationErrors?.objectiveIds?.has(obj.id)

  return (
    <div className="tree-node" style={{ marginLeft: 16 }}>
      <div className="tree-node-header"
        style={{ outline: objInvalid ? '1px solid #fecaca' : undefined, background: objInvalid ? '#fff5f5' : undefined }}
        onClick={() => setExpanded(!expanded)}>
        <span style={{ width: 16, color: '#9ca3af', flexShrink: 0 }}>
          {iniCount > 0 ? (expanded ? <DownOutlined /> : <RightOutlined />) : null}
        </span>
        <span className="node-type-badge objective">OBJ</span>
        <div style={{ flex: 1 }}>
          <div className="node-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {obj.title}
            {obj.frozen && <span className="frozen-badge"><LockOutlined style={{ fontSize: 10 }} /> Frozen</span>}
            {objInvalid && <ValidationWarning tip="Needs at least one initiative" />}
          </div>
          {obj.description && <div className="node-desc">{obj.description}</div>}
          {obj.universityObjectiveTitles?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
              {obj.universityObjectiveTitles.map((t, i) => (
                <Tooltip key={i} title="Mapped to university objective">
                  <Tag color="geekblue" style={{ fontSize: 10, cursor: 'default' }}>
                    Uni: {t}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
        <div className="node-actions">
          <CommentBtn entityType="OBJECTIVE" entityId={obj.id} comments={comments} onClick={onComment} />
          {editable && (
            <>
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                style={{ color: '#6b7280' }} />
              {!obj.frozen && (
                <Button type="text" size="small" icon={<PlusOutlined />}
                  onClick={(e) => { e.stopPropagation(); setAddIniOpen(true) }}
                  style={{ color: '#6b7280' }} title="Add Initiative" />
              )}
              <Popconfirm title="Delete objective?" onConfirm={() => deleteMut.mutate()}>
                <Button type="text" size="small" icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()} style={{ color: '#ef4444' }} />
              </Popconfirm>
            </>
          )}
          {isOwner && (
            <Tooltip title={obj.frozen ? 'Unfreeze' : 'Freeze'}>
              <Button type="text" size="small"
                icon={obj.frozen ? <UnlockOutlined /> : <LockOutlined />}
                onClick={(e) => { e.stopPropagation(); freezeMut.mutate() }}
                style={{ color: obj.frozen ? '#c0871a' : '#6b7280' }} />
            </Tooltip>
          )}
        </div>
      </div>

      {expanded && obj.initiatives?.length > 0 && (
        <div>
          {obj.initiatives.map((ini) => (
            <InitiativeNode key={ini.id} ini={ini} role={role} state={state}
              strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
              academicYears={academicYears} assessmentPeriods={assessmentPeriods}
              planningCycleId={planningCycleId} comments={comments}
              onComment={onComment} onRefresh={onRefresh} validationErrors={validationErrors} />
          ))}
        </div>
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title="Edit Objective"
        initialValues={{ title: obj.title, description: obj.description }}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />

      <QuickEditModal open={addIniOpen} onClose={() => setAddIniOpen(false)}
        onSave={addIniMut.mutate} loading={addIniMut.isPending} title="Add Initiative"
        initialValues={{}}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />
    </div>
  )
}

// ─── GoalNode ─────────────────────────────────────────────────────────────────

function GoalNode({ goal, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, areas, comments, onComment, onRefresh, validationErrors }) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addObjOpen, setAddObjOpen] = useState(false)
  const editable = canEdit(role, state)

  const updateMut = useMutation({
    mutationFn: (v) => updateGoal(goal.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: () => message.error('Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: onRefresh,
    onError: () => message.error('Delete failed'),
  })

  const addObjMut = useMutation({
    mutationFn: (v) => createObjective(goal.id, v),
    onSuccess: () => { setAddObjOpen(false); onRefresh() },
    onError: (err) => message.error(err.response?.data?.message || 'Create failed'),
  })

  const objCount = goal.objectives?.length ?? 0
  const goalInvalid = validationErrors?.goalIds?.has(goal.id)

  return (
    <div className="tree-node">
      <div className="tree-node-header"
        style={{ background: goalInvalid ? '#fff5f5' : '#fafbff', outline: goalInvalid ? '1px solid #fecaca' : undefined }}
        onClick={() => setExpanded(!expanded)}>
        <span style={{ width: 16, color: '#9ca3af', flexShrink: 0 }}>
          {objCount > 0 ? (expanded ? <DownOutlined /> : <RightOutlined />) : null}
        </span>
        <span className="node-type-badge goal">GOAL</span>
        <div style={{ flex: 1 }}>
          <div className="node-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {goal.title}
            {goalInvalid && <ValidationWarning tip="Needs at least one objective" />}
          </div>
          {goal.description && <div className="node-desc">{goal.description}</div>}
        </div>
        <div className="node-actions">
          <CommentBtn entityType="GOAL" entityId={goal.id} comments={comments} onClick={onComment} />
          {editable && (
            <>
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                style={{ color: '#6b7280' }} />
              <Button type="text" size="small" icon={<PlusOutlined />}
                onClick={(e) => { e.stopPropagation(); setAddObjOpen(true) }}
                style={{ color: '#6b7280' }} title="Add Objective" />
              <Popconfirm title="Delete goal?" onConfirm={() => deleteMut.mutate()}>
                <Button type="text" size="small" icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()} style={{ color: '#ef4444' }} />
              </Popconfirm>
            </>
          )}
        </div>
      </div>

      {expanded && goal.objectives?.length > 0 && (
        <div className="tree-node-body">
          {goal.objectives.map((obj) => (
            <ObjectiveNode key={obj.id} obj={obj} role={role} state={state}
              strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
              academicYears={academicYears} assessmentPeriods={assessmentPeriods}
              planningCycleId={planningCycleId} comments={comments}
              onComment={onComment} onRefresh={onRefresh} validationErrors={validationErrors} />
          ))}
        </div>
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title="Edit Goal"
        initialValues={{ title: goal.title, description: goal.description, visionAreaId: goal.areaId ?? undefined }}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
          ...(areas.length > 0 ? [{
            name: 'visionAreaId',
            label: 'Vision Concentration Area',
            type: 'select',
            options: areas.map((a) => ({ value: a.id, label: a.name })),
          }] : []),
        ]} />

      <QuickEditModal open={addObjOpen} onClose={() => setAddObjOpen(false)}
        onSave={addObjMut.mutate} loading={addObjMut.isPending} title="Add Objective"
        initialValues={{}}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />
    </div>
  )
}

// ─── AreaSection ──────────────────────────────────────────────────────────────

function AreaSection({ area, goals, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, areas, comments, onComment, onRefresh, validationErrors }) {
  const [expanded, setExpanded] = useState(true)
  const areaInvalid = area && validationErrors?.areaIds?.has(area.id)

  return (
    <div className="area-section" style={{ outline: areaInvalid ? '1px solid #fecaca' : undefined, background: areaInvalid ? '#fff5f5' : undefined, borderRadius: areaInvalid ? 6 : undefined }}>
      <div className="area-header" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpanded(!expanded)}>
        {expanded ? <DownOutlined style={{ fontSize: 11 }} /> : <RightOutlined style={{ fontSize: 11 }} />}
        {area ? (
          <>
            <span>{area.name}</span>
            <span className="area-tag">{goals.length} goals</span>
            {areaInvalid && <ValidationWarning tip="Needs at least one goal" />}
          </>
        ) : (
          <>
            <span style={{ color: '#aab4c4' }}>Ungrouped Goals</span>
            <span className="area-tag">{goals.length}</span>
          </>
        )}
      </div>
      {expanded && (
        <div className="area-goals">
          {goals.length === 0 ? (
            <div style={{ padding: '16px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
              No goals in this area
            </div>
          ) : (
            goals.map((goal) => (
              <GoalNode key={goal.id} goal={goal} role={role} state={state}
                strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
                academicYears={academicYears} assessmentPeriods={assessmentPeriods}
                planningCycleId={planningCycleId} areas={areas}
                comments={comments} onComment={onComment} onRefresh={onRefresh}
                validationErrors={validationErrors} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── StrategyTree (root export) ───────────────────────────────────────────────

export default function StrategyTree({
  strategy,
  comments,
  role,
  onComment,
  onRefresh,
  academicYearId,
  yearLocked,
  academicYears = [],
  assessmentPeriods = [],
  validationErrors = null,
}) {
  const { goals = [], areas = [], state, id: strategyId, planningCycleId } = strategy

  const goalsByAreaId = {}
  const ungrouped = []
  goals.forEach((g) => {
    if (g.areaId) {
      if (!goalsByAreaId[g.areaId]) goalsByAreaId[g.areaId] = []
      goalsByAreaId[g.areaId].push(g)
    } else {
      ungrouped.push(g)
    }
  })

  return (
    <div className="strategy-tree">
      {areas.map((area) => (
        <AreaSection key={area.id} area={area} goals={goalsByAreaId[area.id] || []}
          role={role} state={state} strategyId={strategyId}
          academicYearId={academicYearId} yearLocked={yearLocked} academicYears={academicYears}
          assessmentPeriods={assessmentPeriods} planningCycleId={planningCycleId} areas={areas}
          comments={comments} onComment={onComment} onRefresh={onRefresh}
          validationErrors={validationErrors} />
      ))}
      {ungrouped.length > 0 && (
        <AreaSection area={null} goals={ungrouped} role={role} state={state}
          strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
          academicYears={academicYears} assessmentPeriods={assessmentPeriods}
          planningCycleId={planningCycleId} areas={areas}
          comments={comments} onComment={onComment} onRefresh={onRefresh}
          validationErrors={validationErrors} />
      )}
    </div>
  )
}
