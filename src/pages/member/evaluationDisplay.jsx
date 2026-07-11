// Shared display helpers for Annual Evaluation views (head's Team Evaluations page and the
// read-only Organization Evaluations rollup) -- kept in one place so both pages render
// categories/goals/achievements with the same color language instead of drifting apart.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Checkbox, Col, Empty, Form, Input, Modal, Popover, Row, Select, Space, Tag, Typography } from 'antd'
import { InfoCircleOutlined, PlusOutlined, DeleteOutlined, BulbOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReviewControl from '../../components/ReviewControl'
import {
  getNextCycleGoals, updateNextCycleGoalNotes, generateNextCycleGoalSuggestions, addNextCycleGoal,
  updateNextCycleGoalRubric, reviewNextCycleGoalAsLeader, reviewNextCycleGoalAsEmployee, deleteNextCycleGoal,
} from '../../api/annualEvaluations'
import { getCategoriesByTitle } from '../../api/portfolio'

const { Text, Paragraph } = Typography

export const STATE_COLORS = {
  DRAFT: 'default',
  EMPLOYEE_SUBMITTED: 'warning',
  HEAD_SUBMITTED: 'processing',
  CONCLUDED: 'success',
}

// Categories should always read Teaching, Research, then Service regardless of the order
// they were created/returned in -- any category outside this fixed set sorts after, alphabetically.
const CATEGORY_ORDER = ['Teaching', 'Research', 'Service']

export function orderedCategoryResults(categoryResults) {
  return [...categoryResults].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.categoryName)
    const ib = CATEGORY_ORDER.indexOf(b.categoryName)
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? CATEGORY_ORDER.length : ia) - (ib === -1 ? CATEGORY_ORDER.length : ib)
    }
    return (a.categoryName || '').localeCompare(b.categoryName || '')
  })
}

// Each category gets its own accent so a head scanning down the page can tell at a glance which
// section they're in -- carried through to that category's achievement chips (border-tinted to match).
export const CATEGORY_COLORS = {
  Teaching: { accent: '#1677ff', tint: '#e6f4ff' },
  Research: { accent: '#722ed1', tint: '#f9f0ff' },
  Service: { accent: '#08979c', tint: '#e6fffb' },
}
const DEFAULT_CATEGORY_COLOR = { accent: '#595959', tint: '#fafafa' }
export const categoryColor = (categoryName) => CATEGORY_COLORS[categoryName] || DEFAULT_CATEGORY_COLOR

// Achievements not yet linked to a specific criteria get their own amber treatment regardless of
// category -- it's a data-quality flag ("needs designation"), not evidence for a rated criteria.
export const UNLINKED_COLOR = { accent: '#faad14', tint: '#fffbe6' }

// Annual Goals get their own identity, separate from the three fixed categories above.
export const GOAL_COLOR = { accent: '#2f54eb', tint: '#f0f5ff' }

// Small colored evidence chips read much faster than a one-column Table for what's usually 1-3 rows.
export function AchievementList({ entries, emptyText, color }) {
  if (entries.length === 0) {
    return <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>{emptyText}</Text>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      {entries.map((e) => (
        <div key={e.entryId}
          style={{ background: color.tint, borderLeft: `3px solid ${color.accent}`, borderRadius: 4, padding: '6px 10px', fontSize: 13 }}>
          {e.achievementTitle}
        </div>
      ))}
    </div>
  )
}

export function rankLabelText(rankLabels, rank) {
  if (!rank) return '—'
  const found = rankLabels.find((l) => l.rank === rank)
  return found ? `${rank} – ${found.label}` : String(rank)
}

