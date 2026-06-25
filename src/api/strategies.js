import api from './axios'

const unwrap = (r) => r.data.data

// Strategy CRUD
export const getStrategy = (id) => api.get(`/api/strategies/${id}`).then(unwrap)
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
export const recordAchievement = (measurementId, payload) =>
  api.post(`/api/measurements/${measurementId}/achievements`, payload).then(unwrap)
export const updateAchievement = (id, payload) =>
  api.put(`/api/achievements/${id}`, payload).then(unwrap)

// Exports
export const downloadPdf = (id) =>
  api.get(`/api/strategies/${id}/pdf`, { responseType: 'blob' })
export const downloadExcel = (id) =>
  api.get(`/api/strategies/${id}/excel`, { responseType: 'blob' })

// Coverage report
export const getCoverageReport = (strategyId) =>
  api.get(`/api/reports/coverage/${strategyId}`).then(unwrap)
