// Task-progress page (central-dashboard drill-down): full detail for a single Kaizen-burst
// improvement task -- state actions for the owner/admin, collaborator management for the owner/
// map-author/admin, and a permanent, author-attributed notes thread anyone with a link to the task
// (owner, collaborator, or the map's author/admin) can read and add to. Reached from the central
// dashboard's "My Tasks" panel, or from a Kanban card's title on either board page.
import { useState } from 'react'
import {
  Card, Tag, Button, Space, Typography, Popconfirm, Tooltip, Select, Input, List, Avatar, Empty, message,
} from 'antd'
import {
  ArrowLeftOutlined, UserAddOutlined, DeleteOutlined, SendOutlined, SwapOutlined, RollbackOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../auth/AuthContext'
import { searchUsers } from '../../../api/strategies'
import InfoTip from '../../../components/InfoTip'
import VsmTaskCompletionModal from './VsmTaskCompletionModal'
import {
  getImprovementTaskDetail, getTaskNotes, addTaskNote, addTaskAssignee, removeTaskAssignee,
  startImprovementTask, completeImprovementTask, updateImprovementTaskType, returnImprovementTaskToBoard,
} from '../../../api/vsmTasks'

const { Title, Text, Paragraph } = Typography

const STATE_COLORS = { BACKLOG: 'default', AVAILABLE: 'blue', PULLED: 'purple', IN_PROGRESS: 'gold', DONE: 'green' }
const TASK_TYPE_COLORS = { MINOR: 'default', IMPROVEMENT: 'gold' }

export default function VsmTaskDetailPage() {
  const { taskId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [noteBody, setNoteBody] = useState('')
  const [assigneeModalOpen, setAssigneeModalOpen] = useState(false)
  const [pickedEmployeeId, setPickedEmployeeId] = useState(null)
  const [userOptions, setUserOptions] = useState([])
  const [achievementTaskOpen, setAchievementTaskOpen] = useState(false)

  const { data: task, isLoading } = useQuery({
    queryKey: ['vsm-task-detail', taskId], queryFn: () => getImprovementTaskDetail(taskId),
  })
  const { data: notes = [] } = useQuery({
    queryKey: ['vsm-task-notes', taskId], queryFn: () => getTaskNotes(taskId),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vsm-task-detail', taskId] })
    qc.invalidateQueries({ queryKey: ['vsm-task-notes', taskId] })
    qc.invalidateQueries({ queryKey: ['my-vsm-dashboard'] })
  }

  const isAdmin = user?.systemRoles?.includes('ADMIN')
  const canManage = isAdmin || task?.pulledById === user?.userId

  const noteMut = useMutation({
    mutationFn: () => addTaskNote(taskId, noteBody.trim()),
    onSuccess: () => { setNoteBody(''); qc.invalidateQueries({ queryKey: ['vsm-task-notes', taskId] }) },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.noteAddError')),
  })

  const stateMut = useMutation({
    mutationFn: (action) => {
      if (action === 'start') return startImprovementTask(taskId)
      if (action === 'complete') return completeImprovementTask(taskId)
      return returnImprovementTaskToBoard(taskId)
    },
    onSuccess: (_, action) => {
      if (action === 'return') { message.success(t('vsm.taskReturned')); navigate(-1); return }
      invalidate()
    },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.taskActionError')),
  })

  const changeTypeMut = useMutation({
    mutationFn: (newType) => updateImprovementTaskType(taskId, newType),
    onSuccess: () => { message.success(t('vsm.taskTypeUpdated')); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.taskTypeUpdateError')),
  })

  const addAssigneeMut = useMutation({
    mutationFn: () => addTaskAssignee(taskId, pickedEmployeeId),
    onSuccess: () => {
      message.success(t('vsm.assigneeAdded'))
      setAssigneeModalOpen(false)
      setPickedEmployeeId(null)
      invalidate()
    },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.assigneeAddError')),
  })

  const removeAssigneeMut = useMutation({
    mutationFn: (employeeId) => removeTaskAssignee(taskId, employeeId),
    onSuccess: () => { message.success(t('vsm.assigneeRemoved')); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.assigneeRemoveError')),
  })

  const handleUserSearch = async (q) => {
    if (!q || q.length < 2) { setUserOptions([]); return }
    const users = await searchUsers(q)
    setUserOptions(users.map((u) => ({ value: u.id, label: `${u.fname} ${u.lname} — ${u.email}` })))
  }

  if (isLoading || !task) {
    return <div style={{ padding: 24 }}>{t('vsm.loadingMap')}</div>
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        <Title level={4} style={{ margin: 0 }}>{task.title}</Title>
        <Tag color={STATE_COLORS[task.state]}>{task.state}</Tag>
        <Tag color={TASK_TYPE_COLORS[task.taskType]}>{task.taskType}</Tag>
        {task.canEditMap && task.state !== 'DONE' && (
          <Popconfirm
            title={task.taskType === 'MINOR' ? t('vsm.switchToImprovementConfirm') : t('vsm.switchToMinorConfirm')}
            onConfirm={() => changeTypeMut.mutate(task.taskType === 'MINOR' ? 'IMPROVEMENT' : 'MINOR')}
          >
            <Tooltip title={t('vsm.changeTaskType')}>
              <Button size="small" type="text" icon={<SwapOutlined />} />
            </Tooltip>
          </Popconfirm>
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          {task.vsmMapTitle} — {task.kaizenNodeTitle}
        </Text>
        {task.description && <Paragraph>{task.description}</Paragraph>}

        <div style={{ marginBottom: 12 }}>
          <Text strong>{t('vsm.taskOwnerLabel')}: </Text>
          <Text>{task.pulledByName || t('vsm.taskUnowned')}</Text>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong>{t('vsm.collaboratorsLabel')} <InfoTip title={t('vsm.collaboratorsInfo')} /></Text>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(task.assignees || []).map((a) => (
              <Tag key={a.employeeId} closable={task.canManageAssignees}
                onClose={(e) => { e.preventDefault(); removeAssigneeMut.mutate(a.employeeId) }}>
                {a.employeeName}
              </Tag>
            ))}
            {(task.assignees || []).length === 0 && <Text type="secondary">{t('vsm.noCollaborators')}</Text>}
            {task.canManageAssignees && (task.state === 'PULLED' || task.state === 'IN_PROGRESS') && (
              <Button size="small" icon={<UserAddOutlined />} onClick={() => setAssigneeModalOpen(true)}>
                {t('vsm.addCollaborator')}
              </Button>
            )}
          </div>
        </div>

        {task.achievementRequired && (
          <Text type="warning" style={{ display: 'block', marginBottom: 12, color: '#ad6800' }}>
            {t('vsm.achievementRequiredHint')}
          </Text>
        )}

        <Space wrap>
          {canManage && task.state === 'PULLED' && (
            <Button loading={stateMut.isPending} onClick={() => stateMut.mutate('start')}>
              {t('vsm.startTask')}
            </Button>
          )}
          {canManage && (task.state === 'PULLED' || task.state === 'IN_PROGRESS') && (
            task.achievementRequired ? (
              <Button type="primary" style={{ background: '#13223a' }} onClick={() => setAchievementTaskOpen(true)}>
                {t('vsm.logAchievement')}
              </Button>
            ) : (
              <Button type="primary" style={{ background: '#13223a' }} loading={stateMut.isPending}
                onClick={() => stateMut.mutate('complete')}>
                {t('vsm.completeTask')}
              </Button>
            )
          )}
          {task.canEditMap && (task.state === 'PULLED' || task.state === 'IN_PROGRESS') && (
            <Popconfirm title={t('vsm.returnToBoardConfirm', { name: task.pulledByName })}
              onConfirm={() => stateMut.mutate('return')}>
              <Tooltip title={t('vsm.returnToBoardTip')}>
                <Button icon={<RollbackOutlined />} loading={stateMut.isPending}>{t('vsm.returnToBoard')}</Button>
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      </Card>

      <Card title={t('vsm.notesTitle')}>
        {notes.length === 0 ? (
          <Empty description={t('vsm.noNotesYet')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={notes}
            renderItem={(n) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar>{n.authorName?.[0]}</Avatar>}
                  title={<span>{n.authorName} <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>{new Date(n.createdAt).toLocaleString()}</Text></span>}
                  description={<span style={{ whiteSpace: 'pre-wrap' }}>{n.body}</span>}
                />
              </List.Item>
            )}
          />
        )}
        {task.canAddNote && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Input.TextArea
              rows={2}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder={t('vsm.addNotePlaceholder')}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              style={{ background: '#13223a' }}
              disabled={!noteBody.trim()}
              loading={noteMut.isPending}
              onClick={() => noteMut.mutate()}
            />
          </div>
        )}
      </Card>

      {assigneeModalOpen && (
        <Card style={{ marginTop: 16 }} title={t('vsm.addCollaborator')}
          extra={<Button size="small" onClick={() => setAssigneeModalOpen(false)}>{t('common.cancel')}</Button>}>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              style={{ width: '100%' }}
              showSearch
              filterOption={false}
              placeholder={t('vsm.collaboratorSearchPlaceholder')}
              options={userOptions}
              onSearch={handleUserSearch}
              onChange={setPickedEmployeeId}
              value={pickedEmployeeId}
            />
            <Button type="primary" style={{ background: '#13223a' }} disabled={!pickedEmployeeId}
              loading={addAssigneeMut.isPending} onClick={() => addAssigneeMut.mutate()}>
              {t('vsm.addCollaborator')}
            </Button>
          </Space.Compact>
        </Card>
      )}

      <VsmTaskCompletionModal
        task={achievementTaskOpen ? task : null}
        onClose={() => setAchievementTaskOpen(false)}
        onSuccess={() => { setAchievementTaskOpen(false); invalidate() }}
      />
    </div>
  )
}
