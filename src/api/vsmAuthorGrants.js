// VSM author delegation (Phase 4): Admin grants "VSM author" rights over a unit to an employee;
// the top-of-hierarchy head above that employee approves before it's active.
import api from './axios'

const unwrap = (r) => r.data.data

export const createVsmAuthorGrant = (payload) => api.post('/api/vsm/author-grants', payload).then(unwrap)
export const getAllVsmAuthorGrants = () => api.get('/api/vsm/author-grants').then(unwrap)
export const revokeVsmAuthorGrant = (id) => api.post(`/api/vsm/author-grants/${id}/revoke`).then(unwrap)
export const getPendingVsmAuthorGrantsForMe = () => api.get('/api/vsm/author-grants/pending-for-me').then(unwrap)
export const getMyVsmAuthorGrants = () => api.get('/api/vsm/author-grants/mine').then(unwrap)
export const approveVsmAuthorGrant = (id) => api.post(`/api/vsm/author-grants/${id}/approve`).then(unwrap)
export const rejectVsmAuthorGrant = (id) => api.post(`/api/vsm/author-grants/${id}/reject`).then(unwrap)
