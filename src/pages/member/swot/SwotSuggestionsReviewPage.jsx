import { useEffect, useState } from 'react'
import {
  Card, Radio, Input, Button, Space, message, Popconfirm, List, Form, Modal, Spin, Typography, Divider, Alert,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSwotStatus, getSwotSuggestions, getMySwotReviewItems, submitSwotReviewItem,
  getSwotAlternatives, proposeSwotAlternative, deleteSwotAlternative, submitSwotReview,
  getSwotGoalAdditions, proposeSwotGoalAddition, deleteSwotGoalAddition,
} from '../../../api/swot'

const { Paragraph, Text } = Typography

const ACTIONS = [
  { value: 'REJECT', label: 'Reject' },
  { value: 'APPROVE_AS_IS', label: 'Approve as-is' },
  { value: 'APPROVE_WITH_EDITS', label: 'Approve with edits' },
  { value: 'PROPOSE_ALTERNATIVE', label: 'Prefer a different area' },
]

// submitFullReview's validation errors always end in "(missing: <name>)" and name either an area
// or a goal by its exact title — matched back against `suggestions` here so the UI can point at
// the precise card, not just show the same text the popup already has.
function findMissingTarget(errorMessage, suggestions) {
  if (!errorMessage) return null
  let m = errorMessage.match(/^You must review every suggested area before submitting \(missing: (.+)\)$/)
  if (m) {
    const area = suggestions.find((a) => a.name === m[1])
    if (area) return { type: 'AREA', id: area.id }
  }
  m = errorMessage.match(/^You must review every goal under ".+" before submitting \(missing: (.+)\)$/)
  if (m) {
    for (const area of suggestions) {
      const goal = area.goals?.find((g) => g.title === m[1])
      if (goal) return { type: 'GOAL', id: goal.id }
    }
  }
  return null
}

function ReviewControl({ targetType, targetId, defaultTitle, defaultDescription, draft, onSave }) {
  const current = draft || {}
  const [title, setTitle] = useState(current.editedTitle ?? defaultTitle)
  const [description, setDescription] = useState(current.editedDescription ?? defaultDescription)

  useEffect(() => {
    setTitle(current.editedTitle ?? defaultTitle)
    setDescription(current.editedDescription ?? defaultDescription)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.actionType])

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
            placeholder="Edited title"
            style={{ marginBottom: 6 }}
          />
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => onSave(targetType, targetId, { actionType: current.actionType, editedTitle: title, editedDescription: description })}
            rows={2}
            placeholder="Edited description"
          />
        </div>
      )}
      {current.actionType === 'PROPOSE_ALTERNATIVE' && (
        <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
          Use "Propose a Different Area" below to submit your alternative.
        </Text>
      )}
    </div>
  )
}

