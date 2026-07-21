import { useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Checkbox, Tag, message,
  Upload, Alert, Statistic, Row, Col, Divider, Typography,
} from 'antd'
import {
  PlusOutlined, EditOutlined, UserOutlined,
  UploadOutlined, DownloadOutlined, InboxOutlined, SearchOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { getUsers, createUser, updateUser, getDepartments, getOrgGroups, importUsers } from '../../api/admin'
import { getAllTitles } from '../../api/portfolio'
import { useNavigate } from 'react-router-dom'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'
import { useAuth } from '../../auth/AuthContext'

const { Dragger } = Upload
const { Text } = Typography

const CSV_TEMPLATE = 'fname,lname,email,title,department,orgGroup\nJane,Doe,jane.doe@rit.edu,Professor,ENG,\n'

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'users_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const TABLE_PREFS_KEY = 'spms.adminUsersTable.prefs'

// Admin console page listing every app_user: create/edit users one at a time,
// bulk-import via CSV, and jump to a user's per-strategy role assignments.
// Table sort + page size are persisted (see useTablePrefs) so the admin's
// preferred view survives navigating away and coming back.
export default function UsersPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  // A User Admin (limited role, granted only by a true Admin) reaches this page too, but must
  // never see or submit the Roles field -- the server enforces this independently regardless
  // (AdminService.createUser/updateUser), this just keeps a User Admin from seeing a field that
  // wouldn't do anything for them anyway.
  const isFullAdmin = currentUser?.systemRoles?.includes('ADMIN')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { prefs, sortOrderFor, handleTableChange } = useTablePrefs(TABLE_PREFS_KEY)

  // CSV import state
  const [importOpen, setImportOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [importResult, setImportResult] = useState(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  })
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  })
  const { data: orgGroups = [] } = useQuery({
    queryKey: ['admin-org-groups'],
    queryFn: getOrgGroups,
  })
  // A User Admin can only assign a title that already exists (server-enforced too, see
  // AdminService.assertKnownTitleIfUserAdmin) -- they pick from this list instead of typing free text.
  const { data: allTitles = [] } = useQuery({
    queryKey: ['all-titles'],
    queryFn: getAllTitles,
    enabled: !isFullAdmin,
  })

  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }))
  const orgGroupOptions = orgGroups.map((g) => ({ value: g.id, label: g.title }))
  const titleOptions = allTitles.map((ti) => ({ value: ti.titleName, label: ti.titleName }))

  const filteredUsers = users.filter((u) => {
    if (!search) return true
    const haystack = [u.fname, u.lname, u.email, u.title, u.department?.name].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  // ── user create / edit ──────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (user) => {
    setEditing(user)
    form.setFieldsValue({
      fname: user.fname,
      lname: user.lname,
      email: user.email,
      title: user.title,
      departmentId: user.department?.id,
      orgGroupId: user.orgGroup?.id,
      systemRoles: user.systemRoles || [],
    })
    setModalOpen(true)
  }

  // `editing` (set by openEdit) decides create vs. update; both share one
  // modal/form, so the mutation just branches on whether it's populated.
  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing ? updateUser(editing.id, values) : createUser(values),
    onSuccess: () => {
      message.success(editing ? t('usersAdmin.userUpdated') : t('usersAdmin.userCreated'))
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('usersAdmin.operationFailed')),
  })

  // ── CSV import ──────────────────────────────────────────────────────────────

  const openImport = () => {
    setSelectedFile(null)
    setImportResult(null)
    setImportOpen(true)
  }

  // Server matches rows by email: existing users are updated in place, unknown
  // emails are created fresh with a default password. See importResult.errors
  // for any rows the server rejected (rendered in the modal's results view below).
  const importMutation = useMutation({
    mutationFn: () => importUsers(selectedFile),
    onSuccess: (result) => {
      setImportResult(result)
      setSelectedFile(null)
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('usersAdmin.importFailed')),
  })

  const errorColumns = [
    { title: t('usersAdmin.rowColLabel'), dataIndex: 'row', width: 70 },
    { title: t('usersAdmin.reasonColLabel'), dataIndex: 'message' },
  ]

  // ── table columns ───────────────────────────────────────────────────────────

  const columns = [
    {
      title: t('common.name'),
      key: 'name',
      render: (_, r) => (
        <span style={{ fontWeight: 500 }}>
          {r.fname} {r.lname}
        </span>
      ),
      sorter: (a, b) => compareStrings(`${a.fname} ${a.lname}`, `${b.fname} ${b.lname}`),
      sortOrder: sortOrderFor('name'),
    },
    {
      title: t('common.email'),
      key: 'email',
      dataIndex: 'email',
      sorter: (a, b) => compareStrings(a.email, b.email),
      sortOrder: sortOrderFor('email'),
    },
    {
      title: t('common.title'),
      key: 'title',
      dataIndex: 'title',
      render: (v) => v || '—',
      sorter: (a, b) => compareStrings(a.title, b.title),
      sortOrder: sortOrderFor('title'),
    },
    {
      title: t('common.department'),
      key: 'department',
      render: (_, r) => r.department?.name || '—',
      sorter: (a, b) => compareStrings(a.department?.name, b.department?.name),
      sortOrder: sortOrderFor('department'),
    },
    {
      title: t('usersAdmin.rolesColLabel'),
      key: 'role',
      render: (_, r) => (
        <>
          {r.systemRoles?.includes('ADMIN') && <Tag color="purple">{t('usersAdmin.adminRoleTag')}</Tag>}
          {r.systemRoles?.includes('HR') && <Tag color="blue">{t('usersAdmin.hrRoleTag')}</Tag>}
          {r.systemRoles?.includes('USER_ADMIN') && <Tag color="cyan">{t('usersAdmin.userAdminRoleTag')}</Tag>}
          {!r.systemRoles?.length && <Tag color="default">{t('usersAdmin.employeeRoleTag')}</Tag>}
        </>
      ),
      sorter: (a, b) => (a.systemRoles?.length || 0) - (b.systemRoles?.length || 0),
      sortOrder: sortOrderFor('role'),
    },
    {
      title: t('common.status'),
      key: 'status',
      render: (_, r) =>
        r.active ? <Tag color="green">{t('departmentsAdmin.activeTag')}</Tag> : <Tag color="default">{t('departmentsAdmin.inactiveTag')}</Tag>,
      sorter: (a, b) => Number(a.active) - Number(b.active),
      sortOrder: sortOrderFor('status'),
    },
    {
      title: t('common.actions'),
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            {t('goalSetting.editButton')}
          </Button>
          <Button
            size="small"
            icon={<UserOutlined />}
            onClick={() => navigate(`/admin/users/${r.id}`)}
          >
            {t('usersAdmin.assignmentsButton')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('usersAdmin.pageTitle')}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<UploadOutlined />} onClick={openImport}>
            {t('usersAdmin.importCsvButton')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#13223a' }}>
            {t('usersAdmin.newUserButton')}
          </Button>
        </div>
      </div>

      <Input
        placeholder={t('usersAdmin.searchPlaceholder')}
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 360, marginBottom: 16 }}
      />

      <Table
        dataSource={filteredUsers}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: prefs.current,
          pageSize: prefs.pageSize,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => t('achievementLog.totalCount', { count: total }),
        }}
        onChange={handleTableChange}
        size="middle"
      />

      {/* ── Create / Edit modal ─────────────────────────────────────────────── */}
      <Modal
        title={editing ? t('usersAdmin.editUserTitle') : t('usersAdmin.createUserTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="fname" label={t('usersAdmin.firstNameLabel')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lname" label={t('usersAdmin.lastNameLabel')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item name="email" label={t('common.email')} rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
          )}
          {!editing && (
            <Form.Item name="password" label={t('usersAdmin.passwordLabel')}>
              <Input.Password placeholder={t('usersAdmin.passwordPlaceholder')} />
            </Form.Item>
          )}
          <Form.Item name="title" label={t('common.title')}>
            {isFullAdmin ? (
              <Input />
            ) : (
              <Select
                showSearch
                options={titleOptions}
                allowClear
                placeholder={t('usersAdmin.selectExistingTitlePlaceholder')}
                optionFilterProp="label"
              />
            )}
          </Form.Item>
          <Form.Item name="departmentId" label={t('common.department')}>
            <Select options={deptOptions} allowClear placeholder={t('usersAdmin.noDepartmentPlaceholder')} />
          </Form.Item>
          <Form.Item name="orgGroupId" label={t('usersAdmin.orgGroupLabel')}>
            <Select options={orgGroupOptions} allowClear placeholder={t('usersAdmin.noOrgGroupPlaceholder')} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -12, marginBottom: 16 }}>
            {t('usersAdmin.departmentOrOrgGroupRequired')}
          </Text>
          {isFullAdmin && (
            <Form.Item name="systemRoles" label={t('usersAdmin.rolesColLabel')}>
              <Checkbox.Group
                options={[
                  { label: t('usersAdmin.adminRoleTag'), value: 'ADMIN' },
                  { label: t('usersAdmin.hrRoleTag'), value: 'HR' },
                  { label: t('usersAdmin.userAdminRoleTag'), value: 'USER_ADMIN' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* ── CSV Import modal ────────────────────────────────────────────────── */}
      <Modal
        title={t('usersAdmin.importCsvTitle')}
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        footer={
          importResult ? (
            <Button type="primary" onClick={() => setImportOpen(false)}>
              {t('usersAdmin.doneButton')}
            </Button>
          ) : (
            <>
              <Button onClick={() => setImportOpen(false)}>{t('common.cancel')}</Button>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                disabled={!selectedFile}
                loading={importMutation.isPending}
                onClick={() => importMutation.mutate()}
                style={{ background: '#13223a' }}
              >
                {t('dataRepo.runImportButton')}
              </Button>
            </>
          )
        }
        width={600}
        destroyOnClose
      >
        {!importResult ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={downloadTemplate}
              >
                {t('usersAdmin.downloadTemplateButton')}
              </Button>
            </div>

            <Dragger
              accept=".csv"
              maxCount={1}
              beforeUpload={(file) => {
                setSelectedFile(file)
                return false  // prevent auto-upload
              }}
              onRemove={() => setSelectedFile(null)}
              fileList={selectedFile ? [selectedFile] : []}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">{t('usersAdmin.dragCsvText')}</p>
              <p className="ant-upload-hint">
                {t('usersAdmin.csvColumnsLabel')} <Text code>fname, lname, email, title, department, orgGroup</Text>
                <br />
                <Trans i18nKey="usersAdmin.csvHintLine1" components={{ code: <Text code />, strong: <strong /> }} />
                <br />
                {t('usersAdmin.csvHintLine2')}
                <br />
                {t('usersAdmin.csvHintLine3')}
              </p>
            </Dragger>
          </>
        ) : (
          <>
            <Row gutter={24} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Statistic
                  title={t('usersAdmin.newUsersCreatedStat')}
                  value={importResult.imported}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={t('usersAdmin.existingUsersUpdatedStat')}
                  value={importResult.updated}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={t('usersAdmin.rowsSkippedStat')}
                  value={importResult.errors?.length ?? 0}
                  valueStyle={{ color: importResult.errors?.length ? '#ff4d4f' : '#8c8c8c' }}
                />
              </Col>
            </Row>

            {importResult.errors?.length > 0 && (
              <>
                <Divider orientation="left" style={{ fontSize: 13 }}>
                  {t('usersAdmin.skippedRowsDivider')}
                </Divider>
                <Alert
                  type="warning"
                  showIcon
                  message={t('usersAdmin.rowsCouldNotBeImported', { count: importResult.errors.length })}
                  style={{ marginBottom: 12 }}
                />
                <Table
                  dataSource={importResult.errors}
                  columns={errorColumns}
                  rowKey="row"
                  size="small"
                  pagination={false}
                  scroll={{ y: 200 }}
                />
              </>
            )}

            {importResult.errors?.length === 0 && (
              <Alert type="success" showIcon message={t('usersAdmin.allRowsProcessed')} />
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
