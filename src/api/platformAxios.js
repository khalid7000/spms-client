// Separate axios instance for /api/platform/** -- a Super Admin token must never share a
// localStorage key, interceptor, or redirect target with the tenant app's `api` instance
// (src/api/axios.js). Same shape otherwise (bearer header, FormData Content-Type handling,
// 401 -> clear + redirect), just pointed at the platform identity space.
import axios from 'axios'

const platformApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('platformToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

platformApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('platformToken')
      localStorage.removeItem('platformUser')
      window.location.href = '/console/login'
    }
    return Promise.reject(err)
  }
)

export default platformApi
