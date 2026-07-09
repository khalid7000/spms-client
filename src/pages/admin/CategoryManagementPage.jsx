import { useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Card, Drawer, Space, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, AppstoreOutlined, OrderedListOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAllTitles, createCategory, getCategoriesByTitle, updateCategory, deleteCategory,
  addRankLabel, getRankLabels, updateRankLabel, deleteRankLabel,
  addCriteria, getCriteria, updateCriteria, deleteCriteria
} from '../../api/portfolio'
import { useTablePrefs } from '../../hooks/useTablePrefs'
import TableTotal from '../../components/TableTotal'

const CATEGORY_PREFS_KEY = 'spms.admin.portfolio.categories'

export default function CategoryManagementPage() {
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
    </div>
  )
}
