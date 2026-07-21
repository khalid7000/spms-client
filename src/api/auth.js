import api from './axios'

// slug routes to POST /api/auth/{slug}/login, which is what actually resolves the tenant
// (see TenantResolutionFilter's javadoc) -- omit it only for a deployment's single default
// org, where the plain /api/auth/login endpoint's default-schema fallback already resolves
// correctly.
export const login = (email, password, slug) =>
  api.post(slug ? `/api/auth/${slug}/login` : '/api/auth/login', { email, password }).then((r) => r.data.data)

export const register = (payload) =>
  api.post('/api/auth/register', payload).then((r) => r.data.data)

export const changePassword = (currentPassword, newPassword) =>
  api.patch('/api/auth/change-password', { currentPassword, newPassword }).then((r) => r.data.data)
