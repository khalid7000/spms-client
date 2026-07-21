import { useState } from 'react'
import { Card, Button, Select, Space, Spin, message, Popconfirm, Typography, Tag, Tooltip } from 'antd'
import { ArrowLeftOutlined, LinkOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueries, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getSwotBallot, submitSwotVote } from '../../../api/swot'
import QuadrantBadge from '../../../components/swot/QuadrantBadge'

const { Paragraph, Text } = Typography
const QUADRANTS = ['STRENGTH', 'WEAKNESS', 'OPPORTUNITY', 'THREAT']
const RANK_LABEL_KEYS = ['swot.rank1Choice', 'swot.rank2Choice', 'swot.rank3Choice', 'swot.rank4Choice', 'swot.rank5Choice']

// Renders one ballot candidate's dropdown label: the combined-family icon (this option
// sums several WordNet-linked words), or a "syn" tag on an individual word that has
// detected siblings, so voters can see *why* two options look related before picking.
function candidateLabel(c, t) {
  return (
    <span>
      {c.synonymGroup && <LinkOutlined style={{ marginRight: 4, color: '#c9a24b' }} />}
      {c.displayLabel}
      <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
        ({t('swot.submitterCountBare', { count: c.submitterCount })})
      </Text>
      {c.relatedWords?.length > 0 && (
        <Tooltip title={t('swot.autoDetectedSynonymOf', { words: c.relatedWords.join(', ') })}>
          <Tag color="gold" style={{ marginLeft: 6, fontSize: 10, lineHeight: '16px' }}>{t('swot.synTag')}</Tag>
        </Tooltip>
      )}
    </span>
  )
}

// Ranked-choice voting UI: one ballot per SWOT quadrant, each with N rank-ordered
// Selects. Candidates (including the backend's synonym-family combined options —
// see SwotWordClusterer) arrive pre-sorted by submitter count; this page only
// renders them and prevents picking the same candidate twice within one quadrant.
export default function SwotVotePage() {
  const { t } = useTranslation()
  const { strategyId } = useParams()
  const navigate = useNavigate()
  const [selections, setSelections] = useState({}) // { STRENGTH: ['word1', 'word2', ...], ... }

  const ballotQueries = useQueries({
    queries: QUADRANTS.map((quadrant) => ({
      queryKey: ['swot-ballot', strategyId, quadrant],
      queryFn: () => getSwotBallot(strategyId, quadrant),
    })),
  })

  const isLoading = ballotQueries.some((q) => q.isLoading)
  const rankCount = ballotQueries.find((q) => q.data)?.data?.rankCount ?? 3

  const submitMut = useMutation({
    mutationFn: () => {
      const rankedWordsByQuadrant = {}
      for (const q of QUADRANTS) {
        const ranks = (selections[q] || []).filter(Boolean)
        if (ranks.length) rankedWordsByQuadrant[q] = ranks
      }
      return submitSwotVote(strategyId, rankedWordsByQuadrant)
    },
    onSuccess: () => { message.success(t('swot.voteSubmitted')); navigate(`/strategies/${strategyId}/swot`) },
    onError: (err) => message.error(err.response?.data?.message || t('swot.voteSubmitFailed')),
  })

  const setRank = (quadrant, rankIndex, value) => {
    setSelections((prev) => {
      const current = [...(prev[quadrant] || [])]
      current[rankIndex] = value
      return { ...prev, [quadrant]: current }
    })
  }

  const hasAnyVote = QUADRANTS.some((q) => (selections[q] || []).some(Boolean))

  if (isLoading) {
    return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <Button type="text" icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/strategies/${strategyId}/swot`)}
        style={{ marginBottom: 16, color: '#6b7280' }}>
        {t('swot.backToOverview')}
      </Button>

      <Card>
        <Paragraph>
          {t('swot.rankInstructions', { count: rankCount })} <LinkOutlined style={{ color: '#c9a24b' }} /> {t('swot.combinedOptionHint')}
          {' '}<Tag color="gold" style={{ fontSize: 10, lineHeight: '16px' }}>{t('swot.synTag')}</Tag> {t('swot.synTagHint')}
        </Paragraph>

        {QUADRANTS.map((quadrant, qi) => {
          const candidates = ballotQueries[qi]?.data?.candidates ?? []
          const picked = selections[quadrant] || []
          return (
            <Card key={quadrant} size="small" style={{ marginBottom: 16 }} title={<QuadrantBadge quadrant={quadrant} />}>
              {candidates.length === 0 ? (
                <span style={{ color: '#9ca3af' }}>{t('swot.noWordsSubmittedQuadrant')}</span>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {Array.from({ length: rankCount }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 70, fontSize: 12, color: '#6b7280' }}>{t(RANK_LABEL_KEYS[i] ?? RANK_LABEL_KEYS[RANK_LABEL_KEYS.length - 1])}</span>
                      <Select
                        allowClear
                        style={{ flex: 1 }}
                        placeholder={t('swot.selectWordPlaceholder')}
                        value={picked[i]}
                        onChange={(v) => setRank(quadrant, i, v)}
                        options={candidates
                          .filter((c) => !picked.includes(c.word) || picked[i] === c.word)
                          .map((c) => ({ value: c.word, label: candidateLabel(c, t) }))}
                      />
                    </div>
                  ))}
                </Space>
              )}
            </Card>
          )
        })}

        <Popconfirm
          title={t('swot.submitVoteConfirmTitle')}
          description={t('swot.submitVoteConfirmDescription')}
          onConfirm={() => submitMut.mutate()}
          disabled={!hasAnyVote}
        >
          <Button type="primary" disabled={!hasAnyVote} loading={submitMut.isPending} style={{ background: '#13223a' }}>
            {t('swot.submitVoteButton')}
          </Button>
        </Popconfirm>
      </Card>
    </div>
  )
}
