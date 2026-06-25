const LABELS = {
  OWNER: 'Owner',
  EDITOR: 'Editor',
  COMMENTER: 'Commenter',
  VIEWER: 'Viewer',
}

export default function RoleChip({ role }) {
  return (
    <span className={`role-chip ${role}`}>{LABELS[role] ?? role}</span>
  )
}
