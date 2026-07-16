// Client for the in-app notification inbox (no email involved -- see NotificationService on the backend).
import api from './axios'

const unwrap = (r) => r.data.data

export const getMyNotifications = () => api.get('/api/notifications/my').then(unwrap)

export const getUnreadCount = () => api.get('/api/notifications/unread-count').then(unwrap)

export const markNotificationRead = (id) => api.put(`/api/notifications/${id}/read`).then(unwrap)

export const markNotificationUnread = (id) => api.put(`/api/notifications/${id}/unread`).then(unwrap)

export const markAllNotificationsRead = () => api.put('/api/notifications/mark-all-read').then(unwrap)
