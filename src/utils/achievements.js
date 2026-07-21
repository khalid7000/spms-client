// Shared achievement-recording helpers -- used by the Strategy Tree's AchievementRail
// (StrategyTree.jsx) and the dashboard's quick Add Achievement wizard (AddAchievementWizard.jsx),
// so both fast-add paths gate and resolve achievements identically instead of drifting apart.

export function canRecordAchievement(role, state) {
  if (state !== 'DEPLOYED') return false
  return role === 'OWNER' || role === 'EDITOR'
}

// Resolves the one unambiguous assessment period a fast-add flow (Initiative card's own "Add"
// button, the rail's search-and-log picker, the dashboard wizard) may fix an achievement to,
// without ever asking the user to pick one freely -- checked in priority order: the initiative's
// own resolved period (set when the tree fell back to Base Plan filtered by a requested year), the
// initiative's own academic year, then the tree's own year-filter. Returns null when genuinely
// ambiguous (Base Plan with no year context at all) -- callers should disable the fast path in
// that case and point the user at "View all", where every period already has its own fixed-period
// Add button.
export function resolveFixedPeriod(ini, academicYearId, academicYears, assessmentPeriods) {
  const name = ini.assessmentPeriodName
    || academicYears.find((y) => y.id === ini.academicYearId)?.name
    || academicYears.find((y) => y.id === academicYearId)?.name
  if (!name) return null
  return { name, id: assessmentPeriods.find((p) => p.name === name)?.id }
}
