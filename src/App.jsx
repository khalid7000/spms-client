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
import AcademicYearsPage from './pages/admin/AcademicYearsPage'

import MemberLayout from './layouts/MemberLayout'
import MemberDashboard from './pages/member/MemberDashboard'
import StrategyDetailPage from './pages/member/StrategyDetailPage'
import ReportPage from './pages/member/ReportPage'
import ApprovalsPage from './pages/member/ApprovalsPage'
import SwotLandingPage from './pages/member/swot/SwotLandingPage'
import SwotWordEntryPage from './pages/member/swot/SwotWordEntryPage'
import SwotVisualizationPage from './pages/member/swot/SwotVisualizationPage'
import SwotVotePage from './pages/member/swot/SwotVotePage'
import SwotResultsPage from './pages/member/swot/SwotResultsPage'
import SwotSuggestionsReviewPage from './pages/member/swot/SwotSuggestionsReviewPage'
import SwotFinalizationPage from './pages/member/swot/SwotFinalizationPage'

function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to="/dashboard" replace />
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
        <Route path="academic-years" element={<AcademicYearsPage />} />
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
        <Route path="strategies/:strategyId/swot" element={<SwotLandingPage />} />
        <Route path="strategies/:strategyId/swot/collect" element={<SwotWordEntryPage />} />
        <Route path="strategies/:strategyId/swot/board" element={<SwotVisualizationPage />} />
        <Route path="strategies/:strategyId/swot/vote" element={<SwotVotePage />} />
        <Route path="strategies/:strategyId/swot/results" element={<SwotResultsPage />} />
        <Route path="strategies/:strategyId/swot/review" element={<SwotSuggestionsReviewPage />} />
        <Route path="strategies/:strategyId/swot/finalize" element={<SwotFinalizationPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
