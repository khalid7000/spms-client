import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

// requiredRoles: role name, or array of role names - user needs at least one (ignored if adminOnly is set)
export function ProtectedRoute({ children, adminOnly = false, requiredRoles }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Force password change before any other page
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  const roles = user.systemRoles || []

  if (adminOnly && !roles.includes('ADMIN')) {
    return <Navigate to="/dashboard" replace />
  }

  if (requiredRoles) {
    const allowed = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
    if (!allowed.some((r) => roles.includes(r))) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}
