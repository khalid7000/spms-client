import api from './axios'

export const getDashboard = () => api.get('/api/dashboard').then((r) => r.data.data)
