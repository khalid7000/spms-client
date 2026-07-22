// Department-wide rollup Kanban board: every open improvement task across every Value Stream Map
// owned within a department, in one place -- faculty browse and pull without needing to know which
// specific process map a task came from (each card still shows its source map/node).
import { useState } from 'react'
import { Button, Space, Typography, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getVsmDepartmentBoard, pullImprovementTask, startImprovementTask, completeImprovementTask, updateImprovementTaskType,
  returnImprovementTaskToBoard,
} from '../../../api/vsmTasks'
import { useAuth } from '../../../auth/AuthContext'
import VsmBoardColumns from './VsmBoardColumns'
import VsmTaskCompletionModal from './VsmTaskCompletionModal'

const { Title } = Typography

export default function VsmDepartmentBoardPage() {
  const { departmentId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [pendingTaskId, setPendingTaskId] = useState(null)
  const [achievementTask, setAchievementTask] = useState(null)

  const { data: tasks = [] } = useQuery({
    queryKey: ['vsm-department-board', departmentId],
    queryFn: () => getVsmDepartmentBoard(departmentId),
    refetchInterval: 15_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vsm-department-board', departmentId] })

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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/vsm')} />
        <Title level={4} style={{ margin: 0 }}>{t('vsm.departmentBoardTitle')}</Title>
      </Space>

      <VsmBoardColumns
        tasks={tasks}
        currentUserId={user?.userId}
        isAdmin={isAdmin}
        showSource
        pendingTaskId={pendingTaskId}
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
