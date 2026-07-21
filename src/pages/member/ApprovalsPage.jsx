import { Link } from 'react-router-dom'
import { Table, Button, Tag, message, Popconfirm, Typography, Empty } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getMyPendingApprovals, approveStrategy } from '../../api/approvals'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { useTerminology } from '../../TerminologyContext'

const { Text } = Typography

export default function ApprovalsPage() {
  const { t } = useTranslation()
  const { topLevelStrategyLabel } = useTerminology()
  const qc = useQueryClient()

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: getMyPendingApprovals,
  })

  const approveMutation = useMutation({
    mutationFn: approveStrategy,
    onSuccess: () => {
      message.success(t('approvals.approveSuccess'))
      qc.invalidateQueries({ queryKey: ['pending-approvals'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('approvals.approveError')),
  })

  const columns = [
    {
      title: t('approvals.colStrategy'),
      dataIndex: 'strategyTitle',
      render: (v, r) => (
        <Link to={`/strategies/${r.strategyId}`} style={{ fontWeight: 500 }}>
          {v}
        </Link>
      ),
      sorter: (a, b) => compareStrings(a.strategyTitle, b.strategyTitle),
    },
    {
      title: t('common.department'),
      dataIndex: 'strategyDepartment',
      render: (v) => v || <Text type="secondary">{topLevelStrategyLabel}</Text>,
    },
    {
      title: t('approvals.colOwner'),
      dataIndex: 'ownerName',
      render: (v, r) => `${v} (${r.ownerEmail})`,
    },
    {
      title: t('common.yourRole'),
      dataIndex: 'approverTitle',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('approvals.colRequested'),
      dataIndex: 'requestedAt',
      render: (v) => new Date(v).toLocaleDateString(),
    },
    {
      title: t('approvals.colAction'),
      render: (_, r) => (
        <Popconfirm
          title={t('approvals.confirmTitle')}
          description={t('approvals.confirmDescription')}
          onConfirm={() => approveMutation.mutate(r.strategyId)}
        >
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            {t('approvals.approveButton')}
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('approvals.title')}</h1>
      </div>
      {pending.length === 0 && !isLoading ? (
        <Empty description={t('approvals.noneAwaiting')} style={{ marginTop: 48 }} />
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
