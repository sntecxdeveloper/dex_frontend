export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const STATUS_COLORS: Record<string, string> = {
  ONLINE: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  OFFLINE: 'bg-amber-100 text-amber-800 border border-amber-200',
  ERROR: 'bg-red-100 text-red-800 border border-red-200',
  ENROLLING: 'bg-blue-100 text-blue-800 border border-blue-200',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  ONLINE: 'bg-emerald-500',
  OFFLINE: 'bg-amber-500',
  ERROR: 'bg-red-500',
  ENROLLING: 'bg-blue-500',
};

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  LOW: 'bg-blue-100 text-blue-800 border border-blue-200',
};

export const SEVERITY_DOT_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-blue-500',
};

export const ISSUE_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800 border border-red-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border border-blue-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  CLOSED: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export const REMEDIATION_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border border-amber-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border border-blue-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  FAILED: 'bg-red-100 text-red-800 border border-red-200',
};

export const ROLE_COLORS: Record<string, string> = {
  ROLE_ADMIN: 'bg-purple-100 text-purple-800 border border-purple-200',
  ROLE_OPERATOR: 'bg-blue-100 text-blue-800 border border-blue-200',
  ROLE_VIEWER: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: 'Admin',
  ROLE_OPERATOR: 'Operator',
  ROLE_VIEWER: 'Viewer',
};

export const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
};

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/devices', label: 'Devices', icon: 'devices' },
  { path: '/issues', label: 'Issues', icon: 'issues' },
  { path: '/remediation', label: 'Remediation', icon: 'remediation' },
  { path: '/knowledge', label: 'Knowledge Base', icon: 'knowledge' },
  { path: '/tickets', label: 'ITSM Tickets', icon: 'tickets' },
  { path: '/security', label: 'Security', icon: 'security' },
];

export const ADMIN_NAV_ITEMS = [
  { path: '/settings', label: 'Settings', icon: 'settings' },
  { path: '/admin/users', label: 'Users', icon: 'users' },
];
