import { useTranslation } from 'react-i18next'

const KEYS = {
  OWNER: 'role.owner',
  EDITOR: 'role.editor',
  COMMENTER: 'role.commenter',
  VIEWER: 'role.viewer',
}

export default function RoleChip({ role }) {
  const { t } = useTranslation()
  return (
    <span className={`role-chip ${role}`}>{KEYS[role] ? t(KEYS[role]) : role}</span>
  )
}
