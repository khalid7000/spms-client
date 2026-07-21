import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Card, Drawer, Space, InputNumber, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, AppstoreOutlined, OrderedListOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getAllTitles, createCategory, getCategoriesByTitle, updateCategory, deleteCategory,
  addRankLabel, getRankLabels, updateRankLabel, deleteRankLabel,
  addCriteria, getCriteria, updateCriteria, deleteCriteria,
  getAchievementModules, getAchievementModuleAssignments, assignAchievementModule, unassignAchievementModule,
  getInfoTools, getInfoToolAssignments, assignInfoTool, unassignInfoTool, getRepositoryTypes,
} from '../../api/portfolio'
import { useTablePrefs } from '../../hooks/useTablePrefs'
import TableTotal from '../../components/TableTotal'
import { useTerminology } from '../../TerminologyContext'

const CATEGORY_PREFS_KEY = 'spms.admin.portfolio.categories'

export default function CategoryManagementPage() {
  const { t } = useTranslation()
  const { academicYearLabel } = useTerminology()
  const [selectedTitle, setSelectedTitle] = useState(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [rankLabelDrawerOpen, setRankLabelDrawerOpen] = useState(false)
  const [criteriaDrawerOpen, setCriteriaDrawerOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingRankLabel, setEditingRankLabel] = useState(null)
  const [editingCriteria, setEditingCriteria] = useState(null)
  const [categoryForm] = Form.useForm()
  const [rankLabelForm] = Form.useForm()
  const [criteriaForm] = Form.useForm()
  const qc = useQueryClient()
  const { handleTableChange } = useTablePrefs(CATEGORY_PREFS_KEY)

  // Fetch titles
  const { data: titles = [], isLoading: titlesLoading } = useQuery({
    queryKey: ['employee-titles'],
    queryFn: getAllTitles,
  })
  const selectedTitleObj = titles.find((ti) => ti.id === selectedTitle)

  // Fetch categories for selected title
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['portfolio-categories', selectedTitle],
    queryFn: () => selectedTitle ? getCategoriesByTitle(selectedTitle) : Promise.resolve([]),
    enabled: !!selectedTitle
  })

  // Fetch rank labels for selected title
  const { data: rankLabels = [] } = useQuery({
    queryKey: ['rank-labels', selectedTitle],
    queryFn: () => selectedTitle ? getRankLabels(selectedTitle) : Promise.resolve([]),
    enabled: !!selectedTitle
  })

  // Mutations for categories
  const createCategoryMutation = useMutation({
    mutationFn: (values) => createCategory(selectedTitle, values),
    onSuccess: () => {
      message.success(t('categoryMgmt.categoryCreated'))
      setCategoryModalOpen(false)
      categoryForm.resetFields()
      qc.invalidateQueries({ queryKey: ['portfolio-categories', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.createCategoryFailed'))
  })

  const updateCategoryMutation = useMutation({
    mutationFn: (values) => updateCategory(editingCategory.id, values),
    onSuccess: () => {
      message.success(t('categoryMgmt.categoryUpdated'))
      setCategoryModalOpen(false)
      categoryForm.resetFields()
      setEditingCategory(null)
      qc.invalidateQueries({ queryKey: ['portfolio-categories', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.updateCategoryFailed'))
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: () => {
      message.success(t('categoryMgmt.categoryDeleted'))
      qc.invalidateQueries({ queryKey: ['portfolio-categories', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.cannotDeleteSystemDefault'))
  })

  // Mutations for rank labels (per title)
  const addRankLabelMutation = useMutation({
    mutationFn: (values) => addRankLabel(selectedTitle, values),
    onSuccess: () => {
      message.success(t('categoryMgmt.rankLabelAdded'))
      rankLabelForm.resetFields()
      qc.invalidateQueries({ queryKey: ['rank-labels', selectedTitle] })
      qc.invalidateQueries({ queryKey: ['employee-titles'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.addRankLabelFailed'))
  })

  const updateRankLabelMutation = useMutation({
    mutationFn: (values) => updateRankLabel(editingRankLabel.id, values),
    onSuccess: () => {
      message.success(t('categoryMgmt.rankLabelUpdated'))
      rankLabelForm.resetFields()
      setEditingRankLabel(null)
      qc.invalidateQueries({ queryKey: ['rank-labels', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.updateRankLabelFailed'))
  })

  const deleteRankLabelMutation = useMutation({
    mutationFn: (id) => deleteRankLabel(id),
    onSuccess: () => {
      message.success(t('categoryMgmt.rankLabelDeleted'))
      qc.invalidateQueries({ queryKey: ['rank-labels', selectedTitle] })
      qc.invalidateQueries({ queryKey: ['employee-titles'] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.deleteRankLabelFailed'))
  })

  // Mutations for criteria
  const addCriteriaMutation = useMutation({
    mutationFn: (values) => addCriteria(editingCategory.id, values),
    onSuccess: () => {
      message.success(t('categoryMgmt.criteriaAdded'))
      criteriaForm.resetFields()
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory.id] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.addCriteriaFailed'))
  })

  const updateCriteriaMutation = useMutation({
    mutationFn: (values) => updateCriteria(editingCriteria.id, values),
    onSuccess: () => {
      message.success(t('categoryMgmt.criteriaUpdated'))
      criteriaForm.resetFields()
      setEditingCriteria(null)
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory.id] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.updateCriteriaFailed'))
  })

  const deleteCriteriaMutation = useMutation({
    mutationFn: (id) => deleteCriteria(id),
    onSuccess: () => {
      message.success(t('categoryMgmt.criteriaDeleted'))
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory.id] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.deleteCriteriaFailed'))
  })

  // Fetch criteria for category being managed
  const { data: categoryCriteria = [] } = useQuery({
    queryKey: ['criteria', editingCategory?.id],
    queryFn: () => editingCategory ? getCriteria(editingCategory.id) : Promise.resolve([]),
    enabled: !!editingCategory
  })

  // Achievement modules -- registered modules (fixed, code-defined) plus this title's current
  // assignments (used to know which modules are "taken" elsewhere in the title, since a module
  // may only be assigned to one criterion per title).
  const { data: achievementModules = [] } = useQuery({
    queryKey: ['achievement-modules'],
    queryFn: getAchievementModules,
  })
  const { data: titleModuleAssignments = [] } = useQuery({
    queryKey: ['achievement-module-assignments', selectedTitle],
    queryFn: () => getAchievementModuleAssignments(selectedTitle),
    enabled: !!selectedTitle,
  })

  // Assigning (or re-assigning to change the limit) always goes through this prompt -- the max
  // achievements/year is required, so there's no "assign, then set the limit later" path.
  const [moduleLimitPrompt, setModuleLimitPrompt] = useState(null) // { code, criteriaId, moduleName }
  const [moduleLimitForm] = Form.useForm()

  const assignModuleMutation = useMutation({
    mutationFn: ({ code, criteriaId, maxAchievementsPerYear, mandatory, displayName }) =>
      assignAchievementModule(code, criteriaId, maxAchievementsPerYear, mandatory, displayName),
    onSuccess: () => {
      message.success(t('categoryMgmt.moduleAssigned'))
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory?.id] })
      qc.invalidateQueries({ queryKey: ['achievement-module-assignments', selectedTitle] })
      setModuleLimitPrompt(null)
      moduleLimitForm.resetFields()
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.assignModuleFailed'))
  })

  const unassignModuleMutation = useMutation({
    mutationFn: ({ code, criteriaId }) => unassignAchievementModule(code, criteriaId),
    onSuccess: () => {
      message.success(t('categoryMgmt.moduleUnassigned'))
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory?.id] })
      qc.invalidateQueries({ queryKey: ['achievement-module-assignments', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.unassignModuleFailed'))
  })

  // Criteria Info Tools -- head-only viewers, parallel to achievement modules above but for
  // pulling in reference info (e.g. Early Alert data) rather than recording achievements. Only
  // one implementation exists today (Central Repository Viewer); the tool itself has no display
  // name (unlike achievement modules), so INFO_TOOL_LABELS below is purely a picker-UI label.
  const { data: infoTools = [] } = useQuery({
    queryKey: ['info-tools'],
    queryFn: getInfoTools,
  })
  const { data: titleInfoToolAssignments = [] } = useQuery({
    queryKey: ['info-tool-assignments', selectedTitle],
    queryFn: () => getInfoToolAssignments(selectedTitle),
    enabled: !!selectedTitle,
  })
  const { data: repositoryTypes = [] } = useQuery({
    queryKey: ['repository-types'],
    queryFn: getRepositoryTypes,
  })

  // { code, criteriaId, toolLabel, repositorySourceType, isNew } -- repositorySourceType is part of
  // an assignment's identity (see backend uniqueness fix), so it's only pickable when isNew; editing
  // an existing assignment only ever changes its displayName.
  const [infoToolPrompt, setInfoToolPrompt] = useState(null)
  const [infoToolForm] = Form.useForm()

  const assignInfoToolMutation = useMutation({
    mutationFn: ({ code, criteriaId, displayName, repositorySourceType }) =>
      assignInfoTool(code, criteriaId, displayName, repositorySourceType),
    onSuccess: () => {
      message.success(t('categoryMgmt.infoToolAssigned'))
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory?.id] })
      qc.invalidateQueries({ queryKey: ['info-tool-assignments', selectedTitle] })
      setInfoToolPrompt(null)
      infoToolForm.resetFields()
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.assignInfoToolFailed'))
  })

  const unassignInfoToolMutation = useMutation({
    mutationFn: ({ code, criteriaId, repositorySourceType }) => unassignInfoTool(code, criteriaId, repositorySourceType),
    onSuccess: () => {
      message.success(t('categoryMgmt.infoToolUnassigned'))
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory?.id] })
      qc.invalidateQueries({ queryKey: ['info-tool-assignments', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('categoryMgmt.unassignInfoToolFailed'))
  })

  const INFO_TOOL_LABELS = { CENTRAL_REPOSITORY_VIEWER: t('categoryMgmt.centralRepositoryViewerLabel') }
  const REPOSITORY_TYPE_LABELS = { EARLY_ALERT: t('categoryMgmt.earlyAlertLabel'), GRADE_DISTRIBUTION: t('categoryMgmt.gradeDistributionLabel') }
  const infoToolComboLabel = (toolCode, repositorySourceType) =>
    t('categoryMgmt.comboLabel', {
      tool: INFO_TOOL_LABELS[toolCode] ?? toolCode,
      type: REPOSITORY_TYPE_LABELS[repositorySourceType] ?? repositorySourceType,
    })

  const handleCreateCategory = () => {
    setEditingCategory(null)
    categoryForm.resetFields()
    setCategoryModalOpen(true)
  }

  const handleEditCategory = (category) => {
    setEditingCategory(category)
    categoryForm.setFieldsValue({
      categoryName: category.categoryName,
      description: category.description
    })
    setCategoryModalOpen(true)
  }

  const handleSaveCategory = async () => {
    try {
      const values = await categoryForm.validateFields()
      if (editingCategory) {
        await updateCategoryMutation.mutateAsync(values)
      } else {
        await createCategoryMutation.mutateAsync(values)
      }
    } catch (err) {
      message.error(t('categoryMgmt.fixFormErrors'))
    }
  }

  const handleManageCriteria = (category) => {
    setEditingCategory(category)
    setCriteriaDrawerOpen(true)
  }

  const handleSaveRankLabel = async () => {
    try {
      const values = await rankLabelForm.validateFields()
      if (editingRankLabel) {
        await updateRankLabelMutation.mutateAsync(values)
      } else {
        await addRankLabelMutation.mutateAsync(values)
      }
    } catch (err) {
      message.error(t('categoryMgmt.fixFormErrors'))
    }
  }

  const handleSaveCriteria = async () => {
    try {
      const values = await criteriaForm.validateFields()
      if (editingCriteria) {
        await updateCriteriaMutation.mutateAsync(values)
      } else {
        await addCriteriaMutation.mutateAsync(values)
      }
    } catch (err) {
      message.error(t('categoryMgmt.fixFormErrors'))
    }
  }

  const categoriesColumns = [
    {
      title: t('categoryMgmt.colCategoryName'),
      dataIndex: 'categoryName',
      key: 'categoryName',
      sorter: (a, b) => a.categoryName.localeCompare(b.categoryName)
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: t('categoryMgmt.colCriteria'),
      key: 'criteriaCount',
      width: 90,
      render: (_, record) => record.criteria?.length ?? 0
    },
    {
      title: t('categoryMgmt.colSystemDefault'),
      dataIndex: 'isSystemDefault',
      key: 'isSystemDefault',
      render: (val) => val ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : '-'
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="primary" size="small" onClick={() => handleEditCategory(record)}>
            <EditOutlined /> {t('goalSetting.editButton')}
          </Button>
          <Button type="default" size="small" onClick={() => handleManageCriteria(record)}>
            <AppstoreOutlined /> {t('categoryMgmt.colCriteria')}
          </Button>
          {!record.isSystemDefault && (
            <Popconfirm title={t('categoryMgmt.deleteCategoryConfirmTitle')} onConfirm={() => deleteCategoryMutation.mutate(record.id)}>
              <Button type="primary" danger size="small">
                <DeleteOutlined />
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const rankLabelColumns = [
    { title: t('categoryMgmt.colRank'), dataIndex: 'rank', key: 'rank', width: 80, sorter: (a, b) => a.rank - b.rank },
    { title: t('categoryMgmt.colLabel'), dataIndex: 'label', key: 'label' },
    { title: t('common.description'), dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button type="primary" size="small" onClick={() => {
            setEditingRankLabel(record)
            rankLabelForm.setFieldsValue(record)
          }}>
            <EditOutlined />
          </Button>
          <Popconfirm title={t('categoryMgmt.deleteConfirmTitle')} onConfirm={() => deleteRankLabelMutation.mutate(record.id)}>
            <Button type="primary" danger size="small"><DeleteOutlined /></Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const criteriaColumns = [
    { title: t('categoryMgmt.colCriteriaName'), dataIndex: 'criteriaName', key: 'criteriaName', sorter: (a, b) => a.criteriaName.localeCompare(b.criteriaName) },
    { title: t('common.description'), dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: t('categoryMgmt.colRubric'), key: 'rubric', width: 90,
      render: (_, record) => record.rubricUnsatisfactory && record.rubricMeetsExpectations && record.rubricExceedsExpectations
        ? <Tag color="green">{t('categoryMgmt.rubricSetTag')}</Tag> : <Tag color="orange">{t('categoryMgmt.rubricNotSetTag')}</Tag>,
    },
    {
      title: (
        <div>
          <div>{t('categoryMgmt.achievementModulesColTitle')}</div>
          <div style={{ fontWeight: 400, fontSize: 11, color: '#9ca3af' }}>
            {t('categoryMgmt.achievementModulesColHint')}
          </div>
        </div>
      ),
      key: 'achievementModules', width: 260,
      render: (_, record) => {
        const assignedCodes = record.achievementModuleCodes ?? []
        const availableModules = achievementModules.filter((m) =>
          !assignedCodes.includes(m.code)
          && !titleModuleAssignments.some((a) => a.moduleCode === m.code && a.criteriaId !== record.id)
        )
        return (
          <Space direction="vertical" size={4}>
            <Space size={4} wrap>
              {assignedCodes.map((code) => {
                const module = achievementModules.find((m) => m.code === code)
                const assignment = titleModuleAssignments.find((a) => a.moduleCode === code && a.criteriaId === record.id)
                return (
                  <Tag key={code} closable
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setModuleLimitPrompt({ code, criteriaId: record.id, moduleName: module?.displayName ?? code })
                      moduleLimitForm.setFieldsValue({
                        maxAchievementsPerYear: assignment?.maxAchievementsPerYear,
                        mandatory: assignment?.mandatory ?? false,
                        displayName: assignment?.displayName,
                      })
                    }}
                    onClose={(e) => { e.preventDefault(); unassignModuleMutation.mutate({ code, criteriaId: record.id }) }}>
                    {assignment?.displayName || module?.displayName || code}
                    {assignment?.maxAchievementsPerYear ? t('categoryMgmt.maxPerYearSuffix', { count: assignment.maxAchievementsPerYear }) : ''}
                    {assignment?.mandatory ? t('categoryMgmt.requiredSuffix') : ''}
                  </Tag>
                )
              })}
            </Space>
            {availableModules.length > 0 && (
              <Select
                size="small" style={{ width: 200 }} placeholder={t('categoryMgmt.assignModulePlaceholder')} value={null}
                options={availableModules.map((m) => ({ value: m.code, label: m.displayName }))}
                onChange={(code) => {
                  const module = achievementModules.find((m) => m.code === code)
                  setModuleLimitPrompt({ code, criteriaId: record.id, moduleName: module?.displayName ?? code })
                  moduleLimitForm.resetFields()
                }}
              />
            )}
          </Space>
        )
      },
    },
    {
      title: (
        <div>
          <div>{t('categoryMgmt.infoToolsColTitle')}</div>
          <div style={{ fontWeight: 400, fontSize: 11, color: '#9ca3af' }}>
            {t('categoryMgmt.infoToolsColHint')}
          </div>
        </div>
      ),
      key: 'infoTools', width: 240,
      render: (_, record) => {
        const assignments = record.infoToolAssignments ?? []
        const usedCombos = new Set(titleInfoToolAssignments.map((a) => `${a.toolCode}::${a.repositorySourceType}`))
        const availableCombos = infoTools.flatMap((tool) =>
          repositoryTypes
            .filter((rt) => !usedCombos.has(`${tool.code}::${rt}`))
            .map((rt) => ({ code: tool.code, repositorySourceType: rt }))
        )
        return (
          <Space direction="vertical" size={4}>
            <Space size={4} wrap>
              {assignments.map((a) => (
                <Tag key={`${a.toolCode}-${a.repositorySourceType}`} closable
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setInfoToolPrompt({
                      code: a.toolCode, criteriaId: record.id,
                      toolLabel: infoToolComboLabel(a.toolCode, a.repositorySourceType),
                      repositorySourceType: a.repositorySourceType, isNew: false,
                    })
                    infoToolForm.setFieldsValue({ displayName: a.displayName, repositorySourceType: a.repositorySourceType })
                  }}
                  onClose={(e) => {
                    e.preventDefault()
                    unassignInfoToolMutation.mutate({ code: a.toolCode, criteriaId: record.id, repositorySourceType: a.repositorySourceType })
                  }}>
                  {a.displayName}
                </Tag>
              ))}
            </Space>
            {availableCombos.length > 0 && (
              <Select
                size="small" style={{ width: 220 }} placeholder={t('categoryMgmt.assignToolPlaceholder')} value={null}
                options={availableCombos.map((c) => ({
                  value: `${c.code}::${c.repositorySourceType}`,
                  label: infoToolComboLabel(c.code, c.repositorySourceType),
                }))}
                onChange={(value) => {
                  const [code, repositorySourceType] = value.split('::')
                  setInfoToolPrompt({
                    code, criteriaId: record.id,
                    toolLabel: infoToolComboLabel(code, repositorySourceType),
                    repositorySourceType, isNew: true,
                  })
                  infoToolForm.resetFields()
                  infoToolForm.setFieldsValue({ repositorySourceType })
                }}
              />
            )}
          </Space>
        )
      },
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="primary" size="small" onClick={() => {
            setEditingCriteria(record)
            criteriaForm.setFieldsValue(record)
          }}>
            <EditOutlined />
          </Button>
          <Popconfirm title={t('categoryMgmt.deleteConfirmTitle')} onConfirm={() => deleteCriteriaMutation.mutate(record.id)}>
            <Button type="primary" danger size="small"><DeleteOutlined /></Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <h1>{t('categoryMgmt.pageTitle')}</h1>

        <Form layout="inline" style={{ marginBottom: '20px' }}>
          <Form.Item label={t('categoryMgmt.selectTitleLabel')}>
            <Select
              style={{ width: 200 }}
              placeholder={t('categoryMgmt.selectTitlePlaceholder')}
              value={selectedTitle}
              onChange={setSelectedTitle}
              loading={titlesLoading}
              options={titles.map(ti => ({ label: ti.titleName, value: ti.id }))}
            />
          </Form.Item>
          {selectedTitle && (
            <>
              <Form.Item>
                <Button icon={<OrderedListOutlined />} onClick={() => setRankLabelDrawerOpen(true)}>
                  {t('categoryMgmt.manageRankLabelsButton')}
                  {!selectedTitleObj?.hasRankLabels && <Tag color="warning" style={{ marginLeft: 8 }}>{t('categoryMgmt.notConfiguredTag')}</Tag>}
                </Button>
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateCategory}>
                  {t('categoryMgmt.newCategoryButton')}
                </Button>
              </Form.Item>
            </>
          )}
        </Form>

        {selectedTitle && (
          <Table
            dataSource={categories}
            columns={categoriesColumns}
            loading={categoriesLoading}
            rowKey="id"
            onChange={handleTableChange}
            pagination={{ pageSize: 10, showTotal: (total) => t('achievementLog.totalCount', { count: total }) }}
          />
        )}
      </Card>

      {/* Category Modal */}
      <Modal
        title={editingCategory ? t('categoryMgmt.editCategoryTitle') : t('categoryMgmt.createCategoryTitle')}
        open={categoryModalOpen}
        onOk={handleSaveCategory}
        onCancel={() => {
          setCategoryModalOpen(false)
          setEditingCategory(null)
          categoryForm.resetFields()
        }}
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item label={t('categoryMgmt.colCategoryName')} name="categoryName" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('common.description')} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Rank Labels Drawer (per Title) */}
      <Drawer
        title={t('categoryMgmt.rankLabelsDrawerTitle', { title: selectedTitleObj?.titleName ?? '' })}
        placement="right"
        onClose={() => { setRankLabelDrawerOpen(false); setEditingRankLabel(null) }}
        open={rankLabelDrawerOpen}
        width={600}
      >
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          {t('categoryMgmt.rankLabelsIntro')}
        </p>
        <TableTotal count={rankLabels.length} />
        <Table
          dataSource={rankLabels}
          columns={rankLabelColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
        <Card style={{ marginTop: '16px' }}>
          <Form form={rankLabelForm} layout="vertical">
            <Form.Item label={t('categoryMgmt.colRank')} name="rank" rules={[{ required: true }]}>
              <InputNumber min={1} max={5} />
            </Form.Item>
            <Form.Item label={t('categoryMgmt.colLabel')} name="label" rules={[{ required: true }]}>
              <Input placeholder={t('categoryMgmt.labelPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('common.description')} name="description">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Space>
              <Button type="primary" onClick={handleSaveRankLabel}>
                {editingRankLabel ? t('categoryMgmt.updateRankLabelButton') : t('categoryMgmt.addRankLabelButton')}
              </Button>
              {editingRankLabel && (
                <Button onClick={() => { setEditingRankLabel(null); rankLabelForm.resetFields() }}>{t('common.cancel')}</Button>
              )}
            </Space>
          </Form>
        </Card>
      </Drawer>

      {/* Criteria Drawer (per Category) */}
      <Drawer
        title={t('categoryMgmt.criteriaDrawerTitle', { category: editingCategory?.categoryName ?? '' })}
        placement="right"
        onClose={() => { setCriteriaDrawerOpen(false); setEditingCategory(null); setEditingCriteria(null) }}
        open={criteriaDrawerOpen}
        width={900}
      >
        {editingCategory && (
          <div>
            <TableTotal count={categoryCriteria.length} />
            <Table
              dataSource={categoryCriteria}
              columns={criteriaColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
            <Card style={{ marginTop: '16px' }}>
              <Form form={criteriaForm} layout="vertical">
                <Form.Item label={t('categoryMgmt.colCriteriaName')} name="criteriaName" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item label={t('common.description')} name="description" extra={t('categoryMgmt.criteriaDescriptionExtra')}>
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item
                  label={t('categoryMgmt.rubricUnsatisfactoryLabel')} name="rubricUnsatisfactory"
                  extra={t('categoryMgmt.rubricUnsatisfactoryExtra')}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item
                  label={t('categoryMgmt.rubricMeetsLabel')} name="rubricMeetsExpectations"
                  extra={t('categoryMgmt.rubricMeetsExtra')}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item
                  label={t('categoryMgmt.rubricExceedsLabel')} name="rubricExceedsExpectations"
                  extra={t('categoryMgmt.rubricExceedsExtra')}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Space>
                  <Button type="primary" onClick={handleSaveCriteria}>
                    {editingCriteria ? t('categoryMgmt.updateCriteriaButton') : t('categoryMgmt.addCriteriaButton')}
                  </Button>
                  {editingCriteria && (
                    <Button onClick={() => { setEditingCriteria(null); criteriaForm.resetFields() }}>{t('common.cancel')}</Button>
                  )}
                </Space>
              </Form>
            </Card>
          </div>
        )}
      </Drawer>

      {/* Achievement Module assign/edit-limit prompt -- the max-per-year is required, so assigning
          (or changing it later) always goes through this one form. */}
      <Modal
        title={moduleLimitPrompt ? t('categoryMgmt.moduleLimitModalTitle', { name: moduleLimitPrompt.moduleName }) : ''}
        open={!!moduleLimitPrompt}
        onOk={() => moduleLimitForm.submit()}
        confirmLoading={assignModuleMutation.isPending}
        onCancel={() => { setModuleLimitPrompt(null); moduleLimitForm.resetFields() }}
        okText={t('common.save')}
      >
        <Form
          form={moduleLimitForm} layout="vertical" initialValues={{ mandatory: false }}
          onFinish={(values) => assignModuleMutation.mutate({
            code: moduleLimitPrompt.code, criteriaId: moduleLimitPrompt.criteriaId,
            maxAchievementsPerYear: values.maxAchievementsPerYear,
            mandatory: values.mandatory,
            displayName: values.displayName,
          })}
        >
          <Form.Item
            label={t('categoryMgmt.maxAchievementsPerLabel', { yearLabel: academicYearLabel.toLowerCase() })} name="maxAchievementsPerYear"
            rules={[{ required: true, message: t('categoryMgmt.enterPositiveNumber') }]}
            extra={t('categoryMgmt.maxAchievementsExtra', { yearLabel: academicYearLabel.toLowerCase() })}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('categoryMgmt.mandatoryLabel')} name="mandatory" valuePropName="checked"
            extra={t('categoryMgmt.mandatoryExtra')}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('categoryMgmt.buttonLabelOverrideLabel')} name="displayName"
            extra={t('categoryMgmt.buttonLabelOverrideExtra', { name: moduleLimitPrompt?.moduleName ?? '' })}
          >
            <Input placeholder={moduleLimitPrompt?.moduleName} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Info Tool assign/edit prompt -- unlike achievement modules, the tool itself has no
          hardcoded name, so a display name is always required here (not just an override). */}
      <Modal
        title={infoToolPrompt ? t('categoryMgmt.infoToolModalTitle', { label: infoToolPrompt.toolLabel }) : ''}
        open={!!infoToolPrompt}
        onOk={() => infoToolForm.submit()}
        confirmLoading={assignInfoToolMutation.isPending}
        onCancel={() => { setInfoToolPrompt(null); infoToolForm.resetFields() }}
        okText={t('common.save')}
      >
        <Form
          form={infoToolForm} layout="vertical"
          onFinish={(values) => assignInfoToolMutation.mutate({
            code: infoToolPrompt.code, criteriaId: infoToolPrompt.criteriaId,
            displayName: values.displayName,
            repositorySourceType: values.repositorySourceType,
          })}
        >
          <Form.Item
            label={t('categoryMgmt.buttonLabelLabel')} name="displayName"
            rules={[{ required: true, message: t('categoryMgmt.enterButtonLabelMessage') }]}
            extra={t('categoryMgmt.buttonLabelExtra')}
          >
            <Input placeholder={t('categoryMgmt.buttonLabelPlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('categoryMgmt.repositoryTypeLabel')} name="repositorySourceType"
            rules={[{ required: true, message: t('categoryMgmt.selectRepositoryTypeMessage') }]}
            extra={infoToolPrompt?.isNew
              ? t('categoryMgmt.repositoryTypeExtraNew')
              : t('categoryMgmt.repositoryTypeExtraFixed')}
          >
            <Select
              disabled={!infoToolPrompt?.isNew}
              options={repositoryTypes.map((rt) => ({ value: rt, label: REPOSITORY_TYPE_LABELS[rt] ?? rt }))}
              placeholder={t('categoryMgmt.selectTypePlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
