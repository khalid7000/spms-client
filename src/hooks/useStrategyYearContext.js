import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStrategy } from '../api/strategies'
import { getAcademicYears, getMostRecentAcademicYear } from '../api/academicYears'

// Fetches a strategy and auto-resolves which academic year's copy to view: defaults to the most
// recent year under the strategy's planning cycle instead of leaving it on the year-less Base
// Plan (achievements/initiatives added there attach to the base structure and become invisible
// under every specific year filter afterward -- see
// AcademicYearService.backfillInitiativeCopiesForNewlyDeployedStrategy for the backend half of
// this), then falls back to Base Plan once if that auto-picked year turns out to have zero
// initiatives anywhere in the tree (a strategy that was never actually frozen/copied for any
// year). Shared by StrategyDetailPage (the full tree view) and the dashboard's quick Add
// Achievement wizard so both default to exactly the same view of "the plan".
export function useStrategyYearContext(strategyId) {
  const [academicYearId, setAcademicYearIdState] = useState(null)

  // yearManagedRef guards both effects below against looping: it's a ref (not state), so flipping
  // it never itself triggers a re-render/re-run, and once it's true neither effect touches
  // academicYearId again -- whether because the caller picked a year itself (via the wrapped
  // setAcademicYearId below) or because the auto-pick's fallback already ran once.
  const yearManagedRef = useRef(false)

  // Any deliberate external call (e.g. StrategyDetailPage's year <Select>) counts as "user
  // managed" -- wrap the raw setter so callers never need to know about yearManagedRef themselves.
  const setAcademicYearId = (id) => {
    yearManagedRef.current = true
    setAcademicYearIdState(id)
  }

  const stratKey = ['strategy', strategyId, academicYearId]
  const { data: strategy, isLoading: strategyLoading } = useQuery({
    queryKey: stratKey,
    queryFn: () => getStrategy(strategyId, academicYearId),
    enabled: !!strategyId,
  })

  const { data: allAcademicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: getAcademicYears,
    enabled: !!strategy && (strategy.state === 'DEPLOYED' || strategy.state === 'FROZEN'),
  })
  // Academic years belong to one university strategy's cycle -- only years under this strategy's
  // own planning cycle apply here (a department strategy shares its cycle with the university
  // strategy overseeing it). Without this, every strategy's picker would list every academic year
  // in the system, including ones from unrelated cycles with nothing actually copied for it.
  const academicYears = allAcademicYears.filter((y) => y.planningCycleId === strategy?.planningCycleId)

  useEffect(() => {
    if (!academicYearId && !yearManagedRef.current && academicYears.length > 0) {
      setAcademicYearIdState(getMostRecentAcademicYear(academicYears).id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId, academicYears.length])

  useEffect(() => {
    if (!yearManagedRef.current && academicYearId && strategy) {
      const hasAnyInitiative = (strategy.goals ?? []).some((g) =>
        (g.objectives ?? []).some((o) => (o.initiatives ?? []).length > 0)
      )
      if (!hasAnyInitiative) {
        yearManagedRef.current = true
        setAcademicYearIdState(null)
      }
    }
  }, [academicYearId, strategy])

  const assessmentPeriods = strategy?.assessmentPeriods ?? []

  return {
    strategy, strategyLoading, stratKey,
    academicYearId, setAcademicYearId, academicYears, assessmentPeriods,
  }
}
