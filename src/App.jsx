import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

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
import CategoryManagementPage from './pages/admin/CategoryManagementPage'
import EvaluationReportsPage from './pages/admin/EvaluationReportsPage'

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
import GoalSettingPage from './pages/member/GoalSettingPage'
import GoalReviewPage from './pages/member/GoalReviewPage'
import AchievementLoggingPage from './pages/member/AchievementLoggingPage'
import AnnualEvaluationPage from './pages/member/AnnualEvaluationPage'
import TeamEvaluationsPage from './pages/member/TeamEvaluationsPage'
import OrgEvaluationsPage from './pages/member/OrgEvaluationsPage'
import StrategyCreationConsolePage from './pages/member/StrategyCreationConsolePage'

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

      {/* Single shared shell (sidebar/header) for every authenticated route -- member and admin
          pages alike -- so switching between consoles never remounts the layout. Role gating for
          admin-only / HR-only pages happens per-route below instead of at the layout level. */}
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
        <Route path="strategy-creation" element={<StrategyCreationConsolePage />} />
        <Route path="strategies/:strategyId" element={<StrategyDetailPage />} />
        <Route path="strategies/:strategyId/report" element={<ReportPage />} />
        <Route path="strategies/:strategyId/swot" element={<SwotLandingPage />} />
        <Route path="strategies/:strategyId/swot/collect" element={<SwotWordEntryPage />} />
        <Route path="strategies/:strategyId/swot/board" element={<SwotVisualizationPage />} />
        <Route path="strategies/:strategyId/swot/vote" element={<SwotVotePage />} />
        <Route path="strategies/:strategyId/swot/results" element={<SwotResultsPage />} />
        <Route path="strategies/:strategyId/swot/review" element={<SwotSuggestionsReviewPage />} />
        <Route path="strategies/:strategyId/swot/finalize" element={<SwotFinalizationPage />} />
        <Route path="portfolio/team-goals" element={<GoalSettingPage />} />
        <Route path="portfolio/goals" element={<GoalReviewPage />} />
        <Route path="portfolio/achievements" element={<AchievementLoggingPage />} />
        <Route path="portfolio/my-evaluation" element={<AnnualEvaluationPage />} />
        <Route path="portfolio/team-evaluations" element={<TeamEvaluationsPage />} />
        <Route path="portfolio/org-evaluations" element={<OrgEvaluationsPage />} />

        {/* Admin console -- ADMIN only */}
        <Route path="admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="admin/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        <Route path="admin/users/:id" element={<ProtectedRoute adminOnly><UserDetailPage /></ProtectedRoute>} />
        <Route path="admin/departments" element={<ProtectedRoute adminOnly><DepartmentsPage /></ProtectedRoute>} />
        <Route path="admin/planning-cycles" element={<ProtectedRoute adminOnly><PlanningCyclesPage /></ProtectedRoute>} />
        <Route path="admin/org-groups" element={<ProtectedRoute adminOnly><OrgGroupsPage /></ProtectedRoute>} />
        <Route path="admin/academic-years" element={<ProtectedRoute adminOnly><AcademicYearsPage /></ProtectedRoute>} />
        <Route path="admin/strategies" element={<ProtectedRoute adminOnly><StrategiesAdminPage /></ProtectedRoute>} />
        <Route path="admin/strategies/:id" element={<ProtectedRoute adminOnly><StrategyDetailAdminPage /></ProtectedRoute>} />
        <Route path="admin/audit-logs" element={<ProtectedRoute adminOnly><AuditLogPage /></ProtectedRoute>} />
        <Route path="admin/portfolio/categories" element={<ProtectedRoute adminOnly><CategoryManagementPage /></ProtectedRoute>} />

        {/* Reachable by ADMIN or HR -- unlike the rest of the admin console, which is ADMIN-only */}
        <Route path="evaluation-reports" element={<ProtectedRoute requiredRoles={['ADMIN', 'HR']}><EvaluationReportsPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
