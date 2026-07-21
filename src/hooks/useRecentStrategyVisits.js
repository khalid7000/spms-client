// Rolling client-side log of strategy-detail-page visits, in the same localStorage-backed spirit
// as useTablePrefs/useViewPrefs. Powers the dashboard's quick Add Achievement wizard: if the last
// few visits were all the same strategy, assume that's the one the user wants and skip the
// strategy-picking step. No backend involved -- purely a UX shortcut, never used for anything
// that needs to be authoritative or shared across devices.
const KEY = 'spms.recentStrategyVisits'
const MAX_LOG = 10

export function recordStrategyVisit(strategyId) {
  if (!strategyId) return
  try {
    const log = JSON.parse(localStorage.getItem(KEY) || '[]')
    log.push(String(strategyId))
    localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX_LOG)))
  } catch {
    // localStorage unavailable (e.g. private browsing) -- the wizard just always shows the
    // manual strategy picker instead, no functional loss.
  }
}

// Returns the strategy id if the last `streak` visits were all that same strategy, else null.
export function getStreakStrategyId(streak = 3) {
  try {
    const log = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (log.length < streak) return null
    const last = log.slice(-streak)
    return last.every((id) => id === last[0]) ? last[0] : null
  } catch {
    return null
  }
}
