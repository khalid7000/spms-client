import api from './axios'

export const login = (email, password) =>
  api.post('/api/auth/login', { email, password }).then((r) => r.data.data)

export const register = (payload) =>
  api.post('/api/auth/register', payload).then((r) => r.data.data)

export const changePassword = (currentPassword, newPassword) =>
  api.patch('/api/auth/change-password', { currentPassword, newPassword }).then((r) => r.data.data)
