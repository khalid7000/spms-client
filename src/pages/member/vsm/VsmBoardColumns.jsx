// Shared 4-column Kanban layout (Available / Pulled / In Progress / Done) for both the per-map board
// and the department-wide rollup -- plain Ant Design Card/Row columns, not a drag-drop library:
// state transitions happen via explicit Pull/Start/Complete buttons, which is enough for a first
// version and avoids pulling in a dnd dependency before it's clear the extra polish is worth it.
import { Row, Col, Card, Button, Tag, Empty, Space, Typography, Tooltip, Popconfirm, Badge } from 'antd'
import { SwapOutlined, RollbackOutlined, MessageOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import InfoTip from '../../../components/InfoTip'

const { Text } = Typography

const COLUMNS = [
  { state: 'AVAILABLE', titleKey: 'vsm.boardAvailable', infoKey: 'vsm.boardAvailableInfo' },
  { state: 'PULLED', titleKey: 'vsm.boardPulled', infoKey: 'vsm.boardPulledInfo' },
  { state: 'IN_PROGRESS', titleKey: 'vsm.boardInProgress', infoKey: 'vsm.boardInProgressInfo' },
  { state: 'DONE', titleKey: 'vsm.boardDone', infoKey: 'vsm.boardDoneInfo' },
]

const TASK_TYPE_INFO_KEYS = { MINOR: 'vsm.taskTypeMinorInfo', IMPROVEMENT: 'vsm.taskTypeImprovementInfo' }

const TASK_TYPE_COLORS = { MINOR: 'default', IMPROVEMENT: 'gold' }

export default function VsmBoardColumns({ tasks, currentUserId, isAdmin, showSource, onPull, onStart, onComplete, onLogAchievement, onChangeType, onReturnToBoard, pendingTaskId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Row gutter={16}>
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((task) => task.state === col.state)
        return (
          <Col span={6} key={col.state}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {t(col.titleKey)} ({columnTasks.length}) <InfoTip title={t(col.infoKey)} /></div>
            {columnTasks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} style={{ marginTop: 24 }} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {columnTasks.map((task) => {
                  const canManage = isAdmin || task.pulledById === currentUserId
                  const returnToBoardButton = task.canEditMap && (task.state === 'PULLED' || task.state === 'IN_PROGRESS') && (
                    <Popconfirm
                      title={t('vsm.returnToBoardConfirm', { name: task.pulledByName })}
                      onConfirm={() => onReturnToBoard(task.id)}
                    >
                      <Tooltip title={t('vsm.returnToBoardTip')}>
                        <Button size="small" icon={<RollbackOutlined />} loading={pendingTaskId === task.id}>
                          {t('vsm.returnToBoard')}
                        </Button>
                      </Tooltip>
                    </Popconfirm>
                  )
                  return (
                    <Card key={task.id} size="small" title={
                      <span
                        onClick={() => navigate(`/vsm/tasks/${task.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        {task.title}
                        {task.noteCount > 0 && (
                          <Tooltip title={t('vsm.notesCountTooltip', { count: task.noteCount })}>
                            <Badge count={<MessageOutlined style={{ color: '#c9a24b', fontSize: 12, marginLeft: 6 }} />} />
                          </Tooltip>
                        )}
                      </span>
                    } extra={
                      <Space size={4}>
                        <Tooltip title={t(TASK_TYPE_INFO_KEYS[task.taskType])}>
                          <Tag color={TASK_TYPE_COLORS[task.taskType]} style={{ cursor: 'help' }}>{task.taskType}</Tag>
                        </Tooltip>
                        {task.canEditMap && task.state !== 'DONE' && (
                          <Popconfirm
                            title={task.taskType === 'MINOR' ? t('vsm.switchToImprovementConfirm') : t('vsm.switchToMinorConfirm')}
                            onConfirm={() => onChangeType(task.id, task.taskType === 'MINOR' ? 'IMPROVEMENT' : 'MINOR')}
                          >
                            <Tooltip title={t('vsm.changeTaskType')}>
                              <Button type="text" size="small" icon={<SwapOutlined />} />
                            </Tooltip>
                          </Popconfirm>
                        )}
                      </Space>
                    }>
                      {showSource && (
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          {task.vsmMapTitle} — {task.kaizenNodeTitle}
                        </Text>
                      )}
                      {task.description && <div style={{ marginBottom: 8 }}>{task.description}</div>}
                      {task.pulledByName && (
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                          {t('vsm.pulledBy', { name: task.pulledByName })}
                        </Text>
                      )}
                      {task.state === 'AVAILABLE' && (
                        <Button size="small" type="primary" loading={pendingTaskId === task.id}
                          onClick={() => onPull(task.id)} style={{ background: '#13223a' }}>
                          {t('vsm.pullTask')}
                        </Button>
                      )}
                      {task.achievementRequired && (
                        <Text type="warning" style={{ fontSize: 12, display: 'block', marginBottom: 8, color: '#ad6800' }}>
                          {t('vsm.achievementRequiredHint')}
                        </Text>
                      )}
                      {task.state === 'PULLED' && (
                        <Space wrap>
                          {canManage && (
                            <Button size="small" loading={pendingTaskId === task.id} onClick={() => onStart(task.id)}>
                              {t('vsm.startTask')}
                            </Button>
                          )}
                          {canManage && (
                            task.achievementRequired ? (
                              <Button size="small" type="primary" onClick={() => onLogAchievement(task)} style={{ background: '#13223a' }}>
                                {t('vsm.logAchievement')}
                              </Button>
                            ) : (
                              <Button size="small" type="primary" loading={pendingTaskId === task.id}
                                onClick={() => onComplete(task.id)} style={{ background: '#13223a' }}>
                                {t('vsm.completeTask')}
                              </Button>
                            )
                          )}
                          {returnToBoardButton}
                        </Space>
                      )}
                      {task.state === 'IN_PROGRESS' && (
                        <Space wrap>
                          {canManage && (
                            task.achievementRequired ? (
                              <Button size="small" type="primary" onClick={() => onLogAchievement(task)} style={{ background: '#13223a' }}>
                                {t('vsm.logAchievement')}
                              </Button>
                            ) : (
                              <Button size="small" type="primary" loading={pendingTaskId === task.id}
                                onClick={() => onComplete(task.id)} style={{ background: '#13223a' }}>
                                {t('vsm.completeTask')}
                              </Button>
                            )
                          )}
                          {returnToBoardButton}
                        </Space>
                      )}
                      {task.state === 'DONE' && task.doneAt && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t('vsm.doneAt', { time: new Date(task.doneAt).toLocaleString() })}
                        </Text>
                      )}
                    </Card>
                  )
                })}
              </Space>
            )}
          </Col>
        )
      })}
    </Row>
  )
}
