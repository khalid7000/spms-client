import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Let the browser set Content-Type automatically for FormData (includes the multipart boundary)
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// Matches /api/auth/login and /api/auth/{slug}/login -- a 401 from either is just "wrong
// credentials", an expected outcome of a login attempt, not a sign of an existing session
// going stale. Treating it the same as a real session-expiry 401 force-logs-out a user who
// simply mistyped their password, wiping the URL's slug and stranding them on the plain
// /login page with no way back to their org's login form.
const LOGIN_REQUEST_PATTERN = /^\/api\/auth\/(?:[^/]+\/)?login$/

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginAttempt = LOGIN_REQUEST_PATTERN.test(err.config?.url || '')
    if (err.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
