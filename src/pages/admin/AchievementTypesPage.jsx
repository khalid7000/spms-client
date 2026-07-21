// Achievement types (e.g. "Curriculum", "Publication", "Grant") shown in the achievement-recording
// Type dropdown throughout the app -- fully admin-configurable so each organization can define its
// own list. Two rows ("Other" and "Course Evaluation") are system-linked (see AchievementType
// .systemCode) and can be renamed but never deactivated, since other code branches on them.
import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Tag, message, Popconfirm, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAchievementTypes, createAchievementType, updateAchievementType } from '../../api/admin'
import TableTotal from '../../components/TableTotal'
import { compareStrings } from '../../hooks/useTablePrefs'

export default function AchievementTypesPage() {
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['admin-achievement-types'],
    queryFn: getAchievementTypes,
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (type) => {
    setEditing(type)
    form.setFieldsValue({ name: type.name })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing
        ? updateAchievementType(editing.id, { name: values.name, active: editing.active })
        : createAchievementType(values),
    onSuccess: () => {
      message.success(editing ? t('achievementTypesAdmin.typeUpdated') : t('achievementTypesAdmin.typeCreated'))
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-achievement-types'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('tree.operationFailed')),
  })

  const deactivateMutation = useMutation({
    mutationFn: (type) => updateAchievementType(type.id, { name: type.name, active: false }),
    onSuccess: () => {
      message.success(t('achievementTypesAdmin.typeDeactivated'))
      qc.invalidateQueries({ queryKey: ['admin-achievement-types'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('achievementTypesAdmin.deactivateFailed')),
  })

  const reactivateMutation = useMutation({
    mutationFn: (type) => updateAchievementType(type.id, { name: type.name, active: true }),
    onSuccess: () => {
      message.success(t('achievementTypesAdmin.typeReactivated'))
      qc.invalidateQueries({ queryKey: ['admin-achievement-types'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('achievementTypesAdmin.reactivateFailed')),
  })

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
      sorter: (a, b) => compareStrings(a.name, b.name),
    },
    {
      title: t('common.status'),
      dataIndex: 'active',
      render: (active) => <Tag color={active ? 'green' : 'default'}>{active ? t('departmentsAdmin.activeTag') : t('departmentsAdmin.inactiveTag')}</Tag>,
    },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>{t('goalSetting.editButton')}</Button>
          {r.systemCode ? (
            <Tooltip title={t('achievementTypesAdmin.systemLinkedTooltip')}>
              <Button size="small" icon={<StopOutlined />} disabled>{t('departmentsAdmin.deactivateButton')}</Button>
            </Tooltip>
          ) : r.active ? (
            <Popconfirm title={t('achievementTypesAdmin.deactivateConfirmTitle')} description={t('achievementTypesAdmin.deactivateConfirmDescription')} onConfirm={() => deactivateMutation.mutate(r)}>
              <Button size="small" danger icon={<StopOutlined />}>{t('departmentsAdmin.deactivateButton')}</Button>
            </Popconfirm>
          ) : (
            <Button size="small" onClick={() => reactivateMutation.mutate(r)}>{t('achievementTypesAdmin.reactivateButton')}</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('nav.achievementTypes')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#13223a' }}>
          {t('achievementTypesAdmin.newTypeButton')}
        </Button>
      </div>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        {t('achievementTypesAdmin.intro')}
      </p>

      <TableTotal count={types.length} />
      <Table
        dataSource={types}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={editing ? t('achievementTypesAdmin.editTypeTitle') : t('achievementTypesAdmin.createTypeTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={420}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}>
            <Input placeholder={t('achievementTypesAdmin.namePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
