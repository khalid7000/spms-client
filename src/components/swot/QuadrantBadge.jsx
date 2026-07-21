import { useTranslation } from 'react-i18next'

const LABEL_KEYS = {
  STRENGTH: 'swot.quadrantStrength',
  WEAKNESS: 'swot.quadrantWeakness',
  OPPORTUNITY: 'swot.quadrantOpportunity',
  THREAT: 'swot.quadrantThreat',
}

export default function QuadrantBadge({ quadrant }) {
  const { t } = useTranslation()
  return <span className={`swot-chip ${quadrant}`}>{LABEL_KEYS[quadrant] ? t(LABEL_KEYS[quadrant]) : quadrant}</span>
}
