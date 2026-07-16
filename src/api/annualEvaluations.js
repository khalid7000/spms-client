// Client for the end-of-year Annual Evaluation workflow: employee self-assessment, head rating
// (per-criteria/category/overall), and the sign/refuse-to-sign step that concludes it.
import api from './axios'

const unwrap = (r) => r.data.data

export const getMyEvaluation = (academicYearId) =>
  api.get(`/api/portfolio/evaluations/my/${academicYearId}`).then(unwrap)

export const getTeamEvaluations = (academicYearId) =>
  api.get(`/api/portfolio/evaluations/team/${academicYearId}`).then(unwrap)

// Read-only rollup across a head's whole hierarchy (direct department(s) plus every department
// under any org group they head), not just the evaluations where they're literally the rater.
export const getHierarchyEvaluations = (academicYearId) =>
  api.get(`/api/portfolio/evaluations/hierarchy/${academicYearId}`).then(unwrap)

// Admin/HR report search -- org-wide, not scoped to a specific head
export const getConcludedEvaluations = (academicYearId) =>
  api.get(`/api/portfolio/evaluations/concluded/${academicYearId}`).then(unwrap)

export const getEvaluation = (id) =>
  api.get(`/api/portfolio/evaluations/${id}`).then(unwrap)

export const updateEntryDesignation = (evaluationId, entryId, payload) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/entries/${entryId}/designation`, payload).then(unwrap)

export const updateSelfRank = (evaluationId, categoryId, rank) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/categories/${categoryId}/self-rank`, { rank }).then(unwrap)

// One self-rank covers the whole Annual Goals section -- parallel to a category's own self-rank.
export const updateGoalsSelfRank = (evaluationId, rank) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/goals-self-rank`, { rank }).then(unwrap)

export const markCriteriaNothingToReport = (evaluationId, criteriaId, nothingToReport) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/criteria/${criteriaId}/nothing-to-report`, { nothingToReport }).then(unwrap)

export const markGoalNothingToReport = (evaluationId, goalId, nothingToReport) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/goals/${goalId}/nothing-to-report`, { nothingToReport }).then(unwrap)

export const submitEmployeeSelfAssessment = (evaluationId) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/submit-employee`).then(unwrap)

export const updateCriteriaRank = (evaluationId, criteriaId, rank) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/criteria/${criteriaId}/rank`, { rank }).then(unwrap)

export const updateCategoryHeadRank = (evaluationId, categoryId, rank) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/categories/${categoryId}/head-rank`, { rank }).then(unwrap)

export const updateCategoryHeadComments = (evaluationId, categoryId, strengths, improvements) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/categories/${categoryId}/head-comments`, { strengths, improvements }).then(unwrap)

export const updateGoalHeadRank = (evaluationId, goalId, rank) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/goals/${goalId}/head-rank`, { rank }).then(unwrap)

// One comment field for the whole Annual Goals section -- parallel to a category's own comment field.
export const updateGoalsHeadComments = (evaluationId, strengths, improvements) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/goals-comments`, { strengths, improvements }).then(unwrap)

// One head rank for the whole Annual Goals section -- parallel to a category's headCategoryRank.
export const updateGoalsHeadRank = (evaluationId, rank) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/goals-head-rank`, { rank }).then(unwrap)

export const updateOverallRank = (evaluationId, rank) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/overall-rank`, { rank }).then(unwrap)

// Combines what used to be two separate head actions (submit, then sign) into one -- see
// AnnualEvaluationService.submitAndSignHeadEvaluation.
export const submitAndSignHeadEvaluation = (evaluationId, signatureName) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/submit-and-sign-head`, { signatureName }).then(unwrap)

// Sends the evaluation back to the employee for one more round of edits/comments -- usable exactly
// once per evaluation (see returnedToEmployeeAt on the response).
export const returnToEmployeeForReview = (evaluationId) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/return-to-employee`).then(unwrap)

export const updateCategoryEmployeeComments = (evaluationId, categoryId, comments) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/categories/${categoryId}/employee-comments`, { comments }).then(unwrap)

