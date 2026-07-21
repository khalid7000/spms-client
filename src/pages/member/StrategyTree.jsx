// Renders a Strategy's Vision Area > Goal > Objective > Initiative > Measurement tree as an
// achievement-first board: Areas are the only collapsible level (everything under an open Area
// renders flat), Initiatives render as a card grid or a list (user's choice, remembered per
// strategy), and a permanent right-hand rail lets you log an achievement, see plan-wide stats, and
// see what was recently logged -- without opening the tree at all. Inline create/edit/delete is
// still available at every level, plus the achievement-recording modal (which also tags each
// achievement to a portfolio category/criteria for the annual evaluation workflow).
import { useState, useEffect } from 'react'
import {
  Button, Input, InputNumber, Form, Modal, Drawer, Popconfirm, message, Tooltip, Badge, Select, Tag,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CommentOutlined,
  RightOutlined, DownOutlined, LockOutlined, UnlockOutlined, TrophyOutlined,
  ExclamationCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { useMutation, useQueryClient, useQueries, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  createGoal, updateGoal, deleteGoal,
  createObjective, updateObjective, deleteObjective, setObjectiveFrozen,
  createInitiative, updateInitiative, deleteInitiative, suggestMeasurement,
  createMeasurement, updateMeasurement, deleteMeasurement,
  getAchievements, getAchievementsAcrossYears, getRecentAchievements,
  getUniversityObjectives, getAvailableUniversityInitiatives,
} from '../../api/strategies'
import { useViewPrefs } from '../../hooks/useViewPrefs'
import { useTerminology } from '../../TerminologyContext'
import {
  AchievementModal, AchievementReportModal,
  useAddAchievementMutation, useEditAchievementMutation, useDeleteAchievementMutation,
} from '../../components/AchievementModal'
import { canRecordAchievement, resolveFixedPeriod } from '../../utils/achievements'

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

// Flips membership of `key` in a Set, returning a new Set (never mutates the one passed in) —
// used for the Vision Area expand/collapse toggle (the only level still collapsible).
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

// Whether the academic year matching this assessment-period name is frozen -- shared by
// AchievementsPanel (gates add/edit/delete per period group) and the Initiative status chip
// (shows "Frozen" instead of a progress color). Falls back to the tree's own year-filter lock
// when no matching year is found (e.g. viewing the Base Plan).
function isPeriodLocked(academicYears, yearLocked, periodName) {
  const match = academicYears.find((y) => y.name === periodName)
  return match ? (match.closed ?? false) : yearLocked
}

// On track / needs attention / not started / frozen -- mirrors the exact initiativeColor/
// rollupColor algorithm already duplicated server-side (StrategyService) and in ReportPage.jsx /
// StrategySummaryChart.jsx (red=0, amber=below threshold, green=at/above), fed by the same
// all-time achievementCount already shown in the old "achievements total" tag. This is NOT the
// period-scoped count the Dashboard's own rollup uses, so it can disagree with that -- no endpoint
// currently exposes a period-scoped count at this granularity.
function initiativeStatus(count, threshold, frozen) {
  if (frozen) return { labelKey: 'tree.statusFrozen', tone: 'frozen' }
  if (count === 0) return { labelKey: 'tree.statusNotStarted', tone: 'red' }
  if (count >= threshold) return { labelKey: 'tree.statusOnTrack', tone: 'green' }
  return { labelKey: 'tree.statusNeedsAttention', tone: 'amber' }
}

// Every Initiative across the whole strategy, with its parent Goal/Objective for display and
// search -- powers the rail's stats and its "search any initiative" achievement picker.
function flattenInitiatives(goals) {
  const result = []
  goals.forEach((g) => {
    ;(g.objectives ?? []).forEach((o) => {
      ;(o.initiatives ?? []).forEach((ini) => {
        result.push({ initiative: ini, objectiveId: o.id, goalTitle: g.title })
      })
    })
  })
  return result
}

// ─── UnitInput ────────────────────────────────────────────────────────────────

const UNIT_PRESET_KEYS = [
  { value: '#', labelKey: 'tree.unitCount' },
  { value: '$', labelKey: 'tree.unitUsd' },
  { value: 'AED', labelKey: 'tree.unitAed' },
  { value: '%', labelKey: 'tree.unitPercent' },
]

// Measurement unit picker: a dropdown of common units plus "Other" for anything else, which
// reveals a free-text input. Built as a controlled value/onChange component so it drops straight
// into a Form.Item like any other input -- antd's Form wires those props automatically.
function UnitInput({ value, onChange }) {
  const { t } = useTranslation()
  const isPreset = UNIT_PRESET_KEYS.some((p) => p.value === value)
  // Tracked separately from `value` -- while typing a custom unit, `value` is legitimately empty
  // at first, and an empty string is falsy, so deriving "are we in Other mode" from `value` alone
  // would snap back to "nothing selected" the instant the field was cleared.
  const [otherMode, setOtherMode] = useState(!!value && !isPreset)
  const selectValue = otherMode ? 'OTHER' : (isPreset ? value : undefined)

  return (
    <div>
      <Select
        allowClear
        placeholder={t('tree.selectUnit')}
        value={selectValue}
        options={[
          ...UNIT_PRESET_KEYS.map((p) => ({ value: p.value, label: t(p.labelKey) })),
          { value: 'OTHER', label: t('tree.unitOther') },
        ]}
        onChange={(v) => {
          setOtherMode(v === 'OTHER')
          onChange?.(v === 'OTHER' ? '' : v)
        }}
        onClear={() => { setOtherMode(false); onChange?.(undefined) }}
      />
      {otherMode && (
        <Input
          style={{ marginTop: 8 }}
          placeholder={t('tree.enterCustomUnit')}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  )
}

// ─── QuickEditModal ───────────────────────────────────────────────────────────

function QuickEditModal({ open, onClose, onSave, loading, title, initialValues, fields }) {
  const { t } = useTranslation()
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
                placeholder={f.placeholder ?? t('tree.selectNone')}
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

// ─── AddInitiativeModal ───────────────────────────────────────────────────────
// Not built on the generic QuickEditModal: this is the one creation flow that also lets the
// user pull an AI-suggested KPI into the same form before saving (see suggestMeasurement in
// api/strategies.js), which needs its own button/loading/fallback state that the plain
// fields-array-driven QuickEditModal has no way to express. Saving here creates the
// Initiative and, if a KPI was filled in (suggested or typed by hand), its Measurement in one
// atomic backend call (InitiativeService.createInitiative) rather than the separate
// "add initiative, then separately add its measurement" two-step flow used everywhere else --
// that gap is exactly how initiatives ended up with no KPI at all before.

function AddInitiativeModal({
  open, onClose, onSave, loading, objectiveId,
  showUniversityInitiativeSelect, universityInitiativeLabel, universityInitiativePlaceholder,
  universityInitiativeOptions, loadingUnivInitiatives, universityInitiativeRequiredMessage,
}) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [suggesting, setSuggesting] = useState(false)
  const [suggestFailed, setSuggestFailed] = useState(false)

  const handleSuggest = async () => {
    const title = form.getFieldValue('title')
    if (!title) {
      message.warning(t('tree.enterTitleFirst'))
      return
    }
    setSuggestFailed(false)
    setSuggesting(true)
    try {
      const suggestion = await suggestMeasurement(objectiveId, {
        initiativeTitle: title,
        initiativeDescription: form.getFieldValue('description'),
      })
      form.setFieldsValue({
        measurementDescription: suggestion.description,
        measurementUnit: suggestion.unit,
        measurementTargetValue: suggestion.targetValue,
      })
    } catch {
      setSuggestFailed(true)
    } finally {
      setSuggesting(false)
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const { measurementDescription, measurementUnit, measurementTargetValue, ...initiativeFields } = values
      const measurement = measurementDescription
        ? { description: measurementDescription, unit: measurementUnit, targetValue: measurementTargetValue }
        : undefined
      onSave({ ...initiativeFields, measurement })
    } catch {}
  }

  return (
    <Modal title={t('tree.addInitiativeTitle')} open={open} onCancel={onClose} onOk={handleOk}
      confirmLoading={loading} destroyOnClose
      afterOpenChange={(v) => { if (!v) setSuggestFailed(false) }}>
      <Form form={form} layout="vertical">
        <Form.Item name="title" label={t('common.title')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label={t('common.description')}>
          <Input.TextArea rows={2} />
        </Form.Item>
        {showUniversityInitiativeSelect && (
          <Form.Item name="universityInitiativeId" label={universityInitiativeLabel}
            rules={[{ required: true, message: universityInitiativeRequiredMessage }]}>
            <Select allowClear placeholder={universityInitiativePlaceholder}
              options={universityInitiativeOptions} loading={loadingUnivInitiatives} />
          </Form.Item>
        )}

        <div style={{ borderTop: '1px solid #f0f0f0', marginBottom: 12, paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>{t('tree.kpiSectionLabel')}</span>
            <Button size="small" icon={<ThunderboltOutlined />} loading={suggesting} onClick={handleSuggest}>
              {t('tree.suggestKpiButton')}
            </Button>
          </div>
          {suggestFailed && (
            <div style={{ color: '#d97706', fontSize: 12, marginBottom: 8 }}>
              {t('tree.suggestKpiFailed')}
            </div>
          )}
          <Form.Item name="measurementDescription" label={t('common.description')}>
            <Input />
          </Form.Item>
          <Form.Item name="measurementUnit" label={t('tree.unitLabel')}>
            <UnitInput />
          </Form.Item>
          <Form.Item name="measurementTargetValue" label={t('tree.targetValueLabel')}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

// ─── comment button ───────────────────────────────────────────────────────────

function CommentBtn({ entityType, entityId, comments, onClick }) {
  const { t } = useTranslation()
  const total = totalForEntity(comments, entityType, entityId)
  const hasUnread = unreadForEntity(comments, entityType, entityId) > 0
  return (
    <Tooltip title={total > 0 ? t('tree.commentsCountLabel', { count: total }) : t('tree.commentsLabel')}>
      <Badge count={total} size="small" offset={[2, -2]} showZero={false}>
        <Button type="text" size="small" icon={<CommentOutlined />}
          onClick={(e) => { e.stopPropagation(); onClick(entityType, entityId) }}
          style={{ color: hasUnread ? '#c9a24b' : total > 0 ? '#6b7280' : '#d1d5db' }} />
      </Badge>
    </Tooltip>
  )
}

// AchievementModal, AchievementReportModal, and the add/edit/delete mutation hooks now live in
// src/components/AchievementModal.jsx -- shared with the Annual Evaluation page, since
// achievements generated by a criterion-assigned achievement tool have no measurement/Initiative
// at all and so can only ever be edited from that page, never the Strategy Tree.

// ─── MeasurementNode ─────────────────────────────────────────────────────────

function MeasurementNode({ m, role, state, comments, onComment, onRefresh }) {
  const { t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)
  const editable = canEdit(role, state)

  const updateMut = useMutation({
    mutationFn: (v) => updateMeasurement(m.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: () => message.error(t('common.updateFailed')),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteMeasurement(m.id),
    onSuccess: onRefresh,
    onError: () => message.error(t('common.deleteFailed')),
  })

  const ratio = m.targetValue > 0 ? (m.actualValue ?? 0) / m.targetValue : 0
  const colorClass = ratio >= 1 ? 'green' : ratio >= 0.7 ? 'amber' : 'red'

  return (
    <div className="measurement-row">
      <span className="node-type-badge measurement" style={{ fontSize: 9 }}>KPI</span>
      <span style={{ flex: 1, fontSize: 13 }}>{m.description}</span>
      <div className="measurement-values">
        <span className="measurement-target">{t('tree.targetValueDisplay', { value: m.targetValue ?? '—', unit: m.unit })}</span>
        <span className={`measurement-actual ${colorClass}`}>{t('tree.actualValueDisplay', { value: m.actualValue ?? '—', unit: m.unit })}</span>
      </div>
      <div className="node-actions">
        <CommentBtn entityType="MEASUREMENT" entityId={m.id} comments={comments} onClick={onComment} />
        {editable && (
          <>
            <Button type="text" size="small" icon={<EditOutlined />}
              onClick={() => setEditOpen(true)} style={{ color: '#6b7280' }} />
            <Popconfirm title={t('tree.deleteMeasurementConfirm')} onConfirm={() => deleteMut.mutate()}>
              <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#ef4444' }} />
            </Popconfirm>
          </>
        )}
      </div>
      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title={t('tree.editMeasurementTitle')}
        initialValues={{ description: m.description, unit: m.unit, targetValue: m.targetValue, actualValue: m.actualValue }}
        fields={[
          { name: 'description', label: t('common.description'), rules: [{ required: true }] },
          { name: 'unit', label: t('tree.unitLabel'), type: 'unit' },
          { name: 'targetValue', label: t('tree.targetValueLabel'), type: 'number' },
          { name: 'actualValue', label: t('tree.actualValueLabel'), type: 'number' },
        ]} />
    </div>
  )
}

// ─── AchievementsPanel ───────────────────────────────────────────────────────
// Trophy icon lives here — at each period group header — not on the INI row.

function AchievementsPanel({ measurements, initiativeId, iniAcademicYearId, basePlanPeriodFilterName, role, state, yearLocked, academicYears, assessmentPeriods, academicYearId, onRefresh, departmentBreakdown, strategyId }) {
  const { t } = useTranslation()
  const { topLevelStrategyLabel } = useTerminology()
  const [editingAchievement, setEditingAchievement] = useState(null)
  // addingForPeriod: null (closed) | { id: number|undefined, name: string|undefined }
  const [addingForPeriod, setAddingForPeriod] = useState(null)
  const [viewingAchievement, setViewingAchievement] = useState(null)

  // canAddAch: base eligibility — per-group year lock is checked separately
  const canAddAch = canRecordAchievement(role, state) && (measurements?.length ?? 0) > 0

  const groupLockedFor = (periodName) => isPeriodLocked(academicYears, yearLocked, periodName)
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

  // Initiative-level fields (achievementCount, recentAchievements, status chip) live in the
  // strategy-tree payload itself, not in these achievements/across-years queries -- every mutation
  // here also calls onRefresh so those stay in sync, not just this panel's own achievement list.
  const addAchMut = useAddAchievementMutation(measurements, initiativeId, strategyId, () => { setAddingForPeriod(null); onRefresh?.() })
  const editMut = useEditAchievementMutation(measurements, initiativeId, strategyId, () => { setEditingAchievement(null); onRefresh?.() })
  const deleteMut = useDeleteAchievementMutation(measurements, initiativeId, strategyId, () => onRefresh?.())

  // Nothing to show and no add capability
  if (!canAddAch && all.length === 0 && academicYears.length === 0 && !departmentBreakdown?.length) return null
  if (isLoading) return (
    <div style={{ padding: '6px 0', fontSize: 12, color: '#9ca3af' }}>{t('tree.loadingAchievements')}</div>
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
          {t('tree.reportedAchievements')}
        </div>

        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([period, items]) => {
          const groupLocked = groupLockedFor(period)
          const deptContribs = deptByPeriod[period] ?? []
          const deptTotal = deptContribs.reduce((s, d) => s + d.achievementCount, 0)
          const periodTotal = items.length + deptTotal
          return (
          <div key={period} style={{ marginBottom: 14 }}>
            <div className="ach-section-label">
              <span className="lbl">
                {t('tree.periodAchievementCount', { period, count: periodTotal })}
                {groupLocked && <LockOutlined style={{ marginLeft: 4, fontSize: 10 }} />}
              </span>
              {canAddAch && !groupLocked && (
                <button type="button" className="add-ach-btn"
                  onClick={() => setAddingForPeriod({ name: period, id: items[0]?.assessmentPeriodId ?? periodIdForName(period) })}>
                  <span className="trophy">🏆</span> {t('tree.addAchievementButton')}
                </button>
              )}
            </div>
            {deptContribs.length > 0 && (
              <div style={{ margin: '0 0 8px 0', padding: '5px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  {t('tree.departmentContributions')}
                </div>
                {deptContribs.map((d) => (
                  <div key={d.departmentName} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#374151', marginBottom: 2 }}>
                    <span>{d.departmentName}</span>
                    <span style={{ fontWeight: 600, color: '#b45309' }}>{d.achievementCount}</span>
                  </div>
                ))}
                {items.length > 0 && (
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#374151', marginBottom: 2 }}>
                    <span>{t('tree.localContribution', { label: topLevelStrategyLabel.toLowerCase() })}</span>
                    <span style={{ fontWeight: 600 }}>{items.length}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, borderTop: '1px solid #fde68a', paddingTop: 3, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('common.total')}</span>
                  <span style={{ color: '#1d4ed8' }}>{periodTotal}</span>
                </div>
              </div>
            )}
            <div className="ach-card-list">
              {items.map((a) => (
                <Tooltip key={a.id} title={a.details || t('tree.noAdditionalDetails')} placement="left">
                <div className="ach-card" style={{ cursor: 'pointer' }} onClick={() => setViewingAchievement(a)}>
                  <span className="icon">🏆</span>
                  <div className="body">
                    <div className="title">{a.title}</div>
                    <div className="meta">
                      {a.achievementTypeName && <span className="type-tag">{a.achievementTypeName}</span>}
                      <span className="date">{new Date(a.recordedAt).toISOString().slice(0, 10)}</span>
                      {a.authorName && <span>— {a.authorName}</span>}
                    </div>
                  </div>
                  {!groupLocked && (a.canEdit || a.canDelete) && (
                    <div className="ach-card-actions" onClick={(e) => e.stopPropagation()}>
                      {a.canEdit && (
                        <Button type="text" size="small" icon={<EditOutlined />}
                          style={{ color: '#9ca3af' }}
                          onClick={() => setEditingAchievement(a)} />
                      )}
                      {a.canDelete && (
                        <Popconfirm title={t('tree.deleteAchievementConfirm')} onConfirm={() => deleteMut.mutate(a.id)}>
                          <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#ef4444' }} />
                        </Popconfirm>
                      )}
                    </div>
                  )}
                </div>
                </Tooltip>
              ))}
            </div>
          </div>
        )})}
      </div>

      {/* Edit existing achievement */}
      <AchievementModal
        open={!!editingAchievement}
        onClose={() => setEditingAchievement(null)}
        onSave={(values) => editMut.mutate({ achievementId: editingAchievement.id, values })}
        loading={editMut.isPending}
        title={t('tree.editAchievementTitle')}
        assessmentPeriods={assessmentPeriods}
        academicYears={academicYears}
        academicYearId={academicYearId}
        achievementId={editingAchievement?.id}
        authorId={editingAchievement?.authorId}
        initialPeriodName={editingAchievement?.assessmentPeriodName}
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
        title={addingForPeriod?.name ? t('tree.recordAchievementFor', { name: addingForPeriod.name }) : t('tree.recordAchievement')}
        assessmentPeriods={assessmentPeriods}
        academicYears={academicYears}
        academicYearId={academicYearId}
        initialPeriodName={addingForPeriod?.name}
        initialValues={{ assessmentPeriodId: addingForPeriod?.id }}
      />

      <AchievementReportModal achievement={viewingAchievement} onClose={() => setViewingAchievement(null)} />
    </>
  )
}

// ─── InitiativeNode ───────────────────────────────────────────────────────────
// Renders as either a card (default, grid) or a list row (Concept A-style, collapsible), per the
// tree's cards/list toggle -- both share the exact same detail body (measurements + achievements).

function InitiativeCardPreview({ ini }) {
  const { t } = useTranslation()
  const measurements = ini.measurements ?? []
  if (measurements.length === 0) {
    return <div className="kpi-line" style={{ color: '#9ca3af' }}>{t('tree.noKpisYet')}</div>
  }
  const first = measurements[0]
  return (
    <div className="kpi-line">
      {first.description}: <span className="v">{first.actualValue ?? '—'}{first.unit ? ` ${first.unit}` : ''}</span>
      {' '}/ {t('tree.target')} <span className="v">{first.targetValue ?? '—'}{first.unit ? ` ${first.unit}` : ''}</span>
      {measurements.length > 1 && (
        <span style={{ marginLeft: 6, color: '#9ca3af' }}>
          {t('tree.moreKpis', { count: measurements.length - 1 })}
        </span>
      )}
    </div>
  )
}

// Up to 2 achievements shown directly on the card -- the server prioritizes the viewer's own into
// these 2 slots (see StrategyService.buildInitiativeResponse), falling back to most-recent overall,
// so a user's own achievements get quick edit/delete right here without opening "View all". A "+N
// more" line derived from the direct achievementCount already on the initiative covers the rest.
function InitiativeAchievementPreview({ ini, onEdit, onDelete, onView }) {
  const { t } = useTranslation()
  const preview = ini.recentAchievements ?? []
  if (preview.length === 0) return null
  const remaining = (ini.achievementCount ?? 0) - preview.length
  return (
    <div className="ach-preview">
      {preview.map((a) => (
        <Tooltip key={a.id} title={a.details || t('tree.noAdditionalDetails')} placement="left">
        <div className="ach-chip" style={{ cursor: 'pointer' }} onClick={() => onView(a)}>
          <span className="ach-chip-text">
            {a.title}
            {a.authorName && <span className="who"> — {a.authorName}</span>}
          </span>
          {(a.canEdit || a.canDelete) && (
            <span className="ach-chip-actions" onClick={(e) => e.stopPropagation()}>
              {a.canEdit && (
                <Button type="text" size="small" icon={<EditOutlined />}
                  onClick={() => onEdit(a)} style={{ color: '#6b7280', padding: '0 2px', height: 'auto' }} />
              )}
              {a.canDelete && (
                <Popconfirm title={t('tree.deleteAchievementConfirm')} onConfirm={() => onDelete(a.id)}>
                  <Button type="text" size="small" icon={<DeleteOutlined />}
                    style={{ color: '#ef4444', padding: '0 2px', height: 'auto' }} />
                </Popconfirm>
              )}
            </span>
          )}
        </div>
        </Tooltip>
      ))}
      {remaining > 0 && <div className="ach-more">{t('tree.moreAchievements', { count: remaining })}</div>}
    </div>
  )
}

function InitiativeNode({ ini, objectiveId, isDeptStrategy, viewMode, allAreasExpanded, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, comments, onComment, onRefresh, validationErrors, threshold }) {
  const { t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)
  const [addMeasOpen, setAddMeasOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [editingPreviewAchievement, setEditingPreviewAchievement] = useState(null)
  const [viewingPreviewAchievement, setViewingPreviewAchievement] = useState(null)
  const [rowExpanded, setRowExpanded] = useState(allAreasExpanded)
  // List view's per-row collapse is otherwise unreachable by "Expand/Collapse All Areas" --
  // that button only ever toggled collapsedAreaKeys (Vision Areas), so clicking it opened the
  // areas but every initiative row stayed individually collapsed. Re-sync whenever the button
  // is clicked; a row can still be toggled by hand afterward, same as Areas already work.
  useEffect(() => {
    setRowExpanded(allAreasExpanded)
  }, [allAreasExpanded])
  const [detailOpen, setDetailOpen] = useState(false)
  const { topLevelStrategyLabel, academicYearLabel } = useTerminology()
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
    onError: (err) => message.error(err.response?.data?.message || t('common.updateFailed')),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteInitiative(ini.id),
    onSuccess: onRefresh,
    onError: (err) => message.error(err.response?.data?.message || t('common.deleteFailed')),
  })

  const addMeasMut = useMutation({
    mutationFn: (v) => createMeasurement(ini.id, v),
    onSuccess: () => { setAddMeasOpen(false); onRefresh() },
    onError: () => message.error(t('common.createFailed')),
  })

  const quickAddMut = useAddAchievementMutation(ini.measurements, ini.id, strategyId, () => { setQuickAddOpen(false); onRefresh?.() })
  // Powers the card's own achievement-preview chips -- quick edit/delete without opening "View all".
  const editPreviewMut = useEditAchievementMutation(ini.measurements, ini.id, strategyId, () => { setEditingPreviewAchievement(null); onRefresh?.() })
  const deletePreviewMut = useDeleteAchievementMutation(ini.measurements, ini.id, strategyId, () => onRefresh?.())

  const hasMeasurement = (ini.measurements?.length ?? 0) > 0
  const hasContent = hasMeasurement || ini.hasAchievements || ini.mappedAchievementCount > 0
  const totalAchievements = (ini.achievementCount ?? 0) + (ini.mappedAchievementCount ?? 0)
  const frozenByYear = isPeriodLocked(academicYears, yearLocked, ini.assessmentPeriodName)
  const status = initiativeStatus(totalAchievements, threshold, frozenByYear)
  // The card's fast-add can only fix an achievement to an unambiguous period -- when viewing Base
  // Plan with no year context at all, fall back to "View all", where every period already has its
  // own fixed-period Add button (see AchievementsPanel).
  const fixedPeriod = resolveFixedPeriod(ini, academicYearId, academicYears, assessmentPeriods)
  const canAddAch = canRecordAchievement(role, state) && hasMeasurement && !!fixedPeriod

  const editDeleteActions = editable && !isFrozen && (
    <>
      <Button type="text" size="small" icon={<EditOutlined />}
        onClick={(e) => { e.stopPropagation(); setEditOpen(true) }} style={{ color: '#6b7280' }} />
      <Popconfirm title={t('tree.deleteInitiativeConfirm')} onConfirm={() => deleteMut.mutate()}>
        <Button type="text" size="small" icon={<DeleteOutlined />}
          onClick={(e) => e.stopPropagation()} style={{ color: '#ef4444' }} />
      </Popconfirm>
    </>
  )

  const addMeasurementAction = editable && (
    <Button type="text" size="small" icon={<PlusOutlined />}
      onClick={(e) => { e.stopPropagation(); setAddMeasOpen(true) }}
      style={{ color: '#6b7280' }} title={t('tree.addMeasurementTitle')} />
  )

  const detailBody = (
    <div>
      {ini.measurements?.map((m) => (
        <MeasurementNode key={m.id} m={m} role={role} state={state}
          comments={comments} onComment={onComment} onRefresh={onRefresh} />
      ))}
      <AchievementsPanel
        measurements={ini.measurements ?? []}
        initiativeId={ini.id}
        iniAcademicYearId={ini.academicYearId}
        basePlanPeriodFilterName={ini.assessmentPeriodName}
        role={role} state={state} yearLocked={yearLocked}
        academicYears={academicYears} assessmentPeriods={assessmentPeriods}
        academicYearId={academicYearId} onRefresh={onRefresh}
        departmentBreakdown={ini.departmentBreakdown} strategyId={strategyId}
      />
    </div>
  )

  const sharedModals = (
    <>
      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title={t('tree.editInitiativeTitle')}
        initialValues={{ title: ini.title, description: ini.description, universityInitiativeId: ini.universityInitiativeId ?? undefined }}
        fields={[
          { name: 'title', label: t('common.title'), rules: [{ required: true }] },
          { name: 'description', label: t('common.description'), type: 'textarea' },
          ...(showUniversityMapping ? [{
            name: 'universityInitiativeId',
            label: t('tree.universityInitiativeLabel', { label: topLevelStrategyLabel }),
            type: 'select',
            placeholder: t('tree.selectUniversityInitiativePlaceholder', { label: topLevelStrategyLabel.toLowerCase() }),
            options: universityInitiativeOptions,
            loading: loadingUnivInitiatives,
            rules: [{ required: true, message: t('tree.mapInitiativeRequired', { label: topLevelStrategyLabel.toLowerCase() }) }],
          }] : []),
        ]} />
      <QuickEditModal open={addMeasOpen} onClose={() => setAddMeasOpen(false)}
        onSave={addMeasMut.mutate} loading={addMeasMut.isPending} title={t('tree.addMeasurementTitle')}
        initialValues={{}}
        fields={[
          { name: 'description', label: t('common.description'), rules: [{ required: true }] },
          { name: 'unit', label: t('tree.unitLabel'), type: 'unit' },
          { name: 'targetValue', label: t('tree.targetValueLabel'), type: 'number' },
        ]} />
      {/* Fast path: record an achievement straight from the card, no need to open its detail
          view first -- shares the same mutation AchievementsPanel and the rail both use. */}
      <AchievementModal
        open={quickAddOpen} onClose={() => setQuickAddOpen(false)}
        onSave={quickAddMut.mutate} loading={quickAddMut.isPending}
        title={t('tree.recordAchievementFor', { name: ini.title })}
        assessmentPeriods={assessmentPeriods} academicYears={academicYears} academicYearId={academicYearId}
        initialPeriodName={fixedPeriod?.name}
        initialValues={{ assessmentPeriodId: fixedPeriod?.id }} />
      {/* Quick edit for a card's own achievement-preview chips -- same modal AchievementsPanel uses. */}
      <AchievementModal
        open={!!editingPreviewAchievement} onClose={() => setEditingPreviewAchievement(null)}
        onSave={(values) => editPreviewMut.mutate({ achievementId: editingPreviewAchievement.id, values })}
        loading={editPreviewMut.isPending}
        title={t('tree.editAchievementTitle')}
        assessmentPeriods={assessmentPeriods} academicYears={academicYears} academicYearId={academicYearId}
        achievementId={editingPreviewAchievement?.id}
        authorId={editingPreviewAchievement?.authorId}
        initialPeriodName={editingPreviewAchievement?.assessmentPeriodName}
        initialValues={editingPreviewAchievement ? {
          title: editingPreviewAchievement.title,
          achievementTypeId: editingPreviewAchievement.achievementTypeId,
          customTypeName: editingPreviewAchievement.customTypeName,
          assessmentPeriodId: editingPreviewAchievement.assessmentPeriodId,
          details: editingPreviewAchievement.details,
          privateNotes: editingPreviewAchievement.privateNotes,
        } : {}} />
      <AchievementReportModal achievement={viewingPreviewAchievement} onClose={() => setViewingPreviewAchievement(null)} />
    </>
  )

  if (viewMode === 'list') {
    return (
      <div className="tree-node">
        <div className="tree-node-header"
          style={{ outline: iniInvalid ? '1px solid #fecaca' : undefined, background: iniInvalid ? '#fff5f5' : undefined }}
          onClick={() => setRowExpanded((v) => !v)}>
          <span style={{ width: 16, color: '#9ca3af', flexShrink: 0 }}>
            {hasContent ? (rowExpanded ? <DownOutlined /> : <RightOutlined />) : null}
          </span>
          <span className="node-type-badge initiative">INI</span>
          <div style={{ flex: 1 }}>
            <div className="node-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {ini.title}
              {iniInvalid && <ValidationWarning tip={t('tree.needsMeasurementTip')} />}
              {isFrozen && (
                <Tooltip title={t('tree.hasAchievementsLockedTooltip')}>
                  <LockOutlined style={{ fontSize: 11, color: '#c9a24b' }} />
                </Tooltip>
              )}
            </div>
            {ini.description && <div className="node-desc">{ini.description}</div>}
            {ini.universityInitiativeTitle && (
              <Tooltip title={t('tree.mappedToInitiativeTooltip', { label: topLevelStrategyLabel.toLowerCase(), title: ini.universityInitiativeTitle })}>
                <Tag color="purple" style={{ fontSize: 10, marginTop: 2, cursor: 'default', maxWidth: '100%', overflow: 'hidden' }}>
                  <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                    {topLevelStrategyLabel}: {ini.universityInitiativeTitle}
                  </span>
                </Tag>
              </Tooltip>
            )}
          </div>
          <span className={`status-chip ${status.tone}`}>{t(status.labelKey)}</span>
          <span className="ini-count">{t('tree.achievementCountBare', { count: totalAchievements })}</span>
          <div className="node-actions" onClick={(e) => e.stopPropagation()}>
            <CommentBtn entityType="INITIATIVE" entityId={ini.id} comments={comments} onClick={onComment} />
            {editDeleteActions}
            {addMeasurementAction}
            {canRecordAchievement(role, state) && hasMeasurement && (
              <Tooltip title={fixedPeriod ? t('tree.recordAchievementTooltip') : t('tree.selectYearAboveTooltip', { yearLabel: academicYearLabel.toLowerCase() })}>
                <Button type="text" size="small" icon={<TrophyOutlined />} disabled={!fixedPeriod}
                  onClick={() => setQuickAddOpen(true)} style={{ color: fixedPeriod ? '#c9a24b' : '#d1d5db' }} />
              </Tooltip>
            )}
          </div>
        </div>
        {rowExpanded && (
          <div className="tree-node-body" style={{ padding: '8px 16px 8px 48px' }}>
            {detailBody}
          </div>
        )}
        {sharedModals}
      </div>
    )
  }

  return (
    <div className={`init-card ${iniInvalid ? 'invalid' : ''}`}>
      <span className="node-type-badge initiative card-badge">{t('common.initiative')}</span>
      <div className="init-card-top">
        <div className="init-card-title">
          {ini.title}
          {iniInvalid && <ValidationWarning tip={t('tree.needsMeasurementTip')} />}
          {isFrozen && (
            <Tooltip title={t('tree.hasAchievementsLockedTooltip')}>
              <LockOutlined style={{ fontSize: 11, color: '#c9a24b' }} />
            </Tooltip>
          )}
        </div>
        <span className={`status-chip ${status.tone}`}>{t(status.labelKey)}</span>
      </div>
      {ini.universityInitiativeTitle && (
        <Tooltip title={t('tree.mappedToInitiativeTooltip', { label: topLevelStrategyLabel.toLowerCase(), title: ini.universityInitiativeTitle })}>
          <Tag color="purple" style={{ fontSize: 10, alignSelf: 'flex-start', maxWidth: '100%', overflow: 'hidden' }}>
            <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
              {topLevelStrategyLabel}: {ini.universityInitiativeTitle}
            </span>
          </Tag>
        </Tooltip>
      )}
      <InitiativeCardPreview ini={ini} />
      <InitiativeAchievementPreview ini={ini}
        onEdit={setEditingPreviewAchievement}
        onDelete={(id) => deletePreviewMut.mutate(id)}
        onView={setViewingPreviewAchievement} />
      <div className="init-card-foot">
        <span className="ach-count"><b>{totalAchievements}</b>{t('tree.loggedSuffix')}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <CommentBtn entityType="INITIATIVE" entityId={ini.id} comments={comments} onClick={onComment} />
          {editDeleteActions}
          {addMeasurementAction}
          <Button size="small" type="text" onClick={() => setDetailOpen(true)}>{t('tree.viewAll')}</Button>
          <Button size="small" className="card-add-btn" icon={<TrophyOutlined />}
            disabled={!canAddAch}
            title={!hasMeasurement ? t('tree.addKpiFirst')
              : !fixedPeriod ? t('tree.selectYearAboveTooltip', { yearLabel: academicYearLabel.toLowerCase() })
              : undefined}
            onClick={() => (hasMeasurement && fixedPeriod ? setQuickAddOpen(true) : setDetailOpen(true))}>
            {hasMeasurement ? t('tree.addButton') : t('tree.addKpiFirst')}
          </Button>
        </div>
      </div>

      <Drawer title={ini.title} open={detailOpen} onClose={() => setDetailOpen(false)} width={520} destroyOnClose>
        {detailBody}
      </Drawer>
      {sharedModals}
    </div>
  )
}

// ─── ObjectiveNode ────────────────────────────────────────────────────────────
// No longer collapsible -- always shows its Initiatives, as a card grid or a list, per viewMode.

function ObjectiveNode({ obj, isDeptStrategy, viewMode, allAreasExpanded, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, comments, onComment, onRefresh, validationErrors, threshold }) {
  const { t } = useTranslation()
  const { topLevelStrategyLabel } = useTerminology()
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
    onError: (err) => message.error(err.response?.data?.message || t('common.updateFailed')),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteObjective(obj.id),
    onSuccess: onRefresh,
    onError: () => message.error(t('common.deleteFailed')),
  })

  const freezeMut = useMutation({
    mutationFn: () => setObjectiveFrozen(obj.id, !obj.frozen),
    onSuccess: onRefresh,
    onError: () => message.error(t('tree.operationFailed')),
  })

  const addIniMut = useMutation({
    mutationFn: (v) => createInitiative(obj.id, { ...v, academicYearId }),
    onSuccess: () => { setAddIniOpen(false); onRefresh() },
    onError: (err) => message.error(err.response?.data?.message || t('common.createFailed')),
  })

  const objInvalid = validationErrors?.objectiveIds?.has(obj.id)
  const initiatives = obj.initiatives ?? []

  const initiativeProps = {
    isDeptStrategy, viewMode, allAreasExpanded, role, state, strategyId, academicYearId, yearLocked,
    academicYears, assessmentPeriods, planningCycleId, comments, onComment, onRefresh,
    validationErrors, threshold,
  }

  return (
    <div className={`board-objective ${objInvalid ? 'invalid' : ''}`}>
      <div className="board-objective-head">
        <span className="node-type-badge objective">{t('common.objective')}</span>
        <span className="obj-title">
          {obj.title}
          {obj.frozen && <span className="frozen-badge" style={{ marginLeft: 8 }}><LockOutlined style={{ fontSize: 10 }} /> {t('freezeYear.frozen')}</span>}
          {objInvalid && <ValidationWarning tip={t('tree.needsInitiativeTip')} />}
        </span>
        {obj.universityObjectiveTitles?.length > 0 && (
          <span style={{ display: 'flex', gap: 4, maxWidth: '100%', flexWrap: 'wrap' }}>
            {obj.universityObjectiveTitles.map((title, i) => (
              <Tooltip key={i} title={t('tree.mappedToObjectiveTooltip', { label: topLevelStrategyLabel.toLowerCase(), title })}>
                <Tag color="geekblue" style={{ fontSize: 10, cursor: 'default', maxWidth: '100%', overflow: 'hidden' }}>
                  <span style={{ display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                    {topLevelStrategyLabel}: {title}
                  </span>
                </Tag>
              </Tooltip>
            ))}
          </span>
        )}
        <div className="node-actions">
          <CommentBtn entityType="OBJECTIVE" entityId={obj.id} comments={comments} onClick={onComment} />
          {editable && (
            <>
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={() => setEditOpen(true)} style={{ color: '#6b7280' }} />
              {!obj.frozen && (
                <Button type="text" size="small" icon={<PlusOutlined />}
                  onClick={() => setAddIniOpen(true)} style={{ color: '#6b7280' }} title={t('tree.addInitiativeTitle')} />
              )}
              <Popconfirm title={t('tree.deleteObjectiveConfirm')} onConfirm={() => deleteMut.mutate()}>
                <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#ef4444' }} />
              </Popconfirm>
            </>
          )}
          {isOwner && (
            <Tooltip title={obj.frozen ? t('freezeYear.unfreezeAction') : t('freezeYear.freezeAction')}>
              <Button type="text" size="small"
                icon={obj.frozen ? <UnlockOutlined /> : <LockOutlined />}
                onClick={() => freezeMut.mutate()}
                style={{ color: obj.frozen ? '#c0871a' : '#6b7280' }} />
            </Tooltip>
          )}
        </div>
      </div>
      {obj.description && <div className="node-desc" style={{ marginBottom: 10 }}>{obj.description}</div>}

      {initiatives.length === 0 ? (
        <div className="board-empty">{t('tree.noInitiativesYet')}</div>
      ) : viewMode === 'list' ? (
        <div className="init-list-view">
          {initiatives.map((ini) => (
            <InitiativeNode key={ini.id} ini={ini} objectiveId={obj.id} {...initiativeProps} />
          ))}
        </div>
      ) : (
        <div className="board-grid">
          {initiatives.map((ini) => (
            <InitiativeNode key={ini.id} ini={ini} objectiveId={obj.id} {...initiativeProps} />
          ))}
        </div>
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title={t('tree.editObjectiveTitle')}
        initialValues={{ title: obj.title, description: obj.description, universityObjectiveIds: obj.universityObjectiveIds ?? [] }}
        fields={[
          { name: 'title', label: t('common.title'), rules: [{ required: true }] },
          { name: 'description', label: t('common.description'), type: 'textarea' },
          ...(isDeptStrategy ? [{
            name: 'universityObjectiveIds',
            label: t('tree.universityObjectivesLabel', { label: topLevelStrategyLabel }),
            type: 'select',
            mode: 'multiple',
            placeholder: t('tree.selectUniversityObjectivePlaceholder', { label: topLevelStrategyLabel.toLowerCase() }),
            options: universityObjectiveOptions,
            loading: loadingUnivObjectives,
            rules: [{ required: true, type: 'array', min: 1, message: t('tree.mapObjectiveRequired', { label: topLevelStrategyLabel.toLowerCase() }) }],
          }] : []),
        ]} />

      <AddInitiativeModal open={addIniOpen} onClose={() => setAddIniOpen(false)}
        onSave={addIniMut.mutate} loading={addIniMut.isPending} objectiveId={obj.id}
        showUniversityInitiativeSelect={isDeptStrategy && !academicYearId}
        universityInitiativeLabel={t('tree.universityInitiativeLabel', { label: topLevelStrategyLabel })}
        universityInitiativePlaceholder={t('tree.selectUniversityInitiativePlaceholder', { label: topLevelStrategyLabel.toLowerCase() })}
        universityInitiativeOptions={universityInitiativeOptions}
        loadingUnivInitiatives={loadingUnivInitiatives}
        universityInitiativeRequiredMessage={t('tree.mapInitiativeRequired', { label: topLevelStrategyLabel.toLowerCase() })} />
    </div>
  )
}

// ─── GoalNode ─────────────────────────────────────────────────────────────────
// No longer collapsible -- always shows its Objectives.

function GoalNode({ goal, isDeptStrategy, viewMode, allAreasExpanded, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, areas, comments, onComment, onRefresh, validationErrors, threshold }) {
  const { t } = useTranslation()
  const { topLevelStrategyLabel } = useTerminology()
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
    onError: () => message.error(t('common.updateFailed')),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: onRefresh,
    onError: () => message.error(t('common.deleteFailed')),
  })

  const addObjMut = useMutation({
    mutationFn: (v) => createObjective(goal.id, v),
    onSuccess: () => { setAddObjOpen(false); onRefresh() },
    onError: (err) => message.error(err.response?.data?.message || t('common.createFailed')),
  })

  const goalInvalid = validationErrors?.goalIds?.has(goal.id)
  const objectives = goal.objectives ?? []

  return (
    <div className={`board-goal ${goalInvalid ? 'invalid' : ''}`}>
      <div className="board-goal-head">
        <span className="node-type-badge goal">{t('common.goal')}</span>
        <h3>
          {goal.title}
          {goalInvalid && <ValidationWarning tip={t('tree.needsObjectiveTip')} />}
        </h3>
        <div className="node-actions">
          <CommentBtn entityType="GOAL" entityId={goal.id} comments={comments} onClick={onComment} />
          {editable && (
            <>
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={() => setEditOpen(true)} style={{ color: '#6b7280' }} />
              <Button type="text" size="small" icon={<PlusOutlined />}
                onClick={() => setAddObjOpen(true)} style={{ color: '#6b7280' }} title={t('tree.addObjectiveTitle')} />
              <Popconfirm title={t('tree.deleteGoalConfirm')} onConfirm={() => deleteMut.mutate()}>
                <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#ef4444' }} />
              </Popconfirm>
            </>
          )}
        </div>
      </div>
      {goal.description && <div className="node-desc" style={{ marginBottom: 12 }}>{goal.description}</div>}

      {objectives.length === 0 ? (
        <div className="board-empty">{t('tree.noObjectivesYet')}</div>
      ) : (
        objectives.map((obj) => (
          <ObjectiveNode key={obj.id} obj={obj} isDeptStrategy={isDeptStrategy} viewMode={viewMode}
            allAreasExpanded={allAreasExpanded}
            role={role} state={state} strategyId={strategyId} academicYearId={academicYearId}
            yearLocked={yearLocked} academicYears={academicYears} assessmentPeriods={assessmentPeriods}
            planningCycleId={planningCycleId} comments={comments} onComment={onComment} onRefresh={onRefresh}
            validationErrors={validationErrors} threshold={threshold} />
        ))
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title={t('tree.editGoalTitle')}
        initialValues={{ title: goal.title, description: goal.description, visionAreaId: goal.areaId ?? undefined }}
        fields={[
          { name: 'title', label: t('common.title'), rules: [{ required: true }] },
          { name: 'description', label: t('common.description'), type: 'textarea' },
          ...(areas.length > 0 ? [{
            name: 'visionAreaId',
            label: t('strategyDetail.visionAreaLabel'),
            type: 'select',
            options: areas.map((a) => ({ value: a.id, label: a.name })),
          }] : []),
        ]} />

      <QuickEditModal open={addObjOpen} onClose={() => setAddObjOpen(false)}
        onSave={addObjMut.mutate} loading={addObjMut.isPending} title={t('tree.addObjectiveTitle')}
        initialValues={{}}
        fields={[
          { name: 'title', label: t('common.title'), rules: [{ required: true }] },
          { name: 'description', label: t('common.description'), type: 'textarea' },
          ...(isDeptStrategy ? [{
            name: 'universityObjectiveIds',
            label: t('tree.universityObjectivesLabel', { label: topLevelStrategyLabel }),
            type: 'select',
            mode: 'multiple',
            placeholder: t('tree.selectUniversityObjectivePlaceholder', { label: topLevelStrategyLabel.toLowerCase() }),
            options: universityObjectiveOptions,
            loading: loadingUnivObjectives,
            rules: [{ required: true, type: 'array', min: 1, message: t('tree.mapObjectiveRequired', { label: topLevelStrategyLabel.toLowerCase() }) }],
          }] : []),
        ]} />
    </div>
  )
}

// ─── AreaSection ──────────────────────────────────────────────────────────────
// The only collapsible level now -- a gradient band; everything inside an open Area is flat.

function AreaSection({ area, goals, expanded, onToggle, isDeptStrategy, viewMode, allAreasExpanded, role, state, strategyId, academicYearId, yearLocked, academicYears, assessmentPeriods, planningCycleId, areas, comments, onComment, onRefresh, validationErrors, threshold }) {
  const { t } = useTranslation()
  const areaInvalid = area && validationErrors?.areaIds?.has(area.id)

  return (
    <div className={`area-band ${areaInvalid ? 'invalid' : ''}`}>
      <div className="area-strip" onClick={onToggle}>
        {area ? (
          <>
            <span className="name">{area.name}</span>
            <span className="count">{t('tree.goalCount', { count: goals.length })}</span>
            {areaInvalid && <ValidationWarning tip={t('tree.needsGoalTip')} />}
          </>
        ) : (
          <>
            <span className="name" style={{ opacity: 0.75 }}>{t('report.ungroupedGoals')}</span>
            <span className="count">{goals.length}</span>
          </>
        )}
        <span className="area-chevron">{expanded ? <DownOutlined /> : <RightOutlined />}</span>
      </div>
      {expanded && (
        <div className="area-band-body">
          {goals.length === 0 ? (
            <div className="board-empty">{t('tree.noGoalsInArea')}</div>
          ) : (
            goals.map((goal) => (
              <GoalNode key={goal.id} goal={goal} isDeptStrategy={isDeptStrategy} viewMode={viewMode}
                allAreasExpanded={allAreasExpanded}
                role={role} state={state} strategyId={strategyId} academicYearId={academicYearId}
                yearLocked={yearLocked} academicYears={academicYears} assessmentPeriods={assessmentPeriods}
                planningCycleId={planningCycleId} areas={areas} comments={comments} onComment={onComment}
                onRefresh={onRefresh} validationErrors={validationErrors} threshold={threshold} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── AchievementRail ──────────────────────────────────────────────────────────
// Always-visible companion to the board: log an achievement for any initiative in this strategy
// without opening the tree, see the plan's overall numbers, and see what was just logged.

function AchievementRail({ strategyId, goals, academicYears, assessmentPeriods, academicYearId, role, state, onRefresh }) {
  const { t } = useTranslation()
  const { academicYearLabel } = useTerminology()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [quickAddTarget, setQuickAddTarget] = useState(null)

  const flat = flattenInitiatives(goals)
  const filtered = search
    ? flat.filter((f) => f.initiative.title.toLowerCase().includes(search.toLowerCase()))
    : flat
  const totalAchievements = flat.reduce(
    (sum, f) => sum + (f.initiative.achievementCount ?? 0) + (f.initiative.mappedAchievementCount ?? 0), 0)

  const { data: recent = [], isLoading: recentLoading } = useQuery({
    queryKey: ['recent-achievements', strategyId],
    queryFn: () => getRecentAchievements(strategyId, 8),
    enabled: !!strategyId,
  })

  const quickAddMut = useAddAchievementMutation(
    quickAddTarget?.initiative.measurements, quickAddTarget?.initiative.id, strategyId,
    () => { setQuickAddTarget(null); onRefresh?.() },
  )

  const canAdd = canRecordAchievement(role, state)

  return (
    <div className="ach-rail">
      <div className="rail-card">
        <h3>{t('tree.logAchievementTitle')}</h3>
        <Button type="primary" block icon={<TrophyOutlined />} disabled={!canAdd} onClick={() => setPickerOpen(true)}
          style={{ background: '#13223a' }}>
          {t('tree.recordAchievement')}
        </Button>
        <div className="rail-hint">{t('tree.railSearchHint')}</div>
      </div>

      <div className="rail-card">
        <h3>{t('tree.planAtGlance')}</h3>
        <div className="rail-stat-row">
          <div className="rail-stat"><div className="n">{totalAchievements}</div><div className="l">{t('tree.achievementsLabel')}</div></div>
          <div className="rail-stat"><div className="n">{flat.length}</div><div className="l">{t('dashboard.initiativesLabel')}</div></div>
          <div className="rail-stat"><div className="n">{goals.length}</div><div className="l">{t('dashboard.goalsLabel')}</div></div>
        </div>
      </div>

      <div className="rail-card">
        <h3>{t('tree.recentlyLogged')}</h3>
        {recentLoading ? (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{t('tree.loadingEllipsis')}</div>
        ) : recent.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{t('tree.noAchievementsLoggedYet')}</div>
        ) : (
          recent.map((a) => (
            <div key={a.id} className="rail-feed-item">
              <span className="dot" />
              <div>
                <div className="t">{a.title}</div>
                <div className="s">{a.initiativeTitle} — {new Date(a.recordedAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal title={t('tree.recordAchievement')} open={pickerOpen}
        onCancel={() => { setPickerOpen(false); setSearch('') }} footer={null} destroyOnClose>
        <Input placeholder={t('tree.searchInitiativesPlaceholder')} value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
        <div className="rail-picker-list">
          {filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>{t('tree.noMatchingInitiatives')}</div>
          ) : filtered.map((f) => {
            const hasMeasurement = (f.initiative.measurements?.length ?? 0) > 0
            const period = resolveFixedPeriod(f.initiative, academicYearId, academicYears, assessmentPeriods)
            const pickable = hasMeasurement && !!period
            return (
              <div key={f.initiative.id} className="rail-picker-item"
                onClick={() => { if (pickable) { setPickerOpen(false); setQuickAddTarget(f) } }}
                style={{ opacity: pickable ? 1 : 0.5, cursor: pickable ? 'pointer' : 'not-allowed' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{f.initiative.title}</div>
                <div style={{ fontSize: 11.5, color: '#9ca3af' }}>
                  {f.goalTitle}
                  {!hasMeasurement && ` · ${t('tree.needsKpiHint')}`}
                  {hasMeasurement && !period && ` · ${t('tree.selectYearToLogHint', { yearLabel: academicYearLabel.toLowerCase() })}`}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      <AchievementModal
        open={!!quickAddTarget} onClose={() => setQuickAddTarget(null)}
        onSave={quickAddMut.mutate} loading={quickAddMut.isPending}
        title={quickAddTarget ? t('tree.recordAchievementFor', { name: quickAddTarget.initiative.title }) : t('tree.recordAchievement')}
        assessmentPeriods={assessmentPeriods} academicYears={academicYears} academicYearId={academicYearId}
        initialPeriodName={quickAddTarget ? resolveFixedPeriod(quickAddTarget.initiative, academicYearId, academicYears, assessmentPeriods)?.name : undefined}
        initialValues={{ assessmentPeriodId: quickAddTarget ? resolveFixedPeriod(quickAddTarget.initiative, academicYearId, academicYears, assessmentPeriods)?.id : undefined }}
      />
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
  const { t } = useTranslation()
  const { goals = [], areas = [], state, id: strategyId, planningCycleId, strategyType, achievementThreshold } = strategy
  const isDeptStrategy = strategyType !== 'UNIVERSITY'
  const threshold = achievementThreshold ?? 3

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

  // Vision Areas are the only level that still collapses -- Goals/Objectives/Initiatives all
  // render flat once their Area is open (see the approved board redesign). Areas default open.
  const [collapsedAreaKeys, setCollapsedAreaKeys] = useState(() => new Set())
  const [allAreasExpanded, setAllAreasExpanded] = useState(true)
  const toggleArea = (key) => setCollapsedAreaKeys((prev) => toggled(prev, key))

  const handleExpandCollapseAllAreas = () => {
    if (allAreasExpanded) {
      setCollapsedAreaKeys(new Set([...areas.map((a) => a.id), 'ungrouped']))
    } else {
      setCollapsedAreaKeys(new Set())
    }
    setAllAreasExpanded(!allAreasExpanded)
  }

  // Cards (default) vs. List display for Initiatives -- remembered per strategy.
  const [viewMode, setViewMode] = useViewPrefs(`spms.strategyTreeView.${strategyId}`, 'cards')

  const hasAnyGoals = areas.length > 0 || ungrouped.length > 0

  return (
    <div className="strategy-tree">
      <div className="tree-toolbar">
        <div className="view-toggle" role="group" aria-label={t('tree.initiativeDisplayAriaLabel')}>
          <button type="button" className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>▦ {t('tree.cardsView')}</button>
          <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>☰ {t('tree.listView')}</button>
        </div>
        <Button size="small" onClick={handleExpandCollapseAllAreas}>
          {allAreasExpanded ? t('tree.collapseAllAreas') : t('tree.expandAllAreas')}
        </Button>
      </div>

      <div className="tree-layout">
        <div className="tree-board">
          {areas.map((area) => (
            <AreaSection key={area.id} area={area} goals={goalsByAreaId[area.id] || []}
              expanded={!collapsedAreaKeys.has(area.id)} onToggle={() => toggleArea(area.id)}
              isDeptStrategy={isDeptStrategy} viewMode={viewMode} allAreasExpanded={allAreasExpanded}
              role={role} state={state} strategyId={strategyId}
              academicYearId={academicYearId} yearLocked={yearLocked} academicYears={academicYears}
              assessmentPeriods={assessmentPeriods} planningCycleId={planningCycleId} areas={areas}
              comments={comments} onComment={onComment} onRefresh={onRefresh}
              validationErrors={validationErrors} threshold={threshold} />
          ))}
          {ungrouped.length > 0 && (
            <AreaSection area={null} goals={ungrouped}
              expanded={!collapsedAreaKeys.has('ungrouped')} onToggle={() => toggleArea('ungrouped')}
              isDeptStrategy={isDeptStrategy} viewMode={viewMode} allAreasExpanded={allAreasExpanded}
              role={role} state={state}
              strategyId={strategyId} academicYearId={academicYearId} yearLocked={yearLocked}
              academicYears={academicYears} assessmentPeriods={assessmentPeriods}
              planningCycleId={planningCycleId} areas={areas}
              comments={comments} onComment={onComment} onRefresh={onRefresh}
              validationErrors={validationErrors} threshold={threshold} />
          )}
          {!hasAnyGoals && (
            <div className="board-empty" style={{ padding: 40 }}>{t('tree.noGoalsInStrategyYet')}</div>
          )}
        </div>

        <AchievementRail strategyId={strategyId} goals={goals}
          academicYears={academicYears} assessmentPeriods={assessmentPeriods} academicYearId={academicYearId}
          role={role} state={state} onRefresh={onRefresh} />
      </div>
    </div>
  )
}
