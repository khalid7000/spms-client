import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Card, Drawer, Space, InputNumber, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, AppstoreOutlined, OrderedListOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  const selectedTitleObj = titles.find((t) => t.id === selectedTitle)

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
      message.success('Category created')
      setCategoryModalOpen(false)
      categoryForm.resetFields()
      qc.invalidateQueries({ queryKey: ['portfolio-categories', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to create category')
  })

  const updateCategoryMutation = useMutation({
    mutationFn: (values) => updateCategory(editingCategory.id, values),
    onSuccess: () => {
      message.success('Category updated')
      setCategoryModalOpen(false)
      categoryForm.resetFields()
      setEditingCategory(null)
      qc.invalidateQueries({ queryKey: ['portfolio-categories', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update category')
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: () => {
      message.success('Category deleted')
      qc.invalidateQueries({ queryKey: ['portfolio-categories', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Cannot delete system default categories')
  })

  // Mutations for rank labels (per title)
  const addRankLabelMutation = useMutation({
    mutationFn: (values) => addRankLabel(selectedTitle, values),
    onSuccess: () => {
      message.success('Rank label added')
      rankLabelForm.resetFields()
      qc.invalidateQueries({ queryKey: ['rank-labels', selectedTitle] })
      qc.invalidateQueries({ queryKey: ['employee-titles'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to add rank label')
  })

  const updateRankLabelMutation = useMutation({
    mutationFn: (values) => updateRankLabel(editingRankLabel.id, values),
    onSuccess: () => {
      message.success('Rank label updated')
      rankLabelForm.resetFields()
      setEditingRankLabel(null)
      qc.invalidateQueries({ queryKey: ['rank-labels', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update rank label')
  })

  const deleteRankLabelMutation = useMutation({
    mutationFn: (id) => deleteRankLabel(id),
    onSuccess: () => {
      message.success('Rank label deleted')
      qc.invalidateQueries({ queryKey: ['rank-labels', selectedTitle] })
      qc.invalidateQueries({ queryKey: ['employee-titles'] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to delete rank label')
  })

  // Mutations for criteria
  const addCriteriaMutation = useMutation({
    mutationFn: (values) => addCriteria(editingCategory.id, values),
    onSuccess: () => {
      message.success('Criteria added')
      criteriaForm.resetFields()
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory.id] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to add criteria')
  })

  const updateCriteriaMutation = useMutation({
    mutationFn: (values) => updateCriteria(editingCriteria.id, values),
    onSuccess: () => {
      message.success('Criteria updated')
      criteriaForm.resetFields()
      setEditingCriteria(null)
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory.id] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to update criteria')
  })

  const deleteCriteriaMutation = useMutation({
    mutationFn: (id) => deleteCriteria(id),
    onSuccess: () => {
      message.success('Criteria deleted')
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory.id] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to delete criteria')
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
      message.success('Achievement module assigned')
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory?.id] })
      qc.invalidateQueries({ queryKey: ['achievement-module-assignments', selectedTitle] })
      setModuleLimitPrompt(null)
      moduleLimitForm.resetFields()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to assign achievement module')
  })

  const unassignModuleMutation = useMutation({
    mutationFn: ({ code, criteriaId }) => unassignAchievementModule(code, criteriaId),
    onSuccess: () => {
      message.success('Achievement module unassigned')
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory?.id] })
      qc.invalidateQueries({ queryKey: ['achievement-module-assignments', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to unassign achievement module')
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
      message.success('Info tool assigned')
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory?.id] })
      qc.invalidateQueries({ queryKey: ['info-tool-assignments', selectedTitle] })
      setInfoToolPrompt(null)
      infoToolForm.resetFields()
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to assign info tool')
  })

  const unassignInfoToolMutation = useMutation({
    mutationFn: ({ code, criteriaId, repositorySourceType }) => unassignInfoTool(code, criteriaId, repositorySourceType),
    onSuccess: () => {
      message.success('Info tool unassigned')
      qc.invalidateQueries({ queryKey: ['criteria', editingCategory?.id] })
      qc.invalidateQueries({ queryKey: ['info-tool-assignments', selectedTitle] })
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to unassign info tool')
  })

  const INFO_TOOL_LABELS = { CENTRAL_REPOSITORY_VIEWER: 'Central Repository Viewer' }
  const REPOSITORY_TYPE_LABELS = { EARLY_ALERT: 'Early Alert', GRADE_DISTRIBUTION: 'Grade Distribution' }
  const infoToolComboLabel = (toolCode, repositorySourceType) =>
    `${INFO_TOOL_LABELS[toolCode] ?? toolCode} -- ${REPOSITORY_TYPE_LABELS[repositorySourceType] ?? repositorySourceType}`

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
      message.error('Please fix the form errors')
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
      message.error('Please fix the form errors')
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
      message.error('Please fix the form errors')
    }
  }

  const categoriesColumns = [
    {
      title: 'Category Name',
      dataIndex: 'categoryName',
      key: 'categoryName',
      sorter: (a, b) => a.categoryName.localeCompare(b.categoryName)
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Criteria',
      key: 'criteriaCount',
      width: 90,
      render: (_, record) => record.criteria?.length ?? 0
    },
    {
      title: 'System Default',
      dataIndex: 'isSystemDefault',
      key: 'isSystemDefault',
      render: (val) => val ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="primary" size="small" onClick={() => handleEditCategory(record)}>
            <EditOutlined /> Edit
          </Button>
          <Button type="default" size="small" onClick={() => handleManageCriteria(record)}>
            <AppstoreOutlined /> Criteria
          </Button>
          {!record.isSystemDefault && (
            <Popconfirm title="Delete category?" onConfirm={() => deleteCategoryMutation.mutate(record.id)}>
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
    { title: 'Rank', dataIndex: 'rank', key: 'rank', width: 80, sorter: (a, b) => a.rank - b.rank },
    { title: 'Label', dataIndex: 'label', key: 'label' },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Actions',
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
          <Popconfirm title="Delete?" onConfirm={() => deleteRankLabelMutation.mutate(record.id)}>
            <Button type="primary" danger size="small"><DeleteOutlined /></Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const criteriaColumns = [
    { title: 'Criteria Name', dataIndex: 'criteriaName', key: 'criteriaName', sorter: (a, b) => a.criteriaName.localeCompare(b.criteriaName) },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Rubric', key: 'rubric', width: 90,
      render: (_, record) => record.rubricUnsatisfactory && record.rubricMeetsExpectations && record.rubricExceedsExpectations
        ? <Tag color="green">Set</Tag> : <Tag color="orange">Not set</Tag>,
    },
    {
      title: (
        <div>
          <div>Achievement Modules</div>
          <div style={{ fontWeight: 400, fontSize: 11, color: '#9ca3af' }}>
            (Optional -- lets the user manually add an achievement for this criterion)
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
                    {assignment?.maxAchievementsPerYear ? ` · max ${assignment.maxAchievementsPerYear}/yr` : ''}
                    {assignment?.mandatory ? ' · required' : ''}
                  </Tag>
                )
              })}
            </Space>
            {availableModules.length > 0 && (
              <Select
                size="small" style={{ width: 200 }} placeholder="+ Assign module" value={null}
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
          <div>Info Tools</div>
          <div style={{ fontWeight: 400, fontSize: 11, color: '#9ca3af' }}>
            (Optional -- lets the evaluator pull in reference info while reviewing this criterion)
          </div>
        </div>
      ),
      key: 'infoTools', width: 240,
      render: (_, record) => {
        const assignments = record.infoToolAssignments ?? []
        const usedCombos = new Set(titleInfoToolAssignments.map((a) => `${a.toolCode}::${a.repositorySourceType}`))
        const availableCombos = infoTools.flatMap((t) =>
          repositoryTypes
            .filter((rt) => !usedCombos.has(`${t.code}::${rt}`))
            .map((rt) => ({ code: t.code, repositorySourceType: rt }))
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
                size="small" style={{ width: 220 }} placeholder="+ Assign tool" value={null}
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
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="primary" size="small" onClick={() => {
            setEditingCriteria(record)
            criteriaForm.setFieldsValue(record)
          }}>
            <EditOutlined />
          </Button>
          <Popconfirm title="Delete?" onConfirm={() => deleteCriteriaMutation.mutate(record.id)}>
            <Button type="primary" danger size="small"><DeleteOutlined /></Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <h1>Portfolio Category Management</h1>

        <Form layout="inline" style={{ marginBottom: '20px' }}>
          <Form.Item label="Select Title">
            <Select
              style={{ width: 200 }}
              placeholder="Select employee title"
              value={selectedTitle}
              onChange={setSelectedTitle}
              loading={titlesLoading}
              options={titles.map(t => ({ label: t.titleName, value: t.id }))}
            />
          </Form.Item>
          {selectedTitle && (
            <>
              <Form.Item>
                <Button icon={<OrderedListOutlined />} onClick={() => setRankLabelDrawerOpen(true)}>
                  Manage Rank Labels (1-5)
                  {!selectedTitleObj?.hasRankLabels && <Tag color="warning" style={{ marginLeft: 8 }}>Not configured</Tag>}
                </Button>
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateCategory}>
                  New Category
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
            pagination={{ pageSize: 10, showTotal: (total) => `Total: ${total}` }}
          />
        )}
      </Card>

      {/* Category Modal */}
      <Modal
        title={editingCategory ? 'Edit Category' : 'Create Category'}
        open={categoryModalOpen}
        onOk={handleSaveCategory}
        onCancel={() => {
          setCategoryModalOpen(false)
          setEditingCategory(null)
          categoryForm.resetFields()
        }}
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item label="Category Name" name="categoryName" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Rank Labels Drawer (per Title) */}
      <Drawer
        title={`Rank Labels (1-5): ${selectedTitleObj?.titleName ?? ''}`}
        placement="right"
        onClose={() => { setRankLabelDrawerOpen(false); setEditingRankLabel(null) }}
        open={rankLabelDrawerOpen}
        width={600}
      >
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          These labels apply to every category under this title, and to the final overall rank given
          during an evaluation cycle.
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
            <Form.Item label="Rank" name="rank" rules={[{ required: true }]}>
              <InputNumber min={1} max={5} />
            </Form.Item>
            <Form.Item label="Label" name="label" rules={[{ required: true }]}>
              <Input placeholder="e.g., Excellent" />
            </Form.Item>
            <Form.Item label="Description" name="description">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Space>
              <Button type="primary" onClick={handleSaveRankLabel}>
                {editingRankLabel ? 'Update' : 'Add'} Rank Label
              </Button>
              {editingRankLabel && (
                <Button onClick={() => { setEditingRankLabel(null); rankLabelForm.resetFields() }}>Cancel</Button>
              )}
            </Space>
          </Form>
        </Card>
      </Drawer>

      {/* Criteria Drawer (per Category) */}
      <Drawer
        title={`Criteria: ${editingCategory?.categoryName ?? ''}`}
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
                <Form.Item label="Criteria Name" name="criteriaName" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="Description" name="description" extra="What data/evidence the faculty member must provide for this criteria">
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item
                  label="Rubric — Unsatisfactory (1)" name="rubricUnsatisfactory"
                  extra="What the head should see to rate this criteria as Unsatisfactory"
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item
                  label="Rubric — Meets Expectations (2)" name="rubricMeetsExpectations"
                  extra="What the head should see to rate this criteria as Meets Expectations"
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item
                  label="Rubric — Exceeds Expectations (3)" name="rubricExceedsExpectations"
                  extra="What the head should see to rate this criteria as Exceeds Expectations"
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Space>
                  <Button type="primary" onClick={handleSaveCriteria}>
                    {editingCriteria ? 'Update' : 'Add'} Criteria
                  </Button>
                  {editingCriteria && (
                    <Button onClick={() => { setEditingCriteria(null); criteriaForm.resetFields() }}>Cancel</Button>
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
        title={moduleLimitPrompt ? `${moduleLimitPrompt.moduleName} -- Achievement Limit` : ''}
        open={!!moduleLimitPrompt}
        onOk={() => moduleLimitForm.submit()}
        confirmLoading={assignModuleMutation.isPending}
        onCancel={() => { setModuleLimitPrompt(null); moduleLimitForm.resetFields() }}
        okText="Save"
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
            label={`Max achievements per ${academicYearLabel.toLowerCase()}`} name="maxAchievementsPerYear"
            rules={[{ required: true, message: 'Enter a positive number' }]}
            extra={`Once an employee records this many achievements through this tool for this criterion in a ${academicYearLabel.toLowerCase()}, the tool is disabled for them for that year.`}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="At least one achievement required" name="mandatory" valuePropName="checked"
            extra="When on, the employee cannot submit their Annual Evaluation self-assessment without at least one achievement recorded through this tool for this criterion -- this overrides 'Nothing to report' for that criterion."
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Button label override" name="displayName"
            extra={`Optional -- what the employee sees on the button for this criterion. Leave blank to use the default: "${moduleLimitPrompt?.moduleName ?? ''}".`}
          >
            <Input placeholder={moduleLimitPrompt?.moduleName} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Info Tool assign/edit prompt -- unlike achievement modules, the tool itself has no
          hardcoded name, so a display name is always required here (not just an override). */}
      <Modal
        title={infoToolPrompt ? `${infoToolPrompt.toolLabel} -- Assign to Criterion` : ''}
        open={!!infoToolPrompt}
        onOk={() => infoToolForm.submit()}
        confirmLoading={assignInfoToolMutation.isPending}
        onCancel={() => { setInfoToolPrompt(null); infoToolForm.resetFields() }}
        okText="Save"
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
            label="Button label" name="displayName"
            rules={[{ required: true, message: 'Enter what the head will see on the button' }]}
            extra="Shown to the head as the button label for this criterion -- there's no default, so pick something clear (e.g. 'Early Alert Data')."
          >
            <Input placeholder="e.g. Early Alert Data" />
          </Form.Item>
          <Form.Item
            label="Repository type" name="repositorySourceType"
            rules={[{ required: true, message: 'Select which imported data type this pulls from' }]}
            extra={infoToolPrompt?.isNew
              ? "Which type of imported data (from the Data Repository admin console) this tool will show for employees of this criterion's title."
              : "Fixed once assigned -- unassign and re-add this tool to point it at a different repository type."}
          >
            <Select
              disabled={!infoToolPrompt?.isNew}
              options={repositoryTypes.map((t) => ({ value: t, label: REPOSITORY_TYPE_LABELS[t] ?? t }))}
              placeholder="Select a type"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
