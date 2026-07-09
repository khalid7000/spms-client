// Read-only user detail view: profile info (incl. system roles) plus their per-strategy
// role assignments, with the ability to remove an assignment.
import { Button, Card, Descriptions, Table, Tag, Popconfirm, message } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getUserAssignments, deleteAssignment } from '../../api/admin'
import StateChip from '../../components/StateChip'
import RoleChip from '../../components/RoleChip'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers })
  const user = users.find((u) => String(u.id) === id)

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['user-assignments', id],
    queryFn: () => getUserAssignments(id),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      message.success('Assignment removed')
      qc.invalidateQueries({ queryKey: ['user-assignments', id] })
    },
    onError: () => message.error('Failed to remove assignment'),
  })

  const columns = [
    {
      title: 'Strategy',
      render: (_, r) => (
        <span
          style={{ fontWeight: 500, cursor: 'pointer', color: '#2563eb' }}
          onClick={() => navigate(`/admin/strategies/${r.strategyId}`)}
        >
          {r.strategyTitle}
        </span>
      ),
      sorter: (a, b) => compareStrings(a.strategyTitle, b.strategyTitle),
    },
    { title: 'Role', render: (_, r) => <RoleChip role={r.role} /> },
    {
      title: 'Actions',
      render: (_, r) => (
        <Popconfirm
          title="Remove this assignment?"
          onConfirm={() => deleteMutation.mutate(r.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>
            Remove
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/admin/users')}
        style={{ marginBottom: 16, color: '#6b7280' }}
      >
        Back to Users
      </Button>

      {user && (
        <Card style={{ marginBottom: 20 }}>
          <Descriptions title={`${user.fname} ${user.lname}`} column={2}>
            <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
            <Descriptions.Item label="Title">{user.title || '—'}</Descriptions.Item>
            <Descriptions.Item label="Department">
              {user.department?.name || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Role">
              {user.systemRoles?.includes('ADMIN') && <Tag color="purple">Admin</Tag>}
              {user.systemRoles?.includes('HR') && <Tag color="blue">HR</Tag>}
              {!user.systemRoles?.length && <Tag>Employee</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {user.active ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title="Strategy Assignments">
        <TableTotal count={assignments.length} />
        <Table
          dataSource={assignments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: 'No strategy assignments' }}
        />
      </Card>
    </div>
  )
}
