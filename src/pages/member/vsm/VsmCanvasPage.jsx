// The core Value Stream Mapping editor: a React Flow canvas of process/data-box/supplier-customer/
// kaizen-burst nodes and material/information-flow edges. Local edits (drag, add, connect, delete)
// are pure client-side React Flow state; nothing hits the backend until "Save Canvas" sends the
// whole node/edge/metric set in one bulk call (see VsmMapService#saveCanvas on the backend). If the
// leader arrived here via the "describe your process" AI path, generation runs in the background on
// the server (VsmDraftGenerationService) -- this page just polls the map and shows a generating/
// failed/done indicator, same convention as GoalSettingPage/evaluationDisplay's AI flows. Once
// generation lands, the AI's nodes/edges are already real persisted rows (not a client-side preview),
// so they load and edit exactly like anything else on this canvas -- no AI-specific save-path
// branching. Kaizen Burst nodes get a "Create Task" affordance (Phase 3) that creates and publishes
// an ImprovementTask in one step -- see VsmMapBoardPage for the resulting Kanban board.
import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Drawer, Modal, Form, Input, InputNumber, Select, Space, message, Popconfirm, Typography, Tag, Alert, Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, SaveOutlined, DeleteOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import {
  getVsmMap, saveVsmCanvas, updateVsmMap, getAvailableVsmNodeTypes, generateVsmDraft,
} from '../../../api/vsmMaps'
import { createImprovementTask, publishImprovementTask } from '../../../api/vsmTasks'
import { vsmNodeTypes, NODE_TYPE_LABELS, NODE_TYPE_INFO_KEYS, DEFAULT_NODE_DATA } from './VsmNodeCards'
import InfoTip from '../../../components/InfoTip'

const { Title } = Typography

const toReactFlowNodes = (nodes = [], opts = {}) =>
  nodes.map((n) => ({
    id: String(n.id),
    type: n.nodeType,
    position: { x: n.positionX, y: n.positionY },
    data: {
      title: n.title,
      description: n.description,
      cycleTimeMinutes: n.cycleTimeMinutes,
      completeAccuratePercent: n.completeAccuratePercent,
      failRatePercent: n.failRatePercent,
      metrics: n.metrics || [],
      isExisting: true,
      ...(n.nodeType === 'KAIZEN_BURST' && opts.onCreateTask
        ? { onCreateTask: () => opts.onCreateTask(n.id), createTaskLabel: opts.createTaskLabel }
        : {}),
    },
  }))

const toReactFlowEdges = (edges = []) =>
  edges.map((e) => ({
    id: String(e.id),
    source: String(e.sourceNodeId),
    target: String(e.targetNodeId),
    label: e.label,
    style: e.edgeType === 'INFORMATION_FLOW' ? { strokeDasharray: '6 4' } : undefined,
    data: { edgeType: e.edgeType },
  }))

let tempCounter = 0
const nextTempId = () => `temp-${Date.now()}-${tempCounter++}`

// mm:ss (or ss) since `sinceIso` -- same helper as GoalSettingPage/SwotLandingPage, shows "requested
// at X, Y elapsed" while generation is still in flight so waiting looks different from stuck.
function formatElapsed(sinceIso) {
  if (!sinceIso) return null
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000))
  return { m: Math.floor(diffSec / 60), s: diffSec % 60 }
}

// "Generating" has no dedicated status enum on the backend -- derived the same way as
// EmployeeGoalCycle/TeachingEvaluationSession: a request timestamp with no failure, and either no
// completion yet or a completion that predates this request (handles retry-after-edit).
function isGenerating(map) {
  return !!map?.generationRequestedAt && !map?.generationFailureReason
    && (!map?.generatedAt || new Date(map.generatedAt) < new Date(map.generationRequestedAt))
}

