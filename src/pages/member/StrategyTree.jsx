import { useState } from 'react'
import {
  Button, Input, InputNumber, Form, Modal, Popconfirm, message, Tooltip, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CommentOutlined,
  RightOutlined, DownOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createGoal, updateGoal, deleteGoal, assignGoalArea,
  createObjective, updateObjective, deleteObjective, setObjectiveFrozen,
  createInitiative, updateInitiative, deleteInitiative,
  createMeasurement, updateMeasurement, deleteMeasurement,
  createArea, updateArea, deleteArea,
} from '../../api/strategies'

// ─── helpers ────────────────────────────────────────────────────────────────

function canEdit(role, state) {
  if (state === 'DEPLOYED' || state === 'REVIEW') return false
  if (state === 'FROZEN') return role === 'OWNER'
  return role === 'OWNER' || role === 'EDITOR'
}

function canAddGoal(role, state) {
  if (state === 'REVIEW') return false
  if (state === 'DEPLOYED' || state === 'FROZEN') return role === 'OWNER'
  return role === 'OWNER' || role === 'EDITOR'
}

function unreadForEntity(comments, entityType, entityId) {
  return comments.filter((c) => c.entityType === entityType && c.entityId === entityId && c.unread).length
}

// ─── inline text form ────────────────────────────────────────────────────────

function QuickEditModal({ open, onClose, onSave, loading, title, initialValues, fields }) {
  const [form] = Form.useForm()

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      onSave(values)
    } catch {}
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
      afterOpenChange={(v) => { if (v) form.setFieldsValue(initialValues) }}
    >
      <Form form={form} layout="vertical" initialValues={initialValues}>
        {fields.map((f) =>
          f.type === 'number' ? (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules}>
              <InputNumber style={{ width: '100%' }} {...f.props} />
            </Form.Item>
          ) : f.type === 'textarea' ? (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules}>
              <Input.TextArea rows={2} />
            </Form.Item>
          ) : (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules}>
              <Input />
            </Form.Item>
          )
        )}
      </Form>
    </Modal>
  )
}

// ─── comment button ───────────────────────────────────────────────────────────

function CommentBtn({ entityType, entityId, comments, onClick }) {
  const count = unreadForEntity(comments, entityType, entityId)
  return (
    <Tooltip title="Comments">
      <Badge count={count} size="small" offset={[2, -2]}>
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined />}
          onClick={(e) => { e.stopPropagation(); onClick(entityType, entityId) }}
          style={{ color: count > 0 ? '#c9a24b' : '#9ca3af' }}
        />
      </Badge>
    </Tooltip>
  )
}

// ─── MeasurementNode ─────────────────────────────────────────────────────────