export default function SwotSuggestionsReviewPage() {
  const { strategyId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState({})
  const [altOpen, setAltOpen] = useState(false)
  const [altForm] = Form.useForm()
  // Which area's "Propose a Goal" modal is open, if any — null means closed.
  const [goalModalAreaId, setGoalModalAreaId] = useState(null)
  const [goalForm] = Form.useForm()
  // The specific area/goal a failed "Submit My Review" pointed at — { type: 'AREA'|'GOAL', id } or null.
  const [missingTarget, setMissingTarget] = useState(null)

  // The Owner doesn't do a peer review here — they get a read-only preview until every Editor has
  // submitted, then make the final call on the separate Finalization page. Everyone else gets the
  // normal interactive controls below.
  const { data: status } = useQuery({
    queryKey: ['swot-status', strategyId],
    queryFn: () => getSwotStatus(strategyId),
  })
  const isOwner = !!status?.owner

  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery({
    queryKey: ['swot-suggestions', strategyId],
    queryFn: () => getSwotSuggestions(strategyId),
  })
  const { data: myReviewItems = [] } = useQuery({
    queryKey: ['swot-my-review', strategyId],
    queryFn: () => getMySwotReviewItems(strategyId),
    enabled: !isOwner,
  })
  const { data: myAlternatives = [] } = useQuery({
    queryKey: ['swot-alternatives', strategyId],
    queryFn: () => getSwotAlternatives(strategyId),
    enabled: !isOwner,
  })
  // Own proposed goal additions, per area (getSwotGoalAdditions returns only mine for a non-owner caller).
  const { data: myGoalAdditions = [] } = useQuery({
    queryKey: ['swot-goal-additions', strategyId],
    queryFn: () => getSwotGoalAdditions(strategyId),
    enabled: !isOwner,
  })

  useEffect(() => {
    const map = {}
    for (const item of myReviewItems) {
      map[`${item.targetType}:${item.targetId}`] = item
    }
    setDrafts(map)
  }, [myReviewItems])

  // Jump to whichever card a failed submit pointed at, so the user isn't left hunting for it.
  useEffect(() => {
    if (!missingTarget) return
    const el = document.getElementById(`${missingTarget.type.toLowerCase()}-${missingTarget.id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [missingTarget])

  const saveMut = useMutation({
    mutationFn: ({ targetType, targetId, payload }) => submitSwotReviewItem(strategyId, targetType, targetId, payload),
    onError: (err) => message.error(err.response?.data?.message || 'Could not save review'),
  })

  const handleSave = (targetType, targetId, payload) => {
    setDrafts((prev) => ({ ...prev, [`${targetType}:${targetId}`]: payload }))
    saveMut.mutate({ targetType, targetId, payload })
    // A selection was just made for this target — if it was the one flagged as missing, clear the highlight.
    setMissingTarget((prev) => (prev && prev.type === targetType && prev.id === targetId ? null : prev))
  }

  const proposeMut = useMutation({
    mutationFn: (values) => proposeSwotAlternative(strategyId, values),
    onSuccess: () => {
      message.success('Alternative proposed')
      setAltOpen(false)
      altForm.resetFields()
      qc.invalidateQueries({ queryKey: ['swot-alternatives', strategyId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not propose alternative'),
  })

  const deleteAltMut = useMutation({
    mutationFn: (id) => deleteSwotAlternative(strategyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swot-alternatives', strategyId] }),
  })

  const proposeGoalMut = useMutation({
    mutationFn: ({ areaId, values }) => proposeSwotGoalAddition(strategyId, areaId, values),
    onSuccess: () => {
      message.success('Goal proposed')
      setGoalModalAreaId(null)
      goalForm.resetFields()
      qc.invalidateQueries({ queryKey: ['swot-goal-additions', strategyId] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Could not propose goal'),
  })

  const deleteGoalAdditionMut = useMutation({
    mutationFn: (id) => deleteSwotGoalAddition(strategyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swot-goal-additions', strategyId] }),
  })

  const submitReviewMut = useMutation({
    mutationFn: () => submitSwotReview(strategyId),
    onSuccess: () => { setMissingTarget(null); message.success('Review submitted'); navigate(`/strategies/${strategyId}/swot`) },
    onError: (err) => {
      const msg = err.response?.data?.message
      message.error(msg || 'Could not submit review')
      // In addition to the popup, jump to and highlight the exact card still needing a decision.
      setMissingTarget(findMissingTarget(msg, suggestions))
    },
  })

  if (loadingSuggestions) {
    return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <Button type="text" icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/strategies/${strategyId}/swot`)}
        style={{ marginBottom: 16, color: '#6b7280' }}>
        Back to SWOT Overview
      </Button>

      {isOwner ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Read-only preview"
          description="You're the strategy owner — this is a preview of what your Editors are reviewing. You'll make the final call yourself on the Finalization page once every Editor has submitted their review."
        />
      ) : (
        <>
          <Paragraph>
            AI generated these focus areas and goals from your team's top-voted SWOT words. For each area
            and goal, choose whether to reject it, approve it (with or without edits), or propose a different
            area instead.
          </Paragraph>
          {/* Every selection above is saved to the server as soon as you make it (submitSwotReviewItem
              fires immediately, not just on final submit) — this just makes that behavior visible so
              users know it's safe to leave mid-review and pick up later. */}
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Your progress saves automatically"
            description={'Each choice you make above is saved right away. Feel free to close this page and come back later — nothing is final until you click "Submit My Review" below.'}
          />
        </>
      )}

      {suggestions.map((area) => {
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
                ⚠ This area still needs a decision before you can submit
              </Text>
            )}
            {!isOwner && (
              <ReviewControl
                targetType="AREA"
                targetId={area.id}
                defaultTitle={area.name}
                defaultDescription={area.rationale}
                draft={areaDraft}
                onSave={handleSave}
              />
            )}

            {(isOwner || !areaRejected) && (area.goals?.length > 0 || !isOwner) && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text strong style={{ fontSize: 13 }}>Goals</Text>
                {area.goals?.map((goal) => {
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
                        ⚠ This goal still needs a decision before you can submit
                      </Text>
                    )}
                    {!isOwner && (
                      <ReviewControl
                        targetType="GOAL"
                        targetId={goal.id}
                        defaultTitle={goal.title}
                        defaultDescription={goal.description}
                        draft={drafts[`GOAL:${goal.id}`]}
                        onSave={handleSave}
                      />
                    )}
                  </div>
                  )
                })}

                {!isOwner && (
                  <>
                    {myGoalAdditions.filter((g) => g.swotSuggestionId === area.id).map((g) => (
                      <div key={g.id} style={{
                        marginTop: 12, paddingLeft: 12, borderLeft: '2px solid #c9a24b',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                      }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{g.title} <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>(your proposed goal)</Text></div>
                          {g.description && <Paragraph type="secondary" style={{ marginBottom: 0 }}>{g.description}</Paragraph>}
                        </div>
                        <Button type="text" danger size="small" icon={<DeleteOutlined />}
                          onClick={() => deleteGoalAdditionMut.mutate(g.id)} />
                      </div>
                    ))}
                    <Button
                      type="dashed" size="small" icon={<PlusOutlined />}
                      style={{ marginTop: 12 }}
                      onClick={() => setGoalModalAreaId(area.id)}
                    >
                      Propose a Goal for this Area
                    </Button>
                  </>
                )}
              </>
            )}
          </Card>
        )
      })}

      {!isOwner && (
        <>
          <Card
            title="Propose a Different Area"
            extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setAltOpen(true)}>Add Alternative</Button>}
            style={{ marginBottom: 16 }}
          >
            {myAlternatives.length === 0 ? (
              <Text type="secondary">You haven't proposed any alternative areas.</Text>
            ) : (
              <List
                size="small"
                dataSource={myAlternatives}
                renderItem={(p) => (
                  <List.Item actions={[
                    <Button key="del" type="text" danger size="small" icon={<DeleteOutlined />}
                      onClick={() => deleteAltMut.mutate(p.id)} />,
                  ]}>
                    <List.Item.Meta
                      title={p.name}
                      description={
                        <>
                          <div>{p.rationale}</div>
                          <ul style={{ marginTop: 4 }}>
                            {p.goals.map((g) => <li key={g.id}>{g.title}</li>)}
                          </ul>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Space>
            <Popconfirm
              title="Submit your review?"
              description="You won't be able to change your review after this."
              onConfirm={() => submitReviewMut.mutate()}
            >
              <Button type="primary" loading={submitReviewMut.isPending} style={{ background: '#13223a' }}>
                Submit My Review
              </Button>
            </Popconfirm>
            {/* Nothing left to actually save here — every choice above already persisted on selection.
                This just gives users an explicit, reassuring way to step away mid-review. */}
            <Button onClick={() => {
              message.success('Your progress is saved — come back anytime to finish')
              navigate(`/strategies/${strategyId}/swot`)
            }}>
              Save & Exit
            </Button>
          </Space>
        </>
      )}

      <Modal
        title="Propose an Alternative Area"
        open={altOpen}
        onCancel={() => setAltOpen(false)}
        onOk={() => altForm.submit()}
        confirmLoading={proposeMut.isPending}
        destroyOnClose
      >
        <Form form={altForm} layout="vertical" onFinish={proposeMut.mutate}
          initialValues={{ goals: [{ title: '', description: '' }] }}>
          <Form.Item name="name" label="Area name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="rationale" label="Rationale"><Input.TextArea rows={2} /></Form.Item>
          <Form.List name="goals">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[field.name, 'title']} rules={[{ required: true, message: 'Title required' }]}>
                      <Input placeholder="Goal title" style={{ width: 240 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'description']}>
                      <Input placeholder="Description (optional)" style={{ width: 240 }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    )}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>Add Goal</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="Propose a Goal"
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
