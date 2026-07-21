// Read-only user detail view: profile info (incl. system roles) plus their per-strategy
// role assignments, with the ability to remove an assignment.
import { Button, Card, Descriptions, Table, Tag, Popconfirm, message } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getUsers, getUserAssignments, deleteAssignment } from '../../api/admin'
import StateChip from '../../components/StateChip'
import RoleChip from '../../components/RoleChip'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'

export default function UserDetailPage() {
  const { t } = useTranslation()
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
      message.success(t('userDetail.assignmentRemoved'))
      qc.invalidateQueries({ queryKey: ['user-assignments', id] })
    },
    onError: () => message.error(t('userDetail.removeAssignmentFailed')),
  })

  const columns = [
    {
      title: t('approvals.colStrategy'),
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
    { title: t('common.role'), render: (_, r) => <RoleChip role={r.role} /> },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <Popconfirm
          title={t('userDetail.removeAssignmentConfirm')}
          onConfirm={() => deleteMutation.mutate(r.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>
            {t('userDetail.removeButton')}
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
        {t('userDetail.backToUsers')}
      </Button>

      {user && (
        <Card style={{ marginBottom: 20 }}>
          <Descriptions title={`${user.fname} ${user.lname}`} column={2}>
            <Descriptions.Item label={t('common.email')}>{user.email}</Descriptions.Item>
            <Descriptions.Item label={t('common.title')}>{user.title || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('common.department')}>
              {user.department?.name || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('usersAdmin.orgGroupLabel')}>
              {user.orgGroup?.title || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.role')}>
              {user.systemRoles?.includes('ADMIN') && <Tag color="purple">{t('usersAdmin.adminRoleTag')}</Tag>}
              {user.systemRoles?.includes('HR') && <Tag color="blue">{t('usersAdmin.hrRoleTag')}</Tag>}
              {user.systemRoles?.includes('USER_ADMIN') && <Tag color="cyan">{t('usersAdmin.userAdminRoleTag')}</Tag>}
              {!user.systemRoles?.length && <Tag>{t('usersAdmin.employeeRoleTag')}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.status')}>
              {user.active ? <Tag color="green">{t('departmentsAdmin.activeTag')}</Tag> : <Tag>{t('departmentsAdmin.inactiveTag')}</Tag>}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title={t('userDetail.strategyAssignmentsTitle')}>
        <TableTotal count={assignments.length} />
        <Table
          dataSource={assignments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: t('userDetail.noAssignments') }}
        />
      </Card>
    </div>
  )
}
