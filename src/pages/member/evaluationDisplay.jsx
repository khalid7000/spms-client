// Shared display helpers for Annual Evaluation views (head's Team Evaluations page and the
// read-only Organization Evaluations rollup) -- kept in one place so both pages render
// categories/goals/achievements with the same color language instead of drifting apart.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Button, Card, Checkbox, Col, Empty, Form, Input, Modal, Popconfirm, Popover, Rate, Row, Select, Space, Tag, Tooltip, Typography, Upload, message,
} from 'antd'
import { InfoCircleOutlined, PlusOutlined, DeleteOutlined, BulbOutlined, UploadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReviewControl from '../../components/ReviewControl'
import {
  getNextCycleGoals, updateNextCycleGoalNotes, generateNextCycleGoalSuggestions, addNextCycleGoal,
  updateNextCycleGoalRubric, reviewNextCycleGoalAsLeader, reviewNextCycleGoalAsEmployee, deleteNextCycleGoal,
  getTeachingEvaluationSession, updateTeachingEvaluationNote, uploadTeachingEvaluationFiles,
  generateTeachingEvaluationDraft, finalizeTeachingEvaluationAchievement, deleteTeachingEvaluationSession,
  getRatingAssistantSelection, saveRatingAssistantSelection,
} from '../../api/annualEvaluations'
import { getCategoriesByTitle, getMyCycles, getCycleGoals, getInfoToolOptions, getInfoToolDetails } from '../../api/portfolio'
import { getAchievementTypes } from '../../api/strategies'
import { AchievementReportModal, formatAiDetails } from '../../components/AchievementModal'
import { useTerminology } from '../../TerminologyContext'

const { Text, Paragraph } = Typography

export const STATE_COLORS = {
  DRAFT: 'default',
  EMPLOYEE_SUBMITTED: 'warning',
  RETURNED_TO_EMPLOYEE: 'gold',
  HEAD_SUBMITTED: 'processing',
  CONCLUDED: 'success',
}

// Categories sort by their admin-configured position (Portfolio Categories console) -- falls back
// to alphabetical only for the (should-never-happen) case of a missing sortOrder, e.g. legacy data.
export function orderedCategoryResults(categoryResults) {
  return [...categoryResults].sort((a, b) => {
    if (a.sortOrder != null && b.sortOrder != null) {
      return a.sortOrder - b.sortOrder
    }
    return (a.categoryName || '').localeCompare(b.categoryName || '')
  })
}

// Each category gets its own accent so a head scanning down the page can tell at a glance which
// section they're in -- carried through to that category's achievement chips (border-tinted to
// match). Assigned by position in the sorted list, not by name, so any admin-defined category (not
// just the seeded Teaching/Research/Service) gets a distinct color. Reordering categories later
// will shift which color they get -- an accepted, cosmetic side effect of index-based assignment.
const CATEGORY_PALETTE = [
  { accent: '#1677ff', tint: '#e6f4ff' },
  { accent: '#722ed1', tint: '#f9f0ff' },
  { accent: '#08979c', tint: '#e6fffb' },
  { accent: '#d4380d', tint: '#fff2e8' },
  { accent: '#389e0d', tint: '#f6ffed' },
  { accent: '#c41d7f', tint: '#fff0f6' },
]
export const categoryColor = (index) => CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]

// Achievements not yet linked to a specific criteria get their own amber treatment regardless of
// category -- it's a data-quality flag ("needs designation"), not evidence for a rated criteria.
export const UNLINKED_COLOR = { accent: '#faad14', tint: '#fffbe6' }

// Annual Goals get their own identity, separate from the three fixed categories above.
export const GOAL_COLOR = { accent: '#2f54eb', tint: '#f0f5ff' }

// The overall score gets its own identity too, in the Score Summary -- same shaded-tile treatment
// as each category/Annual Goals tile, just its own color and a larger headline number since it's
// the single rolled-up figure the rest of the row builds up to.
export const OVERALL_COLOR = { accent: '#13223a', tint: '#eef1f6' }

