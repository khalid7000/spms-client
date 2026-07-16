import api from './axios'

const unwrap = (r) => r.data.data

// Strategy CRUD
export const getStrategy = (id, academicYearId) =>
  api.get(`/api/strategies/${id}`, { params: { academicYearId } }).then(unwrap)
export const createUniversityStrategy = (payload) =>
  api.post('/api/strategies/university', payload).then(unwrap)
export const createDepartmentStrategy = (payload) =>
  api.post('/api/strategies/department', payload).then(unwrap)
export const changeState = (id, newState) =>
  api.patch(`/api/strategies/${id}/state`, { newState }).then(unwrap)
export const setThreshold = (id, threshold) =>
  api.patch(`/api/strategies/${id}/threshold`, { threshold }).then(unwrap)

// Goals
export const getGoals = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/goals`).then(unwrap)
export const createGoal = (strategyId, payload) =>
  api.post(`/api/strategies/${strategyId}/goals`, payload).then(unwrap)
export const updateGoal = (id, payload) =>
  api.put(`/api/goals/${id}`, payload).then(unwrap)
export const deleteGoal = (id) => api.delete(`/api/goals/${id}`).then(unwrap)

// Vision Areas
export const getAreas = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/areas`).then(unwrap)
export const createArea = (strategyId, payload) =>
  api.post(`/api/strategies/${strategyId}/areas`, payload).then(unwrap)
export const updateArea = (id, payload) => api.put(`/api/areas/${id}`, payload).then(unwrap)
export const deleteArea = (id) => api.delete(`/api/areas/${id}`).then(unwrap)
export const assignGoalArea = (goalId, areaId) =>
  api.patch(`/api/goals/${goalId}/area`, { areaId }).then(unwrap)

// Objectives
export const createObjective = (goalId, payload) =>
  api.post(`/api/goals/${goalId}/objectives`, payload).then(unwrap)
export const updateObjective = (id, payload) =>
  api.put(`/api/objectives/${id}`, payload).then(unwrap)
export const deleteObjective = (id) => api.delete(`/api/objectives/${id}`).then(unwrap)
export const setObjectiveFrozen = (id, frozen) =>
  api.patch(`/api/objectives/${id}/freeze`, { frozen }).then(unwrap)

// University objective/initiative mapping (department strategies only) -- feeds the
// "map to university objective/initiative" selects shown when creating/editing department
// objectives and initiatives.
export const getUniversityObjectives = (deptStrategyId) =>
  api.get(`/api/strategies/${deptStrategyId}/university-objectives`).then(unwrap)
export const getAvailableUniversityInitiatives = (deptObjectiveId) =>
  api.get(`/api/objectives/${deptObjectiveId}/available-university-initiatives`).then(unwrap)

// Initiatives
export const createInitiative = (objectiveId, payload) =>
  api.post(`/api/objectives/${objectiveId}/initiatives`, payload).then(unwrap)
export const updateInitiative = (id, payload) =>
  api.put(`/api/initiatives/${id}`, payload).then(unwrap)
export const deleteInitiative = (id) => api.delete(`/api/initiatives/${id}`).then(unwrap)

// Measurements
export const createMeasurement = (initiativeId, payload) =>
  api.post(`/api/initiatives/${initiativeId}/measurements`, payload).then(unwrap)
export const updateMeasurement = (id, payload) =>
  api.put(`/api/measurements/${id}`, payload).then(unwrap)
export const deleteMeasurement = (id) => api.delete(`/api/measurements/${id}`).then(unwrap)

// Achievements
export const getAchievements = (measurementId) =>
  api.get(`/api/measurements/${measurementId}/achievements`).then(unwrap)
// Union of a base initiative's own achievements plus every academic-year copy's -- used for the
// "Base Plan" (no year selected) view so achievements recorded against a specific year's copy
// still show up instead of looking like they've disappeared. When a selected academic year turns
// out to have no frozen copies, the backend falls back to this same base+union view but narrowed
// to that year's matching period (periodName) -- see InitiativeResponse.assessmentPeriodName.
export const getAchievementsAcrossYears = (initiativeId, periodName) =>
  api.get(`/api/initiatives/${initiativeId}/achievements/across-years`, { params: { periodName } }).then(unwrap)
export const recordAchievement = (measurementId, payload) =>
  api.post(`/api/measurements/${measurementId}/achievements`, payload).then(unwrap)
export const updateAchievement = (id, payload) =>
  api.put(`/api/achievements/${id}`, payload).then(unwrap)
export const deleteAchievement = (id) =>
  api.delete(`/api/achievements/${id}`).then(unwrap)

// Achievement types & assessment periods (reference data)
export const getAchievementTypes = () =>
  api.get('/api/admin/achievement-types/all').then(unwrap)
export const getAssessmentPeriods = (cycleId) =>
  api.get(`/api/admin/planning-cycles/${cycleId}/periods/all`).then(unwrap)

// Exports
export const downloadPdf = (id) =>
  api.get(`/api/strategies/${id}/pdf`, { responseType: 'blob' })
export const downloadExcel = (id) =>
  api.get(`/api/strategies/${id}/excel`, { responseType: 'blob' })

// Coverage report
export const getCoverageReport = (strategyId) =>
  api.get(`/api/reports/coverage/${strategyId}`).then(unwrap)

// Member management (owner only)
export const getMembers = (id) =>
  api.get(`/api/strategies/${id}/members`).then(unwrap)
export const assignMember = (id, payload) =>
  api.put(`/api/strategies/${id}/members`, payload).then(unwrap)
export const revokeMember = (id, userId) =>
  api.delete(`/api/strategies/${id}/members/${userId}`).then(unwrap)

// User search (authenticated, used for member assignment)
export const searchUsers = (q) =>
  api.get('/api/users', { params: { q } }).then(unwrap)

// Audit log (owner or admin)
export const getStrategyAuditLog = (strategyId, params) =>
  api.get(`/api/strategies/${strategyId}/audit-log`, { params }).then((r) => r.data.data)

// "Recently logged" feed for the Strategy Tree's achievement rail -- open to any strategy member.
export const getRecentAchievements = (strategyId, limit = 10) =>
  api.get(`/api/strategies/${strategyId}/achievements/recent`, { params: { limit } }).then(unwrap)
