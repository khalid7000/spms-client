import api from './axios'

const unwrap = (r) => r.data.data

// ============ Employee Titles ============

export const getAllTitles = () => api.get('/api/portfolio/titles').then(unwrap)

// ============ Portfolio Categories ============

export const getMyCategories = () => api.get('/api/portfolio/my-categories').then(unwrap)

export const getCategoriesForEmployee = (employeeId) =>
  api.get(`/api/portfolio/categories-for-employee/${employeeId}`).then(unwrap)

export const createCategory = (titleId, payload) =>
  api.post('/api/portfolio/categories', { titleId, ...payload }).then(unwrap)

export const getCategory = (id) =>
  api.get(`/api/portfolio/categories/${id}`).then(unwrap)

export const getCategoriesByTitle = (titleId) =>
  api.get(`/api/portfolio/titles/${titleId}/categories`).then(unwrap)

export const updateCategory = (id, payload) =>
  api.put(`/api/portfolio/categories/${id}`, payload).then(unwrap)

export const deleteCategory = (id) =>
  api.delete(`/api/portfolio/categories/${id}`).then(unwrap)

// ============ Rank Labels (per Title) ============

export const addRankLabel = (titleId, payload) =>
  api.post(`/api/portfolio/titles/${titleId}/rank-labels`, payload).then(unwrap)

export const getRankLabels = (titleId) =>
  api.get(`/api/portfolio/titles/${titleId}/rank-labels`).then(unwrap)

export const updateRankLabel = (id, payload) =>
  api.put(`/api/portfolio/rank-labels/${id}`, payload).then(unwrap)

export const deleteRankLabel = (id) =>
  api.delete(`/api/portfolio/rank-labels/${id}`).then(unwrap)

// ============ Criteria ============

export const addCriteria = (categoryId, payload) =>
  api.post(`/api/portfolio/categories/${categoryId}/criteria`, payload).then(unwrap)

export const getCriteria = (categoryId) =>
  api.get(`/api/portfolio/categories/${categoryId}/criteria`).then(unwrap)

export const updateCriteria = (id, payload) =>
  api.put(`/api/portfolio/criteria/${id}`, payload).then(unwrap)

export const deleteCriteria = (id) =>
  api.delete(`/api/portfolio/criteria/${id}`).then(unwrap)

export const reorderCriteria = (categoryId, criteriaIds) =>
  api.put(`/api/portfolio/categories/${categoryId}/criteria/reorder`, criteriaIds).then(unwrap)

// ============ Employee Goal Cycles ============

export const getMyDirectReports = () =>
  api.get('/api/portfolio/cycles/my-direct-reports').then(unwrap)

export const createCycle = (employeeId, academicYearId) =>
  api.post('/api/portfolio/cycles', { employeeId, academicYearId }).then(unwrap)

export const getCycle = (id) =>
  api.get(`/api/portfolio/cycles/${id}`).then(unwrap)

export const getMyCycles = (academicYearId) =>
  api.get(`/api/portfolio/cycles/my-academic-year/${academicYearId}`).then(unwrap)

export const getTeamCycles = (academicYearId) =>
  api.get(`/api/portfolio/cycles/team/${academicYearId}`).then(unwrap)

export const updateCycleNotes = (id, payload) =>
  api.put(`/api/portfolio/cycles/${id}/notes`, payload).then(unwrap)

// Suggestions (leader stage, before first submission)
export const generateSuggestions = (cycleId) =>
  api.post(`/api/portfolio/cycles/${cycleId}/generate-suggestions`).then(unwrap)

export const getSuggestions = (cycleId) =>
  api.get(`/api/portfolio/cycles/${cycleId}/suggestions`).then(unwrap)

export const reviewSuggestion = (cycleId, suggestionId, payload) =>
  api.put(`/api/portfolio/cycles/${cycleId}/suggestions/${suggestionId}/review`, payload).then(unwrap)

export const updateSuggestionRubric = (cycleId, suggestionId, payload) =>
  api.put(`/api/portfolio/cycles/${cycleId}/suggestions/${suggestionId}/rubric`, payload).then(unwrap)

export const addSuggestion = (cycleId, payload) =>
  api.post(`/api/portfolio/cycles/${cycleId}/suggestions/add`, payload).then(unwrap)

export const deleteSuggestion = (cycleId, suggestionId) =>
  api.delete(`/api/portfolio/cycles/${cycleId}/suggestions/${suggestionId}`).then(unwrap)

export const submitCycleForReview = (cycleId) =>
  api.post(`/api/portfolio/cycles/${cycleId}/submit-for-review`).then(unwrap)

export const resubmitCycleForReview = (cycleId) =>
  api.post(`/api/portfolio/cycles/${cycleId}/resubmit-for-review`).then(unwrap)

