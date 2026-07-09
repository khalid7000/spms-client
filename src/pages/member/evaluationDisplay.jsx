// Shared display helpers for Annual Evaluation views (head's Team Evaluations page and the
// read-only Organization Evaluations rollup) -- kept in one place so both pages render
// categories/goals/achievements with the same color language instead of drifting apart.
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Col, Input, Modal, Popover, Row, Select, Space, Tag, Typography } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

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
// the head is still typing their remarks. Shared by category and goal head-comments fields.
export function CommentsInput({ initialValue, onSave }) {
  const [value, setValue] = useState(initialValue || '')
  useEffect(() => { setValue(initialValue || '') }, [initialValue])
  return (
    <Input.TextArea
      rows={2} value={value}
      placeholder="Required: your comments"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (value !== (initialValue || '')) onSave(value) }}
    />
  )
}

// The head's written comments for a category/goal -- editable (required, flagged red until
// filled in) when `onSave` is provided, otherwise a read-only paragraph (or nothing, if `show`
// is false -- e.g. the employee's own page hides this while still in DRAFT, before the head has
// even started rating).
export function HeadCommentsBlock({ comments, onSave, show = true }) {
  if (!show) {
    return null
  }
  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 4 }}>
        Head Comments {onSave && !comments?.trim() && <Tag color="red" style={{ marginLeft: 6 }}>Required</Tag>}
      </Text>
      {onSave ? (
        <CommentsInput initialValue={comments} onSave={onSave} />
      ) : (
        <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
          {comments || <Text type="secondary">No comments</Text>}
        </Paragraph>
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
  evaluation, rankLabels, canEdit, onRankChange, onSelfRankChange, onHeadRankChange, onNothingToReportChange, onCommentsChange, showComments = true,
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
      <HeadCommentsBlock comments={evaluation.goalsHeadComments} onSave={onCommentsChange} show={showComments} />
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