// Small colored evidence chips read much faster than a one-column Table for what's usually 1-3 rows.
// Clicking one opens the same read-only achievement report the Strategy Tree uses -- the backend
// has already shaped what's visible (private notes/goal link) based on who's viewing, so this
// renders identically whether it's the employee's own page or the chair's Team Evaluations review.
export function AchievementList({ entries, emptyText, color }) {
  const [viewingAchievement, setViewingAchievement] = useState(null)
  if (entries.length === 0) {
    return <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>{emptyText}</Text>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      {entries.map((e) => (
        <Tooltip
          key={e.entryId}
          title={<div style={{ whiteSpace: 'pre-wrap' }}>{formatAiDetails(e.achievementDetails) || 'No additional details'}</div>}
          placement="left"
        >
          <div style={{ background: color.tint, borderLeft: `3px solid ${color.accent}`, borderRadius: 4, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
            onClick={() => setViewingAchievement({
              id: e.achievementId,
              title: e.achievementTitle,
              details: e.achievementDetails,
              achievementTypeName: e.achievementTypeName,
              customTypeName: e.customTypeName,
              assessmentPeriodName: e.assessmentPeriodName,
              authorName: e.authorName,
              recordedAt: e.recordedAt,
              privateNotes: e.privateNotes,
            })}>
            {e.achievementTitle}
          </div>
        </Tooltip>
      ))}
      <AchievementReportModal achievement={viewingAchievement} onClose={() => setViewingAchievement(null)} />
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
// `highlightMissing` -- set true after a failed submit attempt to redden whichever of these two
// fields is still blank, in addition to the "Required" tag `HeadCommentsBlock` already shows.
export function CommentsInput({ initialStrengths, initialImprovements, onSave, onChange, highlightMissing }) {
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
          status={highlightMissing && !strengths?.trim() ? 'error' : undefined}
          onChange={(e) => { setStrengths(e.target.value); onChange?.(e.target.value, improvements) }}
          onBlur={() => save(strengths, improvements)} />
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Potential Improvements</Text>
        <Input.TextArea rows={2} value={improvements} placeholder="Required: potential improvements"
          status={highlightMissing && !improvements?.trim() ? 'error' : undefined}
          onChange={(e) => { setImprovements(e.target.value); onChange?.(strengths, e.target.value) }}
          onBlur={() => save(strengths, improvements)} />
      </div>
    </div>
  )
}

// The employee's own reflection on a category/criterion/goals section, or (via `heading`, with no
// `sectionName`) a whole-evaluation field like the final summary statement -- a single free-text
// field (not split like the head's), always shown immediately before that section's
// HeadCommentsBlock. Editable (on blur, like CommentsInput) when `onSave` is given -- only the
// employee's own page passes it, gated to DRAFT/RETURNED_TO_EMPLOYEE; every other page (head, org
// rollup) shows it read-only. Optional fields render nothing at all once there's no comment and
// `onSave` wasn't given; `required` fields always render (even blank, read-only) and show a red
// "Required" tag while editable and empty.
export function EmployeeReflectionBlock({ comments, onSave, show = true, sectionName, heading, required = false, color }) {
  const [value, setValue] = useState(comments || '')
  useEffect(() => { setValue(comments || '') }, [comments])

  if (!show) {
    return null
  }
  if (!onSave && !comments?.trim() && !required) {
    return null
  }

  const missing = required && onSave && !value?.trim()

  return (
    <div style={{
      marginBottom: 12,
      ...(color ? { background: color.tint, borderLeft: `3px solid ${color.accent}`, borderRadius: 4, padding: 10 } : {}),
    }}>
      <Text strong style={{ display: 'block', marginBottom: 4 }}>
        {heading || `${required ? '' : 'Optional '}Employee Comments & Reflection${sectionName ? ` on ${sectionName}` : ''}`}
        {missing && <Tag color="red" style={{ marginLeft: 6 }}>Required</Tag>}
      </Text>
      {onSave ? (
        <Input.TextArea rows={2} value={value} status={missing ? 'error' : undefined}
          placeholder={required ? 'Required: your own comments and reflection' : 'Optional: your own comments and reflection on this section'}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => { if (value !== (comments || '')) onSave(value) }} />
      ) : (
        <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{comments || <Text type="secondary">No comments</Text>}</Paragraph>
      )}
    </div>
  )
}

// The head's written comments for a category/goal, split into Strengths / Potential Improvements
// -- editable (required, flagged red until both are filled in) when `onSave` is provided,
// otherwise read-only (or nothing, if `show` is false -- e.g. the employee's own page hides this
// while still in DRAFT, before the head has even started rating). `highlightMissing` reddens the
// fields themselves (not just the "Required" tag) after a failed submit attempt.
export function HeadCommentsBlock({ strengths, improvements, onSave, onChange, show = true, highlightMissing }) {
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
        <CommentsInput initialStrengths={strengths} initialImprovements={improvements} onSave={onSave} onChange={onChange} highlightMissing={highlightMissing} />
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
  onOpenAssistant, highlightMissing, onEmployeeCommentsChange,
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
              status={highlightMissing && !evaluation.goalsHeadRank ? 'error' : undefined}
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
                    status={highlightMissing && !g.headGoalRank ? 'error' : undefined}
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
      <EmployeeReflectionBlock
        comments={evaluation.goalsEmployeeComments}
        sectionName="Annual Goals"
        required
        onSave={onEmployeeCommentsChange}
      />
      <HeadCommentsBlock
        strengths={evaluation.goalsHeadCommentsStrengths}
        improvements={evaluation.goalsHeadCommentsImprovements}
        onSave={onCommentsChange}
        onChange={onCommentsLiveChange}
        show={showComments}
        highlightMissing={highlightMissing}
      />
    </Card>
  )
}

// Top-of-page summary: one row of every category's current head rank (read-only here -- it just
// mirrors whatever's set in that category's own card further down the page) plus the Annual Goals
// section's own rank, and a second row for the overall score, which IS editable right here (same
// `overallRankMut`/behavior as before, just surfaced at the top instead of buried in a Descriptions
// block). `onOverallRankChange` omitted means read-only (the employee's and org-rollup's views).
// `highlightMissing` reddens whichever category/goals/overall cells are still unset, after a
// failed submit attempt.
export function EvaluationScoreSummary({ evaluation, rankLabels, onOverallRankChange, highlightMissing }) {
  const missingOverallRank = !evaluation?.headOverallRank
  const hasGoals = (evaluation?.goalResults?.length ?? 0) > 0
  return (
    <Card size="small" title="Score Summary" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {orderedCategoryResults(evaluation.categoryResults).map((cat, idx) => {
          const color = categoryColor(idx)
          const isMissing = highlightMissing && !cat.headCategoryRank
          return (
            <div key={cat.categoryId} style={{
              flex: '1 1 140px', minWidth: 140, textAlign: 'center', borderRadius: 8, padding: '10px 14px',
              border: `1px solid ${isMissing ? '#ff4d4f' : color.accent}`, background: isMissing ? '#fff1f0' : color.tint,
            }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{cat.categoryName}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: cat.headCategoryRank ? color.accent : '#9ca3af' }}>
                {cat.headCategoryRank ? rankLabelText(rankLabels, cat.headCategoryRank) : 'Not yet rated'}
              </div>
            </div>
          )
        })}
        {hasGoals && (() => {
          const isMissing = highlightMissing && !evaluation.goalsHeadRank
          return (
            <div style={{
              flex: '1 1 140px', minWidth: 140, textAlign: 'center', borderRadius: 8, padding: '10px 14px',
              border: `1px solid ${isMissing ? '#ff4d4f' : GOAL_COLOR.accent}`, background: isMissing ? '#fff1f0' : GOAL_COLOR.tint,
            }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Annual Goals</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: evaluation.goalsHeadRank ? GOAL_COLOR.accent : '#9ca3af' }}>
                {evaluation.goalsHeadRank ? rankLabelText(rankLabels, evaluation.goalsHeadRank) : 'Not yet rated'}
              </div>
            </div>
          )
        })()}
      </div>
      <div style={{ borderTop: '1px solid #e8eef6', paddingTop: 16 }}>
        <div style={{
          textAlign: 'center', borderRadius: 8, padding: '14px 20px',
          border: `1px solid ${highlightMissing && missingOverallRank ? '#ff4d4f' : OVERALL_COLOR.accent}`,
          background: highlightMissing && missingOverallRank ? '#fff1f0' : OVERALL_COLOR.tint,
        }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Overall Score</div>
          {onOverallRankChange ? (
            <Select
              style={{ width: 280 }} placeholder="Select overall rank" value={evaluation.headOverallRank}
              status={highlightMissing && missingOverallRank ? 'error' : undefined}
              options={[1, 2, 3, 4, 5].map((r) => ({ value: r, label: rankLabelText(rankLabels, r) }))}
              onChange={onOverallRankChange}
            />
          ) : (
            <div style={{ fontSize: 22, fontWeight: 700, color: evaluation.headOverallRank ? OVERALL_COLOR.accent : '#9ca3af' }}>
              {evaluation.headOverallRank ? rankLabelText(rankLabels, evaluation.headOverallRank) : 'Not yet rated'}
            </div>
          )}
        </div>
      </div>
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
 * Decision aid for the head while rating a criterion/goal. The head clicks rubric words that
 * describe the achievement evidence shown above; each column's words are worth a fixed weight
 * (1/3/5), and the running average is shown purely as a suggestion, with an explicit "Apply to
 * Rank" opt-in rather than silently overwriting the actual rank. Selections are saved to the
 * backend per (evaluation, criterion/goal) -- strictly private to this evaluation's own head (the
 * backend rejects anyone else) -- so they're available any time: a page refresh, a later login,
 * a different device, not just the current browser session.
 */
export function RatingAssistantModal({ open, onClose, evaluationId, targetType, targetId, title, rubric, entries, onApplyToRank }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState(new Set())
  const [history, setHistory] = useState([])
  const hasTarget = !!evaluationId && !!targetType && !!targetId
  const queryKey = ['rating-assistant-selection', evaluationId, targetType, targetId]

  const { data: savedSelection, isFetched } = useQuery({
    queryKey,
    queryFn: () => getRatingAssistantSelection(evaluationId, targetType, targetId),
    enabled: open && hasTarget,
  })

  // Guards against a real race: the load effect below and the persist effect further down both
  // depend on `isFetched`, so the instant a fetch resolves, BOTH fire in the same commit -- but
  // the persist effect would still see the pre-load `history` (still the old/empty value, since
  // the load effect's setHistory() hasn't been applied to a new render yet). Without this flag,
  // that means every fresh load is immediately followed by a save of stale/empty data, which can
  // reach the server after the correct save and silently erase it. This ref marks "the next
  // `history` change is us applying a load, not a real edit" so the persist effect skips exactly
  // that one turn.
  const justLoadedRef = useRef(false)

  // Loads whatever was saved for this criterion/goal (if anything) instead of always starting blank.
  useEffect(() => {
    if (!open || !isFetched) return
    const loaded = savedSelection?.selectionHistory ?? []
    justLoadedRef.current = true
    setSelected(new Set(loaded))
    setHistory(loaded)
  }, [open, isFetched, savedSelection])

  const saveMut = useMutation({
    mutationFn: (h) => saveRatingAssistantSelection(evaluationId, targetType, targetId, h),
  })

  // Persists the live selection to the backend on every real change. Also patches the GET query's
  // own cache to match immediately -- without this, closing and reopening the same criterion
  // later in the same session would re-read the stale pre-save cached response and silently wipe
  // out what was just saved.
  useEffect(() => {
    if (!open || !hasTarget || !isFetched) return
    if (justLoadedRef.current) {
      justLoadedRef.current = false
      return
    }
    qc.setQueryData(queryKey, { selectionHistory: history })
    saveMut.mutate(history)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, open, hasTarget, isFetched])

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
    <Modal
      title={`Rating Assistant -- ${title || ''}`} open={open} onCancel={onClose} width={900} destroyOnClose
      style={{ top: 12 }}
      styles={{ body: { maxHeight: 'max(160px, calc(100vh - 380px))', overflowY: 'auto', paddingRight: 8 } }}
      footer={
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Suggested Score:</Text>
            <Text strong style={{ fontSize: 28, color: '#cf1322', lineHeight: 1 }}>
              {average !== null ? average.toFixed(1) : '—'}
            </Text>
          </div>
          <Alert type="warning" showIcon style={{ marginBottom: 12 }}
            message="This score is generated to help the evaluator assess the evaluation level of this criterion/goal, and may not necessarily reflect the score the employee would or should get." />
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={clearLast} disabled={history.length === 0}>Clear Last Selection</Button>
            <Button onClick={clearAll} disabled={selected.size === 0}>Clear All</Button>
            {onApplyToRank && (
              <Button type="primary" disabled={roundedScore === null} onClick={() => onApplyToRank(roundedScore)}>
                Apply {roundedScore ?? ''} to Rank
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </Space>
        </div>
      }
    >
      <Text strong style={{ display: 'block', marginBottom: 4 }}>Achievement Summary</Text>
      <AchievementList entries={entries || []} emptyText="No achievements tagged" color={ASSISTANT_NEUTRAL_COLOR} />

      <Text type="secondary" style={{ display: 'block', margin: '12px 0' }}>
        Click the words in the rubric columns below that best describe the achievement level shown above. Skip
        words that don't carry meaning (prepositions, articles, etc.) -- they shouldn't affect the score.
      </Text>

      <Row gutter={12}>
        {RUBRIC_COLUMNS.map((col) => (
          <Col span={8} key={col.key}>
            <div style={{ background: col.tint, borderRadius: 6, padding: 10, minHeight: 100 }}>
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
    </Modal>
  )
}

// Head-only viewer button for a Criteria Info Tool (e.g. Central Repository Viewer showing Early
// Alert data) -- never rendered on the employee's own AnnualEvaluationPage, only on the head's
// Team Evaluations and the read-only Org Evaluations rollup. The actual data endpoints are
// server-side gated against the evaluation's own employee regardless (see
// PermissionService.assertCanUseCriteriaInfoTool), so this button existing is not itself the
// security boundary -- just keeps the employee from seeing it in the first place.
export function CriteriaInfoToolButton({ evaluationId, criteriaId, repositorySourceType, displayName }) {
  const [open, setOpen] = useState(false)
  const [selectedTerms, setSelectedTerms] = useState([])
  const [details, setDetails] = useState(null)

  const { data: options = [], isLoading: optionsLoading } = useQuery({
    queryKey: ['info-tool-options', evaluationId, criteriaId, repositorySourceType],
    queryFn: () => getInfoToolOptions(evaluationId, criteriaId, repositorySourceType),
    enabled: open,
  })

  const detailsMut = useMutation({
    mutationFn: () => getInfoToolDetails(evaluationId, criteriaId, repositorySourceType, selectedTerms),
    onSuccess: (text) => setDetails(text),
    onError: (err) => message.error(err.response?.data?.message || 'Failed to load details'),
  })

  return (
    <>
      <Button size="small" onClick={() => { setOpen(true); setSelectedTerms([]); setDetails(null) }}>
        {displayName}
      </Button>
      <Modal title={displayName} open={open} onCancel={() => setOpen(false)} footer={null} width={640} destroyOnClose>
        {optionsLoading ? (
          <Text type="secondary">Loading available terms…</Text>
        ) : options.length === 0 ? (
          <Text type="secondary">No data available for this employee.</Text>
        ) : (
          <>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Select term(s):</Text>
            <Checkbox.Group
              options={options.map((o) => ({ value: o.key, label: o.label }))}
              value={selectedTerms}
              onChange={setSelectedTerms}
              style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}
            />
            <Button type="primary" disabled={selectedTerms.length === 0} loading={detailsMut.isPending}
              onClick={() => detailsMut.mutate()} style={{ marginBottom: 12, background: '#13223a' }}>
              View
            </Button>
          </>
        )}
        {details != null && (
          <Paragraph style={{
            whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto',
            background: '#f5f7fb', padding: 12, borderRadius: 4, marginBottom: 0,
          }}>
            {details}
          </Paragraph>
        )}
      </Modal>
    </>
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

// h/m/s breakdown of a duration in seconds -- drops to "Xm Ys" once under an hour and "Ys" once
// under a minute, but stays readable ("2h 5m") for the multi-hour waits a slow local/CPU-only
// model can genuinely take (generation runs fully in the background, so there's no cap on this).
function formatHMS(diffSec) {
  const h = Math.floor(diffSec / 3600)
  const m = Math.floor((diffSec % 3600) / 60)
  const s = diffSec % 60
  if (h > 0) return `${h}h ${m}m`
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// Time since `sinceIso` -- same style used for AI-generation waiting elsewhere in the app
// (GoalSettingPage, SwotLandingPage): shows "submitted at X, Y elapsed" while generation is still
// in flight, so waiting looks different from stuck.
export function formatElapsed(sinceIso) {
  if (!sinceIso) return null
  return formatHMS(Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000)))
}

// Fixed duration between two timestamps -- shown once generation completes, so the help text can
// say how long the last AI request actually took (not just that it's done).
export function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null
  return formatHMS(Math.max(0, Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000)))
}

// Button + modal for the "Teaching Evaluations" customizable achievement module (see
// CustomizableAchievementModule / TeachingEvaluationSessionService) -- only rendered when this
// criterion actually has the module assigned (checked by the caller via achievementModuleCodes).
// Employee uploads their course-evaluation files (parsed server-side to plain text); AI drafting
// runs in the background on the server, so closing this modal and coming back later loses nothing
// -- the uploaded files, extracted text, and once-ready draft are all persisted on the session.
// Generating the AI review is required before saving: the review itself is shown read-only (it
// becomes part of the permanent record, not something the employee edits), and the employee adds
// their own required reflection underneath it before finalizing into a normal achievement tagged
// to this criterion.
export function TeachingEvaluationsModal({
  evaluationId, evaluation, criteriaId, buttonLabel, onAfterSave, limitReached, maxAchievementsPerYear,
}) {
  const { defaultHeadTitleLabel, academicYearLabel } = useTerminology()
  const [open, setOpen] = useState(false)
  const [fileList, setFileList] = useState([])
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: session } = useQuery({
    queryKey: ['teaching-eval-session', evaluationId, criteriaId],
    queryFn: () => getTeachingEvaluationSession(evaluationId, criteriaId),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  })

  const { data: achievementTypes = [] } = useQuery({
    queryKey: ['achievement-types'],
    queryFn: getAchievementTypes,
    enabled: open,
  })

  const { data: myCycles = [] } = useQuery({
    queryKey: ['my-goal-cycles', evaluation?.academicYearId],
    queryFn: () => getMyCycles(evaluation.academicYearId),
    enabled: open && !!evaluation?.academicYearId,
  })
  const deployedCycle = myCycles.find((c) => c.state === 'DEPLOYED')
  const { data: myGoals = [] } = useQuery({
    queryKey: ['my-deployed-goals-for-teaching-eval', deployedCycle?.id],
    queryFn: () => getCycleGoals(deployedCycle.id),
    enabled: open && !!deployedCycle,
  })

  const invalidateSession = () => qc.invalidateQueries({ queryKey: ['teaching-eval-session', evaluationId, criteriaId] })

  const noteMut = useMutation({
    mutationFn: (note) => updateTeachingEvaluationNote(evaluationId, session.id, note),
    onSuccess: invalidateSession,
  })
  const uploadMut = useMutation({
    mutationFn: (files) => uploadTeachingEvaluationFiles(evaluationId, session.id, files),
    onSuccess: () => { invalidateSession(); setFileList([]); message.success('Files processed') },
    onError: (err) => message.error(err.response?.data?.message || 'Could not process files'),
  })
  const generateMut = useMutation({
    mutationFn: () => generateTeachingEvaluationDraft(evaluationId, session.id),
    onSuccess: () => { message.success('Generating draft -- this can take a minute or two'); invalidateSession() },
    onError: (err) => message.error(err.response?.data?.message || 'Could not start generation'),
  })
  const finalizeMut = useMutation({
    mutationFn: (values) => finalizeTeachingEvaluationAchievement(evaluationId, session.id, values),
    onSuccess: () => {
      message.success('Achievement recorded')
      setOpen(false)
      form.resetFields()
      setFileList([])
      onAfterSave?.()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not save achievement'),
  })
  const startOverMut = useMutation({
    mutationFn: () => deleteTeachingEvaluationSession(evaluationId, session.id),
    onSuccess: () => { setOpen(false); form.resetFields(); setFileList([]) },
    onError: (err) => message.error(err.response?.data?.message || 'Could not reset'),
  })

  const generating = !!session?.generationRequestedAt && !session?.generationFailureReason
    && (!session?.generatedAt || new Date(session.generatedAt) < new Date(session.generationRequestedAt))

  // Forces a re-render every second so the "elapsed" clock ticks while generation is running,
  // independent of the 5s session poll -- same pattern as GoalSettingPage/SwotLandingPage.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!generating) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [generating])

  // Saving requires a completed, current AI review -- re-uploading files clears draftDetails on
  // the server (see TeachingEvaluationSessionService.uploadFiles), so this alone also covers "you
  // added more files, regenerate before you can save."
  const hasReadyDraft = !!session?.draftDetails

  // Title and Type are fixed conventions for this module, not free entry -- every achievement
  // recorded here is named "<period> Students' Course Evaluations" and typed "Course Evaluation",
  // so both fields are shown read-only (pre-filled into the form so they're still submitted).
  const courseEvaluationType = achievementTypes.find((t) => t.systemCode === 'COURSE_EVALUATION')
  const fixedTitle = evaluation?.academicYearName ? `${evaluation.academicYearName} Students' Course Evaluations` : ''
  useEffect(() => {
    if (open && fixedTitle) {
      form.setFieldsValue({ title: fixedTitle })
    }
  }, [open, fixedTitle]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && courseEvaluationType) {
      form.setFieldsValue({ achievementTypeId: courseEvaluationType.id })
    }
  }, [open, courseEvaluationType?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Button
        icon={<BulbOutlined />} disabled={limitReached} onClick={() => setOpen(true)}
        title={limitReached
          ? `You've already recorded the maximum of ${maxAchievementsPerYear} achievement${maxAchievementsPerYear === 1 ? '' : 's'} for this criterion this ${academicYearLabel.toLowerCase()}`
          : undefined}
      >
        {buttonLabel}
      </Button>
      <Modal
        title={buttonLabel}
        open={open}
        onCancel={() => setOpen(false)}
        destroyOnClose
        width={720}
        footer={[
          <Popconfirm key="reset" title="Start over?" description="This clears any uploaded files and draft for this criterion."
            onConfirm={() => startOverMut.mutate()}>
            <Button danger loading={startOverMut.isPending}>Start Over</Button>
          </Popconfirm>,
          <Button key="cancel" onClick={() => setOpen(false)}>Cancel</Button>,
          <Button key="save" type="primary" disabled={!hasReadyDraft} loading={finalizeMut.isPending} onClick={() => form.submit()}
            title={!hasReadyDraft ? 'Generate the AI draft (Step 2) before you can save' : undefined}>
            Save Achievement
          </Button>,
        ]}
      >
        {session && (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message="You can close this window any time and come back later"
              description="Your uploaded files and generated draft are saved on the server -- you don't need to wait here while the AI works. Reopen this same criterion later and pick up where you left off; the Save Achievement button unlocks once your draft is ready." />

            <Card size="small" title="1. Upload Your Course Evaluations" style={{ marginBottom: 16 }}>
              <Input
                placeholder="Local folder path (a reference note for you only -- never read by the system)"
                defaultValue={session.localFolderNote}
                onBlur={(e) => noteMut.mutate(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <Upload
                multiple beforeUpload={() => false} accept=".pdf,.docx,.txt"
                fileList={fileList}
                onChange={({ fileList: fl }) => setFileList(fl)}
              >
                <Button icon={<UploadOutlined />}>Select Files (.pdf, .docx, .txt)</Button>
              </Upload>
              <Button
                style={{ marginTop: 8 }} disabled={fileList.length === 0} loading={uploadMut.isPending}
                onClick={() => uploadMut.mutate(fileList.map((f) => f.originFileObj).filter(Boolean))}
              >
                Upload &amp; Extract Text
              </Button>
              {session.uploadedFileNames && (
                <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
                  Processed so far: {session.uploadedFileNames}
                </Paragraph>
              )}
            </Card>

            <Card size="small" title="2. Generate AI Draft (required before saving)" style={{ marginBottom: 16 }}>
              {!generating && !session.generationFailureReason && (
                <Button icon={<BulbOutlined />} disabled={!session.uploadedFileNames} loading={generateMut.isPending}
                  onClick={() => generateMut.mutate()}>
                  {hasReadyDraft ? 'Regenerate AI Draft' : 'Generate AI Draft'}
                </Button>
              )}
              {(generating || session.generationFailureReason) && (
                <div>
                  {session.generationFailureReason ? (
                    <Alert type="error" showIcon style={{ marginBottom: 8 }}
                      message="AI generation failed" description={session.generationFailureReason} />
                  ) : (
                    <div style={{ color: '#6b7280', marginBottom: 8 }}>
                      AI is drafting from your uploaded files -- it's safe to close this window and come back later.
                      This checks automatically and will show the draft once ready.
                      {session.generationRequestedAt && (
                        <>
                          {' '}Submitted at {new Date(session.generationRequestedAt).toLocaleTimeString()}
                          {' — '}{formatElapsed(session.generationRequestedAt)} elapsed.
                        </>
                      )}
                    </div>
                  )}
                  <Button loading={generateMut.isPending} onClick={() => generateMut.mutate()}>
                    {session.generationFailureReason ? 'Retry Generation' : 'Cancel & Retry Generation'}
                  </Button>
                </div>
              )}
            </Card>

            <Card size="small" title="3. Review &amp; Save">
              {hasReadyDraft ? (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>Generated AI Review</Text>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
                    This becomes part of the permanent record and can't be edited -- if something's wrong, upload
                    corrected files and regenerate above.
                    {session.generationRequestedAt && session.generatedAt && (
                      <> Generated in {formatDuration(session.generationRequestedAt, session.generatedAt)}
                        {' '}(ready at {new Date(session.generatedAt).toLocaleTimeString()}).</>
                    )}
                  </Text>
                  <div style={{
                    background: '#fafafa', border: '1px solid #e8eef6', borderRadius: 6, padding: 12,
                    whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 280, overflowY: 'auto',
                  }}>
                    {session.draftDetails}
                  </div>
                </div>
              ) : (
                <Alert type="warning" showIcon style={{ marginBottom: 16 }}
                  message="Generate the AI draft above (Step 2) before you can review and save this achievement." />
              )}
              <Form form={form} layout="vertical" onFinish={(values) => finalizeMut.mutate(values)}>
                <Form.Item name="title" label="Title" rules={[{ required: true }]}>
                  <Input disabled />
                </Form.Item>
                <Form.Item name="achievementTypeId" label="Type" rules={[{ required: true }]}>
                  <Select disabled options={achievementTypes.map((t) => ({ value: t.id, label: t.name }))} />
                </Form.Item>
                <Form.Item name="reflection" label="Your Reflection" rules={[{ required: true, message: 'Add your reflection before saving' }]}
                  extra="Your own comments on these student evaluations and on the AI-generated review above.">
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Form.Item name="privateNotes" label="Private Notes" extra="Only visible to you">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item name="goalId" label="Related Annual Goal (Optional)">
                  <Select allowClear placeholder="None" options={myGoals.map((g) => ({ value: g.id, label: g.goalTitle }))} />
                </Form.Item>
                <Form.Item name="categoryRating" label="Self-Assessment Rating (Optional)">
                  <Rate />
                </Form.Item>
                <Form.Item name="evidenceUrl" label="Evidence/Link" rules={[{ required: true, message: 'Evidence/Link is required' }]}
                  extra={`Upload ALL your course evaluation files for this ${academicYearLabel.toLowerCase()} to your own cloud storage (Google Drive, OneDrive, etc.), make sure it is open to your ${(evaluation?.headTitle ?? defaultHeadTitleLabel).toLowerCase()}, and paste that link here.`}>
                  <Input placeholder="https://..." />
                </Form.Item>
              </Form>
            </Card>
          </>
        )}
      </Modal>
    </>
  )
}
