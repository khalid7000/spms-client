import { useMemo, useState } from 'react'
import { Spin, Empty, Tabs, Tag, Segmented } from 'antd'
import { BarChartOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useQuery, useQueries } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getStrategy, getAchievements } from '../../api/strategies'
import StateChip from '../../components/StateChip'
import StrategySummaryChart from './StrategySummaryChart'

// ─── coloring ────────────────────────────────────────────────────────────────

function initiativeColor(count, threshold) {
  if (count === 0) return 'red'
  if (count >= threshold) return 'green'
  return 'amber'
}

function rollupColor(colors) {
  if (colors.length === 0) return 'amber'
  if (colors.every((c) => c === 'green')) return 'green'
  if (colors.every((c) => c === 'red')) return 'red'
  return 'amber'
}

const CHIP_LABEL = { green: '✓', amber: '~', red: '✗' }

// ─── components ──────────────────────────────────────────────────────────────

function DeptBreakdown({ entries }) {
  if (!entries || entries.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {entries
        .slice()
        .sort((a, b) => b.achievementCount - a.achievementCount)
        .map((d) => (
          <Tag key={d.departmentName} color="blue" style={{ fontSize: 11, margin: 0 }}>
            {d.departmentName}: {d.achievementCount}
          </Tag>
        ))}
    </div>
  )
}

function InitiativeReport({ ini, count, threshold, breakdown }) {
  const color = initiativeColor(count, threshold)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '6px 0',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      <div
        className={`achievement-chip ${color}`}
        style={{ flexShrink: 0, fontSize: 11 }}
        title={`${count} achievement${count !== 1 ? 's' : ''} — threshold ${threshold}`}
      >
        {count}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#374151' }}>{ini.title}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'IBM Plex Mono, monospace' }}>
          {count} achievement{count !== 1 ? 's' : ''} · threshold {threshold}
        </div>
        <DeptBreakdown entries={breakdown} />
      </div>
    </div>
  )
}

