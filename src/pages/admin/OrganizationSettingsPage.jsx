// Fixed, small set of admin-editable display labels (e.g. "Academic Year" -> "Fiscal Year") that
// adapt the app's wording to whatever organization it's deployed at -- see TerminologyContext.jsx
// for how the rest of the app reads these. Edit-only: the key set itself is seeded by migration
// (V72__organization_settings.sql), not created/deleted here.
import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Checkbox, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getOrganizationSettings, updateOrganizationSetting } from '../../api/admin'
import { loadLanguageManifest } from '../../i18n/languageManifest'
import TableTotal from '../../components/TableTotal'

const LANGUAGES_KEY = 'ENABLED_LANGUAGES'
const VSM_NOTATION_PACKS_KEY = 'VSM_ENABLED_NOTATION_PACKS'
// GENERIC is always on server-side (VsmMapService#getEnabledNotationPacks adds it unconditionally)
// regardless of what's stored -- shown here as a locked checkbox so the UI doesn't imply it can be
// turned off.
const VSM_NOTATION_PACK_OPTIONS = [
  { value: 'GENERIC', label: 'Generic (always on)' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
]

export default function OrganizationSettingsPage() {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  // The full set of languages the system has an XML for (not just the currently-enabled subset)
  // -- this is what populates the "Enabled Languages" checkbox list. See languageManifest.js.
  const [languageOptions, setLanguageOptions] = useState([])
  useEffect(() => {
    loadLanguageManifest().then((langs) =>
      setLanguageOptions(langs.map((l) => ({ value: l.code, label: l.displayName }))))
  }, [])

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['admin-organization-settings'],
    queryFn: getOrganizationSettings,
  })

  const isMultiCheckbox = (key) => key === LANGUAGES_KEY || key === VSM_NOTATION_PACKS_KEY

  const openEdit = (s) => {
    setEditing(s)
    form.setFieldsValue({
      value: isMultiCheckbox(s.key) ? s.value.split(',').filter(Boolean) : s.value,
    })
  }

  const saveMutation = useMutation({
    mutationFn: (values) => updateOrganizationSetting(editing.key, {
      value: Array.isArray(values.value) ? values.value.join(',') : values.value,
    }),
    onSuccess: () => {
      message.success(t('orgSettings.settingUpdated'))
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['admin-organization-settings'] })
      qc.invalidateQueries({ queryKey: ['organization-settings-public'] })
      qc.invalidateQueries({ queryKey: ['vsm-node-types'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('common.updateFailed')),
  })

  const columns = [
    { title: t('orgSettings.colSetting'), dataIndex: 'description', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: t('orgSettings.colCurrentValue'), dataIndex: 'value' },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>{t('goalSetting.editButton')}</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('orgSettings.title')}</h1>
      </div>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        {t('orgSettings.intro')}
      </p>

      <TableTotal count={settings.length} />
      <Table
        dataSource={settings}
        columns={columns}
        rowKey="key"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={t('orgSettings.editModalTitle')}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>{editing?.description}</p>
          {editing?.key === LANGUAGES_KEY ? (
            <Form.Item name="value" label={t('orgSettings.enabledLanguagesLabel')}
              rules={[{ required: true, message: t('orgSettings.selectAtLeastOneLanguage') }]}>
              <Checkbox.Group options={languageOptions} />
            </Form.Item>
          ) : editing?.key === VSM_NOTATION_PACKS_KEY ? (
            <Form.Item name="value" label={t('orgSettings.vsmNotationPacksLabel')}>
              <Checkbox.Group>
                {VSM_NOTATION_PACK_OPTIONS.map((opt) => (
                  <div key={opt.value} style={{ marginBottom: 4 }}>
                    <Checkbox value={opt.value} disabled={opt.value === 'GENERIC'}>{opt.label}</Checkbox>
                  </div>
                ))}
              </Checkbox.Group>
            </Form.Item>
          ) : (
            <Form.Item name="value" label={t('orgSettings.valueLabel')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
