import { useEffect, useState } from 'react'
import { Card, Radio, Input, Button, Space, message, Popconfirm, Spin, Typography, Divider, Tag, Alert, Form, Modal } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSwotFinalizationSummary, saveSwotFinalDecisions, submitSwotFinalization,
  proposeSwotGoalAddition, deleteSwotGoalAddition,
} from '../../../api/swot'
import { useAuth } from '../../../auth/AuthContext'

const { Paragraph, Text } = Typography

const ACTIONS = [
  { value: 'REJECT', label: 'Reject' },
  { value: 'APPROVE_AS_IS', label: 'Approve as-is' },
  { value: 'APPROVE_WITH_EDITS', label: 'Approve with edits' },
]

const ACTION_LABELS = {
  REJECT: 'Reject',
  APPROVE_AS_IS: 'Approve as-is',
  APPROVE_WITH_EDITS: 'Approve with edits',
  PROPOSE_ALTERNATIVE: 'Prefers alternative',
}

// finalize()'s validation errors (thrown when a required AREA/GOAL decision is still missing)
// name the exact area or goal by its title — matched back against `summary.suggestions` here so
// the UI can point at the precise card, not just show the same text the popup already has. Note
// this is a different message format from the Editor review page's submitFullReview errors.
function findMissingTarget(errorMessage, suggestions) {
  if (!errorMessage) return null
  let m = errorMessage.match(/^A final decision is required for area "(.+)"$/)
  if (m) {
    const area = suggestions.find((a) => a.name === m[1])
    if (area) return { type: 'AREA', id: area.id }
  }
  m = errorMessage.match(/^A final decision is required for goal "(.+)"$/)
  if (m) {
    for (const area of suggestions) {
      const goal = area.goals?.find((g) => g.title === m[1])
      if (goal) return { type: 'GOAL', id: goal.id }
    }
  }
  return null
}

