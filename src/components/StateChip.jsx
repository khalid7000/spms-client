import { useTranslation } from 'react-i18next'

const KEYS = {
  CREATION: 'state.creation',
  REVIEW: 'state.review',
  // Backend enters this while deploy approvals are outstanding (ApprovalService sets it when a
  // deploy request needs more than one approver) — previously had no label/color here at all, so
  // the chip rendered as invisible white-on-white text (base .state-chip is white text with no
  // background unless a state-specific class matches).
  APPROVAL_PENDING: 'state.approvalPending',
  DEPLOYED: 'state.deployed',
  FROZEN: 'state.frozen',
}

export default function StateChip({ state }) {
  const { t } = useTranslation()
  return (
    <span className={`state-chip ${state}`}>{KEYS[state] ? t(KEYS[state]) : state}</span>
  )
}
