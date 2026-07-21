import { useState, useEffect } from 'react'
import { Drawer, Input, Button, Spin, Empty, message } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getComments, addComment, markRead } from '../api/comments'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export default function CommentDrawer({
  open,
  onClose,
  strategyId,
  entityType,
  entityId,
  entityLabel,
  canComment,
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const qc = useQueryClient()

  const commentsKey = ['comments', strategyId, entityType, entityId]

  const { data: comments = [], isLoading } = useQuery({
    queryKey: commentsKey,
    queryFn: () => getComments(strategyId, entityType, entityId),
    enabled: open && !!strategyId && !!entityType && !!entityId,
  })

  // Mark as read when drawer opens
  useEffect(() => {
    if (open && strategyId && entityType && entityId) {
      markRead(strategyId, entityType, entityId)
        .then(() => {
          qc.invalidateQueries({ queryKey: ['comments', strategyId] })
        })
        .catch(() => {})
    }
  }, [open, strategyId, entityType, entityId, qc])

  const addMutation = useMutation({
    mutationFn: () =>
      addComment(strategyId, {
        entityType,
        entityId,
        content: text.trim(),
      }),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: commentsKey })
    },
    onError: () => message.error(t('commentDrawer.postFailed')),
  })

  const handleSend = () => {
    if (!text.trim()) return
    addMutation.mutate()
  }

  return (
    <Drawer
      title={
        <span style={{ fontSize: 15 }}>
          {t('commentDrawer.commentsLabel')}{' '}
          <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 13 }}>
            — {entityLabel}
          </span>
        </span>
      }
      placement="right"
      width={420}
      onClose={onClose}
      open={open}
      bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <Spin />
          </div>
        ) : comments.length === 0 ? (
          <Empty description={t('commentDrawer.noCommentsYet')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          comments.map((c) => (
            <div key={c.id} className="comment-item">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {c.unread && <span className="comment-unread-dot" style={{ marginRight: 6 }} />}
                <span className="comment-author">{c.authorName}</span>
                <span className="comment-time">{dayjs(c.createdAt).fromNow()}</span>
              </div>
              <div className="comment-content">{c.content}</div>
            </div>
          ))
        )}
      </div>

      {canComment && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #f0f2f5',
            display: 'flex',
            gap: 8,
          }}
        >
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('commentDrawer.addCommentPlaceholder')}
            autoSize={{ minRows: 2, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            style={{ flex: 1, resize: 'none' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={addMutation.isPending}
            disabled={!text.trim()}
            style={{ alignSelf: 'flex-end', background: '#13223a' }}
          />
        </div>
      )}
    </Drawer>
  )
}
