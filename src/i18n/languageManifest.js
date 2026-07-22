// Single source of truth for "which languages does the system have XML for, and what are their
// display name / text direction". Reused by LanguageContext (the switcher's option list),
// LanguageSwitcher, and the admin Organization Settings page's "Enabled Languages" checkbox list.
//
// available.json is the only thing that has to be discoverable without a server directory listing
// (a browser can't list public/locales/*.xml itself) -- adding a new language is: copy an XML,
// translate it, add its code here.
import { fetchLanguageXml } from './xmlBackend'

export async function loadLanguageManifest() {
  // Same base-path concern as fetchLanguageXml above -- must not hardcode a root-relative path.
  const res = await fetch(`${import.meta.env.BASE_URL}locales/available.json`)
  const codes = await res.json()
  const entries = await Promise.all(
    codes.map(async (code) => {
      try {
        const { meta } = await fetchLanguageXml(code)
        return meta
      } catch {
        // A code listed in available.json with a missing/broken XML file shouldn't take down the
        // whole switcher -- just drop it from the list.
        return null
      }
    }),
  )
  return entries.filter(Boolean)
}