// Saves on blur rather than on every keystroke -- avoids firing a mutation per character while
// the head is still typing their remarks. Shared by category and goal head-comments fields, split
// into two required parts: Strengths and Potential Improvements.
// `onChange` (if given) fires on every keystroke, live -- used to mirror these comments into the
// Next Cycle Goals notes as the head types, ahead of `onSave`, which only persists on blur.
export function CommentsInput({ initialStrengths, initialImprovements, onSave, onChange }) {
  const [strengths, setStrengths] = useState(initialStrengths || '')
  const [improvements, setImprovements] = useState(initialImprovements || '')
  useEffect(() => { setStrengths(initialStrengths || '') }, [initialStrengths])
  useEffect(() => { setImprovements(initialImprovements || '') }, [initialImprovements])

  const save = (nextStrengths, nextImprovements) => {
    if (nextStrengths !== (initialStrengths || '') || nextImprovements !== (initialImprovements || '')) {
      onSave(nextStrengths, nextImprovements)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Strengths</Text>
        <Input.TextArea rows={2} value={strengths} placeholder="Required: strengths"
          onChange={(e) => { setStrengths(e.target.value); onChange?.(e.target.value, improvements) }}
          onBlur={() => save(strengths, improvements)} />
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Potential Improvements</Text>
        <Input.TextArea rows={2} value={improvements} placeholder="Required: potential improvements"
          onChange={(e) => { setImprovements(e.target.value); onChange?.(strengths, e.target.value) }}
          onBlur={() => save(strengths, improvements)} />
      </div>
    </div>
  )
}

// The head's written comments for a category/goal, split into Strengths / Potential Improvements
// -- editable (required, flagged red until both are filled in) when `onSave` is provided,
// otherwise read-only (or nothing, if `show` is false -- e.g. the employee's own page hides this
// while still in DRAFT, before the head has even started rating).
export function HeadCommentsBlock({ strengths, improvements, onSave, onChange, show = true }) {
  if (!show) {
    return null
  }
  const missing = onSave && (!strengths?.trim() || !improvements?.trim())
  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 4 }}>
        Head Comments {missing && <Tag color="red" style={{ marginLeft: 6 }}>Required</Tag>}
      </Text>
      {onSave ? (
        <CommentsInput initialStrengths={strengths} initialImprovements={improvements} onSave={onSave} onChange={onChange} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <Text strong style={{ fontSize: 12 }}>Strengths: </Text>
            <Paragraph style={{ whiteSpace: 'pre-wrap', display: 'inline' }}>
              {strengths || <Text type="secondary">No comments</Text>}
            </Paragraph>
          </div>
          <div>
            <Text strong style={{ fontSize: 12 }}>Potential Improvements: </Text>
            <Paragraph style={{ whiteSpace: 'pre-wrap', display: 'inline' }}>
              {improvements || <Text type="secondary">No comments</Text>}
            </Paragraph>
          </div>
        </div>
      )}
    </div>
  )
}

