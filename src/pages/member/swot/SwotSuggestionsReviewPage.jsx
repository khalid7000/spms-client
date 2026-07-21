import { useEffect, useState } from 'react'
import {
  Card, Button, Space, message, Popconfirm, List, Form, Modal, Spin, Typography, Divider, Alert, Input,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getSwotStatus, getSwotSuggestions, getMySwotReviewItems, submitSwotReviewItem,
  getSwotAlternatives, proposeSwotAlternative, deleteSwotAlternative, submitSwotReview,
  getSwotGoalAdditions, proposeSwotGoalAddition, deleteSwotGoalAddition,
} from '../../../api/swot'
import ReviewControl, { ALL_REVIEW_ACTION_KEYS } from '../../../components/ReviewControl'

const { Paragraph, Text } = Typography

const SWOT_ACTION_KEYS = ALL_REVIEW_ACTION_KEYS.map((a) =>
  a.value === 'PROPOSE_ALTERNATIVE' ? { ...a, labelKey: 'swot.preferDifferentArea' } : a)

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

export default function SwotSuggestionsReviewPage() {
  const { t } = useTranslation()
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
  // Once a non-owner reviewer has submitted, the backend rejects any further review/alternative/
  // goal-addition writes for them (assertCanReview) -- mirror that here so the UI shows a locked
  // read-only state instead of controls that silently error when clicked.
  const reviewSubmitted = !isOwner && !!status?.myReviewSubmitted

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
    onError: (err) => message.error(err.response?.data?.message || t('swot.saveReviewFailed')),
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
      message.success(t('swot.alternativeProposed'))
      setAltOpen(false)
      altForm.resetFields()
      qc.invalidateQueries({ queryKey: ['swot-alternatives', strategyId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('swot.proposeAlternativeFailed')),
  })

  const deleteAltMut = useMutation({
    mutationFn: (id) => deleteSwotAlternative(strategyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swot-alternatives', strategyId] }),
  })

  const proposeGoalMut = useMutation({
    mutationFn: ({ areaId, values }) => proposeSwotGoalAddition(strategyId, areaId, values),
    onSuccess: () => {
      message.success(t('swot.goalProposed'))
      setGoalModalAreaId(null)
      goalForm.resetFields()
      qc.invalidateQueries({ queryKey: ['swot-goal-additions', strategyId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('swot.proposeGoalFailed')),
  })

  const deleteGoalAdditionMut = useMutation({
    mutationFn: (id) => deleteSwotGoalAddition(strategyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swot-goal-additions', strategyId] }),
  })

  const submitReviewMut = useMutation({
    mutationFn: () => submitSwotReview(strategyId),
    onSuccess: () => { setMissingTarget(null); message.success(t('swot.reviewSubmitted')); navigate(`/strategies/${strategyId}/swot`) },
    onError: (err) => {
      const msg = err.response?.data?.message
      message.error(msg || t('swot.submitReviewFailed'))
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
        {t('swot.backToOverview')}
      </Button>

      {isOwner ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('swot.readOnlyPreviewTitle')}
          description={t('swot.readOnlyPreviewDescription')}
        />
      ) : reviewSubmitted ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('swot.reviewSubmittedTitle')}
          description={t('swot.reviewSubmittedDescription')}
        />
      ) : (
        <>
          <Paragraph>
            {t('swot.reviewIntro')}
          </Paragraph>
          {/* Every selection above is saved to the server as soon as you make it (submitSwotReviewItem
              fires immediately, not just on final submit) — this just makes that behavior visible so
              users know it's safe to leave mid-review and pick up later. */}
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('swot.autoSaveTitle')}
            description={t('swot.reviewAutoSaveDescription')}
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
                ⚠ {t('swot.areaMissingDecisionSubmit')}
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
                disabled={reviewSubmitted}
                actionKeys={SWOT_ACTION_KEYS}
                alternativeLabelKey="swot.useProposeDifferentAreaBelow"
              />
            )}

            {(isOwner || !areaRejected) && (area.goals?.length > 0 || !isOwner) && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text strong style={{ fontSize: 13 }}>{t('dashboard.goalsLabel')}</Text>
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
                        ⚠ {t('swot.goalMissingDecisionSubmit')}
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
                        disabled={reviewSubmitted}
                        actionKeys={SWOT_ACTION_KEYS}
                        alternativeLabelKey="swot.useProposeDifferentAreaBelow"
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
                          <div style={{ fontWeight: 500 }}>{g.title} <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>{t('swot.yourProposedGoal')}</Text></div>
                          {g.description && <Paragraph type="secondary" style={{ marginBottom: 0 }}>{g.description}</Paragraph>}
                        </div>
                        {!reviewSubmitted && (
                          <Button type="text" danger size="small" icon={<DeleteOutlined />}
                            onClick={() => deleteGoalAdditionMut.mutate(g.id)} />
                        )}
                      </div>
                    ))}
                    {!reviewSubmitted && (
                      <Button
                        type="dashed" size="small" icon={<PlusOutlined />}
                        style={{ marginTop: 12 }}
                        onClick={() => setGoalModalAreaId(area.id)}
                      >
                        {t('swot.proposeGoalForArea')}
                      </Button>
                    )}
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
            title={t('swot.proposeADifferentArea')}
            extra={!reviewSubmitted && (
              <Button size="small" icon={<PlusOutlined />} onClick={() => setAltOpen(true)}>{t('swot.addAlternative')}</Button>
            )}
            style={{ marginBottom: 16 }}
          >
            {myAlternatives.length === 0 ? (
              <Text type="secondary">{t('swot.noAlternativesProposed')}</Text>
            ) : (
              <List
                size="small"
                dataSource={myAlternatives}
                renderItem={(p) => (
                  <List.Item actions={reviewSubmitted ? [] : [
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

          {!reviewSubmitted && (
            <Space>
              <Popconfirm
                title={t('swot.submitReviewConfirmTitle')}
                description={t('swot.submitReviewConfirmDescription')}
                onConfirm={() => submitReviewMut.mutate()}
              >
                <Button type="primary" loading={submitReviewMut.isPending} style={{ background: '#13223a' }}>
                  {t('swot.submitMyReview')}
                </Button>
              </Popconfirm>
              {/* Nothing left to actually save here — every choice above already persisted on selection.
                  This just gives users an explicit, reassuring way to step away mid-review. */}
              <Button onClick={() => {
                message.success(t('swot.progressSavedExit'))
                navigate(`/strategies/${strategyId}/swot`)
              }}>
                {t('swot.saveAndExit')}
              </Button>
            </Space>
          )}
        </>
      )}

      <Modal
        title={t('swot.proposeAlternativeAreaTitle')}
        open={altOpen}
        onCancel={() => setAltOpen(false)}
        onOk={() => altForm.submit()}
        confirmLoading={proposeMut.isPending}
        destroyOnClose
      >
        <Form form={altForm} layout="vertical" onFinish={proposeMut.mutate}
          initialValues={{ goals: [{ title: '', description: '' }] }}>
          <Form.Item name="name" label={t('swot.areaNameLabel')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="rationale" label={t('swot.rationaleLabel')}><Input.TextArea rows={2} /></Form.Item>
          <Form.List name="goals">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[field.name, 'title']} rules={[{ required: true, message: t('swot.titleRequired') }]}>
                      <Input placeholder={t('swot.goalTitleLabel')} style={{ width: 240 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'description']}>
                      <Input placeholder={t('swot.descriptionOptionalLabel')} style={{ width: 240 }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    )}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>{t('swot.addGoalButton')}</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title={t('swot.proposeGoalTitle')}
        open={goalModalAreaId != null}
        onCancel={() => setGoalModalAreaId(null)}
        onOk={() => goalForm.submit()}
        confirmLoading={proposeGoalMut.isPending}
        destroyOnClose
      >
        <Form form={goalForm} layout="vertical"
          onFinish={(values) => proposeGoalMut.mutate({ areaId: goalModalAreaId, values })}>
          <Form.Item name="title" label={t('swot.goalTitleLabel')} rules={[{ required: true, message: t('swot.titleRequired') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('swot.descriptionOptionalLabel')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
