import api from './axios'

const unwrap = (r) => r.data.data

export const getAcademicYears = () => api.get('/api/academic-years').then(unwrap)
export const lockAcademicYear = (id) => api.patch(`/api/academic-years/${id}/lock`).then(unwrap)
export const unlockAcademicYear = (id) => api.patch(`/api/academic-years/${id}/unlock`).then(unwrap)

// Picks the most recent year by startDate (ISO date strings sort correctly as plain strings) --
// used to default portfolio pages' academic-year selects instead of leaving them blank.
export const getMostRecentAcademicYear = (years) =>
  years.reduce((latest, y) => (!latest || y.startDate > latest.startDate ? y : latest), null)
