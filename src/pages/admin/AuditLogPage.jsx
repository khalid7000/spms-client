import { useState } from 'react'
import { Table, Select, Input, Tag, Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAuditLogs, getAdminStrategies } from '../../api/admin'
import dayjs from 'dayjs'

export default function AuditLogPage() {
  const { t } = useTranslation()
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
      title: t('auditLog.colTime'),
      dataIndex: 'createdAt',
      width: 180,
      render: (v) => (
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#6b7280' }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm')}
        </span>
      ),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: t('auditLog.colAction'),
      dataIndex: 'action',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('auditLog.colUser'),
      dataIndex: 'user',
      render: (v) => v ? `${v.fname} ${v.lname}` : '—',
    },
    {
      title: t('auditLog.colEntity'),
      render: (_, r) => (
        <span style={{ fontSize: 13 }}>
          {r.entityType} #{r.entityId}
        </span>
      ),
    },
    {
      title: t('nav.strategy'),
      render: (_, r) => r.strategy?.title || '—',
    },
    {
      title: t('auditLog.colDetails'),
      dataIndex: 'details',
      ellipsis: true,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('nav.auditLogs')}</h1>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select
          placeholder={t('auditLogPage.filterByStrategyPlaceholder')}
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
          showTotal: (count) => t('auditLog.entriesTotal', { count }),
        }}
        size="small"
      />
    </div>
  )
}
