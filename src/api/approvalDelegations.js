// General-purpose approval-authority delegation console: any headship holder can hand off their
// approval authority (Strategy chains, VSM author-grant approval, ...) to another employee for a
// bounded window. See PermissionService#resolveEffectiveApprover on the backend for how this
// applies transparently across every approval type.
import api from './axios'

const unwrap = (r) => r.data.data

export const createApprovalDelegation = (payload) => api.post('/api/approval-delegations', payload).then(unwrap)
export const getMyApprovalDelegations = () => api.get('/api/approval-delegations/mine').then(unwrap)
export const getApprovalDelegationsDelegatedToMe = () => api.get('/api/approval-delegations/delegated-to-me').then(unwrap)
export const getApprovalDelegationsPendingForMe = () => api.get('/api/approval-delegations/pending-for-me').then(unwrap)
export const approveApprovalDelegation = (id) => api.post(`/api/approval-delegations/${id}/approve`).then(unwrap)
export const rejectApprovalDelegation = (id) => api.post(`/api/approval-delegations/${id}/reject`).then(unwrap)
export const cancelApprovalDelegation = (id) => api.post(`/api/approval-delegations/${id}/cancel`).then(unwrap)
