// Renders a Strategy's full Goal > Objective > Initiative > Measurement tree with inline
// create/edit/delete for each node, plus the achievement-recording modal (which also tags
// each achievement to a portfolio category/criteria for the annual evaluation workflow).
import { useEffect, useState } from 'react'
import {
  Button, Input, InputNumber, Form, Modal, Popconfirm, message, Tooltip, Badge, Select, Tag, Rate, Alert, Typography,
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
  getAchievements, getAchievementsAcrossYears, updateAchievement, deleteAchievement,
  getAchievementTypes,
  getUniversityObjectives, getAvailableUniversityInitiatives,
} from '../../api/strategies'
import {
  getMyCategories, getCategoriesForEmployee, getMyCycles, getCycleGoals,
  getEntryByAchievement, logAchievement as logAchievementWithEvaluation, upsertEntryForAchievement,
  getCriteria,
} from '../../api/portfolio'
import { useAuth } from '../../auth/AuthContext'

const { Text } = Typography

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

// Flips membership of `key` in a Set, returning a new Set (never mutates the one passed in) —
// used for every expand/collapse toggle in this tree.
function toggled(set, key) {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

function totalForEntity(comments, entityType, entityId) {
  return comments.filter((c) => c.entityType === entityType && c.entityId === entityId).length
}

function unreadForEntity(comments, entityType, entityId) {
  return comments.filter((c) => c.entityType === entityType && c.entityId === entityId && c.unread).length
}

// ─── UnitInput ────────────────────────────────────────────────────────────────

const UNIT_PRESETS = [
  { value: '#', label: '# (count)' },
  { value: '$', label: '$ (US Dollar)' },
  { value: 'AED', label: 'AED (UAE Dirham)' },
  { value: '%', label: '% (Percentage)' },
]

// Measurement unit picker: a dropdown of common units plus "Other" for anything else, which
// reveals a free-text input. Built as a controlled value/onChange component so it drops straight
// into a Form.Item like any other input -- antd's Form wires those props automatically.
function UnitInput({ value, onChange }) {
  const isPreset = UNIT_PRESETS.some((p) => p.value === value)
  // Tracked separately from `value` -- while typing a custom unit, `value` is legitimately empty
  // at first, and an empty string is falsy, so deriving "are we in Other mode" from `value` alone
  // would snap back to "nothing selected" the instant the field was cleared.
  const [otherMode, setOtherMode] = useState(!!value && !isPreset)
  const selectValue = otherMode ? 'OTHER' : (isPreset ? value : undefined)

  return (
    <div>
      <Select
        allowClear
        placeholder="Select a unit"
        value={selectValue}
        options={[...UNIT_PRESETS, { value: 'OTHER', label: 'Other…' }]}
        onChange={(v) => {
          setOtherMode(v === 'OTHER')
          onChange?.(v === 'OTHER' ? '' : v)
        }}
        onClear={() => { setOtherMode(false); onChange?.(undefined) }}
      />
      {otherMode && (
        <Input
          style={{ marginTop: 8 }}
          placeholder="Enter custom unit"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  )
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
              <Select
                allowClear={!f.mode}
                mode={f.mode}
                placeholder={f.placeholder ?? 'None'}
                options={f.options}
                loading={f.loading}
              />
            </Form.Item>
          ) : f.type === 'unit' ? (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules}>
              <UnitInput />
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

function AchievementModal({
  open, onClose, onSave, loading, initialValues, assessmentPeriods, academicYears = [], title, initialPeriodName,
  academicYearId, achievementId, authorId,
}) {
  const [form] = Form.useForm()
  const { user } = useAuth()

  const { data: achievementTypes = [] } = useQuery({
    queryKey: ['achievement-types'],
    queryFn: getAchievementTypes,
    enabled: open,
  })

  // Editing someone else's achievement (Owner privilege) -- their categories/goals apply, not the editor's.
  const isSelf = !authorId || authorId === user?.userId

  const { data: categories = [], isError: categoriesError } = useQuery({
    queryKey: ['portfolio-categories-for-achievement', isSelf ? 'me' : authorId],
    queryFn: () => (isSelf ? getMyCategories() : getCategoriesForEmployee(authorId)),
    enabled: open,
    retry: false,
  })

  // The tree's own academic-year filter (`academicYearId`) is just a display filter and is often
  // unset -- it has nothing to do with which year this specific achievement belongs to. Resolve
  // the actual year from whichever assessment period the achievement is being recorded against
  // (periods and academic years share the same name, e.g. "2028-2029"), falling back to the tree
  // filter only if no period is known yet (the picker hasn't been touched).
  const watchedPeriodId = Form.useWatch('assessmentPeriodId', form)
  const selectedPeriodName = initialPeriodName ?? assessmentPeriods.find((p) => p.id === watchedPeriodId)?.name
  const effectiveAcademicYearId = selectedPeriodName
    ? academicYears.find((y) => y.name === selectedPeriodName)?.id
    : academicYearId

  const { data: myCycles = [] } = useQuery({
    queryKey: ['my-goal-cycles', effectiveAcademicYearId],
    queryFn: () => getMyCycles(effectiveAcademicYearId),
    enabled: open && isSelf && !!effectiveAcademicYearId,
  })
  const deployedCycle = myCycles.find((c) => c.state === 'DEPLOYED')
  const { data: myGoals = [] } = useQuery({
    queryKey: ['my-deployed-goals-for-achievement', deployedCycle?.id],
    queryFn: () => getCycleGoals(deployedCycle.id),
    enabled: open && isSelf && !!deployedCycle,
  })

  const { data: existingEntry } = useQuery({
    queryKey: ['portfolio-entry-for-achievement', achievementId],
    queryFn: () => getEntryByAchievement(achievementId),
    enabled: open && !!achievementId,
  })

  // Criteria narrows to whichever category is currently selected in the form -- reload as it changes.
  const selectedCategoryId = Form.useWatch('categoryId', form)
  const { data: criteria = [] } = useQuery({
    queryKey: ['portfolio-criteria-for-achievement', selectedCategoryId],
    queryFn: () => getCriteria(selectedCategoryId),
    enabled: open && !!selectedCategoryId,
  })

  // "Other" reveals a free-text field for a custom type -- matched by name since achievementTypeId
  // is whatever id the admin's AchievementType table happens to assign it.
  const selectedAchievementTypeId = Form.useWatch('achievementTypeId', form)
  const otherAchievementType = achievementTypes.find((t) => t.name === 'Other')
  const isOtherType = !!otherAchievementType && selectedAchievementTypeId === otherAchievementType.id

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      ...initialValues,
      categoryId: existingEntry?.categoryId,
      criteriaId: existingEntry?.criteriaId,
      categoryRating: existingEntry?.categoryRating,
      goalId: existingEntry?.goalId,
      evidenceUrl: existingEntry?.evidenceUrl,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingEntry])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      onSave(values)
    } catch {}
  }

  const noCategoriesConfigured = open && (categoriesError || categories.length === 0)

  return (
    <Modal title={title} open={open} onCancel={onClose} onOk={handleOk}
      confirmLoading={loading} okButtonProps={{ disabled: noCategoriesConfigured }} destroyOnClose>
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
        {isOtherType && (
          <Form.Item name="customTypeName" label="Custom Type" rules={[{ required: true, message: 'Describe the achievement type' }]}>
            <Input placeholder="Describe the type of achievement" />
          </Form.Item>
        )}
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

        {noCategoriesConfigured ? (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }}
            message="Portfolio categories aren't configured yet"
            description="Ask an admin to configure portfolio categories for your title before recording achievements here." />
        ) : (
          <>
            <Form.Item name="categoryId" label="Evaluation Category" rules={[{ required: true }]}
              extra="Which annual-portfolio category this achievement counts toward">
              <Select placeholder="Select category"
                options={categories.map((c) => ({ value: c.id, label: c.categoryName }))}
                onChange={() => form.setFieldValue('criteriaId', undefined)} />
            </Form.Item>
            <Form.Item name="criteriaId" label="Criteria" rules={[{ required: true }]}
              extra="Which specific criteria within the category -- used later during the annual evaluation">
              <Select placeholder={selectedCategoryId ? 'Select criteria' : 'Select a category first'}
                disabled={!selectedCategoryId}
                options={criteria.map((c) => ({ value: c.id, label: c.criteriaName }))} />
            </Form.Item>
          </>
        )}

        {isSelf && (
          <Form.Item name="goalId" label="Related Annual Goal (Optional)">
            <Select placeholder="Link to a deployed goal" allowClear
              options={myGoals.map((g) => ({ value: g.id, label: g.goalTitle }))} />
          </Form.Item>
        )}

        <Form.Item name="categoryRating" label="Self-Assessment Rating (Optional)">
          <Rate tooltips={['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']} />
        </Form.Item>
        <Form.Item name="evidenceUrl" label="Evidence/Link" rules={[{ required: true, message: 'Evidence/Link is required' }]}
          extra="URL to evidence. Public link is prefered, but even a link to the evidence in your cloud storage open to public is fine">
          <Input placeholder="URL to certificate, publication, or evidence" />
        </Form.Item>
        {!isSelf && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Goal linking is only available to the achievement's author.
          </Text>
        )}
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
          { name: 'unit', label: 'Unit', type: 'unit' },
          { name: 'targetValue', label: 'Target Value', type: 'number' },
          { name: 'actualValue', label: 'Actual Value', type: 'number' },
        ]} />
    </div>
  )
}

