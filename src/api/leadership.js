// What the current user heads (departments, org groups), if anything -- drives Strategy Creation
// Console visibility/options and Team Goal Setting/Team Evaluations nav visibility.
import api from './axios'

const unwrap = (r) => r.data.data

export const getMyLeadershipProfile = () => api.get('/api/users/me/leadership').then(unwrap)
