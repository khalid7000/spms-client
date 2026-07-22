// Value Stream Mapping console: where department/org-group heads start a new map and see every
// map they can reach (their own, plus anything owned by a unit they head). Mirrors
// StrategyCreationConsolePage's "list + create modal" shape since the audience (heads) and the
// underlying leadership data (getMyLeadershipProfile) are the same.
import { useState } from 'react'
import { Card, Button, Modal, Form, Input, Select, Segmented, Table, Tag, Empty, message, Typography } from 'antd'
import { PlusOutlined, ApartmentOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getMyLeadershipProfile } from '../../../api/leadership'
import { listMyVsmMaps, createVsmMap, generateVsmDraft } from '../../../api/vsmMaps'
import { getMyVsmAuthorGrants } from '../../../api/vsmAuthorGrants'
import InfoTip from '../../../components/InfoTip'

const { Paragraph } = Typography

const STATE_COLORS = { DRAFT: 'gold', ACTIVE: 'green', ARCHIVED: 'default' }

export default function VsmMapListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const scopeType = Form.useWatch('scopeType', form)
  const startMode = Form.useWatch('startMode', form)

  const { data: leadership } = useQuery({ queryKey: ['my-leadership'], queryFn: getMyLeadershipProfile })
  const { data: maps = [], isLoading } = useQuery({ queryKey: ['vsm-maps'], queryFn: listMyVsmMaps })
  // A delegated "VSM author" grant (Phase 4b) widens who can create a map beyond just heads --
  // ACTIVE grants add their unit to the same options a head would already see.
  const { data: myGrants = [] } = useQuery({ queryKey: ['my-vsm-author-grants'], queryFn: getMyVsmAuthorGrants })
  const activeGrants = myGrants.filter((g) => g.status === 'ACTIVE')

  const headedDepartments = leadership?.headedDepartments ?? []
  const headedOrgGroups = leadership?.headedOrgGroups ?? []
  const grantedDepartments = activeGrants
    .filter((g) => g.scopeType === 'DEPARTMENT')
    .map((g) => ({ id: g.departmentId, name: g.departmentName }))
  const grantedOrgGroups = activeGrants
    .filter((g) => g.scopeType === 'ORG_GROUP')
    .map((g) => ({ id: g.orgGroupId, title: g.orgGroupName }))
  const departmentOptions = [...headedDepartments, ...grantedDepartments]
    .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
  const orgGroupOptions = [...headedOrgGroups, ...grantedOrgGroups]
    .filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i)
  const canCreateDepartmentMap = departmentOptions.length > 0
  const canCreateOrgGroupMap = orgGroupOptions.length > 0

  const createMut = useMutation({
    mutationFn: async (values) => {
      const map = await createVsmMap({
        scopeType: values.scopeType,
        scopeId: values.scopeId,
        title: values.title,
        description: values.description,
      })
      if (values.startMode === 'ai') {
        // Fire-and-forget: this call returns as soon as the background job is queued, not once it
        // finishes. The canvas page (VsmCanvasPage) is what shows generating/done/failed, polling
        // the map itself -- nothing here waits for the AI.
        await generateVsmDraft(map.id, { processDescription: values.processDescription })
      }
      return map
    },
    onSuccess: (map) => {
      message.success(t('vsm.createSuccess'))
      setModalOpen(false)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['vsm-maps'] })
      navigate(`/vsm/${map.id}`)
    },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.createError')),
  })

  const columns = [
    { title: t('common.title'), dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: t('vsm.colScope'),
      key: 'scope',
      render: (_, row) => row.departmentName || row.orgGroupName || '-',
    },
    {
      title: t('common.status'),
      dataIndex: 'state',
      key: 'state',
      render: (s) => <Tag color={STATE_COLORS[s]}>{s}</Tag>,
    },
    { title: t('vsm.colAuthor'), dataIndex: 'createdByName', key: 'createdByName' },
    {
      title: t('vsm.colUpdated'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{t('vsm.title')} <InfoTip title={t('vsm.conceptInfo')} /></h1>
            <Paragraph type="secondary">{t('vsm.subtitle')}</Paragraph>
          </div>
          {(canCreateDepartmentMap || canCreateOrgGroupMap) && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              style={{ background: '#13223a' }}
            >
              {t('vsm.newMap')}
            </Button>
          )}
        </div>

        {maps.length === 0 ? (
          <Empty description={t('vsm.nothingYet')} />
        ) : (
          <Table
            dataSource={maps}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            onRow={(row) => ({ onClick: () => navigate(`/vsm/${row.id}`), style: { cursor: 'pointer' } })}
          />
        )}
      </Card>

      <Modal
        title={t('vsm.newMap')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.validateFields().then((v) => createMut.mutate(v)).catch(() => {})}
        confirmLoading={createMut.isPending}
        okText={startMode === 'ai' ? t('vsm.generateDraft') : t('common.save')}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ startMode: 'blank' }}>
          <Form.Item label={<span>{t('vsm.startModeLabel')}<InfoTip title={t('vsm.startWithAiInfo')} /></span>} name="startMode">
            <Segmented
              options={[
                { label: t('vsm.startBlank'), value: 'blank' },
                { label: <span><ThunderboltOutlined /> {t('vsm.startWithAi')}</span>, value: 'ai' },
              ]}
            />
          </Form.Item>
          <Form.Item name="scopeType" label={t('vsm.scopeTypeLabel')} rules={[{ required: true }]}>
            <Select
              placeholder={t('vsm.selectScopeType')}
              options={[
                ...(canCreateDepartmentMap ? [{ value: 'DEPARTMENT', label: t('common.department') }] : []),
                ...(canCreateOrgGroupMap ? [{ value: 'ORG_GROUP', label: t('vsm.orgGroup') }] : []),
              ]}
            />
          </Form.Item>
          {scopeType === 'DEPARTMENT' && (
            <Form.Item name="scopeId" label={t('common.department')} rules={[{ required: true }]}>
              <Select
                placeholder={t('vsm.selectDepartment')}
                options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          )}
          {scopeType === 'ORG_GROUP' && (
            <Form.Item name="scopeId" label={t('vsm.orgGroup')} rules={[{ required: true }]}>
              <Select
                placeholder={t('vsm.selectOrgGroup')}
                options={orgGroupOptions.map((g) => ({ value: g.id, label: g.title }))}
                suffixIcon={<ApartmentOutlined />}
              />
            </Form.Item>
          )}
          <Form.Item name="title" label={t('common.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          {startMode === 'ai' && (
            <Form.Item
              name="processDescription"
              label={t('vsm.processDescriptionLabel')}
              extra={t('vsm.processDescriptionHelp')}
              rules={[{ required: true, message: t('vsm.processDescriptionRequired') }]}
            >
              <Input.TextArea rows={5} placeholder={t('vsm.processDescriptionPlaceholder')} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