// Goals (materialized once the leader submits)
export const getCycleGoals = (cycleId) =>
  api.get(`/api/portfolio/cycles/${cycleId}/goals`).then(unwrap)

export const addGoal = (cycleId, payload) =>
  api.post(`/api/portfolio/cycles/${cycleId}/goals`, payload).then(unwrap)

export const updateGoal = (cycleId, goalId, payload) =>
  api.put(`/api/portfolio/cycles/${cycleId}/goals/${goalId}`, payload).then(unwrap)

export const deleteGoal = (cycleId, goalId) =>
  api.delete(`/api/portfolio/cycles/${cycleId}/goals/${goalId}`).then(unwrap)

// Employee stage
export const startEmployeeReview = (cycleId) =>
  api.put(`/api/portfolio/cycles/${cycleId}/start-employee-review`).then(unwrap)

export const reviewGoal = (cycleId, goalId, payload) =>
  api.put(`/api/portfolio/cycles/${cycleId}/goals/${goalId}/review`, payload).then(unwrap)

export const acceptCycle = (cycleId, signatureName) =>
  api.post(`/api/portfolio/cycles/${cycleId}/accept`, { signatureName }).then(unwrap)

export const submitCycleBack = (cycleId) =>
  api.post(`/api/portfolio/cycles/${cycleId}/submit-back`).then(unwrap)

// Reuse of Next Cycle Goals drafted/approved during a past, concluded Annual Evaluation -- see
// AnnualEvaluationNextCycleGoal. Grouped by the evaluation each batch came from.
export const getReusableNextCycleGoals = (employeeId) =>
  api.get(`/api/portfolio/cycles/reusable-next-cycle-goals?employeeId=${employeeId}`).then(unwrap)

export const useNextCycleGoals = (employeeId, academicYearId, nextCycleGoalIds) =>
  api.post('/api/portfolio/cycles/use-next-cycle-goals', { employeeId, academicYearId, nextCycleGoalIds }).then(unwrap)

// Runs the reuse check across every direct report at once instead of one employee at a time.
export const batchUseNextCycleGoals = (targetAcademicYearId, sourceAcademicYearId) =>
  api.post('/api/portfolio/cycles/batch-use-next-cycle-goals', { targetAcademicYearId, sourceAcademicYearId }).then(unwrap)

// ============ Portfolio Entries (Achievements + evaluation) ============

export const logAchievement = (payload) =>
  api.post('/api/portfolio/entries', payload).then(unwrap)

export const getEntry = (id) =>
  api.get(`/api/portfolio/entries/${id}`).then(unwrap)

export const getMyPortfolio = (academicYearId) =>
  api.get('/api/portfolio/entries/my-portfolio', { params: { academicYearId } }).then(unwrap)

export const getEmployeePortfolio = (employeeId, academicYearId) =>
  api.get(`/api/portfolio/entries/employee/${employeeId}`, { params: { academicYearId } }).then(unwrap)

export const getPortfolioByCategory = (categoryId) =>
  api.get(`/api/portfolio/entries/my-portfolio/by-category/${categoryId}`).then(unwrap)

export const getPortfolioByGoal = (goalId) =>
  api.get(`/api/portfolio/entries/my-portfolio/by-goal/${goalId}`).then(unwrap)

export const updateEntry = (id, payload) =>
  api.put(`/api/portfolio/entries/${id}`, payload).then(unwrap)

export const deleteEntry = (id) =>
  api.delete(`/api/portfolio/entries/${id}`).then(unwrap)

export const linkEntryToGoal = (entryId, goalId) =>
  api.put(`/api/portfolio/entries/${entryId}/link-goal/${goalId}`).then(unwrap)

// Achievement-linked entries (Strategy Tree's achievement-recording modal)
export const getEntryByAchievement = (achievementId) =>
  api.get(`/api/portfolio/entries/by-achievement/${achievementId}`).then(unwrap)

export const getEntriesByMeasurement = (measurementId) =>
  api.get(`/api/portfolio/entries/by-measurement/${measurementId}`).then(unwrap)

export const upsertEntryForAchievement = (achievementId, payload) =>
  api.put(`/api/portfolio/entries/by-achievement/${achievementId}`, payload).then(unwrap)

// ============ Portfolio Summary ============

export const getMyPortfolioSummary = (academicYearId) =>
  api.get('/api/portfolio/entries/my-portfolio/summary', {
    params: { academicYearId }
  }).then(unwrap)

export const getEmployeePortfolioSummary = (employeeId, academicYearId) =>
  api.get(`/api/portfolio/entries/employee/${employeeId}/summary`, {
    params: { academicYearId }
  }).then(unwrap)
