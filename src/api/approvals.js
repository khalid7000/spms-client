import api from './axios'

const unwrap = (r) => r.data.data

export const getMyPendingApprovals = () => api.get('/api/approvals/pending').then(unwrap)
export const getStrategyApprovalStatus = (strategyId) =>
  api.get(`/api/approvals/strategy/${strategyId}`).then(unwrap)
export const approveStrategy = (strategyId) =>
  api.post(`/api/approvals/strategy/${strategyId}/approve`).then(unwrap)
