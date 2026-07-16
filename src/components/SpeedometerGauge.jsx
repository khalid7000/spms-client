import { Typography } from 'antd'

const { Text } = Typography

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

function arcPath(cx, cy, r, fromAngle, toAngle) {
  const p1 = polarPoint(cx, cy, r, fromAngle)
  const p2 = polarPoint(cx, cy, r, toAngle)
  const largeArc = Math.abs(fromAngle - toAngle) > 180 ? 1 : 0
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`
}

const CX = 100
const CY = 100
const ARC_R = 80
const NEEDLE_R = 60

/**
 * Small semicircular "speedometer" -- fixed red/amber/green zones spanning the bottom, middle, and
 * top third of `max`, with a needle pointing at `value`. Used wherever we'd otherwise show a bare
 * "x / y" on-track count, so the proportion reads at a glance instead of requiring mental math.
 */
export default function SpeedometerGauge({ value, max, label, size = 108 }) {
  const height = Math.round(size * 0.6)

  if (!max) {
    return (
      <div style={{ width: size, textAlign: 'center' }}>
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>No data</Text>
        </div>
        {label && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{label}</Text>}
      </div>
    )
  }

  const fraction = Math.max(0, Math.min(1, value / max))
  const needleAngle = 180 - fraction * 180
  const needleTip = polarPoint(CX, CY, NEEDLE_R, needleAngle)

  return (
    <div style={{ width: size, textAlign: 'center' }}>
      <svg viewBox="0 0 200 112" width={size} height={height}>
        <path d={arcPath(CX, CY, ARC_R, 180, 120)} stroke="#ff4d4f" strokeWidth={16} fill="none" strokeLinecap="round" />
        <path d={arcPath(CX, CY, ARC_R, 120, 60)} stroke="#fa8c16" strokeWidth={16} fill="none" strokeLinecap="round" />
        <path d={arcPath(CX, CY, ARC_R, 60, 0)} stroke="#52c41a" strokeWidth={16} fill="none" strokeLinecap="round" />
        <line x1={CX} y1={CY} x2={needleTip.x} y2={needleTip.y} stroke="#1a2035" strokeWidth={4} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={7} fill="#1a2035" />
      </svg>
      <div style={{ marginTop: -4, fontWeight: 700, fontSize: 14, color: '#1a2035' }}>
        {value} / {max}
      </div>
      {label && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 1 }}>{label}</Text>}
    </div>
  )
}
