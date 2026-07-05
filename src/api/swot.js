import api from './axios'

const unwrap = (r) => r.data.data

// Status & lifecycle
export const getSwotStatus = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/swot/status`).then(unwrap)
export const startSwot = (strategyId) =>
  api.post(`/api/strategies/${strategyId}/swot/start`).then(unwrap)

// Word collection
export const getMySwotEntries = (strategyId, quadrant) =>
  api.get(`/api/strategies/${strategyId}/swot/entries`, { params: { quadrant } }).then(unwrap)
export const submitSwotWord = (strategyId, payload) =>
  api.post(`/api/strategies/${strategyId}/swot/entries`, payload).then(unwrap)
export const deleteSwotWord = (strategyId, entryId) =>
  api.delete(`/api/strategies/${strategyId}/swot/entries/${entryId}`).then(unwrap)
export const suggestSynonyms = (strategyId, payload) =>
  api.post(`/api/strategies/${strategyId}/swot/synonyms`, payload).then(unwrap)
export const submitFullSwot = (strategyId) =>
  api.post(`/api/strategies/${strategyId}/swot/submit`).then(unwrap)

// Visualization
export const getSwotVisualization = (strategyId, quadrant) =>
  api.get(`/api/strategies/${strategyId}/swot/visualization`, { params: { quadrant } }).then(unwrap)

// Voting
export const getSwotBallot = (strategyId, quadrant) =>
  api.get(`/api/strategies/${strategyId}/swot/vote/ballot`, { params: { quadrant } }).then(unwrap)
export const submitSwotVote = (strategyId, rankedWordsByQuadrant) =>
  api.post(`/api/strategies/${strategyId}/swot/vote`, { rankedWordsByQuadrant }).then(unwrap)
export const getSwotResults = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/swot/results`).then(unwrap)

// AI suggestions
export const generateSwotSuggestions = (strategyId) =>
  api.post(`/api/strategies/${strategyId}/swot/suggestions/generate`).then(unwrap)
export const getSwotSuggestions = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/swot/suggestions`).then(unwrap)

// Per-user review
export const getMySwotReviewItems = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/swot/review/mine`).then(unwrap)
export const submitSwotReviewItem = (strategyId, targetType, targetId, payload) =>
  api.post(`/api/strategies/${strategyId}/swot/suggestions/${targetType}/${targetId}/review`, payload).then(unwrap)
export const proposeSwotAlternative = (strategyId, payload) =>
  api.post(`/api/strategies/${strategyId}/swot/alternatives`, payload).then(unwrap)
export const getSwotAlternatives = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/swot/alternatives`).then(unwrap)
export const deleteSwotAlternative = (strategyId, proposalId) =>
  api.delete(`/api/strategies/${strategyId}/swot/alternatives/${proposalId}`).then(unwrap)
export const submitSwotReview = (strategyId) =>
  api.post(`/api/strategies/${strategyId}/swot/review/submit`).then(unwrap)

// New goals proposed under an existing AI-suggested area (Editor during review, Owner during finalization)
export const getSwotGoalAdditions = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/swot/goal-additions`).then(unwrap)
export const proposeSwotGoalAddition = (strategyId, areaId, payload) =>
  api.post(`/api/strategies/${strategyId}/swot/suggestions/${areaId}/goal-additions`, payload).then(unwrap)
export const deleteSwotGoalAddition = (strategyId, additionId) =>
  api.delete(`/api/strategies/${strategyId}/swot/goal-additions/${additionId}`).then(unwrap)

// Owner finalization
export const getSwotFinalizationSummary = (strategyId) =>
  api.get(`/api/strategies/${strategyId}/swot/finalization/summary`).then(unwrap)
export const saveSwotFinalDecisions = (strategyId, decisions) =>
  api.post(`/api/strategies/${strategyId}/swot/finalization/decisions`, { decisions }).then(unwrap)
export const submitSwotFinalization = (strategyId) =>
  api.post(`/api/strategies/${strategyId}/swot/finalization/submit`).then(unwrap)

// Cross-strategy "pending my action" feed (mirrors approvals)
export const getMySwotPendingActions = () => api.get('/api/swot/pending').then(unwrap)
