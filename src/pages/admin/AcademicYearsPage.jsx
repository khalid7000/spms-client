import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, DatePicker } from 'antd'
import { PlusOutlined, LockOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { createAcademicYear, closeAcademicYear, getAdminStrategies } from '../../api/admin'
import { getAcademicYears } from '../../api/academicYears'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'
import { useTerminology } from '../../TerminologyContext'
import dayjs from 'dayjs'

export default function AcademicYearsPage() {
  const { t } = useTranslation()
  const { academicYearLabel, topLevelStrategyLabel } = useTerminology()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: years = [], isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: getAcademicYears,
  })

  const { data: strategies = [] } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: getAdminStrategies,
  })
  const universityStrategies = strategies.filter((s) => s.strategyType === 'UNIVERSITY')

  const createMutation = useMutation({
    mutationFn: (values) =>
      createAcademicYear({
        name: values.name,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
        universityStrategyId: values.universityStrategyId,
      }),
    onSuccess: () => {
      message.success(t('academicYearsAdmin.yearCreated', { yearLabel: academicYearLabel }))
      setModalOpen(false)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('academicYearsAdmin.createFailed')),
  })

  const closeMutation = useMutation({
    mutationFn: closeAcademicYear,
    onSuccess: () => {
      message.success(t('academicYearsAdmin.yearClosed', { yearLabel: academicYearLabel }))
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('academicYearsAdmin.closeFailed')),
  })

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
      sorter: (a, b) => compareStrings(a.name, b.name),
    },
    {
      title: t('academicYearsAdmin.startDateCol'),
      dataIndex: 'startDate',
      render: (v) => (v ? dayjs(v).format('MMM D, YYYY') : '—'),
    },
    {
      title: t('academicYearsAdmin.endDateCol'),
      dataIndex: 'endDate',
      render: (v) => (v ? dayjs(v).format('MMM D, YYYY') : '—'),
    },
    {
      title: topLevelStrategyLabel,
      dataIndex: 'universityStrategyTitle',
      render: (v) => v || '—',
    },
    {
      title: t('common.status'),
      dataIndex: 'closed',
      render: (closed) =>
        closed ? <Tag color="red">{t('academicYearsAdmin.closedTag')}</Tag> : <Tag color="green">{t('freezeYear.open')}</Tag>,
    },
    {
      title: '',
      render: (_, row) =>
        !row.closed ? (
          <Popconfirm
            title={t('academicYearsAdmin.closeConfirmTitle', { yearLabel: academicYearLabel.toLowerCase() })}
            description={t('academicYearsAdmin.closeConfirmDescription')}
            onConfirm={() => closeMutation.mutate(row.id)}
            okText={t('evalDisplay.closeButton')}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<LockOutlined />}>
              {t('academicYearsAdmin.closeYearButton')}
            </Button>
          </Popconfirm>
        ) : null,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{academicYearLabel}s</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
          style={{ background: '#13223a' }}
        >
          {t('academicYearsAdmin.newYearButton', { yearLabel: academicYearLabel })}
        </Button>
      </div>

      <TableTotal count={years.length} />
      <Table
        dataSource={years}
        rowKey="id"
        loading={isLoading}
        columns={columns}
        pagination={false}
      />

      <Modal
        title={t('academicYearsAdmin.createYearTitle', { yearLabel: academicYearLabel })}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={createMutation.mutate}>
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true, message: t('academicYearsAdmin.requiredMessage') }]}>
            <Input placeholder={t('academicYearsAdmin.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="universityStrategyId" label={topLevelStrategyLabel}
            rules={[{ required: true, message: t('academicYearsAdmin.strategyMustBeSelected', { label: topLevelStrategyLabel.toLowerCase() }) }]}
            extra={t('academicYearsAdmin.strategyScopeHint', { yearLabel: academicYearLabel.toLowerCase() })}
          >
            <Select
              placeholder={t('academicYearsAdmin.selectStrategyPlaceholder', { label: topLevelStrategyLabel.toLowerCase(), yearLabel: academicYearLabel.toLowerCase() })}
              options={universityStrategies.map((s) => ({ value: s.id, label: s.title }))}
            />
          </Form.Item>
          <Form.Item name="startDate" label={t('academicYearsAdmin.startDateCol')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endDate" label={t('academicYearsAdmin.endDateCol')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
