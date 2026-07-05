import { Progress } from 'antd'

export default function SwotProgressBar({ label, done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
        <span>{label}</span>
        <span>{done}/{total} submitted</span>
      </div>
      <Progress percent={pct} showInfo={false} strokeColor="#13223a" size="small" />
    </div>
  )
}