// Annual Goals as a fourth section under the three fixed categories -- one section-level
// self-rank and one head-comments field cover the whole section (parallel to how each category
// has its own single self-rank/comments), while each individual goal still gets its own head rank
// (editable when `canEdit`, a read-only tag otherwise -- e.g. the Organization Evaluations rollup,
// which is always view-only regardless of the evaluation's state) and, optionally, the employee's
// own editable "nothing to report" checkbox (used by the employee's self-assessment page; omit
// `onNothingToReportChange` to just show it as a read-only tag). Each goal displays "Goal:" and its
// title first, then "Goal Achievements:" and its tagged achievements below that.
export function GoalsSection({
  evaluation, rankLabels, canEdit, onRankChange, onSelfRankChange, onHeadRankChange, onNothingToReportChange, onCommentsChange, onCommentsLiveChange, showComments = true,
  onOpenAssistant,
}) {
  if (!evaluation.goalResults?.length) {
    return null
  }
  return (
    <Card type="inner" title="Annual Goals"
      style={{ marginBottom: 16, borderTop: `4px solid ${GOAL_COLOR.accent}` }}
      styles={{ header: { background: GOAL_COLOR.tint } }}
      extra={
        <Space>
          <span>Rank:</span>
          {onHeadRankChange ? (
            <Select style={{ width: 220 }} value={evaluation.goalsHeadRank} placeholder="Rank"
              options={[1, 2, 3, 4, 5].map((r) => ({ value: r, label: rankLabelText(rankLabels, r) }))}
              onChange={onHeadRankChange} />
          ) : (
            <Tag color="green">{evaluation.goalsHeadRank ? rankLabelText(rankLabels, evaluation.goalsHeadRank) : 'Not yet rated'}</Tag>
          )}
          <span>Your self-rank:</span>
          {onSelfRankChange ? (
            <Select style={{ width: 220 }} value={evaluation.goalsEmployeeSelfRank} placeholder="Select rank"
              options={[1, 2, 3, 4, 5].map((r) => ({ value: r, label: rankLabelText(rankLabels, r) }))}
              onChange={onSelfRankChange} />
          ) : (
            <Tag color="magenta">{evaluation.goalsEmployeeSelfRank ? rankLabelText(rankLabels, evaluation.goalsEmployeeSelfRank) : '—'}</Tag>
          )}
        </Space>
      }
    >
      {evaluation.goalResults.map((g) => {
        const goalEntries = evaluation.entries.filter((e) => e.goalId === g.goalId)
        return (
          <div key={g.goalId} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eef6' }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong>Goal: </Text>
              <RubricPopover criteria={{
                criteriaName: g.goalTitle,
                rubricUnsatisfactory: g.rubricUnsatisfactory,
                rubricMeetsExpectations: g.rubricMeetsExpectations,
                rubricExceedsExpectations: g.rubricExceedsExpectations,
              }} />
              {onNothingToReportChange ? (
                <Checkbox
                  checked={g.employeeNothingToReport} disabled={goalEntries.length > 0}
                  onChange={(e) => onNothingToReportChange(g.goalId, e.target.checked)}
                  style={{ marginLeft: 12 }}
                >
                  Nothing to report
                </Checkbox>
              ) : (
                g.employeeNothingToReport && <Tag color="gold" style={{ marginLeft: 8 }}>Employee: nothing to report</Tag>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Goal Achievements:</Text>
              <AchievementList
                entries={goalEntries}
                emptyText={g.employeeNothingToReport ? 'Employee reported nothing for this goal' : 'No achievements tagged to this goal'}
                color={GOAL_COLOR}
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              {canEdit ? (
                <Space>
                  {onOpenAssistant && (
                    <Button size="small"
                      disabled={!g.rubricUnsatisfactory && !g.rubricMeetsExpectations && !g.rubricExceedsExpectations}
                      title={!g.rubricUnsatisfactory && !g.rubricMeetsExpectations && !g.rubricExceedsExpectations
                        ? 'No rubric defined for this goal yet' : undefined}
                      onClick={() => onOpenAssistant(g, goalEntries)}>
                      Rating Assistant
                    </Button>
                  )}
                  <span>Rank:</span>
                  <Select style={{ width: 220 }} value={g.headGoalRank} placeholder="Rank"
                    options={[1, 2, 3, 4, 5].map((r) => ({ value: r, label: rankLabelText(rankLabels, r) }))}
                    onChange={(v) => onRankChange(g.goalId, v)} />
                </Space>
              ) : (
                <Tag color="green">{g.headGoalRank ? rankLabelText(rankLabels, g.headGoalRank) : '—'}</Tag>
              )}
            </div>
          </div>
        )
      })}
      <HeadCommentsBlock
        strengths={evaluation.goalsHeadCommentsStrengths}
        improvements={evaluation.goalsHeadCommentsImprovements}
        onSave={onCommentsChange}
        onChange={onCommentsLiveChange}
        show={showComments}
      />
    </Card>
  )
}

// Admin-set 3-level rubric for a criteria (Unsatisfactory / Meets / Exceeds Expectations),
// shown as reference while the head gives the 1-5 rank.
export function RubricPopover({ criteria }) {
  const hasRubric = criteria.rubricUnsatisfactory || criteria.rubricMeetsExpectations || criteria.rubricExceedsExpectations
  if (!hasRubric) {
    return <span>{criteria.criteriaName}</span>
  }
  return (
    <Popover
      title={criteria.criteriaName}
      trigger="click"
      overlayStyle={{ maxWidth: 480 }}
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><strong>Unsatisfactory:</strong> {criteria.rubricUnsatisfactory || '—'}</div>
          <div><strong>Meets Expectations:</strong> {criteria.rubricMeetsExpectations || '—'}</div>
          <div><strong>Exceeds Expectations:</strong> {criteria.rubricExceedsExpectations || '—'}</div>
        </div>
      }
    >
      <span style={{ cursor: 'pointer' }}>
        {criteria.criteriaName} <InfoCircleOutlined style={{ color: '#2A5298', marginLeft: 4 }} />
      </span>
    </Popover>
  )
}

const ASSISTANT_NEUTRAL_COLOR = { accent: '#595959', tint: '#fafafa' }

const RUBRIC_COLUMNS = [
  { key: 'left', label: 'Below Expectations (1 pt/word)', weight: 1, tint: '#fff1f0', selected: '#ffa39e' },
  { key: 'center', label: 'Meets Expectations (3 pts/word)', weight: 3, tint: '#feffe6', selected: '#fff566' },
  { key: 'right', label: 'Exceeds Expectations (5 pts/word)', weight: 5, tint: '#f6ffed', selected: '#95de64' },
]

function tokenize(text) {
  return (text || '').split(/\s+/).filter(Boolean)
}

/**
 * Client-side, ephemeral decision aid for the head while rating a criterion/goal -- nothing about
 * word-selection state is persisted. The head clicks rubric words that describe the achievement
 * evidence shown above; each column's words are worth a fixed weight (1/3/5), and the running
 * average is shown purely as a suggestion, with an explicit "Apply to Rank" opt-in rather than
 * silently overwriting the actual rank.
 */
export function RatingAssistantModal({ open, onClose, resetKey, title, rubric, entries, onApplyToRank }) {
  const [selected, setSelected] = useState(new Set())
  const [history, setHistory] = useState([])

  useEffect(() => {
    setSelected(new Set())
    setHistory([])
  }, [resetKey, open])

  const columnTokens = useMemo(() => ({
    left: tokenize(rubric?.unsatisfactory),
    center: tokenize(rubric?.meets),
    right: tokenize(rubric?.exceeds),
  }), [rubric])

  const toggle = (columnKey, idx) => {
    const key = `${columnKey}-${idx}`
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        setHistory((h) => h.filter((k) => k !== key))
      } else {
        next.add(key)
        setHistory((h) => [...h, key])
      }
      return next
    })
  }

  const clearLast = () => {
    if (history.length === 0) return
    const last = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(last)
      return next
    })
  }

  const clearAll = () => {
    setSelected(new Set())
    setHistory([])
  }

  const average = useMemo(() => {
    if (selected.size === 0) return null
    let sum = 0
    for (const key of selected) {
      const col = RUBRIC_COLUMNS.find((c) => key.startsWith(c.key + '-'))
      sum += col.weight
    }
    return sum / selected.size
  }, [selected])

  const roundedScore = average !== null ? Math.min(5, Math.max(1, Math.round(average))) : null

  return (
    <Modal title={`Rating Assistant -- ${title || ''}`} open={open} onCancel={onClose} width={900} footer={null} destroyOnClose>
      <Text strong style={{ display: 'block', marginBottom: 4 }}>Achievement Summary</Text>
      <AchievementList entries={entries || []} emptyText="No achievements tagged" color={ASSISTANT_NEUTRAL_COLOR} />

      <Text type="secondary" style={{ display: 'block', margin: '12px 0' }}>
        Click the words in the rubric columns below that best describe the achievement level shown above. Skip
        words that don't carry meaning (prepositions, articles, etc.) -- they shouldn't affect the score.
      </Text>

      <Row gutter={12}>
        {RUBRIC_COLUMNS.map((col) => (
          <Col span={8} key={col.key}>
            <div style={{ background: col.tint, borderRadius: 6, padding: 10, minHeight: 160 }}>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>{col.label}</Text>
              <div>
                {columnTokens[col.key].length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>No rubric text</Text>
                ) : columnTokens[col.key].map((word, idx) => {
                  const key = `${col.key}-${idx}`
                  const isSelected = selected.has(key)
                  return (
                    <span key={idx} onClick={() => toggle(col.key, idx)}
                      style={{
                        cursor: 'pointer', padding: '1px 4px', marginRight: 3, marginBottom: 3, borderRadius: 3,
                        display: 'inline-block', background: isSelected ? col.selected : 'transparent',
                      }}>
                      {word}
                    </span>
                  )
                })}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Suggested Score</Text>
        <div style={{ fontSize: 48, fontWeight: 700, color: '#cf1322', lineHeight: 1.2 }}>
          {average !== null ? average.toFixed(1) : '—'}
        </div>
      </div>

      <Alert type="warning" showIcon style={{ marginBottom: 16 }}
        message="This score is generated to help the evaluator assess the evaluation level of this criterion/goal, and may not necessarily reflect the score the employee would or should get." />

      <Space>
        <Button onClick={clearLast} disabled={history.length === 0}>Clear Last Selection</Button>
        <Button onClick={clearAll} disabled={selected.size === 0}>Clear All</Button>
        {onApplyToRank && (
          <Button type="primary" disabled={roundedScore === null} onClick={() => onApplyToRank(roundedScore)}>
            Apply {roundedScore ?? ''} to Rank
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </Space>
    </Modal>
  )
}

// Distinct from every category color and GOAL_COLOR -- gold, matching the StratAlign brand mark.
export const NEXT_CYCLE_COLOR = { accent: '#c9a24b', tint: '#fffbe6' }

function NextCycleGoalRubricEditor({ goal, onSave }) {
  const [u, setU] = useState(goal.rubricUnsatisfactory || '')
  const [m, setM] = useState(goal.rubricMeetsExpectations || '')
  const [x, setX] = useState(goal.rubricExceedsExpectations || '')
  useEffect(() => {
    setU(goal.rubricUnsatisfactory || '')
    setM(goal.rubricMeetsExpectations || '')
    setX(goal.rubricExceedsExpectations || '')
  }, [goal.id, goal.rubricUnsatisfactory, goal.rubricMeetsExpectations, goal.rubricExceedsExpectations])

  const save = () => onSave({ rubricUnsatisfactory: u, rubricMeetsExpectations: m, rubricExceedsExpectations: x })

  return (
    <div style={{ marginTop: 8 }}>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>3-Level Rubric</Text>
      <Input.TextArea rows={2} value={u} placeholder="Unsatisfactory"
        onChange={(e) => setU(e.target.value)} onBlur={save} style={{ marginBottom: 4 }} />
      <Input.TextArea rows={2} value={m} placeholder="Meets Expectations"
        onChange={(e) => setM(e.target.value)} onBlur={save} style={{ marginBottom: 4 }} />
      <Input.TextArea rows={2} value={x} placeholder="Exceeds Expectations"
        onChange={(e) => setX(e.target.value)} onBlur={save} />
    </div>
  )
}

// Live mirror of the head's Next Cycle Goals notes -- everything they've written as head comments
// across the categories and Annual Goals section, kept in sync continuously (at load, and on every
// keystroke -- see NextCycleGoalsSection's effect and TeamEvaluationsPage's draft-comment plumbing)
// so they're never retyping the same strengths/improvements they just identified moments ago.
function buildDefaultNextCycleNotes(evaluation) {
  if (!evaluation) return { strengths: '', weaknesses: '' }
  const strengthParts = []
  const improvementParts = []
  for (const cat of orderedCategoryResults(evaluation.categoryResults || [])) {
    if (cat.headCommentsStrengths) strengthParts.push(`${cat.categoryName}: ${cat.headCommentsStrengths}`)
    if (cat.headCommentsImprovements) improvementParts.push(`${cat.categoryName}: ${cat.headCommentsImprovements}`)
  }
  if (evaluation.goalsHeadCommentsStrengths) strengthParts.push(`Annual Goals: ${evaluation.goalsHeadCommentsStrengths}`)
  if (evaluation.goalsHeadCommentsImprovements) improvementParts.push(`Annual Goals: ${evaluation.goalsHeadCommentsImprovements}`)
  return { strengths: strengthParts.join('\n\n'), weaknesses: improvementParts.join('\n\n') }
}

// Goals for the employee's NEXT annual cycle, drafted and reviewed by both the head and the
// employee during THIS evaluation's own review/sign exchange (not a separate approval workflow).
// Mirrors GoalSettingPage.jsx's AI-suggestion UI almost verbatim, except each goal carries TWO
// independent ReviewControls -- one for the head's own review, one for the employee's (required
// before they may sign or refuse the evaluation as a whole). Manages its own data/mutations so
// every call site just needs to pass evaluationId + the two edit-window booleans.
export function NextCycleGoalsSection({ evaluationId, evaluation, canHeadEdit, canEmployeeReview, onAfterMutate }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [addForm] = Form.useForm()
  const [notesForm] = Form.useForm()

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['next-cycle-goals', evaluationId],
    queryFn: () => getNextCycleGoals(evaluationId),
    enabled: !!evaluationId,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-for-title', evaluation?.titleId],
    queryFn: () => getCategoriesByTitle(evaluation.titleId),
    enabled: !!evaluation?.titleId && canHeadEdit,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['next-cycle-goals', evaluationId] })
    onAfterMutate?.()
  }

  const notesMut = useMutation({
    mutationFn: ({ strengths, weaknesses }) => updateNextCycleGoalNotes(evaluationId, strengths, weaknesses),
    onSuccess: invalidate,
  })
  const generateMut = useMutation({
    mutationFn: () => generateNextCycleGoalSuggestions(evaluationId),
    onSuccess: invalidate,
  })
  const addMut = useMutation({
    mutationFn: (values) => addNextCycleGoal(evaluationId, values),
    onSuccess: () => { invalidate(); setAddOpen(false); addForm.resetFields() },
  })
  const rubricMut = useMutation({
    mutationFn: ({ goalId, payload }) => updateNextCycleGoalRubric(evaluationId, goalId, payload),
    onSuccess: invalidate,
  })
  const leaderReviewMut = useMutation({
    mutationFn: ({ goalId, payload }) => reviewNextCycleGoalAsLeader(evaluationId, goalId, payload),
    onSuccess: invalidate,
  })
  const employeeReviewMut = useMutation({
    mutationFn: ({ goalId, payload }) => reviewNextCycleGoalAsEmployee(evaluationId, goalId, payload),
    onSuccess: invalidate,
  })
  const deleteMut = useMutation({
    mutationFn: (goalId) => deleteNextCycleGoal(evaluationId, goalId),
    onSuccess: invalidate,
  })

  const generating = !!evaluation?.nextCycleGenerationRequestedAt && !evaluation?.nextCycleGenerationFailureReason
    && (!evaluation?.nextCycleGeneratedAt || new Date(evaluation.nextCycleGeneratedAt) < new Date(evaluation.nextCycleGenerationRequestedAt))

  // Keep the notes fields continuously mirroring the head's category/goals comments -- at page
  // load, and live as the head types those comments elsewhere on the page (TeamEvaluationsPage
  // threads live drafts of them into the `evaluation` prop on every keystroke, not just on save).
  // The visual update is immediate; the actual persist is debounced so a fast typist doesn't spam
  // the backend once per character.
  const lastSyncedNotesRef = useRef({ strengths: null, weaknesses: null })
  const notesSyncTimerRef = useRef(null)
  // Force a resync on the next evaluation's own data instead of comparing against the previous
  // evaluation's computed defaults, which could coincidentally match (e.g. both blank) and skip.
  useEffect(() => { lastSyncedNotesRef.current = { strengths: null, weaknesses: null } }, [evaluationId])
  useEffect(() => {
    if (!canHeadEdit || !evaluation) return
    const defaults = buildDefaultNextCycleNotes(evaluation)
    if (defaults.strengths === lastSyncedNotesRef.current.strengths
        && defaults.weaknesses === lastSyncedNotesRef.current.weaknesses) {
      return
    }
    lastSyncedNotesRef.current = defaults
    notesForm.setFieldsValue(defaults)
    if (notesSyncTimerRef.current) clearTimeout(notesSyncTimerRef.current)
    notesSyncTimerRef.current = setTimeout(() => notesMut.mutate(defaults), 800)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canHeadEdit, evaluation])
  useEffect(() => () => { if (notesSyncTimerRef.current) clearTimeout(notesSyncTimerRef.current) }, [])

  if (!canHeadEdit && !canEmployeeReview && goals.length === 0) {
    return null
  }

  return (
    <Card type="inner" title="Next Cycle Goals"
      style={{ marginBottom: 16, borderTop: `4px solid ${NEXT_CYCLE_COLOR.accent}` }}
      styles={{ header: { background: NEXT_CYCLE_COLOR.tint } }}
    >
      {canHeadEdit && (
        <Card size="small" title="Strengths & Areas for Improvement" style={{ marginBottom: 16 }}>
          <Form form={notesForm} layout="vertical"
            initialValues={{ strengths: evaluation?.nextCycleNotesStrengths, weaknesses: evaluation?.nextCycleNotesWeaknesses }}>
            <Form.Item label="Strengths" name="strengths">
              <Input.TextArea autoSize={{ minRows: 4, maxRows: 16 }} placeholder="Note strengths to build upon"
                onBlur={() => notesMut.mutate(notesForm.getFieldsValue())} />
            </Form.Item>
            <Form.Item label="Areas for Improvement" name="weaknesses">
              <Input.TextArea autoSize={{ minRows: 4, maxRows: 16 }} placeholder="Note areas where the employee can grow (AI will suggest goals from this)"
                onBlur={() => notesMut.mutate(notesForm.getFieldsValue())} />
            </Form.Item>
            {!generating && !evaluation?.nextCycleGenerationFailureReason && (
              <Button icon={<BulbOutlined />} loading={generateMut.isPending} onClick={() => generateMut.mutate()}>
                Generate AI Suggestions
              </Button>
            )}
          </Form>
          {(generating || evaluation?.nextCycleGenerationFailureReason) && (
            <div style={{ marginTop: 12 }}>
              {evaluation?.nextCycleGenerationFailureReason ? (
                <Alert type="error" showIcon style={{ marginBottom: 8 }}
                  message="AI generation failed" description={evaluation.nextCycleGenerationFailureReason} />
              ) : (
                <div style={{ color: '#6b7280', marginBottom: 8 }}>
                  AI is generating suggested goals in the background. This page checks automatically and will show them once ready.
                </div>
              )}
              <Button loading={generateMut.isPending} onClick={() => generateMut.mutate()}>
                {evaluation?.nextCycleGenerationFailureReason ? 'Retry Generation' : 'Cancel & Retry Generation'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {isLoading ? null : goals.length === 0 ? (
        <Empty description="No next cycle goals yet" />
      ) : (
        goals.map((g) => (
          <Card key={g.id} size="small" style={{ marginBottom: 12 }}
            title={<>{g.suggestedTitle} <Tag>{g.categoryName}</Tag></>}
            extra={canHeadEdit && (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => deleteMut.mutate(g.id)} />
            )}
          >
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>{g.suggestedDescription}</Paragraph>
            {g.rationale && <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>Rationale: {g.rationale}</Paragraph>}
            {canHeadEdit ? (
              <NextCycleGoalRubricEditor goal={g} onSave={(payload) => rubricMut.mutate({ goalId: g.id, payload })} />
            ) : (g.rubricUnsatisfactory || g.rubricMeetsExpectations || g.rubricExceedsExpectations) && (
              <div style={{ marginTop: 8 }}>
                <RubricPopover criteria={{
                  criteriaName: 'View 3-level rubric',
                  rubricUnsatisfactory: g.rubricUnsatisfactory,
                  rubricMeetsExpectations: g.rubricMeetsExpectations,
                  rubricExceedsExpectations: g.rubricExceedsExpectations,
                }} />
              </div>
            )}
            <Row gutter={16} style={{ marginTop: 10 }}>
              <Col span={12}>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Head Review</Text>
                {canHeadEdit ? (
                  <ReviewControl targetType="NEXT_CYCLE_GOAL_LEADER" targetId={g.id}
                    defaultTitle={g.suggestedTitle} defaultDescription={g.suggestedDescription}
                    draft={{ actionType: g.leaderActionType, editedTitle: g.leaderEditedTitle, editedDescription: g.leaderEditedDescription }}
                    onSave={(_t, _id, payload) => leaderReviewMut.mutate({ goalId: g.id, payload })}
                  />
                ) : (
                  <Tag color={g.leaderActionType ? 'blue' : 'default'}>{g.leaderActionType || 'Not yet reviewed'}</Tag>
                )}
              </Col>
              <Col span={12}>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Employee Review</Text>
                {canEmployeeReview ? (
                  <ReviewControl targetType="NEXT_CYCLE_GOAL_EMPLOYEE" targetId={g.id}
                    defaultTitle={g.leaderEditedTitle || g.suggestedTitle} defaultDescription={g.leaderEditedDescription || g.suggestedDescription}
                    draft={{ actionType: g.employeeActionType, editedTitle: g.employeeEditedTitle, editedDescription: g.employeeEditedDescription }}
                    onSave={(_t, _id, payload) => employeeReviewMut.mutate({ goalId: g.id, payload })}
                  />
                ) : (
                  <Tag color={g.employeeActionType ? 'blue' : 'default'}>{g.employeeActionType || 'Not yet reviewed'}</Tag>
                )}
              </Col>
            </Row>
          </Card>
        ))
      )}

      {canHeadEdit && (
        <>
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Add a New Goal</Button>
          <Modal title="Add a Next Cycle Goal" open={addOpen} onCancel={() => setAddOpen(false)} destroyOnClose
            onOk={() => addForm.submit()} confirmLoading={addMut.isPending}>
            <Form form={addForm} layout="vertical" onFinish={(values) => addMut.mutate(values)}>
              <Form.Item label="Category" name="categoryId" rules={[{ required: true }]}>
                <Select options={categories.map((c) => ({ value: c.id, label: c.categoryName }))} placeholder="Select category" />
              </Form.Item>
              <Form.Item label="Goal Title" name="title" rules={[{ required: true }]}>
                <Input placeholder="e.g., Develop advanced statistical analysis skills" />
              </Form.Item>
              <Form.Item label="Description" name="description">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item label="Rubric — Unsatisfactory (1)" name="rubricUnsatisfactory">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item label="Rubric — Meets Expectations (3)" name="rubricMeetsExpectations">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item label="Rubric — Exceeds Expectations (5)" name="rubricExceedsExpectations">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </Card>
  )
}
