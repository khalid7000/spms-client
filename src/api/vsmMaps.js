// Value Stream Mapping module (Phase 1): map CRUD + canvas save. Kaizen-burst/Kanban task endpoints
// are a later phase, added here without touching these calls.
import api from './axios'

const unwrap = (r) => r.data.data

export const listMyVsmMaps = () => api.get('/api/vsm/maps').then(unwrap)
export const getAvailableVsmNodeTypes = () =>
  api.get('/api/vsm/maps/available-node-types').then(unwrap)
export const createVsmMap = (payload) => api.post('/api/vsm/maps', payload).then(unwrap)
// Kicks off (or retries) async AI draft generation for an already-created map -- returns
// immediately, before generation finishes. Poll getVsmMap(id) for generatedAt/
// generationFailureReason (see VsmDraftGenerationService on the backend).
export const generateVsmDraft = (id, payload) => api.post(`/api/vsm/maps/${id}/generate-draft`, payload).then(unwrap)
export const getVsmMap = (id) => api.get(`/api/vsm/maps/${id}`).then(unwrap)
export const updateVsmMap = (id, payload) => api.put(`/api/vsm/maps/${id}`, payload).then(unwrap)
export const deleteVsmMap = (id) => api.delete(`/api/vsm/maps/${id}`).then(unwrap)
// Bulk "save the whole canvas" call -- see VsmCanvasSaveRequest on the backend for the
// tempId-reconciliation contract new nodes/edges use.
export const saveVsmCanvas = (id, payload) => api.put(`/api/vsm/maps/${id}/canvas`, payload).then(unwrap)
// Cross-map rollup dashboard (Phase 6) -- current-state snapshot over every map this user can see.
export const getVsmAnalytics = () => api.get('/api/vsm/maps/analytics').then(unwrap)
