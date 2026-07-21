import { useState, useMemo } from 'react'
import { Table, Button, Input, Tag, Select, Popconfirm, message } from 'antd'
import { SearchOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAdminStrategies, getPlanningCycles, deleteAdminStrategy } from '../../api/admin'
import { useNavigate } from 'react-router-dom'
import StateChip from '../../components/StateChip'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'

const TABLE_PREFS_KEY = 'spms.adminStrategiesTable.prefs'

const STATES = ['CREATION', 'REVIEW', 'DEPLOYED', 'FROZEN']

export default function StrategiesAdminPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState(null)
  const [cycleFilter, setCycleFilter] = useState(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { prefs, sortOrderFor, handleTableChange } = useTablePrefs(TABLE_PREFS_KEY)

  const deleteMutation = useMutation({
    mutationFn: deleteAdminStrategy,
    onSuccess: () => {
      message.success(t('strategiesAdmin.strategyDeleted'))
      qc.invalidateQueries({ queryKey: ['admin-strategies'] })
      qc.invalidateQueries({ queryKey: ['admin-cycles'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('strategiesAdmin.deleteFailed')),
  })

  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: getAdminStrategies,
  })

  const { data: cycles = [] } = useQuery({
    queryKey: ['admin-cycles'],
    queryFn: getPlanningCycles,
  })

  const cycleOptions = useMemo(() =>
    cycles.map((c) => ({ value: c.id, label: c.name })),
  [cycles])

  const filtered = strategies.filter((s) => {
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase())
    const matchState = !stateFilter || s.state === stateFilter
    const matchCycle = !cycleFilter || s.planningCycleId === cycleFilter
    return matchSearch && matchState && matchCycle
  })

  const columns = [
    {
      title: t('common.title'),
      dataIndex: 'title',
      key: 'title',
      render: (v, r) => (
        <span
          style={{ fontWeight: 500, cursor: 'pointer', color: '#2563eb' }}
          onClick={() => navigate(`/admin/strategies/${r.id}`)}
        >
          {v}
        </span>
      ),
      sorter: (a, b) => compareStrings(a.title, b.title),
      sortOrder: sortOrderFor('title'),
    },
    {
      title: t('common.type'),
      dataIndex: 'strategyType',
      key: 'strategyType',
      render: (v) => (
        <Tag color={v === 'UNIVERSITY' ? 'geekblue' : 'green'}>{v}</Tag>
      ),
      sorter: (a, b) => compareStrings(a.strategyType, b.strategyType),
      sortOrder: sortOrderFor('strategyType'),
    },
    {
      title: t('strategiesAdmin.stateColLabel'),
      dataIndex: 'state',
      key: 'state',
      render: (v) => <StateChip state={v} />,
      sorter: (a, b) => compareStrings(a.state, b.state),
      sortOrder: sortOrderFor('state'),
    },
    {
      title: t('common.department'),
      dataIndex: 'departmentName',
      key: 'departmentName',
      render: (v) => v || '—',
      sorter: (a, b) => compareStrings(a.departmentName, b.departmentName),
      sortOrder: sortOrderFor('departmentName'),
    },
    {
      title: t('strategyCreation.colPlanningCycle'),
      dataIndex: 'planningCycleName',
      key: 'planningCycleName',
      sorter: (a, b) => compareStrings(a.planningCycleName, b.planningCycleName),
      sortOrder: sortOrderFor('planningCycleName'),
    },
    {
      title: t('strategiesAdmin.thresholdColLabel'),
      dataIndex: 'achievementThreshold',
      key: 'achievementThreshold',
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>{v}</span>
      ),
      sorter: (a, b) => (a.achievementThreshold ?? 0) - (b.achievementThreshold ?? 0),
      sortOrder: sortOrderFor('achievementThreshold'),
    },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="small" onClick={() => navigate(`/admin/strategies/${r.id}`)}>
            {t('strategiesAdmin.manageButton')}
          </Button>
          {!r.hasGoals && (
            <Popconfirm
              title={t('strategiesAdmin.deleteConfirmTitle')}
              description={t('strategiesAdmin.deleteConfirmDescription')}
              onConfirm={() => deleteMutation.mutate(r.id)}
              okText={t('strategiesAdmin.deleteOkText')}
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending && deleteMutation.variables === r.id}
              />
            </Popconfirm>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('nav.strategies')}</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder={t('strategiesAdmin.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <Select
          placeholder={t('strategiesAdmin.filterByStatePlaceholder')}
          allowClear
          value={stateFilter}
          onChange={setStateFilter}
          style={{ width: 160 }}
          options={STATES.map((s) => ({ value: s, label: s }))}
        />
        <Select
          placeholder={t('strategiesAdmin.filterByCyclePlaceholder')}
          allowClear
          value={cycleFilter}
          onChange={setCycleFilter}
          style={{ width: 220 }}
          showSearch
          optionFilterProp="label"
          options={cycleOptions}
        />
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: prefs.current,
          pageSize: prefs.pageSize,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => t('achievementLog.totalCount', { count: total }),
        }}
        onChange={handleTableChange}
        size="middle"
      />
    </div>
  )
}
