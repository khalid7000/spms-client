import api from './axios'

const unwrap = (r) => r.data.data

export const getAcademicYears = () => api.get('/api/academic-years').then(unwrap)
export const lockAcademicYear = (id) => api.patch(`/api/academic-years/${id}/lock`).then(unwrap)
export const unlockAcademicYear = (id) => api.patch(`/api/academic-years/${id}/unlock`).then(unwrap)
