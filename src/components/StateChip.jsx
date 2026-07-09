const LABELS = {
  CREATION: 'Creation',
  REVIEW: 'Review',
  // Backend enters this while deploy approvals are outstanding (ApprovalService sets it when a
  // deploy request needs more than one approver) — previously had no label/color here at all, so
  // the chip rendered as invisible white-on-white text (base .state-chip is white text with no
  // background unless a state-specific class matches).
  APPROVAL_PENDING: 'Awaiting Approval',
  DEPLOYED: 'Deployed',
  FROZEN: 'Frozen',
}

export default function StateChip({ state }) {
  return (
    <span className={`state-chip ${state}`}>{LABELS[state] ?? state}</span>
  )
}
