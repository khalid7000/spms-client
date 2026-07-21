import platformApi from './platformAxios'

const unwrap = (r) => r.data.data

export const login = (email, password) =>
  platformApi.post('/api/platform/auth/login', { email, password }).then(unwrap)