function VsmCanvasInner() {
  const { mapId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: map, isLoading } = useQuery({
    queryKey: ['vsm-map', mapId],
    queryFn: () => getVsmMap(mapId),
    refetchInterval: (query) => (isGenerating(query.state.data) ? 5000 : false),
  })
  const { data: availableNodeTypes = [] } = useQuery({
    queryKey: ['vsm-node-types'],
    queryFn: getAvailableVsmNodeTypes,
  })

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [createTaskNodeId, setCreateTaskNodeId] = useState(null)
  const [form] = Form.useForm()
  const [taskForm] = Form.useForm()

  const generating = isGenerating(map)

  useEffect(() => {
    if (map) {
      setNodes(toReactFlowNodes(map.nodes, {
        // Only the author/admin may spin up a task (ImprovementTaskService#createTask asserts the
        // same edit permission) -- a same-department viewer gets the Kaizen Burst card without the
        // "Create Task" affordance rather than one that would 403 on click.
        onCreateTask: map.canEdit ? (nodeId) => setCreateTaskNodeId(nodeId) : undefined,
        createTaskLabel: t('vsm.createTask'),
      }))
      setEdges(toReactFlowEdges(map.edges))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, setNodes, setEdges])

  const createTaskMut = useMutation({
    mutationFn: async (values) => {
      const task = await createImprovementTask(createTaskNodeId, values)
      return publishImprovementTask(task.id)
    },
    onSuccess: () => {
      message.success(t('vsm.taskCreated'))
      setCreateTaskNodeId(null)
      taskForm.resetFields()
    },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.taskCreateError')),
  })

  // Ticks a dummy state every second while generating, purely so the elapsed-time text re-renders
  // between the 5s polls above -- the poll itself is what actually refetches the map.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!generating) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [generating])

  const retryMut = useMutation({
    mutationFn: () => generateVsmDraft(mapId, { processDescription: map.draftProcessDescription }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vsm-map', mapId] }),
    onError: (err) => message.error(err.response?.data?.message || t('vsm.canvasSaveError')),
  })

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, data: { edgeType: 'MATERIAL_FLOW' } }, eds)),
    [setEdges]
  )

  const addNode = (nodeType) => {
    const id = nextTempId()
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: nodeType,
        position: { x: 80 + (nds.length % 5) * 200, y: 80 + Math.floor(nds.length / 5) * 140 },
        data: { title: `New ${NODE_TYPE_LABELS[nodeType]}`, isExisting: false, ...DEFAULT_NODE_DATA },
      },
    ])
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  const openNodeDrawer = (node) => {
    setSelectedNodeId(node.id)
    form.setFieldsValue({
      title: node.data.title,
      description: node.data.description,
      cycleTimeMinutes: node.data.cycleTimeMinutes,
      completeAccuratePercent: node.data.completeAccuratePercent,
      failRatePercent: node.data.failRatePercent,
      metrics: node.data.metrics || [],
    })
  }

  const saveNodeDrawer = () => {
    form.validateFields().then((values) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...values } } : n))
      )
      setSelectedNodeId(null)
    })
  }

  const deleteSelectedNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId))
    setSelectedNodeId(null)
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const nodesPayload = nodes.map((n) => {
        const isExisting = n.data.isExisting
        return {
          id: isExisting ? Number(n.id) : null,
          tempId: isExisting ? null : n.id,
          nodeType: n.type,
          positionX: n.position.x,
          positionY: n.position.y,
          title: n.data.title,
          description: n.data.description,
          cycleTimeMinutes: n.data.cycleTimeMinutes,
          completeAccuratePercent: n.data.completeAccuratePercent,
          failRatePercent: n.data.failRatePercent,
          metrics: (n.data.metrics || []).map((m, i) => ({
            label: m.label, value: m.value, unit: m.unit, displayOrder: m.displayOrder ?? i,
          })),
        }
      })
      const edgesPayload = edges.map((e) => ({
        sourceRef: e.source,
        targetRef: e.target,
        edgeType: e.data?.edgeType || 'MATERIAL_FLOW',
        label: e.label,
      }))
      return saveVsmCanvas(mapId, { nodes: nodesPayload, edges: edgesPayload })
    },
    onSuccess: (saved) => {
      message.success(t('vsm.canvasSaved'))
      setNodes(toReactFlowNodes(saved.nodes))
      setEdges(toReactFlowEdges(saved.edges))
      qc.invalidateQueries({ queryKey: ['vsm-map', mapId] })
    },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.canvasSaveError')),
  })

  const activateMut = useMutation({
    mutationFn: () => updateVsmMap(mapId, { title: map.title, description: map.description, state: 'ACTIVE' }),
    onSuccess: () => {
      message.success(t('vsm.mapActivated'))
      qc.invalidateQueries({ queryKey: ['vsm-map', mapId] })
    },
  })

  if (isLoading || !map) {
    return <div style={{ padding: 24 }}>{t('vsm.loadingMap')}</div>
  }

  return (
    <div style={{ height: 'calc(100vh - 56px - 48px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <Space style={{ minWidth: 0 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/vsm')} />
          <Title level={4} style={{ margin: 0, maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={map.title}>
            {map.title}
          </Title>
          <Tag>{map.state}</Tag>
          {!map.canEdit && <Tag color="default">{t('vsm.viewOnly')}</Tag>}
          <InfoTip title={t('vsm.conceptInfo')} />
        </Space>
        <Space wrap>
          <Button icon={<UnorderedListOutlined />} onClick={() => navigate(`/vsm/${mapId}/board`)}>
            {t('vsm.viewBoard')}
          </Button>
          {map.canEdit && map.state === 'DRAFT' && (
            <Button onClick={() => activateMut.mutate()} loading={activateMut.isPending}>
              {t('vsm.activateMap')}
            </Button>
          )}
          {map.canEdit && availableNodeTypes.map((nt) => (
            <Tooltip key={nt} title={t(NODE_TYPE_INFO_KEYS[nt]) || undefined}>
              <Button icon={<PlusOutlined />} onClick={() => addNode(nt)}>
                {NODE_TYPE_LABELS[nt] || nt}
              </Button>
            </Tooltip>
          ))}
          {map.canEdit && (
            <Button type="primary" icon={<SaveOutlined />} onClick={() => saveMut.mutate()} loading={saveMut.isPending} style={{ background: '#13223a' }}>
              {t('vsm.saveCanvas')}
            </Button>
          )}
        </Space>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
        <span><span style={{ display: 'inline-block', width: 20, borderTop: '2px solid #475569', verticalAlign: 'middle', marginRight: 4 }} />{t('vsm.edgeLegendMaterial')}</span>
        <span><span style={{ display: 'inline-block', width: 20, borderTop: '2px dashed #475569', verticalAlign: 'middle', marginRight: 4 }} />{t('vsm.edgeLegendInformation')}</span>
        <InfoTip title={t('vsm.edgeLegendInfo')} />
      </div>

      {(generating || map.generationFailureReason) && (
        <div style={{ marginBottom: 12 }}>
          {map.generationFailureReason ? (
            <Alert
              type="error"
              showIcon
              message={t('evalDisplay.aiGenerationFailed')}
              description={map.generationFailureReason}
              action={
                <Button size="small" loading={retryMut.isPending} onClick={() => retryMut.mutate()}>
                  {t('swot.retryGeneration')}
                </Button>
              }
            />
          ) : (
            <Alert
              type="info"
              showIcon
              message={
                <>
                  {t('vsm.generatingDraftBackgroundHint')}
                  {map.generationRequestedAt && (() => {
                    const elapsed = formatElapsed(map.generationRequestedAt)
                    return (
                      <>
                        {' '}{t('swot.submittedAt', { time: new Date(map.generationRequestedAt).toLocaleTimeString() })}
                        {' — '}{elapsed.m > 0 ? t('swot.elapsedMinSec', elapsed) : t('swot.elapsedSec', elapsed)}
                      </>
                    )
                  })()}
                </>
              }
            />
          )}
        </div>
      )}

      <div style={{ flex: 1, border: '1px solid #e8eef6', borderRadius: 8, background: '#fff' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={vsmNodeTypes}
          onNodeClick={(_, node) => openNodeDrawer(node)}
          nodesDraggable={map.canEdit}
          nodesConnectable={map.canEdit}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      <Drawer
        title={selectedNode?.data.title}
        open={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        width={420}
        destroyOnClose
        extra={map.canEdit && (
          <Popconfirm title={t('vsm.deleteNodeConfirm')} onConfirm={deleteSelectedNode}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
      >
        <Form form={form} layout="vertical" onFinish={saveNodeDrawer} disabled={!map.canEdit}>
          <Form.Item name="title" label={t('common.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="cycleTimeMinutes" label={<span>{t('vsm.cycleTimeMinutes')}<InfoTip title={t('vsm.cycleTimeInfo')} /></span>}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="completeAccuratePercent" label={<span>{t('vsm.completeAccuratePercent')}<InfoTip title={t('vsm.completeAccurateInfo')} /></span>}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="failRatePercent" label={<span>{t('vsm.failRatePercent')}<InfoTip title={t('vsm.failRateInfo')} /></span>}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>

          <Form.List name="metrics">
            {(fields, { add, remove }) => (
              <>
                <Typography.Text strong>{t('vsm.additionalMetrics')}</Typography.Text>
                {fields.map((field) => (
                  <Space key={field.key} style={{ display: 'flex', marginTop: 8 }} align="baseline">
                    <Form.Item name={[field.name, 'label']} rules={[{ required: true, message: t('vsm.metricLabelRequired') }]}>
                      <Input placeholder={t('vsm.metricLabelPlaceholder')} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'value']} rules={[{ required: true, message: t('vsm.metricValueRequired') }]}>
                      <InputNumber placeholder={t('vsm.metricValuePlaceholder')} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'unit']}>
                      <Input placeholder={t('vsm.metricUnitPlaceholder')} style={{ width: 70 }} />
                    </Form.Item>
                    {map.canEdit && <DeleteOutlined onClick={() => remove(field.name)} />}
                  </Space>
                ))}
                {map.canEdit && (
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginTop: 8 }}>
                    {t('vsm.addMetric')}
                  </Button>
                )}
              </>
            )}
          </Form.List>

          {map.canEdit && (
            <Form.Item style={{ marginTop: 24 }}>
              <Button type="primary" htmlType="submit" block style={{ background: '#13223a' }}>
                {t('vsm.applyNodeChanges')}
              </Button>
            </Form.Item>
          )}
        </Form>
      </Drawer>

      <Modal
        title={t('vsm.createTask')}
        open={!!createTaskNodeId}
        onCancel={() => setCreateTaskNodeId(null)}
        onOk={() => taskForm.validateFields().then((v) => createTaskMut.mutate(v)).catch(() => {})}
        confirmLoading={createTaskMut.isPending}
        destroyOnClose
      >
        <Form form={taskForm} layout="vertical" initialValues={{ taskType: 'MINOR' }}>
          <Form.Item name="title" label={t('common.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="taskType"
            label={<span>{t('vsm.taskTypeLabel')}<InfoTip title={t('vsm.taskTypeInfo')} /></span>}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'MINOR', label: t('vsm.taskTypeMinor') },
                { value: 'IMPROVEMENT', label: t('vsm.taskTypeImprovement') },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function VsmCanvasPage() {
  return (
    <ReactFlowProvider>
      <VsmCanvasInner />
    </ReactFlowProvider>
  )
}
