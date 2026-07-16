// Central name-value data repository (type + secondary key + employee email -> free text) fed by
// admin-run "readers" -- polymorphic parallel to Customizable Achievement Modules, but for importing
// reference data instead of recording achievements. Readers so far: Early Alert and Grade
// Distribution (both term-keyed Excel exports, matched to an instructor by name in a fixed column).
// Criteria Info Tools (assigned per-criterion in Category Management) read this data back for heads.
import { useState } from 'react'
import { Card, Button, Modal, Form, Input, InputNumber, Select, Upload, Table, message, Typography, Tag } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRepositoryReaders, getRepositoryRecordsSummary, runRepositoryImport } from '../../api/admin'
import TableTotal from '../../components/TableTotal'

const { Paragraph, Text } = Typography

// Shared term-picking form for any reader that just needs year/term/file -- computes nothing
// client-side, the server derives the term code (see TermCodeUtil.computeTermCode). Both Early
// Alert and Grade Distribution use this same shape today; a future reader needing different
// inputs would get its own form registered separately in REPOSITORY_READER_FORMS below.
function YearTermFileImportForm({ onSubmit, submitting }) {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState([])

  return (
    <Form
      form={form} layout="vertical"
      onFinish={(values) => {
        const file = fileList[0]?.originFileObj
        if (!file) {
          message.error('Select an Excel file first')
          return
        }
        onSubmit({ file, params: { year: String(values.year), term: values.term } })
      }}
    >
      <Form.Item name="year" label="Year" rules={[{ required: true, message: 'Enter the calendar year' }]}>
        <InputNumber min={2000} max={2100} precision={0} style={{ width: '100%' }} placeholder="e.g. 2025" />
      </Form.Item>
      <Form.Item name="term" label="Term" rules={[{ required: true, message: 'Select a term' }]}>
        <Select options={[
          { value: 'FALL', label: 'Fall' },
          { value: 'SPRING', label: 'Spring' },
          { value: 'SUMMER', label: 'Summer' },
        ]} placeholder="Select term" />
      </Form.Item>
      <Form.Item label="Excel file" required>
        <Upload
          beforeUpload={() => false} accept=".xlsx" maxCount={1}
          fileList={fileList}
          onChange={({ fileList: fl }) => setFileList(fl)}
        >
          <Button icon={<UploadOutlined />}>Select .xlsx file</Button>
        </Upload>
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={submitting} style={{ background: '#13223a' }}>
        Run Import
      </Button>
    </Form>
  )
}

const REPOSITORY_READER_FORMS = {
  EARLY_ALERT: YearTermFileImportForm,
  GRADE_DISTRIBUTION: YearTermFileImportForm,
}

export default function DataRepositoryPage() {
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
      message.success(`Import completed: ${result.recordsCreated} record(s) created`)
      setLastResult({ code: activeReader.code, ...result })
      setActiveReader(null)
      qc.invalidateQueries({ queryKey: ['repository-records-summary'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Import failed'),
  })

  const summaryColumns = [
    { title: 'Type', dataIndex: 'sourceType', key: 'sourceType' },
    { title: 'Key', dataIndex: 'secondaryKey', key: 'secondaryKey' },
    { title: 'Label', dataIndex: 'secondaryKeyLabel', key: 'secondaryKeyLabel', render: (v) => v || <Text type="secondary">—</Text> },
    { title: 'Records', dataIndex: 'recordCount', key: 'recordCount', width: 100 },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Data Repository</h1>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Import reference data (e.g. Early Alert reports) into the central repository. Criteria Info
        Tools -- assigned per-criterion in Category Management -- read this data back for heads
        during Annual Evaluation review. Re-running an import for the same type/term replaces the
        prior data for that term rather than duplicating it.
      </Paragraph>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {readersLoading ? (
          <Text type="secondary">Loading readers…</Text>
        ) : readers.map((reader) => (
          <Card key={reader.code} title={reader.displayName} style={{ width: 340 }}
            styles={{ header: { background: '#f5f7fb' } }}>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>{reader.description}</Paragraph>
            <Button type="primary" onClick={() => setActiveReader(reader)} style={{ background: '#13223a' }}>
              Run Import
            </Button>
          </Card>
        ))}
      </div>

      {lastResult && lastResult.warnings?.length > 0 && (
        <Card size="small" title="Last import warnings" style={{ marginBottom: 24, borderColor: '#faad14' }}>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {lastResult.warnings.map((w) => (
              <div key={w} style={{ marginBottom: 4 }}><Tag color="gold">!</Tag>{w}</div>
            ))}
          </div>
        </Card>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Imported Data</h2>
      <TableTotal count={summary.length} />
      <Table dataSource={summary} columns={summaryColumns} rowKey={(r) => `${r.sourceType}-${r.secondaryKey}`}
        loading={summaryLoading} pagination={false} />

      <Modal
        title={activeReader ? `Run Import -- ${activeReader.displayName}` : ''}
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
  const FormComponent = REPOSITORY_READER_FORMS[code]
  if (!FormComponent) {
    return <Paragraph type="secondary">No import form is registered for this reader yet.</Paragraph>
  }
  return <FormComponent onSubmit={onSubmit} submitting={submitting} />
}
