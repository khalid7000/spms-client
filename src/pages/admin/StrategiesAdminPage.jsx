import { useState } from 'react'
import { Table, Button, Input, Tag, Select } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getAdminStrategies } from '../../api/admin'
import { useNavigate } from 'react-router-dom'
import StateChip from '../../components/StateChip'

const STATES = ['CREATION', 'REVIEW', 'DEPLOYED', 'FROZEN']

export default function StrategiesAdminPage() {
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState(null)
  const navigate = useNavigate()

  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: getAdminStrategies,
  })

  const filtered = strategies.filter((s) => {
    const matchSearch =
      !search || s.title.toLowerCase().includes(search.toLowerCase())
    const matchState = !stateFilter || s.state === stateFilter
    return matchSearch && matchState
  })

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      render: (v, r) => (
        <span
          style={{ fontWeight: 500, cursor: 'pointer', color: '#2563eb' }}
          onClick={() => navigate(`/admin/strategies/${r.id}`)}
        >
          {v}
        </span>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'strategyType',
      render: (v) => (
        <Tag color={v === 'UNIVERSITY' ? 'geekblue' : 'green'}>{v}</Tag>
      ),
    },
    {
      title: 'State',
      dataIndex: 'state',
      render: (v) => <StateChip state={v} />,
    },
    {
      title: 'Department',
      dataIndex: 'departmentName',
      render: (v) => v || '—',
    },
    {
      title: 'Planning Cycle',
      dataIndex: 'planningCycleName',
    },
    {
      title: 'Threshold',
      dataIndex: 'achievementThreshold',
      align: 'center',
      render: (v) => (
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>{v}</span>
      ),
    },
    {
      title: 'Actions',
      render: (_, r) => (
        <Button size="small" onClick={() => navigate(`/admin/strategies/${r.id}`)}>
          Manage
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Strategies</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input
          placeholder="Search strategies…"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <Select
          placeholder="Filter by state"
          allowClear
          value={stateFilter}
          onChange={setStateFilter}
          style={{ width: 160 }}
          options={STATES.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        size="middle"
      />
    </div>
  )
}