// ─── AchievementsPanel ───────────────────────────────────────────────────────
// Trophy icon lives here — at each period group header — not on the INI row.

function AchievementsPanel({ measurements, initiativeId, iniAcademicYearId, basePlanPeriodFilterName, role, state, yearLocked, academicYears, assessmentPeriods, academicYearId, onRefresh, departmentBreakdown }) {
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

  // This initiative row being a base row (iniAcademicYearId null) -- whether because Base Plan is
  // literally selected, or because the backend fell back to it for a requested year that was never
  // frozen (basePlanPeriodFilterName set in that case) -- means its own measurements rarely carry
  // achievements going forward; those get recorded against a specific year's copy instead. Pull the
  // union across every year-copy in that case (one call, optionally narrowed to the matching period)
  // rather than just this row's own measurements, so achievements don't look like they've vanished.
  const showingBasePlan = !iniAcademicYearId
  const perMeasurementQueries = useQueries({
    queries: (!showingBasePlan ? (measurements ?? []) : []).map((m) => ({
      queryKey: ['achievements', m.id],
      queryFn: () => getAchievements(m.id),
    })),
  })
  const acrossYearsQuery = useQuery({
    queryKey: ['achievements-across-years', initiativeId, basePlanPeriodFilterName],
    queryFn: () => getAchievementsAcrossYears(initiativeId, basePlanPeriodFilterName),
    enabled: showingBasePlan && !!initiativeId,
  })

  const isLoading = showingBasePlan ? acrossYearsQuery.isLoading : perMeasurementQueries.some((q) => q.isLoading)
  const all = showingBasePlan ? (acrossYearsQuery.data ?? []) : perMeasurementQueries.flatMap((q) => q.data ?? [])

  const addAchMut = useMutation({
    mutationFn: (values) => logAchievementWithEvaluation({
      measurementId: measurements[0].id,
      achievementTitle: values.title,
      achievementTypeId: values.achievementTypeId,
      customTypeName: values.customTypeName,
      details: values.details,
      privateNotes: values.privateNotes,
      assessmentPeriodId: values.assessmentPeriodId,
      categoryId: values.categoryId,
      criteriaId: values.criteriaId,
      categoryRating: values.categoryRating,
      goalId: values.goalId,
      evidenceUrl: values.evidenceUrl,
    }),
    onSuccess: () => {
      message.success('Achievement recorded')
      setAddingForPeriod(null)
      ;(measurements ?? []).forEach((m) => qc.invalidateQueries({ queryKey: ['achievements', m.id] }))
      qc.invalidateQueries({ queryKey: ['achievements-across-years', initiativeId] })
      onRefresh?.()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to record achievement'),
  })

  const editMut = useMutation({
    mutationFn: async (values) => {
      await updateAchievement(editingAchievement.id, {
        title: values.title,
        achievementTypeId: values.achievementTypeId,
        customTypeName: values.customTypeName,
        details: values.details,
        privateNotes: values.privateNotes,
        assessmentPeriodId: values.assessmentPeriodId,
      })
      await upsertEntryForAchievement(editingAchievement.id, {
        categoryId: values.categoryId,
        criteriaId: values.criteriaId,
        categoryRating: values.categoryRating,
        goalId: values.goalId,
        evidenceUrl: values.evidenceUrl,
      })
    },
    onSuccess: () => {
      message.success('Achievement updated')
      setEditingAchievement(null)
      ;(measurements ?? []).forEach((m) => qc.invalidateQueries({ queryKey: ['achievements', m.id] }))
      qc.invalidateQueries({ queryKey: ['achievements-across-years', initiativeId] })
      onRefresh?.()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteAchievement(id),
    onSuccess: () => {
      message.success('Achievement deleted')
      ;(measurements ?? []).forEach((m) => qc.invalidateQueries({ queryKey: ['achievements', m.id] }))
      qc.invalidateQueries({ queryKey: ['achievements-across-years', initiativeId] })
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
        academicYears={academicYears}
        academicYearId={academicYearId}
        achievementId={editingAchievement?.id}
        authorId={editingAchievement?.authorId}
        initialValues={editingAchievement ? {
          title: editingAchievement.title,
          achievementTypeId: editingAchievement.achievementTypeId,
          customTypeName: editingAchievement.customTypeName,
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
        academicYears={academicYears}
        academicYearId={academicYearId}
        initialPeriodName={addingForPeriod?.name}
        initialValues={{ assessmentPeriodId: addingForPeriod?.id }}
      />
    </>
  )
}

// ─── InitiativeNode ───────────────────────────────────────────────────────────

function InitiativeNode({ ini, objectiveId, isDeptStrategy, expanded, onToggle, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, comments, onComment, onRefresh, validationErrors }) {
  const [editOpen, setEditOpen] = useState(false)
  const [addMeasOpen, setAddMeasOpen] = useState(false)
  const editable = canEdit(role, state)
  const isFrozen = ini.hasAchievements
  const iniInvalid = validationErrors?.initiativeIds?.has(ini.id)

  // Same mapping requirement as the Add Initiative modal (ObjectiveNode) -- only relevant for
  // base (non-year-specific) initiatives, mirroring InitiativeService's server-side exemption.
  const showUniversityMapping = isDeptStrategy && !ini.academicYearId
  const { data: availableUniversityInitiatives = [], isLoading: loadingUnivInitiatives } = useQuery({
    queryKey: ['available-university-initiatives', objectiveId],
    queryFn: () => getAvailableUniversityInitiatives(objectiveId),
    enabled: showUniversityMapping && editOpen,
  })
  const universityInitiativeOptions = availableUniversityInitiatives.map((i) => ({ value: i.id, label: i.title }))

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
        onClick={onToggle}>
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
            initiativeId={ini.id}
            iniAcademicYearId={ini.academicYearId}
            basePlanPeriodFilterName={ini.assessmentPeriodName}
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
        initialValues={{ title: ini.title, description: ini.description, universityInitiativeId: ini.universityInitiativeId ?? undefined }}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
          ...(showUniversityMapping ? [{
            name: 'universityInitiativeId',
            label: 'University Initiative',
            type: 'select',
            placeholder: 'Select the university initiative this maps to',
            options: universityInitiativeOptions,
            loading: loadingUnivInitiatives,
            rules: [{ required: true, message: 'Map this initiative to a university initiative' }],
          }] : []),
        ]} />

      <QuickEditModal open={addMeasOpen} onClose={() => setAddMeasOpen(false)}
        onSave={addMeasMut.mutate} loading={addMeasMut.isPending} title="Add Measurement"
        initialValues={{}}
        fields={[
          { name: 'description', label: 'Description', rules: [{ required: true }] },
          { name: 'unit', label: 'Unit', type: 'unit' },
          { name: 'targetValue', label: 'Target Value', type: 'number' },
        ]} />
    </div>
  )
}

// ─── ObjectiveNode ────────────────────────────────────────────────────────────

function ObjectiveNode({ obj, expanded, onToggle, expandedInitiativeIds, onToggleInitiative, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, isDeptStrategy, comments, onComment, onRefresh, validationErrors }) {
  const [editOpen, setEditOpen] = useState(false)
  const [addIniOpen, setAddIniOpen] = useState(false)
  const editable = canEdit(role, state)
  const isOwner = role === 'OWNER'

  // Department objectives must map to at least one university objective (enforced server-side
  // too -- see ObjectiveService.createObjective/updateObjective); this feeds that select in both
  // the Add and Edit Objective modals below.
  const { data: universityObjectives = [], isLoading: loadingUnivObjectives } = useQuery({
    queryKey: ['university-objectives', strategyId],
    queryFn: () => getUniversityObjectives(strategyId),
    enabled: isDeptStrategy && !!strategyId,
  })
  const universityObjectiveOptions = universityObjectives.map((o) => ({ value: o.id, label: o.title }))

  // University initiatives available for THIS objective's Add Initiative modal -- scoped
  // server-side to whichever university objective(s) this dept objective is mapped to. Only
  // relevant for base (non-year-specific) initiatives -- see InitiativeService.createInitiative,
  // which skips the mapping requirement entirely when academicYearId is set.
  const { data: availableUniversityInitiatives = [], isLoading: loadingUnivInitiatives } = useQuery({
    queryKey: ['available-university-initiatives', obj.id],
    queryFn: () => getAvailableUniversityInitiatives(obj.id),
    enabled: isDeptStrategy && !academicYearId && addIniOpen,
  })
  const universityInitiativeOptions = availableUniversityInitiatives.map((i) => ({ value: i.id, label: i.title }))

  const updateMut = useMutation({
    mutationFn: (v) => updateObjective(obj.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: (err) => message.error(err.response?.data?.message || 'Update failed'),
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
        onClick={onToggle}>
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
            <InitiativeNode key={ini.id} ini={ini} objectiveId={obj.id} isDeptStrategy={isDeptStrategy}
              expanded={expandedInitiativeIds.has(ini.id)} onToggle={() => onToggleInitiative(ini.id)}
              role={role} state={state}
              strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
              academicYears={academicYears} assessmentPeriods={assessmentPeriods}
              planningCycleId={planningCycleId} comments={comments}
              onComment={onComment} onRefresh={onRefresh} validationErrors={validationErrors} />
          ))}
        </div>
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title="Edit Objective"
        initialValues={{ title: obj.title, description: obj.description, universityObjectiveIds: obj.universityObjectiveIds ?? [] }}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
          ...(isDeptStrategy ? [{
            name: 'universityObjectiveIds',
            label: 'University Objective(s)',
            type: 'select',
            mode: 'multiple',
            placeholder: 'Select at least one university objective',
            options: universityObjectiveOptions,
            loading: loadingUnivObjectives,
            rules: [{ required: true, type: 'array', min: 1, message: 'Map this objective to at least one university objective' }],
          }] : []),
        ]} />

      <QuickEditModal open={addIniOpen} onClose={() => setAddIniOpen(false)}
        onSave={addIniMut.mutate} loading={addIniMut.isPending} title="Add Initiative"
        initialValues={{}}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
          ...(isDeptStrategy && !academicYearId ? [{
            name: 'universityInitiativeId',
            label: 'University Initiative',
            type: 'select',
            placeholder: 'Select the university initiative this maps to',
            options: universityInitiativeOptions,
            loading: loadingUnivInitiatives,
            rules: [{ required: true, message: 'Map this initiative to a university initiative' }],
          }] : []),
        ]} />
    </div>
  )
}