export const updateCriterionEmployeeComments = (evaluationId, criteriaId, comments) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/criteria/${criteriaId}/employee-comments`, { comments }).then(unwrap)

export const updateGoalsEmployeeComments = (evaluationId, comments) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/goals-employee-comments`, { comments }).then(unwrap)

export const updateEmployeeFinalSummary = (evaluationId, comments) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/employee-final-summary`, { comments }).then(unwrap)

export const signAsEmployee = (evaluationId, signatureName) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/sign-employee`, { signatureName }).then(unwrap)

export const refuseToSign = (evaluationId, rationale) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/refuse-to-sign`, { rationale }).then(unwrap)

export const downloadEvaluationPdf = (evaluationId) =>
  api.get(`/api/reports/annual-evaluation/${evaluationId}/pdf`, { responseType: 'blob' })

// ─── Next Cycle Goals -- drafted/reviewed by both head and employee during this evaluation's own
// review/sign exchange, reused later in Team Goal Setting once concluded. ──────────────────────

export const updateNextCycleGoalNotes = (evaluationId, strengths, weaknesses) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/next-cycle-goals/notes`, { strengths, weaknesses }).then(unwrap)

export const generateNextCycleGoalSuggestions = (evaluationId) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/next-cycle-goals/generate-suggestions`).then(unwrap)

export const getNextCycleGoals = (evaluationId) =>
  api.get(`/api/portfolio/evaluations/${evaluationId}/next-cycle-goals`).then(unwrap)

export const addNextCycleGoal = (evaluationId, payload) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/next-cycle-goals`, payload).then(unwrap)

export const updateNextCycleGoalRubric = (evaluationId, goalId, payload) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/next-cycle-goals/${goalId}/rubric`, payload).then(unwrap)

export const reviewNextCycleGoalAsLeader = (evaluationId, goalId, payload) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/next-cycle-goals/${goalId}/leader-review`, payload).then(unwrap)

export const reviewNextCycleGoalAsEmployee = (evaluationId, goalId, payload) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/next-cycle-goals/${goalId}/employee-review`, payload).then(unwrap)

export const deleteNextCycleGoal = (evaluationId, goalId) =>
  api.delete(`/api/portfolio/evaluations/${evaluationId}/next-cycle-goals/${goalId}`).then(unwrap)

// ─── Teaching Evaluations achievement module -- see CustomizableAchievementModule. ─────────────

export const getTeachingEvaluationSession = (evaluationId, criteriaId) =>
  api.get(`/api/portfolio/evaluations/${evaluationId}/teaching-evaluation-sessions`, { params: { criteriaId } }).then(unwrap)

export const updateTeachingEvaluationNote = (evaluationId, sessionId, localFolderNote) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/teaching-evaluation-sessions/${sessionId}/notes`, { localFolderNote }).then(unwrap)

export const uploadTeachingEvaluationFiles = (evaluationId, sessionId, files) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  return api.post(`/api/portfolio/evaluations/${evaluationId}/teaching-evaluation-sessions/${sessionId}/upload`, formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap)
}

export const generateTeachingEvaluationDraft = (evaluationId, sessionId) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/teaching-evaluation-sessions/${sessionId}/generate`).then(unwrap)

export const finalizeTeachingEvaluationAchievement = (evaluationId, sessionId, payload) =>
  api.post(`/api/portfolio/evaluations/${evaluationId}/teaching-evaluation-sessions/${sessionId}/finalize`, payload).then(unwrap)

export const deleteTeachingEvaluationSession = (evaluationId, sessionId) =>
  api.delete(`/api/portfolio/evaluations/${evaluationId}/teaching-evaluation-sessions/${sessionId}`).then(unwrap)

// ─── Rating Assistant word selections -- private to this evaluation's head, any time (not just
// the current browser session). ─────────────────────────────────────────────────────────────────

export const getRatingAssistantSelection = (evaluationId, targetType, targetId) =>
  api.get(`/api/portfolio/evaluations/${evaluationId}/rating-assistant-selection`, { params: { targetType, targetId } }).then(unwrap)

export const saveRatingAssistantSelection = (evaluationId, targetType, targetId, selectionHistory) =>
  api.put(`/api/portfolio/evaluations/${evaluationId}/rating-assistant-selection`, { targetType, targetId, selectionHistory }).then(unwrap)

