import { useEffect, useState } from 'react'
import { Card, Button, Spin, Space, Typography, Popconfirm, message, Alert } from 'antd'
import { ArrowLeftOutlined, RocketOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getSwotStatus, startSwot, generateSwotSuggestions } from '../../../api/swot'
import SwotProgressBar from '../../../components/swot/SwotProgressBar'

const { Title, Paragraph } = Typography

const PHASE_LABEL_KEYS = {
  COLLECTING: 'swot.phaseCollecting',
  VOTING: 'swot.phaseVoting',
  GENERATING_SUGGESTIONS: 'swot.phaseGenerating',
  REVIEWING: 'swot.phaseReviewing',
  FINALIZING: 'swot.phaseFinalizing',
  COMPLETED: 'swot.phaseCompleted',
}

// mm:ss (or ss) since `sinceIso` — used to show "submitted at X, Y elapsed" while generation is
// still in flight, so waiting looks different from stuck.
function formatElapsed(sinceIso) {
  if (!sinceIso) return null
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000))
  const m = Math.floor(diffSec / 60)
  const s = diffSec % 60
  return { m, s }
}

export default function SwotLandingPage() {
  const { t } = useTranslation()
  const { strategyId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const statusKey = ['swot-status', strategyId]
  const { data: status, isLoading } = useQuery({
    queryKey: statusKey,
    queryFn: () => getSwotStatus(strategyId),
    refetchInterval: 10_000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: statusKey })

  const startMut = useMutation({
    mutationFn: () => startSwot(strategyId),
    onSuccess: () => { message.success(t('swot.startedSuccess')); refresh() },
    onError: (err) => message.error(err.response?.data?.message || t('swot.startFailed')),
  })

  // Generation runs in the background (a model call can take a minute or more) — this request
  // just kicks it off; `refresh()` re-polls status, and the phase-driven view below picks up the
  // REVIEWING transition on its own once generation actually finishes.
  const retryMut = useMutation({
    mutationFn: () => generateSwotSuggestions(strategyId),
    onSuccess: () => { message.success(t('swot.generationStarted')); refresh() },
    onError: (err) => message.error(err.response?.data?.message || t('swot.generationStartFailed')),
  })

  // Editors have nothing left to do once SWOT is COMPLETED, so they get bounced back to the
  // strategy automatically. The Owner is deliberately excluded — they come back here later to
  // reference the vote results/word board (links further down), and used to get redirected away
  // before they could even click them.
  useEffect(() => {
    if (status?.phase === 'COMPLETED' && !status?.owner) {
      const t = setTimeout(() => navigate(`/strategies/${strategyId}`), 1500)
      return () => clearTimeout(t)
    }
  }, [status?.phase, status?.owner, strategyId, navigate])

  // Forces a re-render every second so the "elapsed" clock ticks while generation is running,
  // independent of the 10s status poll.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (status?.phase !== 'GENERATING_SUGGESTIONS' || status?.generationFailureReason) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [status?.phase, status?.generationFailureReason])

  if (isLoading) {
    return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/strategies/${strategyId}`)}
        style={{ marginBottom: 16, color: '#6b7280' }}
      >
        {t('swot.backToStrategy')}
      </Button>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RocketOutlined style={{ fontSize: 22, color: '#13223a' }} />
            <Title level={3} style={{ margin: 0 }}>{t('swot.collaborationTitle')}</Title>
          </div>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('swot.collaborationIntro')}
          </Paragraph>

          {!status?.sessionStarted && (
            <Card size="small" style={{ background: '#f8faff' }}>
              {status?.owner ? (
                <Popconfirm
                  title={t('swot.startConfirmTitle')}
                  description={t('swot.startConfirmDescription')}
                  onConfirm={() => startMut.mutate()}
                >
                  <Button type="primary" loading={startMut.isPending} style={{ background: '#13223a' }}>
                    {t('swot.startButton')}
                  </Button>
                </Popconfirm>
              ) : (
                <span style={{ color: '#6b7280' }}>
                  {t('swot.waitingForOwnerToStart')}
                </span>
              )}
            </Card>
          )}

          {status?.sessionStarted && (
            <Card size="small" style={{ background: '#f8faff' }}>
              <div style={{ marginBottom: 12, fontWeight: 600, color: '#13223a' }}>
                {t('swot.currentPhase', { phase: PHASE_LABEL_KEYS[status.phase] ? t(PHASE_LABEL_KEYS[status.phase]) : status.phase })}
              </div>

              {status.phase === 'COLLECTING' && (
                <>
                  <SwotProgressBar label={t('swot.wordCollectionLabel')} done={status.submittedCount} total={status.totalParticipants} />
                  {!status.mySwotSubmitted ? (
                    <Button type="primary" style={{ background: '#13223a' }}
                      onClick={() => navigate(`/strategies/${strategyId}/swot/collect`)}>
                      {t('swot.enterWordsButton')}
                    </Button>
                  ) : (
                    <Space>
                      <span style={{ color: '#6b7280' }}>{t('swot.submittedWaitingOthers')}</span>
                      <Button onClick={() => navigate(`/strategies/${strategyId}/swot/board`)}>{t('swot.viewBoardButton')}</Button>
                    </Space>
                  )}
                </>
              )}

              {status.phase === 'VOTING' && (
                <>
                  <SwotProgressBar label={t('swot.votingLabel')} done={status.votedCount} total={status.totalParticipants} />
                  {!status.myVoteSubmitted ? (
                    <Button type="primary" style={{ background: '#13223a' }}
                      onClick={() => navigate(`/strategies/${strategyId}/swot/vote`)}>
                      {t('swot.castVoteButton')}
                    </Button>
                  ) : (
                    <span style={{ color: '#6b7280' }}>{t('swot.votedWaitingOthers')}</span>
                  )}
                </>
              )}

              {status.phase === 'GENERATING_SUGGESTIONS' && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {status.generationFailureReason ? (
                    <Alert
                      type="error"
                      showIcon
                      message={t('swot.generationFailedTitle')}
                      description={status.generationFailureReason}
                    />
                  ) : (
                    <span style={{ color: '#6b7280' }}>
                      {t('swot.generatingHint')}
                      {status.generationRequestedAt && (() => {
                        const elapsed = formatElapsed(status.generationRequestedAt)
                        return (
                          <>
                            {' '}{t('swot.submittedAt', { time: new Date(status.generationRequestedAt).toLocaleTimeString() })}
                            {' — '}{elapsed.m > 0 ? t('swot.elapsedMinSec', elapsed) : t('swot.elapsedSec', elapsed)}
                          </>
                        )
                      })()}
                    </span>
                  )}
                  {status.owner && (
                    <Button loading={retryMut.isPending} onClick={() => retryMut.mutate()}>
                      {status.generationFailureReason ? t('swot.retryGeneration') : t('swot.cancelRetryGeneration')}
                    </Button>
                  )}
                </Space>
              )}

              {status.phase === 'REVIEWING' && (
                <>
                  {/* Only Editors count here and drive the phase transition — the Owner does a
                      separate finalization pass afterward instead of a peer review of their own. */}
                  <SwotProgressBar label={t('swot.editorReviewLabel')} done={status.reviewedCount} total={status.nonOwnerParticipants} />
                  {status.owner && (
                    <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
                      {t('swot.waitingOnEditors')}
                    </div>
                  )}
                  {!status.myReviewSubmitted ? (
                    <Button type="primary" style={{ background: '#13223a' }}
                      onClick={() => navigate(`/strategies/${strategyId}/swot/review`)}>
                      {t('swot.reviewSuggestionsButton')}
                    </Button>
                  ) : (
                    <span style={{ color: '#6b7280' }}>{t('swot.reviewSubmittedWaiting')}</span>
                  )}
                </>
              )}

              {status.phase === 'FINALIZING' && (
                status.owner ? (
                  <Button type="primary" style={{ background: '#13223a' }}
                    onClick={() => navigate(`/strategies/${strategyId}/swot/finalize`)}>
                    {t('swot.finalizeDraftButton')}
                  </Button>
                ) : (
                  <span style={{ color: '#6b7280' }}>{t('swot.waitingForOwnerToFinalize')}</span>
                )
              )}

              {status.phase === 'COMPLETED' && (
                status.owner ? (
                  <span style={{ color: '#6b7280' }}>
                    {t('swot.doneOwnerHint')}
                  </span>
                ) : (
                  <span style={{ color: '#6b7280' }}>{t('swot.doneRedirecting')}</span>
                )
              )}
            </Card>
          )}

          {status?.sessionStarted && status.phase !== 'COLLECTING' && (
            <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/strategies/${strategyId}/swot/board`)}>
              {t('swot.viewBoardLink')}
            </Button>
          )}
          {status?.sessionStarted && ['REVIEWING', 'FINALIZING', 'COMPLETED'].includes(status.phase) && (
            <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/strategies/${strategyId}/swot/results`)}>
              {t('swot.viewResultsLink')}
            </Button>
          )}
        </Space>
      </Card>
    </div>
  )
}
