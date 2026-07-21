import { Navigate } from 'react-router-dom'
import { usePlatformAuth } from './PlatformAuthContext'

export function PlatformProtectedRoute({ children }) {
  const { isAuthenticated } = usePlatformAuth()
  if (!isAuthenticated) {
    return <Navigate to="/console/login" replace />
  }
  return children
}
