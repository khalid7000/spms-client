// Small "Total: N" label shown above a list Table -- used by every admin/member list page so the
// total item count reads consistently everywhere, including tables with pagination={false} where
// AntD's own pagination-bar showTotal has nowhere to render.
import { useTranslation } from 'react-i18next'

export default function TableTotal({ count }) {
  const { t } = useTranslation()
  return (
    <div style={{ marginBottom: 8, color: '#6b7280', fontSize: 13 }}>
      {t('achievementLog.totalCount', { count })}
    </div>
  )
}
