import api from './axios'

const unwrap = (r) => r.data.data

export const getComments = (strategyId, entityType, entityId) => {
  const params = {}
  if (entityType) params.entityType = entityType
  if (entityId) params.entityId = entityId
  return api.get(`/api/strategies/${strategyId}/comments`, { params }).then(unwrap)
}

export const addComment = (strategyId, payload) =>
  api.post(`/api/strategies/${strategyId}/comments`, payload).then(unwrap)

export const markRead = (strategyId, entityType, entityId) =>
  api
    .post(`/api/strategies/${strategyId}/comments/read`, null, {
      params: { entityType, entityId },
    })
    .then(unwrap)

export const getUnreadCount = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/comments/unread-count`).then(unwrap)
