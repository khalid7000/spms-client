// StratAlign mark: three ascending gold bars (strategic growth) threaded by a single rising line
// ending in an arrowhead (distinct efforts lined up on one trajectory -- "alignment"), on a navy
// badge matching the app's existing sidebar/login palette (--sidebar-bg / --gold in index.css).
import { useId } from 'react'

const NAVY = '#13223a'
const GOLD = '#c9a24b'

export function LogoMark({ size = 32, style }) {
  const markerId = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={style}
      role="img"
      aria-label="StratAlign"
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={GOLD} />
        </marker>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={NAVY} />
      <rect x="14" y="32" width="8" height="14" rx="1.5" fill={GOLD} opacity="0.85" />
      <rect x="28" y="24" width="8" height="22" rx="1.5" fill={GOLD} opacity="0.92" />
      <rect x="42" y="16" width="8" height="30" rx="1.5" fill={GOLD} />
      <polyline
        points="18,32 32,24 46,16 51,11"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  )
}

export default function Logo({ size = 32, textSize, textColor = GOLD, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <LogoMark size={size} />
      <span
        style={{
          fontSize: textSize || size * 0.62,
          fontWeight: 700,
          color: textColor,
          letterSpacing: '-0.3px',
          lineHeight: 1,
        }}
      >
        StratAlign
      </span>
    </div>
  )
}
