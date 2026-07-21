import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getDepartments, createDepartment, updateDepartment,
  deactivateDepartment, reactivateDepartment, getOrgGroups,
} from '../../api/admin'
import { getUsers } from '../../api/admin'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'
import TableTotal from '../../components/TableTotal'
import { useTerminology } from '../../TerminologyContext'

const TABLE_PREFS_KEY = 'spms.adminDepartmentsTable.prefs'

export default function DepartmentsPage() {
  const { t } = useTranslation()
  const { defaultHeadTitleLabel } = useTerminology()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()
  const { sortOrderFor, handleTableChange } = useTablePrefs(TABLE_PREFS_KEY)

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  })
  const { data: orgGroups = [] } = useQuery({
    queryKey: ['admin-org-groups'],
    queryFn: getOrgGroups,
  })
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (dept) => {
    setEditing(dept)
    form.setFieldsValue({
      name: dept.name,
      code: dept.code,
      headTitle: dept.headTitle,
      headUserId: dept.headUserId,
      orgGroupId: dept.orgGroupId,
    })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing ? updateDepartment(editing.id, values) : createDepartment(values),
    onSuccess: () => {
      message.success(editing ? t('departmentsAdmin.departmentUpdated') : t('departmentsAdmin.departmentCreated'))
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-departments'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('tree.operationFailed')),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateDepartment,
    onSuccess: () => {
      message.success(t('departmentsAdmin.departmentDeactivated'))
      qc.invalidateQueries({ queryKey: ['admin-departments'] })
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: reactivateDepartment,
    onSuccess: () => {
      message.success(t('departmentsAdmin.departmentActivated'))
      qc.invalidateQueries({ queryKey: ['admin-departments'] })
    },
  })

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
      sorter: (a, b) => compareStrings(a.name, b.name),
      sortOrder: sortOrderFor('name'),
    },
    {
      title: t('departmentsAdmin.codeCol'),
      dataIndex: 'code',
      key: 'code',
      render: (v) => (
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>{v}</span>
      ),
      sorter: (a, b) => compareStrings(a.code, b.code),
      sortOrder: sortOrderFor('code'),
    },
    {
      title: t('orgGroups.headTitleCol'),
      dataIndex: 'headTitle',
      key: 'headTitle',
      render: (v) => v || '—',
      sorter: (a, b) => compareStrings(a.headTitle, b.headTitle),
      sortOrder: sortOrderFor('headTitle'),
    },
    {
      title: defaultHeadTitleLabel,
      dataIndex: 'headUserName',
      key: 'headUserName',
      render: (v) => v || '—',
      sorter: (a, b) => compareStrings(a.headUserName, b.headUserName),
      sortOrder: sortOrderFor('headUserName'),
    },
    {
      title: t('departmentsAdmin.groupCol'),
      dataIndex: 'orgGroupTitle',
      key: 'orgGroupTitle',
      render: (v) => v || '—',
      sorter: (a, b) => compareStrings(a.orgGroupTitle, b.orgGroupTitle),
      sortOrder: sortOrderFor('orgGroupTitle'),
    },
    {
      title: t('common.status'),
      dataIndex: 'active',
      key: 'active',
      render: (v) => (v ? <Tag color="green">{t('departmentsAdmin.activeTag')}</Tag> : <Tag>{t('departmentsAdmin.inactiveTag')}</Tag>),
      sorter: (a, b) => Number(a.active) - Number(b.active),
      sortOrder: sortOrderFor('active'),
    },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            {t('goalSetting.editButton')}
          </Button>
          {r.active ? (
            <Popconfirm
              title={t('departmentsAdmin.deactivateConfirmTitle')}
              onConfirm={() => deactivateMutation.mutate(r.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                {t('departmentsAdmin.deactivateButton')}
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={t('departmentsAdmin.reactivateConfirmTitle')}
              onConfirm={() => reactivateMutation.mutate(r.id)}
            >
              <Button size="small" icon={<CheckCircleOutlined />}
                style={{ color: '#52c41a', borderColor: '#52c41a' }}>
                {t('departmentsAdmin.activateButton')}
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('nav.departments')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#13223a' }}>
          {t('departmentsAdmin.newDepartmentButton')}
        </Button>
      </div>

      <TableTotal count={departments.length} />
      <Table
        dataSource={departments}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        onChange={handleTableChange}
      />

      <Modal
        title={editing ? t('departmentsAdmin.editDepartmentTitle') : t('departmentsAdmin.createDepartmentTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="name" label={t('departmentsAdmin.departmentNameLabel')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label={t('departmentsAdmin.codeCol')} rules={[{ required: true }]}>
            <Input placeholder={t('departmentsAdmin.codePlaceholder')} />
          </Form.Item>
          <Form.Item name="headTitle" label={t('orgGroups.headTitleCol')}
            tooltip={t('departmentsAdmin.headTitleTooltip')}>
            <Input placeholder={t('departmentsAdmin.headTitlePlaceholder')} />
          </Form.Item>
          <Form.Item name="headUserId" label={t('departmentsAdmin.departmentHeadLabel')}>
            <Select allowClear placeholder={t('strategyDetailAdmin.selectUserPlaceholder')} showSearch
              optionFilterProp="label"
              options={users.map((u) => ({
                value: u.id,
                label: `${u.fname} ${u.lname} (${u.email})`,
              }))} />
          </Form.Item>
          <Form.Item name="orgGroupId" label={t('departmentsAdmin.orgGroupLabel')}>
            <Select allowClear placeholder={t('departmentsAdmin.selectGroupPlaceholder')}
              options={orgGroups.map((g) => ({ value: g.id, label: g.title }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
