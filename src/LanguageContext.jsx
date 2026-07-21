// Owns the active language + text direction, and (since direction has to be reactive, not a
// static prop set once at render time) owns antd's <ConfigProvider> too -- this is why
// ConfigProvider moved here from main.jsx instead of staying a static top-level wrapper.
//
// Mirrors TerminologyContext.jsx's exact pattern: reads ENABLED_LANGUAGES off the same
// ['organization-settings-public'] query Terminology already uses (same query key = no extra
// network call), gated to authenticated users only -- matching how that setting is actually meant
// to apply (see LanguageSwitcher.jsx for why the pre-login Login page uses the full
// XML-available list instead).
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ConfigProvider } from 'antd'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import 'dayjs/locale/ar'
import i18n from './i18n'
import { loadLanguageManifest } from './i18n/languageManifest'
import { getOrganizationSettingsPublic } from './api/admin'
import { useAuth } from './auth/AuthContext'

const STORAGE_KEY = 'spms.language'
const FALLBACK = 'en'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const { isAuthenticated } = useAuth()

  const [languages, setLanguages] = useState([]) // [{code, displayName, direction}, ...]
  const [language, setLanguageState] = useState(() => localStorage.getItem(STORAGE_KEY) || FALLBACK)

  useEffect(() => {
    loadLanguageManifest().then(setLanguages)
  }, [])

  const { data: settings = [] } = useQuery({
    queryKey: ['organization-settings-public'],
    queryFn: getOrganizationSettingsPublic,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
  const enabledLanguagesSetting = settings.find((s) => s.key === 'ENABLED_LANGUAGES')?.value
  const enabledCodes = enabledLanguagesSetting ? enabledLanguagesSetting.split(',').filter(Boolean) : null

  // Pre-login (or before the setting has loaded): every language we have an XML for is offerable.
  // Post-login: only what the Admin enabled -- if the stored preference isn't in that set (e.g. an
  // Admin disabled a language the user had picked), fall back to English rather than getting stuck
  // showing a language the Admin didn't approve for the in-app experience.
  const selectableCodes = isAuthenticated && enabledCodes ? enabledCodes : languages.map((l) => l.code)
  const effectiveLanguage = selectableCodes.length === 0 || selectableCodes.includes(language)
    ? language
    : FALLBACK

  useEffect(() => {
    i18n.changeLanguage(effectiveLanguage)
    // dayjs's own locale drives relative-time strings (CommentDrawer's "2 hours ago") and date
    // formatting (AuditLogPage, AcademicYearsPage) -- separate from i18next, which only owns our
    // own XML-sourced UI strings. Falls back silently to English formatting for any language we
    // don't have a bundled dayjs locale for yet (see the ar-only import above).
    dayjs.locale(effectiveLanguage === 'ar' ? 'ar' : 'en')
    const meta = languages.find((l) => l.code === effectiveLanguage)
    const direction = meta?.direction || 'ltr'
    document.documentElement.dir = direction
    document.documentElement.lang = effectiveLanguage
  }, [effectiveLanguage, languages])

  const setLanguage = (code) => {
    localStorage.setItem(STORAGE_KEY, code)
    setLanguageState(code)
  }

  const direction = languages.find((l) => l.code === effectiveLanguage)?.direction || 'ltr'

  const availableForSwitcher = useMemo(
    () => languages.filter((l) => selectableCodes.length === 0 || selectableCodes.includes(l.code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [languages, isAuthenticated, enabledLanguagesSetting],
  )

  const value = {
    language: effectiveLanguage,
    setLanguage,
    direction,
    languages: availableForSwitcher,
  }

  return (
    <ConfigProvider
      direction={direction}
      theme={{
        token: {
          colorPrimary: '#13223a',
          fontFamily: "'Inter', system-ui, sans-serif",
          borderRadius: 6,
        },
      }}
    >
      <LanguageContext.Provider value={value}>
        {children}
      </LanguageContext.Provider>
    </ConfigProvider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
