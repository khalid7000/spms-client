import { useState } from 'react'
import { Table, Select, Input, Tag, Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs, getAdminStrategies } from '../../api/admin'
import dayjs from 'dayjs'

export default function AuditLogPage() {
  const [strategyId, setStrategyId] = useState(null)
  const [page, setPage] = useState(0)

  const { data: strategies = [] } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: getAdminStrategies,
  })

  const { data: logsPage, isLoading } = useQuery({
    queryKey: ['audit-logs', strategyId, page],
    queryFn: () => getAuditLogs({ strategyId, page, size: 50 }),
  })

  const logs = logsPage?.content ?? []
  const total = logsPage?.totalElements ?? 0

  const columns = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      width: 180,
      render: (v) => (
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#6b7280' }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm')}
        </span>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'User',
      dataIndex: 'user',
      render: (v) => v ? `${v.fname} ${v.lname}` : '—',
    },
    {
      title: 'Entity',
      render: (_, r) => (
        <span style={{ fontSize: 13 }}>
          {r.entityType} #{r.entityId}
        </span>
      ),
    },
    {
      title: 'Strategy',
      render: (_, r) => r.strategy?.title || '—',
    },
    {
      title: 'Details',
      dataIndex: 'details',
      ellipsis: true,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select
          placeholder="Filter by strategy"
          allowClear
          value={strategyId}
          onChange={(v) => { setStrategyId(v); setPage(0) }}
          style={{ width: 320 }}
          showSearch
          optionFilterProp="label"
          options={strategies.map((s) => ({ value: s.id, label: s.title }))}
        />
      </div>

      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page + 1,
          pageSize: 50,
          total,
          onChange: (p) => setPage(p - 1),
          showTotal: (t) => `${t} entries`,
        }}
        size="small"
      />
    </div>
  )
}
