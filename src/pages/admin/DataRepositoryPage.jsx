// Central name-value data repository (type + secondary key + employee email -> free text) fed by
// admin-run "readers" -- polymorphic parallel to Customizable Achievement Modules, but for importing
// reference data instead of recording achievements. Readers so far: Early Alert and Grade
// Distribution (both term-keyed Excel exports, matched to an instructor by name in a fixed column).
// Criteria Info Tools (assigned per-criterion in Category Management) read this data back for heads.
import { useState } from 'react'
import { Card, Button, Modal, Form, Input, InputNumber, Select, Upload, Table, message, Typography, Tag } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getRepositoryReaders, getRepositoryRecordsSummary, runRepositoryImport } from '../../api/admin'
import TableTotal from '../../components/TableTotal'

const { Paragraph, Text } = Typography

// Shared term-picking form for any reader that just needs year/term/file -- computes nothing
// client-side, the server derives the term code (see TermCodeUtil.computeTermCode). Both Early
// Alert and Grade Distribution use this same shape today; a future reader needing different
// inputs would get its own form registered separately in REPOSITORY_READER_FORMS below.
function YearTermFileImportForm({ onSubmit, submitting }) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState([])

  return (
    <Form
      form={form} layout="vertical"
      onFinish={(values) => {
        const file = fileList[0]?.originFileObj
        if (!file) {
          message.error(t('dataRepo.selectExcelFileFirst'))
          return
        }
        onSubmit({ file, params: { year: String(values.year), term: values.term } })
      }}
    >
      <Form.Item name="year" label={t('dataRepo.yearLabel')} rules={[{ required: true, message: t('dataRepo.enterCalendarYear') }]}>
        <InputNumber min={2000} max={2100} precision={0} style={{ width: '100%' }} placeholder={t('dataRepo.yearPlaceholder')} />
      </Form.Item>
      <Form.Item name="term" label={t('dataRepo.termLabel')} rules={[{ required: true, message: t('dataRepo.selectTermRequired') }]}>
        <Select options={[
          { value: 'FALL', label: t('dataRepo.termFall') },
          { value: 'SPRING', label: t('dataRepo.termSpring') },
          { value: 'SUMMER', label: t('dataRepo.termSummer') },
        ]} placeholder={t('dataRepo.selectTermPlaceholder')} />
      </Form.Item>
      <Form.Item label={t('dataRepo.excelFileLabel')} required>
        <Upload
          beforeUpload={() => false} accept=".xlsx" maxCount={1}
          fileList={fileList}
          onChange={({ fileList: fl }) => setFileList(fl)}
        >
          <Button icon={<UploadOutlined />}>{t('dataRepo.selectXlsxButton')}</Button>
        </Upload>
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={submitting} style={{ background: '#13223a' }}>
        {t('dataRepo.runImportButton')}
      </Button>
    </Form>
  )
}

const REPOSITORY_READER_FORMS = {
  EARLY_ALERT: YearTermFileImportForm,
  GRADE_DISTRIBUTION: YearTermFileImportForm,
}

export default function DataRepositoryPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [activeReader, setActiveReader] = useState(null) // { code, displayName }
  const [lastResult, setLastResult] = useState(null) // { code, recordsCreated, warnings }

  const { data: readers = [], isLoading: readersLoading } = useQuery({
    queryKey: ['repository-readers'],
    queryFn: getRepositoryReaders,
  })
  const { data: summary = [], isLoading: summaryLoading } = useQuery({
    queryKey: ['repository-records-summary'],
    queryFn: getRepositoryRecordsSummary,
  })

  const importMutation = useMutation({
    mutationFn: ({ code, file, params }) => runRepositoryImport(code, file, params),
    onSuccess: (result) => {
      message.success(t('dataRepo.importCompleted', { count: result.recordsCreated }))
      setLastResult({ code: activeReader.code, ...result })
      setActiveReader(null)
      qc.invalidateQueries({ queryKey: ['repository-records-summary'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('dataRepo.importFailed')),
  })

  const summaryColumns = [
    { title: t('common.type'), dataIndex: 'sourceType', key: 'sourceType' },
    { title: t('dataRepo.keyCol'), dataIndex: 'secondaryKey', key: 'secondaryKey' },
    { title: t('dataRepo.labelCol'), dataIndex: 'secondaryKeyLabel', key: 'secondaryKeyLabel', render: (v) => v || <Text type="secondary">—</Text> },
    { title: t('dataRepo.recordsCol'), dataIndex: 'recordCount', key: 'recordCount', width: 100 },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('nav.dataRepository')}</h1>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('dataRepo.intro')}
      </Paragraph>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {readersLoading ? (
          <Text type="secondary">{t('dataRepo.loadingReaders')}</Text>
        ) : readers.map((reader) => (
          <Card key={reader.code} title={reader.displayName} style={{ width: 340 }}
            styles={{ header: { background: '#f5f7fb' } }}>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>{reader.description}</Paragraph>
            <Button type="primary" onClick={() => setActiveReader(reader)} style={{ background: '#13223a' }}>
              {t('dataRepo.runImportButton')}
            </Button>
          </Card>
        ))}
      </div>

      {lastResult && lastResult.warnings?.length > 0 && (
        <Card size="small" title={t('dataRepo.lastImportWarningsTitle')} style={{ marginBottom: 24, borderColor: '#faad14' }}>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {lastResult.warnings.map((w) => (
              <div key={w} style={{ marginBottom: 4 }}><Tag color="gold">!</Tag>{w}</div>
            ))}
          </div>
        </Card>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('dataRepo.importedDataTitle')}</h2>
      <TableTotal count={summary.length} />
      <Table dataSource={summary} columns={summaryColumns} rowKey={(r) => `${r.sourceType}-${r.secondaryKey}`}
        loading={summaryLoading} pagination={false} />

      <Modal
        title={activeReader ? t('dataRepo.runImportModalTitle', { name: activeReader.displayName }) : ''}
        open={!!activeReader}
        onCancel={() => setActiveReader(null)}
        footer={null}
        destroyOnClose
      >
        {activeReader && (
          <ImportFormFor code={activeReader.code} onSubmit={(payload) => importMutation.mutate({ code: activeReader.code, ...payload })} submitting={importMutation.isPending} />
        )}
      </Modal>
    </div>
  )
}

function ImportFormFor({ code, onSubmit, submitting }) {
  const { t } = useTranslation()
  const FormComponent = REPOSITORY_READER_FORMS[code]
  if (!FormComponent) {
    return <Paragraph type="secondary">{t('dataRepo.noImportFormRegistered')}</Paragraph>
  }
  return <FormComponent onSubmit={onSubmit} submitting={submitting} />
}
