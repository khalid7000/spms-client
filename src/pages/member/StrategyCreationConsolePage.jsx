// Strategy Creation Console: where department/university heads start a new strategy, and
// everyone with a not-yet-deployed strategy relationship (owner, or invited SWOT participant)
// tracks it through SWOT and drafting until it's deployed -- at which point it moves into the
// Strategy Console for everyone assigned to it. Reuses the existing /strategies/:id page and
// SWOT flow entirely; this page only adds the missing "start one" entry point.
import { useState } from 'react'
import { Card, Button, Modal, Form, Input, Select, Table, Tag, Empty, message, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getDashboard } from '../../api/dashboard'
import { getMyLeadershipProfile } from '../../api/leadership'
import { getPlanningCyclesPublic } from '../../api/admin'
import { createDepartmentStrategy, createUniversityStrategy } from '../../api/strategies'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { useTerminology } from '../../TerminologyContext'

const { Paragraph } = Typography

const NOT_DEPLOYED_STATES = ['CREATION', 'REVIEW', 'APPROVAL_PENDING']

export default function StrategyCreationConsolePage() {
  const { t } = useTranslation()
  const { topLevelStrategyLabel } = useTerminology()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const strategyType = Form.useWatch('strategyType', form)

  const { data: leadership } = useQuery({ queryKey: ['my-leadership'], queryFn: getMyLeadershipProfile })
  const { data: dashboard = [], isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const { data: planningCycles = [] } = useQuery({ queryKey: ['planning-cycles-public'], queryFn: getPlanningCyclesPublic })

  const headedDepartments = leadership?.headedDepartments ?? []
  const canCreateUniversity = (leadership?.headedOrgGroups ?? []).some((g) => g.isRoot)
  const canCreateDepartment = headedDepartments.length > 0

  const inProgress = dashboard.filter((item) => NOT_DEPLOYED_STATES.includes(item.state))

  const createMut = useMutation({
    mutationFn: (values) => {
      const payload = { planningCycleId: values.planningCycleId, title: values.title, description: values.description }
      return values.strategyType === 'UNIVERSITY'
        ? createUniversityStrategy(payload)
        : createDepartmentStrategy({ ...payload, departmentId: values.departmentId })
    },
    onSuccess: (strategy) => {
      message.success(t('strategyCreation.createSuccess'))
      setModalOpen(false)
      form.resetFields()
      navigate(`/strategies/${strategy.id}`)
    },
    onError: (err) => message.error(err.response?.data?.message || t('strategyCreation.createError')),
  })

  const columns = [
    {
      title: t('common.title'), dataIndex: 'strategyTitle', key: 'strategyTitle', ellipsis: true,
      sorter: (a, b) => compareStrings(a.strategyTitle, b.strategyTitle),
    },
    { title: t('common.type'), dataIndex: 'strategyType', key: 'strategyType' },
    { title: t('common.yourRole'), dataIndex: 'role', key: 'role' },
    { title: t('common.status'), dataIndex: 'state', key: 'state', render: (s) => <Tag>{s}</Tag> },
    { title: t('strategyCreation.colPlanningCycle'), dataIndex: 'planningCycleName', key: 'planningCycleName' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{t('strategyCreation.title')}</h1>
            <Paragraph type="secondary">
              {t('strategyCreation.subtitle')}
            </Paragraph>
          </div>
          {(canCreateDepartment || canCreateUniversity) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} style={{ background: '#13223a' }}>
              {t('strategyCreation.newStrategy')}
            </Button>
          )}
        </div>

        <h3>{t('strategyCreation.inProgress')}</h3>
        {inProgress.length === 0 ? (
          <Empty description={t('strategyCreation.nothingInProgress')} />
        ) : (
          <>
            <TableTotal count={inProgress.length} />
            <Table
              dataSource={inProgress} columns={columns} rowKey="strategyId" loading={isLoading} pagination={false}
              onRow={(row) => ({ onClick: () => navigate(`/strategies/${row.strategyId}`), style: { cursor: 'pointer' } })}
            />
          </>
        )}
      </Card>

      <Modal
        title={t('strategyCreation.newStrategy')} open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={() => form.validateFields().then((v) => createMut.mutate(v)).catch(() => {})}
        confirmLoading={createMut.isPending} destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="strategyType" label={t('strategyCreation.strategyTypeLabel')} rules={[{ required: true }]}>
            <Select
              placeholder={t('strategyCreation.selectType')}
              options={[
                ...(canCreateDepartment ? [{ value: 'DEPARTMENT', label: t('strategyCreation.departmentStrategy') }] : []),
                ...(canCreateUniversity ? [{ value: 'UNIVERSITY', label: topLevelStrategyLabel }] : []),
              ]}
            />
          </Form.Item>
          {strategyType === 'DEPARTMENT' && (
            <Form.Item name="departmentId" label={t('common.department')} rules={[{ required: true }]}>
              <Select
                placeholder={t('strategyCreation.selectDepartment')}
                options={headedDepartments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          )}
          <Form.Item name="planningCycleId" label={t('strategyCreation.colPlanningCycle')} rules={[{ required: true }]}>
            <Select
              placeholder={t('strategyCreation.selectPlanningCycle')}
              options={planningCycles.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="title" label={t('common.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