function MeasurementNode({ m, role, state, strategyId, comments, onComment, onRefresh }) {
  const [editOpen, setEditOpen] = useState(false)
  const qc = useQueryClient()
  const editable = canEdit(role, state)

  const updateMut = useMutation({
    mutationFn: (v) => updateMeasurement(m.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: () => message.error('Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteMeasurement(m.id),
    onSuccess: onRefresh,
    onError: () => message.error('Delete failed'),
  })

  const ratio = m.targetValue > 0 ? (m.actualValue ?? 0) / m.targetValue : 0
  const colorClass = ratio >= 1 ? 'green' : ratio >= 0.7 ? 'amber' : 'red'

  return (
    <div className="measurement-row">
      <span className="node-type-badge measurement" style={{ fontSize: 9 }}>KPI</span>
      <span style={{ flex: 1, fontSize: 13 }}>{m.description}</span>
      <div className="measurement-values">
        <span className="measurement-target">Target: {m.targetValue ?? '—'} {m.unit}</span>
        <span className={`measurement-actual ${colorClass}`}>
          Actual: {m.actualValue ?? '—'} {m.unit}
        </span>
      </div>
      <div className="node-actions">
        <CommentBtn entityType="MEASUREMENT" entityId={m.id} comments={comments} onClick={onComment} />
        {editable && (
          <>
            <Button type="text" size="small" icon={<EditOutlined />}
              onClick={() => setEditOpen(true)} style={{ color: '#6b7280' }} />
            <Popconfirm title="Delete measurement?" onConfirm={() => deleteMut.mutate()}>
              <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#ef4444' }} />
            </Popconfirm>
          </>
        )}
      </div>

      <QuickEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate}
        loading={updateMut.isPending}
        title="Edit Measurement"
        initialValues={{ description: m.description, unit: m.unit, targetValue: m.targetValue, actualValue: m.actualValue }}
        fields={[
          { name: 'description', label: 'Description', rules: [{ required: true }] },
          { name: 'unit', label: 'Unit' },
          { name: 'targetValue', label: 'Target Value', type: 'number' },
          { name: 'actualValue', label: 'Actual Value', type: 'number' },
        ]}
      />
    </div>
  )
}

// ─── InitiativeNode ───────────────────────────────────────────────────────────

function InitiativeNode({ ini, role, state, strategyId, comments, onComment, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addMeasOpen, setAddMeasOpen] = useState(false)
  const editable = canEdit(role, state)

  const updateMut = useMutation({
    mutationFn: (v) => updateInitiative(ini.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: () => message.error('Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteInitiative(ini.id),
    onSuccess: onRefresh,
    onError: () => message.error('Delete failed'),
  })

  const addMeasMut = useMutation({
    mutationFn: (v) => createMeasurement(ini.id, v),
    onSuccess: () => { setAddMeasOpen(false); onRefresh() },
    onError: () => message.error('Create failed'),
  })

  const measCount = ini.measurements?.length ?? 0

  return (
    <div className="tree-node" style={{ marginLeft: 32 }}>
      <div className="tree-node-header" onClick={() => setExpanded(!expanded)}>
        <span style={{ width: 16, color: '#9ca3af', flexShrink: 0 }}>
          {measCount > 0 ? (expanded ? <DownOutlined /> : <RightOutlined />) : null}
        </span>
        <span className="node-type-badge initiative">INI</span>
        <div style={{ flex: 1 }}>
          <div className="node-title">{ini.title}</div>
          {ini.description && <div className="node-desc">{ini.description}</div>}
        </div>
        <div className="node-actions">
          <CommentBtn entityType="INITIATIVE" entityId={ini.id} comments={comments} onClick={onComment} />
          {editable && (
            <>
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                style={{ color: '#6b7280' }} />
              <Button type="text" size="small" icon={<PlusOutlined />}
                onClick={(e) => { e.stopPropagation(); setAddMeasOpen(true) }}
                style={{ color: '#6b7280' }}
                title="Add Measurement" />
              <Popconfirm title="Delete initiative?" onConfirm={() => deleteMut.mutate()}>
                <Button type="text" size="small" icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: '#ef4444' }} />
              </Popconfirm>
            </>
          )}
        </div>
      </div>
      {expanded && ini.measurements?.length > 0 && (
        <div className="tree-node-body" style={{ padding: '8px 16px 8px 48px' }}>
          {ini.measurements.map((m) => (
            <MeasurementNode
              key={m.id}
              m={m}
              role={role}
              state={state}
              strategyId={strategyId}
              comments={comments}
              onComment={onComment}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title="Edit Initiative"
        initialValues={{ title: ini.title, description: ini.description }}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />

      <QuickEditModal open={addMeasOpen} onClose={() => setAddMeasOpen(false)}
        onSave={addMeasMut.mutate} loading={addMeasMut.isPending} title="Add Measurement"
        initialValues={{}}
        fields={[
          { name: 'description', label: 'Description', rules: [{ required: true }] },
          { name: 'unit', label: 'Unit' },
          { name: 'targetValue', label: 'Target Value', type: 'number' },
        ]} />
    </div>
  )
}

// ─── ObjectiveNode ────────────────────────────────────────────────────────────

function ObjectiveNode({ obj, role, state, strategyId, comments, onComment, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addIniOpen, setAddIniOpen] = useState(false)
  const editable = canEdit(role, state)
  const isOwner = role === 'OWNER'

  const updateMut = useMutation({
    mutationFn: (v) => updateObjective(obj.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: () => message.error('Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteObjective(obj.id),
    onSuccess: onRefresh,
    onError: () => message.error('Delete failed'),
  })

  const freezeMut = useMutation({
    mutationFn: () => setObjectiveFrozen(obj.id, !obj.frozen),
    onSuccess: onRefresh,
    onError: () => message.error('Operation failed'),
  })

  const addIniMut = useMutation({
    mutationFn: (v) => createInitiative(obj.id, v),
    onSuccess: () => { setAddIniOpen(false); onRefresh() },
    onError: () => message.error('Create failed'),
  })

  const iniCount = obj.initiatives?.length ?? 0

  return (
    <div className="tree-node" style={{ marginLeft: 16 }}>
      <div className="tree-node-header" onClick={() => setExpanded(!expanded)}>
        <span style={{ width: 16, color: '#9ca3af', flexShrink: 0 }}>
          {iniCount > 0 ? (expanded ? <DownOutlined /> : <RightOutlined />) : null}
        </span>
        <span className="node-type-badge objective">OBJ</span>
        <div style={{ flex: 1 }}>
          <div className="node-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {obj.title}
            {obj.frozen && <span className="frozen-badge"><LockOutlined style={{ fontSize: 10 }} /> Frozen</span>}
          </div>
          {obj.description && <div className="node-desc">{obj.description}</div>}
        </div>
        <div className="node-actions">
          <CommentBtn entityType="OBJECTIVE" entityId={obj.id} comments={comments} onClick={onComment} />
          {editable && (
            <>
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                style={{ color: '#6b7280' }} />
              {!obj.frozen && (
                <Button type="text" size="small" icon={<PlusOutlined />}
                  onClick={(e) => { e.stopPropagation(); setAddIniOpen(true) }}
                  style={{ color: '#6b7280' }} title="Add Initiative" />
              )}
              <Popconfirm title="Delete objective?" onConfirm={() => deleteMut.mutate()}>
                <Button type="text" size="small" icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: '#ef4444' }} />
              </Popconfirm>
            </>
          )}
          {isOwner && (
            <Tooltip title={obj.frozen ? 'Unfreeze' : 'Freeze'}>
              <Button type="text" size="small"
                icon={obj.frozen ? <UnlockOutlined /> : <LockOutlined />}
                onClick={(e) => { e.stopPropagation(); freezeMut.mutate() }}
                style={{ color: obj.frozen ? '#c0871a' : '#6b7280' }} />
            </Tooltip>
          )}
        </div>
      </div>

      {expanded && obj.initiatives?.length > 0 && (
        <div>
          {obj.initiatives.map((ini) => (
            <InitiativeNode
              key={ini.id}
              ini={ini}
              role={role}
              state={state}
              strategyId={strategyId}
              comments={comments}
              onComment={onComment}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title="Edit Objective"
        initialValues={{ title: obj.title, description: obj.description }}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />

      <QuickEditModal open={addIniOpen} onClose={() => setAddIniOpen(false)}
        onSave={addIniMut.mutate} loading={addIniMut.isPending} title="Add Initiative"
        initialValues={{}}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />
    </div>
  )
}

// ─── GoalNode ─────────────────────────────────────────────────────────────────

function GoalNode({ goal, role, state, strategyId, areas, comments, onComment, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addObjOpen, setAddObjOpen] = useState(false)
  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const editable = canEdit(role, state)
  const isOwner = role === 'OWNER'

  const updateMut = useMutation({
    mutationFn: (v) => updateGoal(goal.id, v),
    onSuccess: () => { setEditOpen(false); onRefresh() },
    onError: () => message.error('Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: onRefresh,
    onError: () => message.error('Delete failed'),
  })

  const addObjMut = useMutation({
    mutationFn: (v) => createObjective(goal.id, v),
    onSuccess: () => { setAddObjOpen(false); onRefresh() },
    onError: () => message.error('Create failed'),
  })

  const [assignAreaForm] = Form.useForm()
  const assignAreaMut = useMutation({
    mutationFn: (v) => assignGoalArea(goal.id, v.areaId ?? null),
    onSuccess: () => { setAreaModalOpen(false); onRefresh() },
    onError: () => message.error('Area assignment failed'),
  })

  const objCount = goal.objectives?.length ?? 0

  return (
    <div className="tree-node">
      <div
        className="tree-node-header"
        style={{ background: '#fafbff' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ width: 16, color: '#9ca3af', flexShrink: 0 }}>
          {objCount > 0 ? (expanded ? <DownOutlined /> : <RightOutlined />) : null}
        </span>
        <span className="node-type-badge goal">GOAL</span>
        <div style={{ flex: 1 }}>
          <div className="node-title">{goal.title}</div>
          {goal.description && <div className="node-desc">{goal.description}</div>}
        </div>
        <div className="node-actions">
          <CommentBtn entityType="GOAL" entityId={goal.id} comments={comments} onClick={onComment} />
          {editable && (
            <>
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                style={{ color: '#6b7280' }} />
              <Button type="text" size="small" icon={<PlusOutlined />}
                onClick={(e) => { e.stopPropagation(); setAddObjOpen(true) }}
                style={{ color: '#6b7280' }} title="Add Objective" />
              <Popconfirm title="Delete goal?" onConfirm={() => deleteMut.mutate()}>
                <Button type="text" size="small" icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: '#ef4444' }} />
              </Popconfirm>
            </>
          )}
          {isOwner && (
            <Button type="text" size="small"
              onClick={(e) => { e.stopPropagation(); assignAreaForm.setFieldsValue({ areaId: goal.areaId }); setAreaModalOpen(true) }}
              style={{ color: '#c9a24b', fontSize: 11, fontWeight: 600 }}
              title="Assign Area"
            >
              Area
            </Button>
          )}
        </div>
      </div>

      {expanded && goal.objectives?.length > 0 && (
        <div className="tree-node-body">
          {goal.objectives.map((obj) => (
            <ObjectiveNode
              key={obj.id}
              obj={obj}
              role={role}
              state={state}
              strategyId={strategyId}
              comments={comments}
              onComment={onComment}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      <QuickEditModal open={editOpen} onClose={() => setEditOpen(false)}
        onSave={updateMut.mutate} loading={updateMut.isPending} title="Edit Goal"
        initialValues={{ title: goal.title, description: goal.description }}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />

      <QuickEditModal open={addObjOpen} onClose={() => setAddObjOpen(false)}
        onSave={addObjMut.mutate} loading={addObjMut.isPending} title="Add Objective"
        initialValues={{}}
        fields={[
          { name: 'title', label: 'Title', rules: [{ required: true }] },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]} />

      <Modal title="Assign Vision Area" open={areaModalOpen}
        onCancel={() => setAreaModalOpen(false)}
        onOk={() => assignAreaForm.submit()} confirmLoading={assignAreaMut.isPending} destroyOnClose>
        <Form form={assignAreaForm} layout="vertical" onFinish={assignAreaMut.mutate}>
          <Form.Item name="areaId" label="Vision Area">
            <select style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d9d9d9' }}>
              <option value="">— No Area (Ungrouped) —</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─── AreaSection ──────────────────────────────────────────────────────────────

function AreaSection({ area, goals, role, state, strategyId, areas, comments, onComment, onRefresh }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="area-section">
      <div
        className="area-header"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <DownOutlined style={{ fontSize: 11 }} /> : <RightOutlined style={{ fontSize: 11 }} />}
        {area ? (
          <>
            <span>{area.name}</span>
            <span className="area-tag">{goals.length} goals</span>
          </>
        ) : (
          <>
            <span style={{ color: '#aab4c4' }}>Ungrouped Goals</span>
            <span className="area-tag">{goals.length}</span>
          </>
        )}
      </div>
      {expanded && (
        <div className="area-goals">
          {goals.length === 0 ? (
            <div style={{ padding: '16px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
              No goals in this area
            </div>
          ) : (
            goals.map((goal) => (
              <GoalNode
                key={goal.id}
                goal={goal}
                role={role}
                state={state}
                strategyId={strategyId}
                areas={areas}
                comments={comments}
                onComment={onComment}
                onRefresh={onRefresh}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── StrategyTree (root export) ───────────────────────────────────────────────

export default function StrategyTree({
  strategy,
  comments,
  role,
  onComment,
  onRefresh,
}) {
  const { goals = [], areas = [], state, id: strategyId } = strategy

  const goalsByAreaId = {}
  const ungrouped = []

  goals.forEach((g) => {
    if (g.areaId) {
      if (!goalsByAreaId[g.areaId]) goalsByAreaId[g.areaId] = []
      goalsByAreaId[g.areaId].push(g)
    } else {
      ungrouped.push(g)
    }
  })

  return (
    <div className="strategy-tree">
      {areas.map((area) => (
        <AreaSection
          key={area.id}
          area={area}
          goals={goalsByAreaId[area.id] || []}
          role={role}
          state={state}
          strategyId={strategyId}
          areas={areas}
          comments={comments}
          onComment={onComment}
          onRefresh={onRefresh}
        />
      ))}
      {ungrouped.length > 0 && (
        <AreaSection
          area={null}
          goals={ungrouped}
          role={role}
          state={state}
          strategyId={strategyId}
          areas={areas}
          comments={comments}
          onComment={onComment}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}
