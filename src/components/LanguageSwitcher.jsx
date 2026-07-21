// Small language picker used on the Login page (pre-auth, offers every language we have an XML
// for) and in MemberLayout's header (post-auth, offers only what the Admin enabled) -- see
// LanguageContext.jsx for how `languages` is scoped differently in each case.
import { Select } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../LanguageContext'

export default function LanguageSwitcher({ style }) {
  const { t } = useTranslation()
  const { language, setLanguage, languages } = useLanguage()

  if (languages.length <= 1) return null

  return (
    <Select
      value={language}
      onChange={setLanguage}
      size="small"
      style={{ width: 130, ...style }}
      suffixIcon={<GlobalOutlined />}
      aria-label={t('languageSwitcher.label')}
      options={languages.map((l) => ({ value: l.code, label: l.displayName }))}
    />
  )
}