// ─── GoalNode ─────────────────────────────────────────────────────────────────

function GoalNode({ goal, expanded, onToggle, expandedObjectiveIds, onToggleObjective, expandedInitiativeIds, onToggleInitiative, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, isDeptStrategy, areas, comments, onComment, onRefresh, validationErrors }) {
  const [editOpen, setEditOpen] = useState(false)
  const [addObjOpen, setAddObjOpen] = useState(false)
  const editable = canEdit(role, state)

  // Same mapping requirement as ObjectiveNode's Edit Objective modal (see ObjectiveService.
  // createObjective) -- needed here too since this is where a brand-new objective is actually
  // created.
  const { data: universityObjectives = [], isLoading: loadingUnivObjectives } = useQuery({
    queryKey: ['university-objectives', strategyId],
    queryFn: () => getUniversityObjectives(strategyId),
    enabled: isDeptStrategy && !!strategyId,
  })
  const universityObjectiveOptions = universityObjectives.map((o) => ({ value: o.id, label: o.title }))

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
        onClick={onToggle}>
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
            <ObjectiveNode key={obj.id} obj={obj}
              expanded={expandedObjectiveIds.has(obj.id)} onToggle={() => onToggleObjective(obj.id)}
              expandedInitiativeIds={expandedInitiativeIds} onToggleInitiative={onToggleInitiative}
              role={role} state={state}
              strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
              academicYears={academicYears} assessmentPeriods={assessmentPeriods}
              planningCycleId={planningCycleId} isDeptStrategy={isDeptStrategy} comments={comments}
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
          ...(isDeptStrategy ? [{
            name: 'universityObjectiveIds',
            label: 'University Objective(s)',
            type: 'select',
            mode: 'multiple',
            placeholder: 'Select at least one university objective',
            options: universityObjectiveOptions,
            loading: loadingUnivObjectives,
            rules: [{ required: true, type: 'array', min: 1, message: 'Map this objective to at least one university objective' }],
          }] : []),
        ]} />
    </div>
  )
}

