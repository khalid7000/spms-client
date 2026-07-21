// Custom i18next backend: loads translations from public/locales/{lng}.xml instead of the usual
// JSON. Lets translators keep editing plain XML (name-value <entry> pairs) while the app still
// gets everything a real i18next backend gives for free -- interpolation, pluralization, and
// automatic fallback to English for any key a language is missing (see i18n/index.js's
// fallbackLng) -- instead of hand-rolled fetch+replace string logic.
//
// Each language's root <language code="..." displayName="..." direction="..."> attributes are its
// metadata -- explicit, not positional, so a translator reordering <entry> lines can never corrupt
// them. Stashed into `languageMeta` as each file is parsed so LanguageContext/LanguageSwitcher/the
// admin Organization Settings page don't need to re-fetch or re-parse just to read a display name.
export const languageMeta = {}

function parseLanguageXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Malformed language XML: ${parseError.textContent}`)
  }

  const root = doc.documentElement
  const code = root.getAttribute('code')
  const meta = {
    code,
    displayName: root.getAttribute('displayName') || code,
    direction: root.getAttribute('direction') === 'rtl' ? 'rtl' : 'ltr',
  }
  if (code) languageMeta[code] = meta

  const resources = {}
  root.querySelectorAll('entry').forEach((el) => {
    const key = el.getAttribute('key')
    if (key) resources[key] = el.textContent
  })
  return { meta, resources }
}

export async function fetchLanguageXml(code) {
  const res = await fetch(`/locales/${code}.xml`)
  if (!res.ok) throw new Error(`No translation file for language "${code}" (${res.status})`)
  const text = await res.text()
  return parseLanguageXml(text)
}

export default class XmlBackend {
  static type = 'backend'

  init() {}

  read(language, namespace, callback) {
    fetchLanguageXml(language)
      .then(({ resources }) => callback(null, resources))
      .catch((err) => callback(err, null))
  }
}
