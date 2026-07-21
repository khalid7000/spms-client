import { Progress } from 'antd'
import { useTranslation } from 'react-i18next'

export default function SwotProgressBar({ label, done, total }) {
  const { t } = useTranslation()
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
        <span>{label}</span>
        <span>{t('swot.submittedCount', { done, total })}</span>
      </div>
      <Progress percent={pct} showInfo={false} strokeColor="#13223a" size="small" />
    </div>
  )
}