// ─── AreaSection ──────────────────────────────────────────────────────────────

function AreaSection({ area, goals, expanded, onToggle, expandedGoalIds, onToggleGoal, expandedObjectiveIds, onToggleObjective, expandedInitiativeIds, onToggleInitiative, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, isDeptStrategy, areas, comments, onComment, onRefresh, validationErrors }) {
  const areaInvalid = area && validationErrors?.areaIds?.has(area.id)

  return (
    <div className="area-section" style={{ outline: areaInvalid ? '1px solid #fecaca' : undefined, background: areaInvalid ? '#fff5f5' : undefined, borderRadius: areaInvalid ? 6 : undefined }}>
      <div className="area-header" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={onToggle}>
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
              <GoalNode key={goal.id} goal={goal}
                expanded={expandedGoalIds.has(goal.id)} onToggle={() => onToggleGoal(goal.id)}
                expandedObjectiveIds={expandedObjectiveIds} onToggleObjective={onToggleObjective}
                expandedInitiativeIds={expandedInitiativeIds} onToggleInitiative={onToggleInitiative}
                role={role} state={state}
                strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
                academicYears={academicYears} assessmentPeriods={assessmentPeriods}
                planningCycleId={planningCycleId} isDeptStrategy={isDeptStrategy} areas={areas}
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
  const { goals = [], areas = [], state, id: strategyId, planningCycleId, strategyType } = strategy
  const isDeptStrategy = strategyType !== 'UNIVERSITY'

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

  // Expand/collapse state for the whole tree lives here so one "Expand All / Collapse All"
  // button can drive every level at once. Areas default OPEN (so we track what's collapsed);
  // goals/objectives/initiatives default CLOSED (so we track what's expanded) — same as each
  // node's original per-instance default, which also means a newly-added item automatically
  // gets the right default with no extra sync effect (its id just isn't in either Set yet).
  const [collapsedAreaKeys, setCollapsedAreaKeys] = useState(() => new Set())
  const [expandedGoalIds, setExpandedGoalIds] = useState(() => new Set())
  const [expandedObjectiveIds, setExpandedObjectiveIds] = useState(() => new Set())
  const [expandedInitiativeIds, setExpandedInitiativeIds] = useState(() => new Set())
  const [allExpanded, setAllExpanded] = useState(false)

  const toggleArea = (key) => setCollapsedAreaKeys((prev) => toggled(prev, key))
  const toggleGoal = (id) => setExpandedGoalIds((prev) => toggled(prev, id))
  const toggleObjective = (id) => setExpandedObjectiveIds((prev) => toggled(prev, id))
  const toggleInitiative = (id) => setExpandedInitiativeIds((prev) => toggled(prev, id))

  const handleExpandCollapseAll = () => {
    if (allExpanded) {
      // Collapse back to just Goals: areas stay open (so the goal list itself stays visible),
      // everything below a goal (objectives/initiatives/measurements/achievements) closes.
      setExpandedGoalIds(new Set())
      setExpandedObjectiveIds(new Set())
      setExpandedInitiativeIds(new Set())
    } else {
      const objectiveIds = []
      const initiativeIds = []
      goals.forEach((g) => (g.objectives ?? []).forEach((o) => {
        objectiveIds.push(o.id)
        ;(o.initiatives ?? []).forEach((i) => initiativeIds.push(i.id))
      }))
      setCollapsedAreaKeys(new Set())
      setExpandedGoalIds(new Set(goals.map((g) => g.id)))
      setExpandedObjectiveIds(new Set(objectiveIds))
      setExpandedInitiativeIds(new Set(initiativeIds))
    }
    setAllExpanded(!allExpanded)
  }

  return (
    <div className="strategy-tree">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="small" onClick={handleExpandCollapseAll}>
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </Button>
      </div>
      {areas.map((area) => (
        <AreaSection key={area.id} area={area} goals={goalsByAreaId[area.id] || []}
          expanded={!collapsedAreaKeys.has(area.id)} onToggle={() => toggleArea(area.id)}
          expandedGoalIds={expandedGoalIds} onToggleGoal={toggleGoal}
          expandedObjectiveIds={expandedObjectiveIds} onToggleObjective={toggleObjective}
          expandedInitiativeIds={expandedInitiativeIds} onToggleInitiative={toggleInitiative}
          role={role} state={state} strategyId={strategyId}
          academicYearId={academicYearId} yearLocked={yearLocked} academicYears={academicYears}
          assessmentPeriods={assessmentPeriods} planningCycleId={planningCycleId} areas={areas}
          isDeptStrategy={isDeptStrategy}
          comments={comments} onComment={onComment} onRefresh={onRefresh}
          validationErrors={validationErrors} />
      ))}
      {ungrouped.length > 0 && (
        <AreaSection area={null} goals={ungrouped}
          expanded={!collapsedAreaKeys.has('ungrouped')} onToggle={() => toggleArea('ungrouped')}
          expandedGoalIds={expandedGoalIds} onToggleGoal={toggleGoal}
          expandedObjectiveIds={expandedObjectiveIds} onToggleObjective={toggleObjective}
          expandedInitiativeIds={expandedInitiativeIds} onToggleInitiative={toggleInitiative}
          role={role} state={state}
          strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
          academicYears={academicYears} assessmentPeriods={assessmentPeriods}
          planningCycleId={planningCycleId} areas={areas}
          isDeptStrategy={isDeptStrategy}
          comments={comments} onComment={onComment} onRefresh={onRefresh}
          validationErrors={validationErrors} />
      )}
    </div>
  )
}
