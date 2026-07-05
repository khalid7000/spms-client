import { Card, Row, Col, Spin, Empty, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { getSwotVisualization } from '../../../api/swot'
import QuadrantBadge from '../../../components/swot/QuadrantBadge'

const QUADRANTS = ['STRENGTH', 'WEAKNESS', 'OPPORTUNITY', 'THREAT']

// Matches the --swot-* CSS custom properties in styles/index.css (recharts needs literal hex, not var()).
const QUADRANT_HEX = {
  STRENGTH: '#009e73',
  WEAKNESS: '#d55e00',
  OPPORTUNITY: '#0072b2',
  THREAT: '#e69f00',
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, maxWidth: 280 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.word}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
        {d.submitterCount} participant{d.submitterCount === 1 ? '' : 's'} suggested this
      </div>
      {d.justifications.map((j, i) => (
        <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
          <strong>{j.contributorName}:</strong> {j.sentence}
        </div>
      ))}
    </div>
  )
}

function QuadrantChart({ quadrant, words }) {
  if (!words.length) {
    return <Empty description="No words yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }
  const data = words.map((w, i) => ({ ...w, x: i + 1 }))
  const maxCount = Math.max(...data.map((d) => d.submitterCount), 1)
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" />
        <XAxis type="number" dataKey="x" hide domain={[0, data.length + 1]} />
        <YAxis
          type="number" dataKey="submitterCount" allowDecimals={false}
          domain={[0, Math.max(maxCount + 1, 3)]}
          label={{ value: 'Submitters', angle: -90, position: 'insideLeft', fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="submitterCount" range={[120, 600]} />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={data} fill={QUADRANT_HEX[quadrant]} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default function SwotVisualizationPage() {
  const { strategyId } = useParams()
  const navigate = useNavigate()

  const { data: words = [], isLoading } = useQuery({
    queryKey: ['swot-visualization', strategyId],
    queryFn: () => getSwotVisualization(strategyId),
  })

  const byQuadrant = (q) => words.filter((w) => w.quadrant === q)

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
        {QUADRANTS.map((q) => (
          <Col xs={24} md={12} key={q}>
            <Card size="small" title={<QuadrantBadge quadrant={q} />}>
              <QuadrantChart quadrant={q} words={byQuadrant(q)} />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
