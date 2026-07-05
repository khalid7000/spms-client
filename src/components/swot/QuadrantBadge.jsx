const LABELS = {
  STRENGTH: 'Strength',
  WEAKNESS: 'Weakness',
  OPPORTUNITY: 'Opportunity',
  THREAT: 'Threat',
}

export default function QuadrantBadge({ quadrant }) {
  return <span className={`swot-chip ${quadrant}`}>{LABELS[quadrant] ?? quadrant}</span>
}
