// Per-map Kanban board for a Value Stream Map's Kaizen-burst improvement tasks -- the source of
// truth a task always traces back to (see VsmDepartmentBoardPage for the cross-map rollup view).
import { useState } from 'react'
import { Button, Space, Typography, message } from 'antd'
import { ArrowLeftOutlined, ApartmentOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getVsmMap } from '../../../api/vsmMaps'
import {
  getVsmMapBoard, pullImprovementTask, startImprovementTask, completeImprovementTask, updateImprovementTaskType,
  returnImprovementTaskToBoard,
} from '../../../api/vsmTasks'
import { useAuth } from '../../../auth/AuthContext'
import VsmBoardColumns from './VsmBoardColumns'
import VsmTaskCompletionModal from './VsmTaskCompletionModal'

const { Title } = Typography

export default function VsmMapBoardPage() {
  const { mapId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [pendingTaskId, setPendingTaskId] = useState(null)
  const [achievementTask, setAchievementTask] = useState(null)

  const { data: map } = useQuery({ queryKey: ['vsm-map', mapId], queryFn: () => getVsmMap(mapId) })
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['vsm-map-board', mapId],
    queryFn: () => getVsmMapBoard(mapId),
    refetchInterval: 15_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vsm-map-board', mapId] })

  const actionMut = useMutation({
    mutationFn: ({ taskId, action }) => {
      setPendingTaskId(taskId)
      if (action === 'pull') return pullImprovementTask(taskId)
      if (action === 'start') return startImprovementTask(taskId)
      if (action === 'return') return returnImprovementTaskToBoard(taskId)
      return completeImprovementTask(taskId)
    },
    onSuccess: (_, { action }) => {
      if (action === 'return') message.success(t('vsm.taskReturned'))
      invalidate()
    },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.taskActionError')),
    onSettled: () => setPendingTaskId(null),
  })

  const changeTypeMut = useMutation({
    mutationFn: ({ taskId, taskType }) => updateImprovementTaskType(taskId, taskType),
    onSuccess: () => { message.success(t('vsm.taskTypeUpdated')); invalidate() },
    onError: (err) => message.error(err.response?.data?.message || t('vsm.taskTypeUpdateError')),
  })

  const isAdmin = user?.systemRoles?.includes('ADMIN')

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/vsm/${mapId}`)} />
        <Title level={4} style={{ margin: 0 }}>{map ? `${map.title} — ${t('vsm.boardTitle')}` : t('vsm.boardTitle')}</Title>
        {map?.departmentId && (
          <Button
            icon={<ApartmentOutlined />}
            onClick={() => navigate(`/vsm/departments/${map.departmentId}/board`)}
          >
            {t('vsm.viewDepartmentBoard')}
          </Button>
        )}
      </Space>

      <VsmBoardColumns
        tasks={tasks}
        currentUserId={user?.userId}
        isAdmin={isAdmin}
        showSource={false}
        pendingTaskId={isLoading ? null : pendingTaskId}
        onPull={(taskId) => actionMut.mutate({ taskId, action: 'pull' })}
        onStart={(taskId) => actionMut.mutate({ taskId, action: 'start' })}
        onComplete={(taskId) => actionMut.mutate({ taskId, action: 'complete' })}
        onLogAchievement={(task) => setAchievementTask(task)}
        onChangeType={(taskId, taskType) => changeTypeMut.mutate({ taskId, taskType })}
        onReturnToBoard={(taskId) => actionMut.mutate({ taskId, action: 'return' })}
      />

      <VsmTaskCompletionModal
        task={achievementTask}
        onClose={() => setAchievementTask(null)}
        onSuccess={() => { setAchievementTask(null); invalidate() }}
      />
    </div>
  )
}
