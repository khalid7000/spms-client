import api from './axios'

const unwrap = (r) => r.data.data

// Users
export const getUsers = () => api.get('/api/admin/users').then(unwrap)
export const createUser = (payload) => api.post('/api/admin/users', payload).then(unwrap)
export const updateUser = (id, payload) => api.put(`/api/admin/users/${id}`, payload).then(unwrap)
export const getUserAssignments = (id) =>
  api.get(`/api/admin/users/${id}/assignments`).then(unwrap)
export const importUsers = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/api/admin/users/import', form).then(unwrap)
}

// Data Repository (readers feed the central name-value repository Criteria Info Tools read from)
export const getRepositoryReaders = () => api.get('/api/admin/repository-readers').then(unwrap)
export const getRepositoryRecordsSummary = () => api.get('/api/admin/repository-records/summary').then(unwrap)
export const runRepositoryImport = (code, file, params) => {
  const form = new FormData()
  form.append('file', file)
  Object.entries(params).forEach(([k, v]) => form.append(k, v))
  return api.post(`/api/admin/repository-readers/${code}/import`, form).then(unwrap)
}

// Org Groups
export const getOrgGroups = () => api.get('/api/admin/org-groups').then(unwrap)
export const createOrgGroup = (payload) => api.post('/api/admin/org-groups', payload).then(unwrap)
export const updateOrgGroup = (id, payload) =>
  api.put(`/api/admin/org-groups/${id}`, payload).then(unwrap)
export const deleteOrgGroup = (id) => api.delete(`/api/admin/org-groups/${id}`).then(unwrap)

// Departments
export const getDepartments = () => api.get('/api/admin/departments').then(unwrap)
export const createDepartment = (payload) =>
  api.post('/api/admin/departments', payload).then(unwrap)
export const updateDepartment = (id, payload) =>
  api.put(`/api/admin/departments/${id}`, payload).then(unwrap)
export const deactivateDepartment = (id) =>
  api.delete(`/api/admin/departments/${id}`).then(unwrap)
export const reactivateDepartment = (id) =>
  api.patch(`/api/admin/departments/${id}/activate`).then(unwrap)

// Planning Cycles
export const getPlanningCycles = () => api.get('/api/admin/planning-cycles').then(unwrap)
export const createPlanningCycle = (payload) =>
  api.post('/api/admin/planning-cycles', payload).then(unwrap)
export const updatePlanningCycle = (id, payload) =>
  api.put(`/api/admin/planning-cycles/${id}`, payload).then((r) => r.data)
export const deletePlanningCycle = (id) => api.delete(`/api/admin/planning-cycles/${id}`).then((r) => r.data)
export const getPlanningCyclePeriods = (cycleId) =>
  api.get(`/api/admin/planning-cycles/${cycleId}/periods`).then(unwrap)
export const createPeriod = (cycleId, payload) =>
  api.post(`/api/admin/planning-cycles/${cycleId}/periods`, payload).then(unwrap)
export const deletePeriod = (id) => api.delete(`/api/admin/periods/${id}`).then(unwrap)

// Strategies (admin view)
export const createAdminUniversityStrategy = (payload) =>
  api.post('/api/admin/strategies/university', payload).then(unwrap)
export const getAdminStrategies = () => api.get('/api/admin/strategies').then(unwrap)
export const getAdminStrategy = (id) => api.get(`/api/admin/strategies/${id}`).then(unwrap)
export const deleteAdminStrategy = (id) => api.delete(`/api/admin/strategies/${id}`).then((r) => r.data)
export const adminOverrideState = (id, state) =>
  api.patch(`/api/admin/strategies/${id}/state`, { state }).then(unwrap)
export const getStrategyAssignments = (id) =>
  api.get(`/api/admin/strategies/${id}/assignments`).then(unwrap)
export const assignRole = (strategyId, payload) =>
  api.post(`/api/admin/strategies/${strategyId}/assign-role`, payload).then(unwrap)
export const deleteAssignment = (id) =>
  api.delete(`/api/admin/assignments/${id}`).then(unwrap)

// Achievement Types (admin manage)
export const getAchievementTypes = () =>
  api.get('/api/admin/achievement-types').then(unwrap)
export const createAchievementType = (payload) =>
  api.post('/api/admin/achievement-types', payload).then(unwrap)
export const updateAchievementType = (id, payload) =>
  api.put(`/api/admin/achievement-types/${id}`, payload).then(unwrap)
export const deleteAchievementType = (id) =>
  api.delete(`/api/admin/achievement-types/${id}`).then(unwrap)

// Organization Settings (admin manage) -- fixed key set, edit-only
export const getOrganizationSettings = () =>
  api.get('/api/admin/organization-settings').then(unwrap)
export const updateOrganizationSetting = (key, payload) =>
  api.put(`/api/admin/organization-settings/${key}`, payload).then(unwrap)

// Reference data (accessible by all authenticated users)
export const getAchievementTypesPublic = () =>
  api.get('/api/admin/achievement-types/all').then(unwrap)
export const getPlanningCyclesPublic = () =>
  api.get('/api/admin/planning-cycles/all').then(unwrap)
export const getOrganizationSettingsPublic = () =>
  api.get('/api/admin/organization-settings/all').then(unwrap)

// Academic Years (admin manage)
export const createAcademicYear = (payload) =>
  api.post('/api/admin/academic-years', payload).then(unwrap)
export const closeAcademicYear = (id) =>
  api.patch(`/api/academic-years/${id}/close`).then(unwrap)

// Audit Logs
export const getAuditLogs = (params) =>
  api.get('/api/admin/audit-logs', { params }).then((r) => r.data.data)
