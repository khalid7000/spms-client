// App-wide display-label overrides (e.g. "Academic Year" -> "Fiscal Year") so the product reads
// naturally for whatever organization it's deployed at, without a code change -- see the admin
// Organization Settings page. Named getters (not a raw `t(key)` map) so a typo'd key surfaces at
// author time instead of silently rendering `undefined` in production.
import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationSettingsPublic } from './api/admin'
import { useAuth } from './auth/AuthContext'

const DEFAULTS = {
  ACADEMIC_YEAR_LABEL: 'Academic Year',
  TOP_LEVEL_STRATEGY_LABEL: 'University Strategy',
  DEFAULT_HEAD_TITLE_LABEL: 'Head',
}

const TerminologyContext = createContext(null)

export function TerminologyProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const { data: settings = [] } = useQuery({
    queryKey: ['organization-settings-public'],
    queryFn: getOrganizationSettingsPublic,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  const values = { ...DEFAULTS }
  settings.forEach((s) => { values[s.key] = s.value })

  const terminology = {
    academicYearLabel: values.ACADEMIC_YEAR_LABEL,
    topLevelStrategyLabel: values.TOP_LEVEL_STRATEGY_LABEL,
    defaultHeadTitleLabel: values.DEFAULT_HEAD_TITLE_LABEL,
  }

  return (
    <TerminologyContext.Provider value={terminology}>
      {children}
    </TerminologyContext.Provider>
  )
}

export function useTerminology() {
  const ctx = useContext(TerminologyContext)
  if (!ctx) throw new Error('useTerminology must be used within TerminologyProvider')
  return ctx
}