function ObjectiveReport({ obj, countMap, threshold, breakdownMap }) {
  const initiatives = obj.initiatives ?? []
  if (initiatives.length === 0) return null

  const iniColors = initiatives.map((i) => initiativeColor(countMap[i.id] ?? 0, threshold))
  const objColor = rollupColor(iniColors)

  return (
    <div style={{ marginBottom: 12, paddingLeft: 12, borderLeft: '3px solid #e8eef6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div
          className={`achievement-chip ${objColor}`}
          style={{ width: 20, height: 20, fontSize: 10, flexShrink: 0 }}
        >
          {CHIP_LABEL[objColor]}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2a5298' }}>{obj.title}</div>
      </div>
      {initiatives.map((ini) => (
        <InitiativeReport
          key={ini.id}
          ini={ini}
          count={countMap[ini.id] ?? 0}
          threshold={threshold}
          breakdown={breakdownMap?.[ini.id]}
        />
      ))}
    </div>
  )
}

function GoalReport({ goal, countMap, threshold, breakdownMap }) {
  const objectives = goal.objectives ?? []
  const allInitiatives = objectives.flatMap((o) => o.initiatives ?? [])
  if (allInitiatives.length === 0) return null

  const objColors = objectives
    .filter((o) => (o.initiatives ?? []).length > 0)
    .map((o) =>
      rollupColor(
        (o.initiatives ?? []).map((i) => initiativeColor(countMap[i.id] ?? 0, threshold))
      )
    )
  const goalColor = rollupColor(objColors)
  const total = allInitiatives.reduce((s, i) => s + (countMap[i.id] ?? 0), 0)

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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div className={`achievement-chip ${goalColor}`} style={{ flexShrink: 0 }}>
          {total > 0 ? total : CHIP_LABEL[goalColor]}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#1a2035' }}>{goal.title}</div>
          {goal.description && (
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{goal.description}</div>
          )}
        </div>
      </div>
      {objectives.map((obj) => (
        <ObjectiveReport
          key={obj.id}
          obj={obj}
          countMap={countMap}
          threshold={threshold}
          breakdownMap={breakdownMap}
        />
      ))}
    </div>
  )
}

function PeriodReport({ strategy, countMap, threshold, breakdownMap }) {
  const { goals = [], areas = [] } = strategy
  const goalsByAreaId = {}
  const ungrouped = []
  goals.forEach((g) => {
    if (g.areaId) {
      ;(goalsByAreaId[g.areaId] = goalsByAreaId[g.areaId] ?? []).push(g)
    } else {
      ungrouped.push(g)
    }
  })
  const sections = [
    ...areas.map((a) => ({ area: a, goals: goalsByAreaId[a.id] ?? [] })),
    ...(ungrouped.length > 0 ? [{ area: null, goals: ungrouped }] : []),
  ]

  return (
    <div>
      {sections.map(({ area, goals: sectionGoals }) => (
        <div key={area?.id ?? 'ungrouped'} className="report-area-section">
          <div className="report-area-title">{area ? area.name : 'Ungrouped Goals'}</div>
          {sectionGoals.map((goal) => (
            <GoalReport
              key={goal.id}
              goal={goal}
              countMap={countMap}
              threshold={threshold}
              breakdownMap={breakdownMap}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ReportPage({ strategy: propStrategy, embedded = false }) {
  const params = useParams()
  const strategyId = propStrategy?.id ?? params?.strategyId
  const [view, setView] = useState('summary')

  const { data: fetchedStrategy, isLoading } = useQuery({
    queryKey: ['strategy', strategyId],
    queryFn: () => getStrategy(strategyId),
    enabled: !propStrategy,
  })

  const strategy = propStrategy ?? fetchedStrategy
  const isUniversity = strategy?.strategyType === 'UNIVERSITY'

  // ── UNIVERSITY PATH ───────────────────────────────────────────────────────
  // departmentBreakdown is already embedded on each initiative in the strategy
  // response. No additional API calls needed — build count/breakdown maps here.

  const { univPeriods, univCountMaps, univBreakdownMaps } = useMemo(() => {
    if (!isUniversity || !strategy) {
      return { univPeriods: [], univCountMaps: {}, univBreakdownMaps: {} }
    }

    const periods = new Set()
    const cMaps = {}   // period → { initiativeId → total count }
    const bMaps = {}   // period → { initiativeId → [{departmentName, achievementCount}] }

    strategy.goals?.forEach((g) =>
      g.objectives?.forEach((o) =>
        o.initiatives?.forEach((ini) => {
          ;(ini.departmentBreakdown ?? []).forEach((d) => {
            const period = d.assessmentPeriodName ?? 'Unassigned'
            periods.add(period)
            if (!cMaps[period]) cMaps[period] = {}
            if (!bMaps[period]) bMaps[period] = {}
            cMaps[period][ini.id] = (cMaps[period][ini.id] ?? 0) + d.achievementCount
            if (!bMaps[period][ini.id]) bMaps[period][ini.id] = []
            bMaps[period][ini.id].push({
              departmentName: d.departmentName,
              achievementCount: d.achievementCount,
            })
          })
        })
      )
    )

    // Fallback: when no achievements exist yet, seed period tabs from the
    // strategy's assessment periods so initiatives still appear with count 0.
    if (periods.size === 0) {
      ;(strategy.assessmentPeriods ?? []).forEach((p) => {
        if (p.name) {
          periods.add(p.name)
          if (!cMaps[p.name]) cMaps[p.name] = {}
          if (!bMaps[p.name]) bMaps[p.name] = {}
        }
      })
    }

    return { univPeriods: [...periods].sort(), univCountMaps: cMaps, univBreakdownMaps: bMaps }
  }, [strategy, isUniversity])

  // ── DEPARTMENT PATH ───────────────────────────────────────────────────────
  // Fetch achievements per measurement and build count maps from them.

  const allMeasurements = useMemo(() => {
    if (!strategy || isUniversity) return []
    const result = []
    strategy.goals?.forEach((g) =>
      g.objectives?.forEach((o) =>
        o.initiatives?.forEach((i) =>
          i.measurements?.forEach((m) => result.push({ id: m.id, initiativeId: i.id }))
        )
      )
    )
    return result
  }, [strategy, isUniversity])

  const achievementQueries = useQueries({
    queries: allMeasurements.map((m) => ({
      queryKey: ['achievements', m.id],
      queryFn: () => getAchievements(m.id),
      enabled: !!strategy && !isUniversity,
    })),
  })

  const isLoadingAchievements = !isUniversity && achievementQueries.some((q) => q.isLoading)

  const achievementsByMid = useMemo(() => {
    const map = {}
    allMeasurements.forEach((m, idx) => {
      map[m.id] = achievementQueries[idx]?.data ?? []
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMeasurements, achievementQueries.map((q) => q.dataUpdatedAt).join(',')])

  const { deptPeriods, deptCountMaps } = useMemo(() => {
    if (isUniversity) return { deptPeriods: [], deptCountMaps: {} }

    const periods = new Set()
    const maps = {}

    // Primary: periods derived from recorded achievements
    allMeasurements.forEach((m) => {
      ;(achievementsByMid[m.id] ?? []).forEach((a) => {
        const period = a.assessmentPeriodName ?? 'Unassigned'
        periods.add(period)
        if (!maps[period]) maps[period] = {}
        maps[period][m.initiativeId] = (maps[period][m.initiativeId] ?? 0) + 1
      })
    })

    // Fallback: also seed period tabs from each initiative's own assessmentPeriodName
    // so year-filtered initiatives with 0 achievements still have a period tab.
    strategy?.goals?.forEach((g) =>
      g.objectives?.forEach((o) =>
        o.initiatives?.forEach((ini) => {
          if (ini.assessmentPeriodName) {
            periods.add(ini.assessmentPeriodName)
            if (!maps[ini.assessmentPeriodName]) maps[ini.assessmentPeriodName] = {}
          }
        })
      )
    )

    return { deptPeriods: [...periods].sort(), deptCountMaps: maps }
  }, [allMeasurements, achievementsByMid, isUniversity, strategy])

  // ── UNIFIED ───────────────────────────────────────────────────────────────

  const allPeriods = isUniversity ? univPeriods : deptPeriods
  const countMaps = isUniversity ? univCountMaps : deptCountMaps

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!strategy) return null

  const { achievementThreshold = 3 } = strategy

  const legend = (
    <div
      style={{
        display: 'flex',
        gap: 16,
        marginBottom: 16,
        fontSize: 13,
        color: '#6b7280',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span>
        <span
          className="achievement-chip green"
          style={{ width: 20, height: 20, fontSize: 11, verticalAlign: 'middle' }}
        >
          ✓
        </span>{' '}
        ≥ {achievementThreshold} achievements
      </span>
      <span>
        <span
          className="achievement-chip amber"
          style={{ width: 20, height: 20, fontSize: 11, verticalAlign: 'middle' }}
        >
          ~
        </span>{' '}
        1–{achievementThreshold - 1}
      </span>
      <span>
        <span
          className="achievement-chip red"
          style={{ width: 20, height: 20, fontSize: 11, verticalAlign: 'middle' }}
        >
          ✗
        </span>{' '}
        0
      </span>
      {isUniversity && (
        <span style={{ marginLeft: 'auto', fontSize: 12 }}>
          Coloured tags show each department's contribution for the selected period
        </span>
      )}
    </div>
  )

  const header = !embedded ? (
    <div className="page-header">
      <h1 className="page-title">{strategy.title} — Report</h1>
      <StateChip state={strategy.state} />
    </div>
  ) : null

  if ((strategy.goals ?? []).length === 0) {
    return (
      <div>
        {header}
        <Empty description="No goals in this strategy" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    )
  }

  if (isLoadingAchievements) {
    return (
      <div>
        {header}
        {legend}
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <Spin tip="Loading achievement data…" size="large" />
        </div>
      </div>
    )
  }

  if (allPeriods.length === 0) {
    return (
      <div>
        {header}
        {legend}
        <Empty
          description="No reported achievements yet"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    )
  }

  const viewToggle = (
    <Segmented
      value={view}
      onChange={setView}
      options={[
        { value: 'summary', icon: <BarChartOutlined />, label: 'Summary' },
        { value: 'detail',  icon: <UnorderedListOutlined />, label: 'Detail' },
      ]}
      style={{ marginBottom: 20 }}
    />
  )

  if (view === 'summary') {
    return (
      <div>
        {header}
        {viewToggle}
        <StrategySummaryChart
          strategy={strategy}
          allPeriods={allPeriods}
          countMaps={countMaps}
          breakdownMaps={isUniversity ? univBreakdownMaps : undefined}
          threshold={achievementThreshold}
        />
      </div>
    )
  }

  const tabItems = allPeriods.map((period) => ({
    key: period,
    label: period,
    children: (
      <PeriodReport
        strategy={strategy}
        countMap={countMaps[period] ?? {}}
        threshold={achievementThreshold}
        breakdownMap={isUniversity ? univBreakdownMaps[period] : undefined}
      />
    ),
  }))

  return (
    <div>
      {header}
      {viewToggle}
      {legend}
      <Tabs items={tabItems} defaultActiveKey={allPeriods[0]} />
    </div>
  )
}
