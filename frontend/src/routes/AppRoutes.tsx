import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { Skeleton } from '../components/common/Skeleton';

// Lazy-loaded pages
const LoginPage = lazy(() => import('../pages/Login/LoginPage'));
const SignupPage = lazy(() => import('../pages/Signup/SignupPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPassword/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPassword/ResetPasswordPage'));
const TwoFactorVerificationPage = lazy(() => import('../pages/TwoFactor/TwoFactorVerificationPage'));
const DashboardPage = lazy(() => import('../pages/Dashboard/DashboardPage'));
const DevicesPage = lazy(() => import('../pages/Devices/DevicesPage'));
const DeviceDetailsPage = lazy(() => import('../pages/Devices/DeviceDetailsPage'));
const IssuesPage = lazy(() => import('../pages/Issues/IssuesPage'));
const IssueDetailsPage = lazy(() => import('../pages/Issues/IssueDetailsPage'));
const DeletedItemsPage = lazy(() => import('../pages/Deleted/DeletedItemsPage'));
const RemediationHistoryPage = lazy(() => import('../pages/Remediation/RemediationHistoryPage'));
const KnowledgeBasePage = lazy(() => import('../pages/KnowledgeBase/KnowledgeBasePage'));
const ArticleDetailsPage = lazy(() => import('../pages/KnowledgeBase/ArticleDetailsPage'));
const TicketsPage = lazy(() => import('../pages/ITSM/TicketsPage'));
const SecuritySettingsPage = lazy(() => import('../pages/Security/SecuritySettingsPage'));
const AuditLogPage = lazy(() => import('../pages/AuditLog/AuditLogPage'));
const NotFoundPage = lazy(() => import('../pages/NotFound/NotFoundPage'));
const AiChatPage = lazy(() => import('../pages/AI/AiChatPage'));
const RemediationExecutePage = lazy(() => import('../pages/Remediation/RemediationExecutePage'));
const ReportsPage = lazy(() => import('../pages/Reports/ReportsPage'));
const AlertRulesPage = lazy(() => import('../pages/Alerts/AlertRulesPage'));
const UserManagementPage = lazy(() => import('../pages/Settings/UserManagement'));
const SettingsPage = lazy(() => import('../pages/Settings/SettingsPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Skeleton className="w-64 h-8" />
  </div>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-2fa" element={<TwoFactorVerificationPage />} />
      </Route>

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/devices/:id" element={<DeviceDetailsPage />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:id" element={<IssueDetailsPage />} />
        <Route
          path="/deleted"
          element={
            <RoleRoute roles={['ROLE_ADMIN', 'ROLE_OPERATOR']}>
              <DeletedItemsPage />
            </RoleRoute>
          }
        />
        <Route path="/remediation" element={<RemediationHistoryPage />} />
        <Route path="/remediation/execute" element={<RemediationExecutePage />} />
        <Route path="/knowledge" element={<KnowledgeBasePage />} />
        <Route path="/knowledge/:id" element={<ArticleDetailsPage />} />
        <Route path="/ai-chat" element={<AiChatPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/alerts" element={<AlertRulesPage />} />
        <Route path="/security" element={<SecuritySettingsPage />} />
        <Route path="/audit-logs" element={<AuditLogPage />} />

        {/* Admin-only routes */}
        <Route
          path="/settings"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <SettingsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <UserManagementPage />
            </RoleRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
