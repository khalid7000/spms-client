// Where a top-of-hierarchy head decides pending VSM author delegation requests (Phase 4). Kept as
// its own small page rather than folded into the existing (Strategy-only) ApprovalsPage.jsx --
// that page's single-approve-action table shape doesn't fit a flow that also needs Reject, and
// merging them was a bigger call than this round of work needed.
import { Card, Button, Table, message, Popconfirm, Empty } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getPendingVsmAuthorGrantsForMe, approveVsmAuthorGrant, rejectVsmAuthorGrant } from '../../../api/vsmAuthorGrants'

export default function VsmAuthorGrantApprovalsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['vsm-author-grant-approvals'], queryFn: getPendingVsmAuthorGrantsForMe,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vsm-author-grant-approvals'] })

  const decideMut = useMutation({
    mutationFn: ({ id, approve }) => (approve ? approveVsmAuthorGrant(id) : rejectVsmAuthorGrant(id)),
    onSuccess: () => { message.success(t('vsmGrants.decisionSuccess')); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || t('vsmGrants.decisionError')),
  })

  const columns = [
    { title: t('vsmGrants.colEmployee'), dataIndex: 'employeeName' },
    { title: t('vsmGrants.colScope'), render: (_, r) => r.departmentName || r.orgGroupName },
    { title: t('vsmGrants.colRequestedBy'), dataIndex: 'grantedByAdminName' },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <>
          <Popconfirm title={t('vsmGrants.approveConfirm')} onConfirm={() => decideMut.mutate({ id: r.id, approve: true })}>
            <Button type="primary" size="small" icon={<CheckOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a', marginRight: 8 }}>
              {t('vsmGrants.approve')}
            </Button>
          </Popconfirm>
          <Popconfirm title={t('vsmGrants.rejectConfirm')} onConfirm={() => decideMut.mutate({ id: r.id, approve: false })}>
            <Button danger size="small" icon={<CloseOutlined />}>{t('vsmGrants.reject')}</Button>
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('vsmGrants.approvalsTitle')}</h1>
      </div>
      <Card>
        {pending.length === 0 && !isLoading ? (
          <Empty description={t('vsmGrants.noneAwaiting')} />
        ) : (
          <Table dataSource={pending} columns={columns} rowKey="id" loading={isLoading} pagination={false} />
        )}
      </Card>
    </div>
  )
}
