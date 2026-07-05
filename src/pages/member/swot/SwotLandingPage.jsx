import { useEffect, useState } from 'react'
import { Card, Button, Spin, Space, Typography, Popconfirm, message, Alert } from 'antd'
import { ArrowLeftOutlined, RocketOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSwotStatus, startSwot, generateSwotSuggestions } from '../../../api/swot'
import SwotProgressBar from '../../../components/swot/SwotProgressBar'

const { Title, Paragraph } = Typography

const PHASE_LABELS = {
  COLLECTING: 'Collecting SWOT words',
  VOTING: 'Ranked-choice voting',
  GENERATING_SUGGESTIONS: 'Generating AI suggestions',
  REVIEWING: 'Reviewing suggested areas & goals',
  FINALIZING: 'Owner finalization',
  COMPLETED: 'Complete',
}

// mm:ss (or ss) since `sinceIso` — used to show "submitted at X, Y elapsed" while generation is
// still in flight, so waiting looks different from stuck.
function formatElapsed(sinceIso) {
  if (!sinceIso) return null
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000))
  const m = Math.floor(diffSec / 60)
  const s = diffSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function SwotLandingPage() {
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
    onSuccess: () => { message.success('SWOT analysis started'); refresh() },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to start'),
  })

  // Generation runs in the background (a model call can take a minute or more) — this request
  // just kicks it off; `refresh()` re-polls status, and the phase-driven view below picks up the
  // REVIEWING transition on its own once generation actually finishes.
  const retryMut = useMutation({
    mutationFn: () => generateSwotSuggestions(strategyId),
    onSuccess: () => { message.success('Generation started — this can take a minute or two'); refresh() },
    onError: (err) => message.error(err.response?.data?.message || 'Could not start generation — try again'),
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
        Back to Strategy
      </Button>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RocketOutlined style={{ fontSize: 22, color: '#13223a' }} />
            <Title level={3} style={{ margin: 0 }}>SWOT Collaboration</Title>
          </div>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Work with your fellow owners and editors to run a SWOT analysis, vote on the
            strongest ideas, and let AI propose focus areas and goals you can review and
            finalize into a draft strategy.
          </Paragraph>

          {!status?.sessionStarted && (
            <Card size="small" style={{ background: '#f8faff' }}>
              {status?.owner ? (
                <Popconfirm
                  title="Start the SWOT analysis?"
                  description="Every current Owner and Editor on this strategy will be invited to participate."
                  onConfirm={() => startMut.mutate()}
                >
                  <Button type="primary" loading={startMut.isPending} style={{ background: '#13223a' }}>
                    Start SWOT Analysis
                  </Button>
                </Popconfirm>
              ) : (
                <span style={{ color: '#6b7280' }}>
                  Waiting for the strategy owner to start the SWOT analysis.
                </span>
              )}
            </Card>
          )}

          {status?.sessionStarted && (
            <Card size="small" style={{ background: '#f8faff' }}>
              <div style={{ marginBottom: 12, fontWeight: 600, color: '#13223a' }}>
                Current phase: {PHASE_LABELS[status.phase] ?? status.phase}
              </div>

              {status.phase === 'COLLECTING' && (
                <>
                  <SwotProgressBar label="Word collection" done={status.submittedCount} total={status.totalParticipants} />
                  {!status.mySwotSubmitted ? (
                    <Button type="primary" style={{ background: '#13223a' }}
                      onClick={() => navigate(`/strategies/${strategyId}/swot/collect`)}>
                      Enter My SWOT Words
                    </Button>
                  ) : (
                    <Space>
                      <span style={{ color: '#6b7280' }}>You've submitted — waiting for others.</span>
                      <Button onClick={() => navigate(`/strategies/${strategyId}/swot/board`)}>View Board</Button>
                    </Space>
                  )}
                </>
              )}

              {status.phase === 'VOTING' && (
                <>
                  <SwotProgressBar label="Voting" done={status.votedCount} total={status.totalParticipants} />
                  {!status.myVoteSubmitted ? (
                    <Button type="primary" style={{ background: '#13223a' }}
                      onClick={() => navigate(`/strategies/${strategyId}/swot/vote`)}>
                      Cast My Vote
                    </Button>
                  ) : (
                    <span style={{ color: '#6b7280' }}>You've voted — waiting for others.</span>
                  )}
                </>
              )}

              {status.phase === 'GENERATING_SUGGESTIONS' && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {status.generationFailureReason ? (
                    <Alert
                      type="error"
                      showIcon
                      message="AI generation failed"
                      description={status.generationFailureReason}
                    />
                  ) : (
                    <span style={{ color: '#6b7280' }}>
                      Voting is closed — AI is generating suggested focus areas from the top-ranked words in
                      the background. This page checks automatically and will move on once it's ready.
                      {status.generationRequestedAt && (
                        <>
                          {' '}Submitted at {new Date(status.generationRequestedAt).toLocaleTimeString()}
                          {' — '}{formatElapsed(status.generationRequestedAt)} elapsed.
                        </>
                      )}
                    </span>
                  )}
                  {status.owner && (
                    <Button loading={retryMut.isPending} onClick={() => retryMut.mutate()}>
                      {status.generationFailureReason ? 'Retry Generation' : 'Cancel & Retry Generation'}
                    </Button>
                  )}
                </Space>
              )}

              {status.phase === 'REVIEWING' && (
                <>
                  {/* Only Editors count here and drive the phase transition — the Owner does a
                      separate finalization pass afterward instead of a peer review of their own. */}
                  <SwotProgressBar label="Editor review" done={status.reviewedCount} total={status.nonOwnerParticipants} />
                  {status.owner && (
                    <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
                      Waiting on your Editors — you'll finalize the draft yourself once they're done.
                    </div>
                  )}
                  {!status.myReviewSubmitted ? (
                    <Button type="primary" style={{ background: '#13223a' }}
                      onClick={() => navigate(`/strategies/${strategyId}/swot/review`)}>
                      Review AI Suggestions
                    </Button>
                  ) : (
                    <span style={{ color: '#6b7280' }}>Your review is in — waiting for the rest of the team.</span>
                  )}
                </>
              )}

              {status.phase === 'FINALIZING' && (
                status.owner ? (
                  <Button type="primary" style={{ background: '#13223a' }}
                    onClick={() => navigate(`/strategies/${strategyId}/swot/finalize`)}>
                    Finalize Draft Strategy
                  </Button>
                ) : (
                  <span style={{ color: '#6b7280' }}>Waiting for the strategy owner to finalize the draft.</span>
                )
              )}

              {status.phase === 'COMPLETED' && (
                status.owner ? (
                  <span style={{ color: '#6b7280' }}>
                    Done! Use the links below any time to revisit the vote results or the word board.
                  </span>
                ) : (
                  <span style={{ color: '#6b7280' }}>Done! Redirecting to your strategy…</span>
                )
              )}
            </Card>
          )}

          {status?.sessionStarted && status.phase !== 'COLLECTING' && (
            <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/strategies/${strategyId}/swot/board`)}>
              View SWOT board
            </Button>
          )}
          {status?.sessionStarted && ['REVIEWING', 'FINALIZING', 'COMPLETED'].includes(status.phase) && (
            <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/strategies/${strategyId}/swot/results`)}>
              View vote results
            </Button>
          )}
        </Space>
      </Card>
    </div>
  )
}
