import { Card, Row, Col, Spin, Empty, Button, Progress } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSwotResults } from '../../../api/swot'
import QuadrantBadge from '../../../components/swot/QuadrantBadge'

const QUADRANTS = ['STRENGTH', 'WEAKNESS', 'OPPORTUNITY', 'THREAT']

const QUADRANT_HEX = {
  STRENGTH: '#009e73',
  WEAKNESS: '#d55e00',
  OPPORTUNITY: '#0072b2',
  THREAT: '#e69f00',
}

export default function SwotResultsPage() {
  const { strategyId } = useParams()
  const navigate = useNavigate()

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['swot-results', strategyId],
    queryFn: () => getSwotResults(strategyId),
  })

  const byQuadrant = (q) => results.filter((r) => r.quadrant === q).sort((a, b) => a.rankPosition - b.rankPosition)

  if (isLoading) {
    return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/strategies/${strategyId}/swot`)}
        style={{ marginBottom: 16, color: '#6b7280' }}>
        Back to SWOT Overview
      </Button>
      <Row gutter={[16, 16]}>
        {QUADRANTS.map((q) => {
          const words = byQuadrant(q)
          const topScore = Math.max(...words.map((w) => w.totalScore), 1)
          return (
            <Col xs={24} md={12} key={q}>
              <Card size="small" title={<QuadrantBadge quadrant={q} />}>
                {words.length === 0 ? (
                  <Empty description="No results" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  words.map((w) => (
                    <div key={w.word} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                        <span><strong>#{w.rankPosition}</strong> {w.word}</span>
                        <span style={{ color: '#6b7280' }}>{w.totalScore} pts</span>
                      </div>
                      <Progress
                        percent={Math.round((w.totalScore / topScore) * 100)}
                        showInfo={false}
                        strokeColor={QUADRANT_HEX[q]}
                        size="small"
                      />
                    </div>
                  ))
                )}
              </Card>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}
