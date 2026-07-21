// i18next setup, imported once from main.jsx for its side effect (registers i18next before the
// app renders). Actual language switching happens later via LanguageContext calling
// i18next.changeLanguage(...); this just gets the engine running with a safe default.
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import XmlBackend from './xmlBackend'

i18next
  .use(XmlBackend)
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes -- avoid double-escaping
    react: { useSuspense: false },
  })

export default i18next