// Shows each Editor's actual submitted verdict (their edited title/description when they have
// one) with a one-click "Use this" that adopts their exact text as the owner's starting point —
// the owner can still tweak it afterward via FinalDecisionControl below.
function ReviewerVerdicts({ items, onUse }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <Text strong style={{ fontSize: 12, color: '#6b7280' }}>Editor reviews</Text>
      {items.map((i) => (
        <div key={i.id} style={{
          marginTop: 6, padding: '6px 10px', background: '#f8faff',
          borderRadius: 4, border: '1px solid #e8eef6',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>
              <b>{i.reviewerName}</b>: {ACTION_LABELS[i.actionType] ?? i.actionType}
            </span>
            {i.actionType !== 'PROPOSE_ALTERNATIVE' && (
              <Button size="small" onClick={() => onUse(i)}>Use this</Button>
            )}
          </div>
          {i.actionType === 'APPROVE_WITH_EDITS' && (
            <div style={{ marginTop: 4, fontSize: 12 }}>
              <div style={{ fontWeight: 500 }}>{i.editedTitle}</div>
              {i.editedDescription && <div style={{ color: '#6b7280' }}>{i.editedDescription}</div>}
            </div>
          )}
          {i.actionType === 'PROPOSE_ALTERNATIVE' && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
              Prefers a different area — see their proposal under "Team-proposed alternative areas" below.
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function FinalDecisionControl({ targetType, targetId, defaultTitle, defaultDescription, draft, onSave }) {
  const current = draft || {}
  const [title, setTitle] = useState(current.editedTitle ?? defaultTitle)
  const [description, setDescription] = useState(current.editedDescription ?? defaultDescription)

  useEffect(() => {
    setTitle(current.editedTitle ?? defaultTitle)
    setDescription(current.editedDescription ?? defaultDescription)
    // Also re-syncs on editedTitle/editedDescription changing alone (not just actionType) — needed
    // so clicking "Use this" on a different Editor's suggestion refreshes the inputs even when both
    // suggestions happen to share the same actionType (e.g. two APPROVE_WITH_EDITS in a row).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.actionType, current.editedTitle, current.editedDescription])

  return (
    <div style={{ marginTop: 8 }}>
      <Radio.Group
        size="small"
        value={current.actionType}
        options={ACTIONS}
        optionType="button"
        onChange={(e) => onSave(targetType, targetId, { actionType: e.target.value, editedTitle: title, editedDescription: description })}
      />
      {current.actionType === 'APPROVE_WITH_EDITS' && (
        <div style={{ marginTop: 8, maxWidth: 480 }}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => onSave(targetType, targetId, { actionType: current.actionType, editedTitle: title, editedDescription: description })}
            placeholder="Final title"
            style={{ marginBottom: 6 }}
          />
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => onSave(targetType, targetId, { actionType: current.actionType, editedTitle: title, editedDescription: description })}
            rows={2}
            placeholder="Final description"
          />
        </div>
      )}
    </div>
  )
}

export default function SwotFinalizationPage() {
  const { strategyId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [drafts, setDrafts] = useState({})
  // Which area's "Add a Goal" modal is open, if any — null means closed.
  const [goalModalAreaId, setGoalModalAreaId] = useState(null)
  const [goalForm] = Form.useForm()
  // The specific area/goal a failed "Finalize" pointed at — { type: 'AREA'|'GOAL', id } or null.
  const [missingTarget, setMissingTarget] = useState(null)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['swot-finalization-summary', strategyId],
    queryFn: () => getSwotFinalizationSummary(strategyId),
  })

  useEffect(() => {
    if (!summary) return
    const map = {}
    for (const item of summary.ownerFinalDecisions || []) {
      map[`${item.targetType}:${item.targetId}`] = item
    }
    setDrafts(map)
  }, [summary])

  // Jump to whichever card a failed finalize attempt pointed at, so the owner isn't left hunting for it.
  useEffect(() => {
    if (!missingTarget) return
    const el = document.getElementById(`${missingTarget.type.toLowerCase()}-${missingTarget.id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [missingTarget])

  const saveMut = useMutation({
    mutationFn: (decision) => saveSwotFinalDecisions(strategyId, [decision]),
    onError: (err) => message.error(err.response?.data?.message || 'Could not save decision'),
  })

  const handleSave = (targetType, targetId, payload) => {
    setDrafts((prev) => ({ ...prev, [`${targetType}:${targetId}`]: payload }))
    saveMut.mutate({ targetType, targetId, ...payload })
    // A decision was just made for this target — if it was the one flagged as missing, clear the highlight.
    setMissingTarget((prev) => (prev && prev.type === targetType && prev.id === targetId ? null : prev))
  }

  // The owner's own additions are already their final call — no separate review step exists for
  // them the way there is for Editor proposals, so default straight to APPROVE_AS_IS on creation.
  // The decision save is awaited *before* invalidating the summary query, so the refetch (which
  // rebuilds `drafts` from scratch) always sees it — otherwise a refetch landing between the two
  // calls would show the new goal with no decision selected yet.
  const proposeGoalMut = useMutation({
    mutationFn: async ({ areaId, values }) => {
      const created = await proposeSwotGoalAddition(strategyId, areaId, values)
      await saveMut.mutateAsync({ targetType: 'GOAL_ADDITION', targetId: created.id, actionType: 'APPROVE_AS_IS' })
    },
    onSuccess: () => {
      message.success('Goal added')
      setGoalModalAreaId(null)
      goalForm.resetFields()
      qc.invalidateQueries({ queryKey: ['swot-finalization-summary', strategyId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not add goal'),
  })

  const deleteGoalAdditionMut = useMutation({
    mutationFn: (id) => deleteSwotGoalAddition(strategyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swot-finalization-summary', strategyId] }),
    onError: (err) => message.error(err.response?.data?.message || 'Could not remove goal'),
  })

  const finalizeMut = useMutation({
    mutationFn: () => submitSwotFinalization(strategyId),
    onSuccess: () => {
      setMissingTarget(null)
      message.success('Draft strategy created')
      qc.invalidateQueries({ queryKey: ['strategy', strategyId] })
      navigate(`/strategies/${strategyId}`)
    },
    onError: (err) => {
      const msg = err.response?.data?.message
      message.error(msg || 'Finalization failed')
      // In addition to the popup, jump to and highlight the exact card still needing a decision.
      setMissingTarget(findMissingTarget(msg, summary?.suggestions || []))
    },
  })

  if (isLoading || !summary) {
    return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  const verdictsFor = (targetType, targetId) =>
    (summary.reviewItems || []).filter((i) => i.targetType === targetType && i.targetId === targetId)

  // Adopts a specific Editor's verdict (their exact edited text, when they have one) as the
  // owner's current draft — falls back to the AI's original title/description for REJECT /
  // APPROVE_AS_IS, since those reviewers didn't submit their own text.
  const useReviewerVersion = (targetType, targetId, item, fallbackTitle, fallbackDescription) => {
    handleSave(targetType, targetId, {
      actionType: item.actionType,
      editedTitle: item.editedTitle ?? fallbackTitle,
      editedDescription: item.editedDescription ?? fallbackDescription,
    })
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <Button type="text" icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/strategies/${strategyId}/swot`)}
        style={{ marginBottom: 16, color: '#6b7280' }}>
        Back to SWOT Overview
      </Button>

      <Paragraph>
        As owner, you make the final call on every suggested (and proposed alternative) area and goal.
        Each Editor's review is shown below the original AI suggestion — click "Use this" to adopt
        one of their versions as your starting point, then edit it further if you like.
      </Paragraph>
      {/* Every decision below is saved to the server as soon as you make it (saveSwotFinalDecisions
          fires immediately, not just on final submit) — this makes that behavior visible so the
          owner knows it's safe to leave mid-review and pick up later. */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Your progress saves automatically"
        description={'Each decision you make below is saved right away. Feel free to close this page and come back later — nothing is final until you click "Finalize & Create Draft Strategy" below.'}
      />

      {(summary.suggestions || []).map((area) => {
        const areaDraft = drafts[`AREA:${area.id}`]
        const areaRejected = areaDraft?.actionType === 'REJECT'
        const areaMissing = missingTarget?.type === 'AREA' && missingTarget.id === area.id
        return (
          <Card
            key={area.id}
            id={`area-${area.id}`}
            style={{
              marginBottom: 16,
              ...(areaMissing ? { border: '2px solid #ff4d4f', boxShadow: '0 0 0 2px rgba(255,77,79,0.15)' } : {}),
            }}
            title={area.name}
          >
            <Paragraph type="secondary">{area.rationale}</Paragraph>
            {areaMissing && (
              <Text type="danger" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                ⚠ This area still needs a final decision before you can finalize
              </Text>
            )}
            <ReviewerVerdicts
              items={verdictsFor('AREA', area.id)}
              onUse={(item) => useReviewerVersion('AREA', area.id, item, area.name, area.rationale)}
            />
            <FinalDecisionControl
              targetType="AREA" targetId={area.id}
              defaultTitle={area.name} defaultDescription={area.rationale}
              draft={areaDraft} onSave={handleSave}
            />

            {!areaRejected && (
              <>
                {area.goals?.length > 0 && (
                  <>
                    <Divider style={{ margin: '16px 0' }} />
                    <Text strong style={{ fontSize: 13 }}>Goals</Text>
                    {area.goals.map((goal) => {
                      const goalMissing = missingTarget?.type === 'GOAL' && missingTarget.id === goal.id
                      return (
                      <div
                        key={goal.id}
                        id={`goal-${goal.id}`}
                        style={{
                          marginTop: 12, paddingLeft: 12,
                          borderLeft: goalMissing ? '2px solid #ff4d4f' : '2px solid #e8eef6',
                          ...(goalMissing ? { background: '#fff1f0', borderRadius: 4, paddingTop: 8, paddingBottom: 8, paddingRight: 8 } : {}),
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>{goal.title}</div>
                        <Paragraph type="secondary" style={{ marginBottom: 0 }}>{goal.description}</Paragraph>
                        {goalMissing && (
                          <Text type="danger" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                            ⚠ This goal still needs a final decision before you can finalize
                          </Text>
                        )}
                        <ReviewerVerdicts
                          items={verdictsFor('GOAL', goal.id)}
                          onUse={(item) => useReviewerVersion('GOAL', goal.id, item, goal.title, goal.description)}
                        />
                        <FinalDecisionControl
                          targetType="GOAL" targetId={goal.id}
                          defaultTitle={goal.title} defaultDescription={goal.description}
                          draft={drafts[`GOAL:${goal.id}`]} onSave={handleSave}
                        />
                      </div>
                      )
                    })}
                  </>
                )}

                {/* Goals proposed by an Editor (or the owner themselves) under this area, alongside
                    the AI's own goals — each gets its own final decision, same as any other goal. */}
                {(summary.goalAdditions || []).filter((g) => g.swotSuggestionId === area.id).map((g) => (
                  <div key={g.id} style={{ marginTop: 12, paddingLeft: 12, borderLeft: '2px solid #c9a24b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontWeight: 500 }}>
                        {g.title} <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>— proposed by {g.proposedByName}</Text>
                      </div>
                      {/* Only the proposer can delete (enforced server-side too) — for an Editor's
                          proposal, reject it via the decision control below instead. */}
                      {g.proposedById === user?.userId && (
                        <Button type="text" danger size="small" icon={<DeleteOutlined />}
                          onClick={() => deleteGoalAdditionMut.mutate(g.id)} />
                      )}
                    </div>
                    {g.description && <Paragraph type="secondary" style={{ marginBottom: 0 }}>{g.description}</Paragraph>}
                    <FinalDecisionControl
                      targetType="GOAL_ADDITION" targetId={g.id}
                      defaultTitle={g.title} defaultDescription={g.description}
                      draft={drafts[`GOAL_ADDITION:${g.id}`]} onSave={handleSave}
                    />
                  </div>
                ))}

                <Button
                  type="dashed" size="small" icon={<PlusOutlined />}
                  style={{ marginTop: 12 }}
                  onClick={() => setGoalModalAreaId(area.id)}
                >
                  Add a Goal to this Area
                </Button>
              </>
            )}
          </Card>
        )
      })}

      {(summary.alternatives || []).length > 0 && (
        <>
          <Divider>Team-proposed alternative areas (optional)</Divider>
          {summary.alternatives.map((alt) => {
            const altDraft = drafts[`ALTERNATIVE_AREA:${alt.id}`]
            const altRejected = !altDraft || altDraft.actionType === 'REJECT'
            return (
              <Card key={alt.id} style={{ marginBottom: 16 }}
                title={<>{alt.name} <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>— proposed by {alt.proposedByName}</Text></>}>
                <Paragraph type="secondary">{alt.rationale}</Paragraph>
                <FinalDecisionControl
                  targetType="ALTERNATIVE_AREA" targetId={alt.id}
                  defaultTitle={alt.name} defaultDescription={alt.rationale}
                  draft={altDraft} onSave={handleSave}
                />
                {!altRejected && alt.goals?.length > 0 && (
                  <>
                    <Divider style={{ margin: '16px 0' }} />
                    {alt.goals.map((goal) => (
                      <div key={goal.id} style={{ marginTop: 12, paddingLeft: 12, borderLeft: '2px solid #e8eef6' }}>
                        <div style={{ fontWeight: 500 }}>{goal.title}</div>
                        <Paragraph type="secondary" style={{ marginBottom: 0 }}>{goal.description}</Paragraph>
                        <FinalDecisionControl
                          targetType="ALTERNATIVE_GOAL" targetId={goal.id}
                          defaultTitle={goal.title} defaultDescription={goal.description}
                          draft={drafts[`ALTERNATIVE_GOAL:${goal.id}`]} onSave={handleSave}
                        />
                      </div>
                    ))}
                  </>
                )}
              </Card>
            )
          })}
        </>
      )}

      <Space>
        <Popconfirm
          title="Finalize the draft strategy?"
          description="This creates real vision areas and goals from your decisions and completes the SWOT workflow."
          onConfirm={() => finalizeMut.mutate()}
        >
          <Button type="primary" loading={finalizeMut.isPending} style={{ background: '#13223a' }}>
            Finalize & Create Draft Strategy
          </Button>
        </Popconfirm>
        {/* Nothing left to actually save here — every decision above already persisted on selection.
            This just gives the owner an explicit, reassuring way to step away mid-review. */}
        <Button onClick={() => {
          message.success('Your progress is saved — come back anytime to finish')
          navigate(`/strategies/${strategyId}/swot`)
        }}>
          Save & Exit
        </Button>
      </Space>

      <Modal
        title="Add a Goal"
        open={goalModalAreaId != null}
        onCancel={() => setGoalModalAreaId(null)}
        onOk={() => goalForm.submit()}
        confirmLoading={proposeGoalMut.isPending}
        destroyOnClose
      >
        <Form form={goalForm} layout="vertical"
          onFinish={(values) => proposeGoalMut.mutate({ areaId: goalModalAreaId, values })}>
          <Form.Item name="title" label="Goal title" rules={[{ required: true, message: 'Title required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
