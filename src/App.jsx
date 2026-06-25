import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import UserDetailPage from './pages/admin/UserDetailPage'
import DepartmentsPage from './pages/admin/DepartmentsPage'
import PlanningCyclesPage from './pages/admin/PlanningCyclesPage'
import StrategiesAdminPage from './pages/admin/StrategiesAdminPage'
import StrategyDetailAdminPage from './pages/admin/StrategyDetailAdminPage'
import AuditLogPage from './pages/admin/AuditLogPage'
import OrgGroupsPage from './pages/admin/OrgGroupsPage'

import MemberLayout from './layouts/MemberLayout'
import MemberDashboard from './pages/member/MemberDashboard'
import StrategyDetailPage from './pages/member/StrategyDetailPage'
import ReportPage from './pages/member/ReportPage'
import ApprovalsPage from './pages/member/ApprovalsPage'

function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.isAdmin ? '/admin' : '/dashboard'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Must be inside ProtectedRoute so unauthenticated users can't reach it,
          but ProtectedRoute skips the mustChangePassword check for this path */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<RootRedirect />} />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="planning-cycles" element={<PlanningCyclesPage />} />
        <Route path="org-groups" element={<OrgGroupsPage />} />
        <Route path="strategies" element={<StrategiesAdminPage />} />
        <Route path="strategies/:id" element={<StrategyDetailAdminPage />} />
        <Route path="audit-logs" element={<AuditLogPage />} />
      </Route>

      {/* Member routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MemberLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<MemberDashboard />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="strategies/:strategyId" element={<StrategyDetailPage />} />
        <Route path="strategies/:strategyId/report" element={<ReportPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
