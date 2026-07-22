// Kaizen-burst improvement tasks + Kanban boards (Phase 3 of the Value Stream Mapping module).
// Achievement-linkage gating for IMPROVEMENT tasks is a later phase, added here without touching
// these calls.
import api from './axios'

const unwrap = (r) => r.data.data

export const createImprovementTask = (nodeId, payload) =>
  api.post(`/api/vsm/nodes/${nodeId}/tasks`, payload).then(unwrap)
export const publishImprovementTask = (id) => api.post(`/api/vsm/tasks/${id}/publish`).then(unwrap)
export const pullImprovementTask = (id) => api.post(`/api/vsm/tasks/${id}/pull`).then(unwrap)
export const startImprovementTask = (id) => api.post(`/api/vsm/tasks/${id}/start`).then(unwrap)
export const completeImprovementTask = (id) => api.post(`/api/vsm/tasks/${id}/complete`).then(unwrap)
// Lets the map's author/admin reclassify a task between MINOR and IMPROVEMENT while it's still
// moving through the team (blocked server-side once the task is DONE).
export const updateImprovementTaskType = (id, taskType) =>
  api.put(`/api/vsm/tasks/${id}/type`, { taskType }).then(unwrap)
// Lets the map's author/admin take a PULLED/IN_PROGRESS task back from its assignee and return it
// to the board as AVAILABLE for someone else to pull.
export const returnImprovementTaskToBoard = (id) => api.post(`/api/vsm/tasks/${id}/return-to-board`).then(unwrap)
export const getVsmMapBoard = (mapId) => api.get(`/api/vsm/maps/${mapId}/board`).then(unwrap)
export const getVsmDepartmentBoard = (departmentId) =>
  api.get(`/api/vsm/departments/${departmentId}/board`).then(unwrap)

// Phase 4: achievement-linkage gating for IMPROVEMENT tasks. getAchievableMeasurements backs the
// Initiative/Measurement picker in VsmTaskCompletionModal -- no such "which initiative can I log
// against" endpoint existed anywhere else in the app before this.
export const getAchievableMeasurements = () => api.get('/api/vsm/achievable-measurements').then(unwrap)
export const logTaskAchievement = (taskId, payload) =>
  api.post(`/api/vsm/tasks/${taskId}/achievement`, payload).then(unwrap)

// Task-progress page: full detail, notes (author-attributed, permanent), and collaborators (can
// view/note but never change state -- see ImprovementTaskService for the exact rules).
export const getImprovementTaskDetail = (id) => api.get(`/api/vsm/tasks/${id}`).then(unwrap)
export const getTaskNotes = (id) => api.get(`/api/vsm/tasks/${id}/notes`).then(unwrap)
export const addTaskNote = (id, body) => api.post(`/api/vsm/tasks/${id}/notes`, { body }).then(unwrap)
export const addTaskAssignee = (id, employeeId) =>
  api.post(`/api/vsm/tasks/${id}/assignees`, { employeeId }).then(unwrap)
export const removeTaskAssignee = (id, employeeId) =>
  api.delete(`/api/vsm/tasks/${id}/assignees/${employeeId}`).then(unwrap)

// Central "My Tasks" dashboard: available-to-pull preview for my department + everything I own or
// collaborate on across every map.
export const getMyVsmDashboard = () => api.get('/api/vsm/my-dashboard').then(unwrap)
