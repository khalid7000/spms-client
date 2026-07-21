// Entry point for the /console/* section -- owns its own PlatformAuthProvider so no changes
// to main.jsx's global provider tree are needed; this whole subtree is a self-contained,
// separate identity space from the tenant app mounted everywhere else.
import { Routes, Route, Navigate } from 'react-router-dom'
import { PlatformAuthProvider, usePlatformAuth } from './PlatformAuthContext'
import { PlatformProtectedRoute } from './PlatformProtectedRoute'
import PlatformLayout from './PlatformLayout'
import PlatformLoginPage from './pages/PlatformLoginPage'
import OrganizationsPage from './pages/OrganizationsPage'
import CreateOrganizationPage from './pages/CreateOrganizationPage'

function PlatformRootRedirect() {
  const { isAuthenticated } = usePlatformAuth()
  return <Navigate to={isAuthenticated ? 'organizations' : 'login'} replace />
}

function PlatformRoutes() {
  return (
    <Routes>
      <Route index element={<PlatformRootRedirect />} />
      <Route path="login" element={<PlatformLoginPage />} />
      <Route element={<PlatformProtectedRoute><PlatformLayout /></PlatformProtectedRoute>}>
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organizations/new" element={<CreateOrganizationPage />} />
      </Route>
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  )
}

export default function PlatformApp() {
  return (
    <PlatformAuthProvider>
      <PlatformRoutes />
    </PlatformAuthProvider>
  )
}
