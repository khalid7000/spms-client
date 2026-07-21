import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch,
  Tag, message, Collapse, Popconfirm, Select, Spin, Divider,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ArrowRightOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getPlanningCycles, createPlanningCycle, updatePlanningCycle, deletePlanningCycle,
  getPlanningCyclePeriods, deletePeriod, getUsers,
  createAdminUniversityStrategy, getAdminStrategies,
} from '../../api/admin'
import { useNavigate } from 'react-router-dom'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { useTerminology } from '../../TerminologyContext'

const { Panel } = Collapse

function CyclePanel({ cycle, allStrategies, users, usersLoading }) {
  const { t } = useTranslation()
  const { topLevelStrategyLabel } = useTerminology()
  const [mainOpen, setMainOpen] = useState(false)
  const [unitOpen, setUnitOpen] = useState(false)
  const [mainForm] = Form.useForm()
  const [unitForm] = Form.useForm()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const cycleStrategies = allStrategies.filter((s) => s.planningCycleId === cycle.id)
  const mainStrategy = cycleStrategies.find((s) => s.strategyType === 'UNIVERSITY')
  const unitStrategies = cycleStrategies.filter((s) => s.strategyType === 'UNIT')
  const deptStrategies = cycleStrategies.filter((s) => s.strategyType === 'DEPARTMENT')

  const { data: periods = [] } = useQuery({
    queryKey: ['periods', cycle.id],
    queryFn: () => getPlanningCyclePeriods(cycle.id),
  })

  const deletePeriodMut = useMutation({
    mutationFn: deletePeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['periods', cycle.id] }),
  })

  const createMut = useMutation({
    mutationFn: (payload) => createAdminUniversityStrategy(payload),
    onSuccess: (strategy, vars) => {
      message.success(vars.type === 'UNIVERSITY'
        ? t('planningCycles.mainStrategyCreated', { label: topLevelStrategyLabel.toLowerCase() })
        : t('planningCycles.unitStrategyCreated'))
      setMainOpen(false)
      setUnitOpen(false)
      mainForm.resetFields()
      unitForm.resetFields()
      qc.invalidateQueries({ queryKey: ['admin-strategies'] })
      navigate(`/admin/strategies/${strategy.id}`)
    },
    onError: (err) => message.error(err.response?.data?.message || t('planningCycles.createStrategyFailed')),
  })

  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.fname} ${u.lname} — ${u.email}`,
  }))

  return (
    <div>
      {/* Main university strategy section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('planningCycles.mainStrategyLabel', { label: topLevelStrategyLabel })}</span>
          {!mainStrategy && (
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { mainForm.resetFields(); setMainOpen(true) }}
              style={{ background: '#13223a' }}
            >
              {t('planningCycles.setupMainStrategyButton')}
            </Button>
          )}
        </div>

        {mainStrategy ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8,
              background: '#eef2ff', border: '1px solid #c7d2fe',
            }}
          >
            <div>
              <span style={{ fontWeight: 600, color: '#3730a3' }}>{mainStrategy.title}</span>
              <Tag style={{ marginLeft: 8 }} color="geekblue">{mainStrategy.state}</Tag>
            </div>
            <Button
              size="small"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate(`/admin/strategies/${mainStrategy.id}`)}
            >
              {t('strategiesAdmin.manageButton')}
            </Button>
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: '6px 0' }}>
            {t('planningCycles.noMainStrategyYet', { label: topLevelStrategyLabel.toLowerCase() })}
          </div>
        )}
      </div>

      {/* Unit strategies section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            {t('planningCycles.unitStrategiesLabel')}
            {unitStrategies.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
                ({unitStrategies.length})
              </span>
            )}
          </span>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => { unitForm.resetFields(); setUnitOpen(true) }}
          >
            {t('planningCycles.addUnitStrategyButton')}
          </Button>
        </div>

        {unitStrategies.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unitStrategies.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px', borderRadius: 8,
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, color: '#166534' }}>{s.title}</span>
                  <Tag style={{ marginLeft: 8 }} color="green">{s.state}</Tag>
                </div>
                <Button
                  size="small"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate(`/admin/strategies/${s.id}`)}
                >
                  {t('strategiesAdmin.manageButton')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: '6px 0' }}>
            {t('planningCycles.noUnitStrategiesYet')}
          </div>
        )}
      </div>

      {/* Department strategies section */}
      {deptStrategies.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              {t('planningCycles.departmentStrategiesLabel')}
              <span style={{ marginLeft: 6, fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
                ({deptStrategies.length})
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {deptStrategies.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px', borderRadius: 8,
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500 }}>{s.title}</span>
                  {s.departmentName && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>
                      {s.departmentName}
                    </span>
                  )}
                  <Tag style={{ marginLeft: 8 }}>{s.state}</Tag>
                </div>
                <Button
                  size="small"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate(`/admin/strategies/${s.id}`)}
                >
                  {t('strategiesAdmin.manageButton')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assessment periods (read-only with delete) */}
      {periods.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('planningCycles.assessmentPeriodsLabel')}</span>
          </div>
          <TableTotal count={periods.length} />
          <Table
            dataSource={periods}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: t('common.name'), dataIndex: 'name', sorter: (a, b) => compareStrings(a.name, b.name) },
              { title: t('planningCycles.startCol'), dataIndex: 'startDate' },
              { title: t('planningCycles.endCol'), dataIndex: 'endDate' },
              {
                title: '',
                width: 60,
                render: (_, r) => (
                  <Popconfirm title={t('planningCycles.deletePeriodConfirm')} onConfirm={() => deletePeriodMut.mutate(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              },
            ]}
          />
        </>
      )}

      {/* Modal: Setup Main Top-Level Strategy */}
      <Modal
        title={t('planningCycles.setupMainStrategyTitle', { label: topLevelStrategyLabel, cycleName: cycle.name })}
        open={mainOpen}
        onCancel={() => setMainOpen(false)}
        onOk={() => mainForm.submit()}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form
          form={mainForm}
          layout="vertical"
          onFinish={(values) => createMut.mutate({ ...values, planningCycleId: cycle.id, type: 'UNIVERSITY' })}
        >
          <Form.Item name="title" label={t('planningCycles.strategyTitleLabel')} rules={[{ required: true }]}>
            <Input placeholder={`${cycle.name} ${topLevelStrategyLabel}`} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ownerId" label={t('planningCycles.ownerLabel')} rules={[{ required: true, message: t('planningCycles.selectOwnerRequired') }]}>
            <Select
              showSearch
              placeholder={t('planningCycles.selectStrategyOwnerPlaceholder')}
              optionFilterProp="label"
              loading={usersLoading}
              notFoundContent={usersLoading ? <Spin size="small" /> : t('planningCycles.noUsersFound')}
              options={userOptions}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Add Unit Strategy */}
      <Modal
        title={t('planningCycles.addUnitStrategyTitle', { cycleName: cycle.name })}
        open={unitOpen}
        onCancel={() => setUnitOpen(false)}
        onOk={() => unitForm.submit()}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form
          form={unitForm}
          layout="vertical"
          onFinish={(values) => createMut.mutate({ ...values, planningCycleId: cycle.id, type: 'UNIT' })}
        >
          <Form.Item name="title" label={t('planningCycles.strategyTitleLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('planningCycles.unitStrategyTitlePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ownerId" label={t('planningCycles.ownerLabel')} rules={[{ required: true, message: t('planningCycles.selectOwnerRequired') }]}>
            <Select
              showSearch
              placeholder={t('planningCycles.selectStrategyOwnerPlaceholder')}
              optionFilterProp="label"
              loading={usersLoading}
              notFoundContent={usersLoading ? <Spin size="small" /> : t('planningCycles.noUsersFound')}
              options={userOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function PlanningCyclesPage() {
  const { t } = useTranslation()
  const { topLevelStrategyLabel } = useTerminology()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['admin-cycles'],
    queryFn: getPlanningCycles,
  })

  const { data: allStrategies = [] } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: getAdminStrategies,
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  })

  // Populate form whenever modal opens or editing changes
  useEffect(() => {
    if (modalOpen) {
      if (editing) {
        form.setFieldsValue({
          name: editing.name,
          startYear: editing.startYear,
          endYear: editing.endYear,
          active: editing.active,
        })
      } else {
        form.resetFields()
      }
    }
  }, [modalOpen, editing, form])

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (cycle) => {
    setEditing(cycle)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    form.resetFields()
  }

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing
        ? updatePlanningCycle(editing.id, values)
        : createPlanningCycle(values),
    onSuccess: () => {
      message.success(editing ? t('planningCycles.cycleUpdated') : t('planningCycles.cycleAndMainStrategyCreated'))
      closeModal()
      qc.invalidateQueries({ queryKey: ['admin-cycles'] })
      qc.invalidateQueries({ queryKey: ['admin-strategies'] })
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.message || t('tree.operationFailed')
      message.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlanningCycle,
    onSuccess: () => {
      message.success(t('planningCycles.cycleDeleted'))
      qc.invalidateQueries({ queryKey: ['admin-cycles'] })
      qc.invalidateQueries({ queryKey: ['admin-strategies'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('planningCycles.deleteFailed')),
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('nav.planningCycles')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#13223a' }}>
          {t('planningCycles.newCycleButton')}
        </Button>
      </div>

      <Collapse accordion>
        {cycles.map((cycle) => {
          const hasStrategies = allStrategies.some((s) => s.planningCycleId === cycle.id)
          return (
          <Panel
            key={cycle.id}
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600 }}>{cycle.name}</span>
                <span style={{ color: '#6b7280', fontSize: 13 }}>
                  {cycle.startYear}–{cycle.endYear}
                </span>
                {cycle.active && <Tag color="green">{t('departmentsAdmin.activeTag')}</Tag>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => { e.stopPropagation(); openEdit(cycle) }}
                  >
                    {t('goalSetting.editButton')}
                  </Button>
                  {!hasStrategies && (
                    <Popconfirm
                      title={t('planningCycles.deleteCycleConfirmTitle')}
                      description={t('planningCycles.deleteCycleConfirmDescription')}
                      onConfirm={(e) => { e?.stopPropagation(); deleteMutation.mutate(cycle.id) }}
                      okText={t('strategiesAdmin.deleteOkText')}
                      okButtonProps={{ danger: true }}
                      onPopupClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        loading={deleteMutation.isPending && deleteMutation.variables === cycle.id}
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            }
          >
            <CyclePanel
              cycle={cycle}
              allStrategies={allStrategies}
              users={users}
              usersLoading={usersLoading}
            />
          </Panel>
          )
        })}
      </Collapse>

      <Modal
        title={editing ? t('planningCycles.editCycleTitle') : t('planningCycles.createCycleTitle')}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label={t('planningCycles.cycleNameLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('planningCycles.cycleNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="startYear" label={t('planningCycles.startYearLabel')} rules={[{ required: true }]}>
            <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endYear" label={t('planningCycles.endYearLabel')} rules={[{ required: true }]}>
            <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="ownerId"
              label={t('planningCycles.mainStrategyOwnerLabel')}
              rules={[{ required: true, message: t('planningCycles.selectMainOwnerRequired', { label: topLevelStrategyLabel.toLowerCase() }) }]}
              extra={t('planningCycles.mainStrategyAutoCreateHint', { label: topLevelStrategyLabel.toLowerCase() })}
            >
              <Select
                showSearch
                placeholder={t('planningCycles.selectStrategyOwnerPlaceholder')}
                optionFilterProp="label"
                loading={usersLoading}
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.fname} ${u.lname} — ${u.email}`,
                }))}
              />
            </Form.Item>
          )}
          {editing && (
            <Form.Item name="active" label={t('departmentsAdmin.activeTag')} valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
