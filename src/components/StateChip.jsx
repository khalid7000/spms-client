const LABELS = {
  CREATION: 'Creation',
  REVIEW: 'Review',
  DEPLOYED: 'Deployed',
  FROZEN: 'Frozen',
}

export default function StateChip({ state }) {
  return (
    <span className={`state-chip ${state}`}>{LABELS[state] ?? state}</span>
  )
}
