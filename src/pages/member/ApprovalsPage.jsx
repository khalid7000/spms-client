import { Link } from 'react-router-dom'
import { Table, Button, Tag, message, Popconfirm, Typography, Empty } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMyPendingApprovals, approveStrategy } from '../../api/approvals'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { useTerminology } from '../../TerminologyContext'

const { Text } = Typography

export default function ApprovalsPage() {
  const { topLevelStrategyLabel } = useTerminology()
  const qc = useQueryClient()

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: getMyPendingApprovals,
  })

  const approveMutation = useMutation({
    mutationFn: approveStrategy,
    onSuccess: () => {
      message.success('Strategy approved')
      qc.invalidateQueries({ queryKey: ['pending-approvals'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Approval failed'),
  })

  const columns = [
    {
      title: 'Strategy',
      dataIndex: 'strategyTitle',
      render: (v, r) => (
        <Link to={`/strategies/${r.strategyId}`} style={{ fontWeight: 500 }}>
          {v}
        </Link>
      ),
      sorter: (a, b) => compareStrings(a.strategyTitle, b.strategyTitle),
    },
    {
      title: 'Department',
      dataIndex: 'strategyDepartment',
      render: (v) => v || <Text type="secondary">{topLevelStrategyLabel}</Text>,
    },
    {
      title: 'Owner',
      dataIndex: 'ownerName',
      render: (v, r) => `${v} (${r.ownerEmail})`,
    },
    {
      title: 'Your Role',
      dataIndex: 'approverTitle',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Requested',
      dataIndex: 'requestedAt',
      render: (v) => new Date(v).toLocaleDateString(),
    },
    {
      title: 'Action',
      render: (_, r) => (
        <Popconfirm
          title="Approve deployment of this strategy?"
          description="This will allow the strategy to proceed to the Deployed state once all required approvers have approved."
          onConfirm={() => approveMutation.mutate(r.strategyId)}
        >
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Approve
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pending Approvals</h1>
      </div>
      {pending.length === 0 && !isLoading ? (
        <Empty description="No strategies awaiting your approval" style={{ marginTop: 48 }} />
      ) : (
        <>
          <TableTotal count={pending.length} />
          <Table
            dataSource={pending}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={false}
          />
        </>
      )}
    </div>
  )
}
