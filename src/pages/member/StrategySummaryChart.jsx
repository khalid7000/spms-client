import { useState, useMemo } from 'react'
import { Select, Drawer, Tag, Row, Col, Card, Statistic, Empty } from 'antd'

// ─── helpers ─────────────────────────────────────────────────────────────────

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

const HEX = { green: '#52c41a', amber: '#fa8c16', red: '#ff4d4f' }
const BG  = { green: '#f6ffed', amber: '#fff7e6', red: '#fff2f0' }
const BORDER = { green: '#b7eb8f', amber: '#ffd591', red: '#ffccc7' }

function pct(count, max) {
  return max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0
}

// ─── mini bar ────────────────────────────────────────────────────────────────

function Bar({ percent, color, height = 8 }) {
  return (
    <div
      style={{
        flex: 1,
        background: '#f3f4f6',
        borderRadius: height / 2,
        height,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          background: HEX[color],
          height: '100%',
          borderRadius: height / 2,
          transition: 'width 0.55s ease',
        }}
      />
    </div>
  )
}

// ─── GoalCard ────────────────────────────────────────────────────────────────

function GoalCard({ goal, countMap, threshold, onClick }) {
  const allInis = useMemo(
    () => (goal.objectives ?? []).flatMap((o) => o.initiatives ?? []),
    [goal],
  )
  const totalCount = allInis.reduce((s, i) => s + (countMap[i.id] ?? 0), 0)
  const maxCount = allInis.length * threshold
  const filledPct = pct(totalCount, maxCount)
  const color = rollupColor(allInis.map((i) => initiativeColor(countMap[i.id] ?? 0, threshold)))

  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1px solid ${BORDER[color]}`,
        borderLeft: `5px solid ${HEX[color]}`,
        borderRadius: 8,
        padding: '16px 18px',
        marginBottom: 12,
        cursor: 'pointer',
        boxShadow: hovered ? '0 4px 18px rgba(0,0,0,0.09)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1a2035', lineHeight: 1.4 }}>
            {goal.title}
          </div>
          {goal.description && (
            <div
              style={{
                fontSize: 12,
                color: '#9ca3af',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 500,
              }}
            >
              {goal.description}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: HEX[color], lineHeight: 1 }}>
            {totalCount}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {filledPct}% · {allInis.length} initiative{allInis.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Main goal progress bar */}
      <Bar percent={filledPct} color={color} height={10} />

      {/* Objective mini-rows */}
      {(goal.objectives ?? []).map((obj) => {
        const oInis = obj.initiatives ?? []
        if (oInis.length === 0) return null
        const oCount = oInis.reduce((s, i) => s + (countMap[i.id] ?? 0), 0)
        const oMax = oInis.length * threshold
        const oPct = pct(oCount, oMax)
        const oColor = rollupColor(oInis.map((i) => initiativeColor(countMap[i.id] ?? 0, threshold)))

        return (
          <div
            key={obj.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: HEX[oColor],
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: '#6b7280',
                width: 180,
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {obj.title}
            </div>
            <Bar percent={oPct} color={oColor} height={5} />
            <div
              style={{ fontSize: 11, color: '#9ca3af', width: 28, textAlign: 'right', flexShrink: 0 }}
            >
              {oCount}
            </div>
          </div>
        )
      })}

      <div style={{ fontSize: 11, color: '#c4cad5', marginTop: 10, textAlign: 'right' }}>
        Click for initiative detail →
      </div>
    </div>
  )
}

// ─── GoalDetail (drawer body) ─────────────────────────────────────────────────

function GoalDetail({ goal, countMap, breakdownMap, threshold }) {
  return (
    <div>
      {(goal.objectives ?? []).map((obj) => {
        const oInis = obj.initiatives ?? []
        if (oInis.length === 0) return null
        const oCount = oInis.reduce((s, i) => s + (countMap[i.id] ?? 0), 0)
        const oColor = rollupColor(oInis.map((i) => initiativeColor(countMap[i.id] ?? 0, threshold)))

        return (
          <div key={obj.id} style={{ marginBottom: 22 }}>
            {/* Objective header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 12px',
                background: BG[oColor],
                border: `1px solid ${BORDER[oColor]}`,
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: HEX[oColor],
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 600, fontSize: 13, color: '#1a2035', flex: 1 }}>
                {obj.title}
              </span>
              <span style={{ fontSize: 12, color: HEX[oColor], fontWeight: 600, flexShrink: 0 }}>
                {oCount} achievement{oCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Initiatives */}
            {oInis.map((ini) => {
              const count = countMap[ini.id] ?? 0
              const iColor = initiativeColor(count, threshold)
              const breakdown = breakdownMap?.[ini.id]

              return (
                <div
                  key={ini.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '7px 12px 7px 20px',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  {/* Count badge */}
                  <div
                    style={{
                      minWidth: 26,
                      height: 26,
                      borderRadius: 5,
                      background: HEX[iColor],
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {count}
                  </div>

                  {/* Title + dept tags */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
                      {ini.title}
                    </div>
                    {breakdown && breakdown.length > 0 && (
                      <div
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}
                      >
                        {breakdown
                          .slice()
                          .sort((a, b) => b.achievementCount - a.achievementCount)
                          .map((d) => (
                            <Tag
                              key={d.departmentName}
                              color="blue"
                              style={{ fontSize: 10, margin: 0, padding: '0 5px', lineHeight: '18px' }}
                            >
                              {d.departmentName}: {d.achievementCount}
                            </Tag>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── main export ─────────────────────────────────────────────────────────────

export default function StrategySummaryChart({
  strategy,
  allPeriods,
  countMaps,
  breakdownMaps,
  threshold,
}) {
  const [selectedPeriod, setSelectedPeriod] = useState(allPeriods[0] ?? null)
  const [activeGoal, setActiveGoal] = useState(null)

  const goals = useMemo(() => strategy?.goals ?? [], [strategy])

  if (!selectedPeriod || allPeriods.length === 0) {
    return (
      <Empty
        description="No achievement data available for any period"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  const countMap = countMaps[selectedPeriod] ?? {}
  const breakdownMap = breakdownMaps?.[selectedPeriod]

  // Summary stats
  const allInis = goals.flatMap((g) => (g.objectives ?? []).flatMap((o) => o.initiatives ?? []))
  const totalCount = allInis.reduce((s, i) => s + (countMap[i.id] ?? 0), 0)

  const allObjectives = goals.flatMap((g) => g.objectives ?? [])

  const goalsOnTrack = goals.filter((g) => {
    const gInis = (g.objectives ?? []).flatMap((o) => o.initiatives ?? [])
    return gInis.length > 0 && rollupColor(gInis.map((i) => initiativeColor(countMap[i.id] ?? 0, threshold))) === 'green'
  }).length

  const objOnTrack = allObjectives.filter((o) => {
    const oInis = o.initiatives ?? []
    return oInis.length > 0 && rollupColor(oInis.map((i) => initiativeColor(countMap[i.id] ?? 0, threshold))) === 'green'
  }).length

  return (
    <div>
      {/* Period selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 13, color: '#6b7280' }}>Period:</span>
        <Select
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          style={{ width: 240 }}
          options={allPeriods.map((p) => ({ value: p, label: p }))}
        />
      </div>

      {/* Stat cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card
            size="small"
            style={{ textAlign: 'center', borderColor: '#e8eef6', borderRadius: 8 }}
          >
            <Statistic
              title="Total Achievements"
              value={totalCount}
              valueStyle={{ color: '#13223a', fontSize: 32 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            style={{
              textAlign: 'center',
              borderRadius: 8,
              borderColor: goalsOnTrack === goals.length ? '#b7eb8f' : '#e8eef6',
              background: goalsOnTrack === goals.length ? '#f6ffed' : undefined,
            }}
          >
            <Statistic
              title="Goals On Track"
              value={`${goalsOnTrack} / ${goals.length}`}
              valueStyle={{
                fontSize: 32,
                color:
                  goalsOnTrack === goals.length
                    ? '#52c41a'
                    : goalsOnTrack === 0
                    ? '#ff4d4f'
                    : '#fa8c16',
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            style={{
              textAlign: 'center',
              borderRadius: 8,
              borderColor: objOnTrack === allObjectives.length ? '#b7eb8f' : '#e8eef6',
              background: objOnTrack === allObjectives.length ? '#f6ffed' : undefined,
            }}
          >
            <Statistic
              title="Objectives On Track"
              value={`${objOnTrack} / ${allObjectives.length}`}
              valueStyle={{
                fontSize: 32,
                color:
                  objOnTrack === allObjectives.length
                    ? '#52c41a'
                    : objOnTrack === 0
                    ? '#ff4d4f'
                    : '#fa8c16',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          fontSize: 12,
          color: '#9ca3af',
          marginBottom: 14,
          alignItems: 'center',
        }}
      >
        {[
          { color: 'green', label: `≥ ${threshold} per initiative` },
          { color: 'amber', label: `1 – ${threshold - 1}` },
          { color: 'red',   label: '0' },
        ].map(({ color, label }) => (
          <span key={color} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: HEX[color] }}
            />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          Bars show achievements vs target ({threshold} per initiative)
        </span>
      </div>

      {/* Goal cards — grouped by vision area */}
      {(() => {
        const areas = strategy.areas ?? []
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

        return sections.map(({ area, goals: sectionGoals }) => {
          const visibleGoals = sectionGoals.filter(
            (g) => (g.objectives ?? []).flatMap((o) => o.initiatives ?? []).length > 0,
          )
          if (visibleGoals.length === 0) return null
          return (
            <div key={area?.id ?? 'ungrouped'}>
              {area && (
                <div
                  style={{
                    background: '#13223a',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '8px 14px',
                    borderRadius: 6,
                    marginTop: 20,
                    marginBottom: 10,
                    letterSpacing: 0.3,
                  }}
                >
                  {area.name}
                </div>
              )}
              {visibleGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  countMap={countMap}
                  threshold={threshold}
                  onClick={() => setActiveGoal(goal)}
                />
              ))}
            </div>
          )
        })
      })()}

      {/* Drill-down drawer */}
      <Drawer
        title={
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2035' }}>
              {activeGoal?.title}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginTop: 2 }}>
              {selectedPeriod}
            </div>
          </div>
        }
        open={!!activeGoal}
        onClose={() => setActiveGoal(null)}
        width={540}
        styles={{ body: { padding: '16px 20px' } }}
      >
        {activeGoal && (
          <GoalDetail
            goal={activeGoal}
            countMap={countMap}
            breakdownMap={breakdownMap}
            threshold={threshold}
          />
        )}
      </Drawer>
    </div>
  )
}
