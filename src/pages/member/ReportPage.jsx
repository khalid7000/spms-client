import { Spin, Empty, Tooltip } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getStrategy } from '../../api/strategies'
import StateChip from '../../components/StateChip'

function scoreColor(actual, target) {
  if (!target || target === 0) return 'amber'
  const ratio = (actual ?? 0) / target
  if (ratio >= 1) return 'green'
  if (ratio >= 0.7) return 'amber'
  return 'red'
}

function MeasurementReport({ m }) {
  const color = scoreColor(m.actualValue, m.targetValue)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      <div
        className={`achievement-chip ${color}`}
        title={`Target: ${m.targetValue}, Actual: ${m.actualValue}`}
      >
        {m.actualValue ?? '?'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#374151' }}>{m.description}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'IBM Plex Mono, monospace' }}>
          target {m.targetValue ?? '—'} {m.unit}
        </div>
      </div>
    </div>
  )
}

function InitiativeReport({ ini }) {
  if (!ini.measurements?.length) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
        {ini.title}
      </div>
      {ini.measurements.map((m) => (
        <MeasurementReport key={m.id} m={m} />
      ))}
    </div>
  )
}

function ObjectiveReport({ obj }) {
  const hasData = obj.initiatives?.some((i) => i.measurements?.length > 0)
  if (!hasData) return null
  return (
    <div style={{ marginBottom: 12, paddingLeft: 12, borderLeft: '3px solid #e8eef6' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#2a5298', marginBottom: 6 }}>
        {obj.title}
      </div>
      {obj.initiatives?.map((ini) => <InitiativeReport key={ini.id} ini={ini} />)}
    </div>
  )
}

function GoalReport({ goal, threshold }) {
  const allMeasurements = goal.objectives?.flatMap((o) =>
    o.initiatives?.flatMap((i) => i.measurements || []) || []
  ) || []

  const totalActual = allMeasurements.reduce((sum, m) => sum + (m.actualValue ?? 0), 0)
  const totalTarget = allMeasurements.reduce((sum, m) => sum + (m.targetValue ?? 0), 0)
  const overall = scoreColor(totalActual, totalTarget)

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e8eef6',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div className={`achievement-chip ${overall}`} style={{ flexShrink: 0 }}>
          {allMeasurements.length > 0
            ? Math.round((totalActual / (totalTarget || 1)) * 100) + '%'
            : '—'}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#1a2035' }}>{goal.title}</div>
          {goal.description && (
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{goal.description}</div>
          )}
        </div>
      </div>
      {goal.objectives?.map((obj) => <ObjectiveReport key={obj.id} obj={obj} />)}
    </div>
  )
}

export default function ReportPage({ strategy: propStrategy, embedded = false }) {
  const params = useParams()
  const strategyId = propStrategy?.id ?? params?.strategyId

  const { data: fetchedStrategy, isLoading } = useQuery({
    queryKey: ['strategy', strategyId],
    queryFn: () => getStrategy(strategyId),
    enabled: !propStrategy,
  })

  const strategy = propStrategy ?? fetchedStrategy

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!strategy) return null

  const { goals = [], areas = [], achievementThreshold = 3 } = strategy

  const goalsByAreaId = {}
  const ungrouped = []
  goals.forEach((g) => {
    if (g.areaId) {
      if (!goalsByAreaId[g.areaId]) goalsByAreaId[g.areaId] = []
      goalsByAreaId[g.areaId].push(g)
    } else {
      ungrouped.push(g)
    }
  })

  const sections = [
    ...areas.map((a) => ({ area: a, goals: goalsByAreaId[a.id] || [] })),
    ...(ungrouped.length > 0 ? [{ area: null, goals: ungrouped }] : []),
  ]

  if (goals.length === 0) {
    return <Empty description="No goals in this strategy" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  return (
    <div>
      {!embedded && (
        <div className="page-header">
          <h1 className="page-title">{strategy.title} — Report</h1>
          <StateChip state={strategy.state} />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          fontSize: 13,
          color: '#6b7280',
        }}
      >
        <span>
          <span
            className="achievement-chip green"
            style={{ width: 20, height: 20, fontSize: 11, verticalAlign: 'middle' }}
          >
            ✓
          </span>{' '}
          ≥ 100%
        </span>
        <span>
          <span
            className="achievement-chip amber"
            style={{ width: 20, height: 20, fontSize: 11, verticalAlign: 'middle' }}
          >
            ~
          </span>{' '}
          70–99%
        </span>
        <span>
          <span
            className="achievement-chip red"
            style={{ width: 20, height: 20, fontSize: 11, verticalAlign: 'middle' }}
          >
            ✗
          </span>{' '}
          &lt; 70%
        </span>
      </div>

      {sections.map(({ area, goals: sectionGoals }, idx) => (
        <div key={area?.id ?? 'ungrouped'} className="report-area-section">
          <div className="report-area-title">
            {area ? area.name : 'Ungrouped Goals'}
          </div>
          {sectionGoals.map((goal) => (
            <GoalReport key={goal.id} goal={goal} threshold={achievementThreshold} />
          ))}
        </div>
      ))}
    </div>
  )
}
