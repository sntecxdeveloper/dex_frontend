import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';

// Auth pages
import LoginPage from '../pages/Login/LoginPage';
import SignupPage from '../pages/Signup/SignupPage';
import ForgotPasswordPage from '../pages/ForgotPassword/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPassword/ResetPasswordPage';
import TwoFactorVerificationPage from '../pages/TwoFactor/TwoFactorVerificationPage';

// App pages
import DashboardPage from '../pages/Dashboard/DashboardPage';
import DevicesPage from '../pages/Devices/DevicesPage';
import DeviceDetailsPage from '../pages/Devices/DeviceDetailsPage';
import IssuesPage from '../pages/Issues/IssuesPage';
import IssueDetailsPage from '../pages/Issues/IssueDetailsPage';
import RemediationHistoryPage from '../pages/Remediation/RemediationHistoryPage';
import KnowledgeBasePage from '../pages/KnowledgeBase/KnowledgeBasePage';
import ArticleDetailsPage from '../pages/KnowledgeBase/ArticleDetailsPage';
import TicketsPage from '../pages/ITSM/TicketsPage';
import SecuritySettingsPage from '../pages/Security/SecuritySettingsPage';
import NotFoundPage from '../pages/NotFound/NotFoundPage';

export default function AppRoutes() {
  return (
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
        <Route path="/remediation" element={<RemediationHistoryPage />} />
        <Route path="/knowledge" element={<KnowledgeBasePage />} />
        <Route path="/knowledge/:id" element={<ArticleDetailsPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/security" element={<SecuritySettingsPage />} />

        {/* Admin-only routes */}
        <Route
          path="/settings"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <div className="text-center py-20">
                <h2 className="text-xl font-bold text-slate-900">Settings</h2>
                <p className="text-sm text-slate-500 mt-2">Settings page coming soon</p>
              </div>
            </RoleRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <div className="text-center py-20">
                <h2 className="text-xl font-bold text-slate-900">User Management</h2>
                <p className="text-sm text-slate-500 mt-2">User management page coming soon</p>
              </div>
            </RoleRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
