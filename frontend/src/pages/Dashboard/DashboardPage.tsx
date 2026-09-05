import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchDashboardData } from '../../features/dashboard/dashboardSlice';
import MetricCard from '../../components/dashboard/MetricCard';
import DeviceHealthChart from '../../components/dashboard/DeviceHealthChart';
import IssueSummary from '../../components/dashboard/IssueSummary';
import RemediationSummary from '../../components/dashboard/RemediationSummary';
import HealthStatusCard from '../../components/dashboard/HealthStatusCard';
import AgentHealthTable from '../../components/dashboard/AgentHealthTable';
import IssueTrendChart from '../../components/dashboard/IssueTrendChart';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import { getIssueTrend, type IssueTrendPoint } from '../../api/issueApi';
import { getRecentLogs, type AuditLog } from '../../api/auditApi';
import { exportDevices } from '../../api/deviceApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatDateTime } from '../../utils/formatDate';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { NAV_PERMISSIONS, ACTION_PERMISSIONS } from '../../utils/constants';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { devices, issues, remediations, loading, error } = useAppSelector((state) => state.dashboard);
  const { user } = useAppSelector((state) => state.auth);
  const role = user?.role ?? '';
  const canRunRemediation = (ACTION_PERMISSIONS.CREATE_REMEDIATION ?? []).includes(role);
  const canViewDevices = (NAV_PERMISSIONS['/devices'] ?? []).includes(role);
  const canViewRemediation = (NAV_PERMISSIONS['/remediation'] ?? []).includes(role);
  const canOpenTickets = (NAV_PERMISSIONS['/tickets'] ?? []).includes(role);
  const canExportReports = (NAV_PERMISSIONS['/reports'] ?? []).includes(role);
  const canViewAudit = (NAV_PERMISSIONS['/audit-logs'] ?? []).includes(role);
  const [now, setNow] = useState(() => new Date());
  const [exporting, setExporting] = useState(false);
  const [trend, setTrend] = useState<IssueTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  // Issue trend (14-day) + recent audit activity for the bottom row
  useEffect(() => {
    let cancelled = false;
    if (!canViewAudit) {
      setActivity([]);
      setActivityLoading(false);
      return () => { cancelled = true; };
    }
    getIssueTrend(14)
      .then((points) => {
        if (!cancelled) setTrend(points);
      })
      .catch(() => {
        if (!cancelled) setTrend([]);
      })
      .finally(() => {
        if (!cancelled) setTrendLoading(false);
      });
    getRecentLogs()
      .then((logs) => {
        if (!cancelled) setActivity(logs.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewAudit]);

  // Auto-refresh every 2 minutes + keep the clock honest
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchDashboardData());
      setNow(new Date());
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [dispatch]);

  // WebSocket for real-time updates
  useWebSocket({
    topic: '/topic/dashboard',
    onMessage: useCallback(
      (msg: unknown) => {
        const data = msg as Record<string, unknown>;
        const type = data?.type as string;
        if (type === 'REFRESH' || type === 'AGENT_STATUS_CHANGE' || type === 'NEW_ISSUE') {
          dispatch(fetchDashboardData());
        }
      },
      [dispatch]
    ),
  });

  // ---- stats ----
  const onlineDevices = devices.filter((d) => d.status === 'ONLINE').length;
  const offlineDevices = devices.filter((d) => d.status === 'OFFLINE').length;
  const errorDevices = devices.filter((d) => d.status === 'ERROR').length;
  const openIssues = issues.filter((i) => i.status === 'OPEN').length;
  const criticalIssues = issues.filter((i) => i.severity === 'CRITICAL' && i.status === 'OPEN');
  const highIssues = issues.filter((i) => i.severity === 'HIGH');
  const mediumIssues = issues.filter((i) => i.severity === 'MEDIUM');
  const lowIssues = issues.filter((i) => i.severity === 'LOW');
  const resolvedToday = remediations.filter(
    (r) => r.status === 'SUCCESS' && r.createdAt && isToday(r.createdAt)
  ).length;

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleExportReport = async () => {
    setExporting(true);
    try {
      await exportDevices('csv');
    } catch {
      // Keep the dashboard quiet if the export fails
    } finally {
      setExporting(false);
    }
  };

  if (loading && devices.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[124px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    );
  }

  if (error && devices.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-red-500/25 bg-red-500/[0.06] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10">
            <svg className="h-6 w-6 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Dashboard unreachable</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Button className="mt-6" icon={<RefreshIcon />} onClick={() => dispatch(fetchDashboardData())}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  /* Alerts requiring attention */
  const alerts: { type: 'error' | 'warning'; title: string; description: string; to: string; actionLabel: string }[] = [];
  if (criticalIssues.length > 0) {
    alerts.push({
      type: 'error',
      title: `${criticalIssues.length} critical issue${criticalIssues.length > 1 ? 's' : ''}`,
      description:
        criticalIssues.slice(0, 3).map((i) => i.title).join(', ') +
        (criticalIssues.length > 3 ? `, and ${criticalIssues.length - 3} more` : ''),
      to: '/issues',
      actionLabel: 'View issues',
    });
  }
  if (offlineDevices > 0 && canViewDevices) {
    alerts.push({
      type: 'warning',
      title: `${offlineDevices} device${offlineDevices > 1 ? 's' : ''} offline`,
      description: `${offlineDevices} device${offlineDevices > 1 ? 's are' : ' is'} not responding to heartbeats`,
      to: '/devices',
      actionLabel: 'View devices',
    });
  }
  if (errorDevices > 0 && canViewDevices) {
    alerts.push({
      type: 'error',
      title: `${errorDevices} device${errorDevices > 1 ? 's' : ''} in error state`,
      description: `${errorDevices} device${errorDevices > 1 ? 's have' : ' has'} reported errors`,
      to: '/devices',
      actionLabel: 'Investigate',
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-400">
            Fleet overview
          </p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900 sm:text-[26px]">
            {greeting}, {user?.username || 'operator'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your infrastructure at a glance ·{' '}
            <span className="font-mono text-[12px] text-slate-600">{formatDateTime(now.toISOString())}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1.5 md:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-medium text-emerald-300">Live feed</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshIcon />}
            onClick={() => dispatch(fetchDashboardData())}
          >
            Refresh
          </Button>
          {canRunRemediation && (
            <Button size="sm" icon={<BoltIcon />} onClick={() => navigate('/remediation/execute')}>
              Run remediation
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Quick actions ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {canExportReports && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          onClick={() => void handleExportReport()}
          disabled={exporting}
          className="group flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md disabled:opacity-60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-primary-600 ring-1 ring-inset ring-sky-100 transition-colors group-hover:bg-primary-600 group-hover:text-white group-hover:ring-primary-600">
            {exporting ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            ) : (
              <DownloadIcon />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-slate-900">Export fleet report</span>
            <span className="mt-0.5 block truncate text-[11px] text-slate-500">Devices inventory as CSV</span>
          </span>
        </motion.button>
        )}

        {canOpenTickets && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          onClick={() => navigate('/tickets')}
          className="group flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100 transition-colors group-hover:bg-amber-500 group-hover:text-white group-hover:ring-amber-500">
            <TicketIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-slate-900">Open ITSM tickets</span>
            <span className="mt-0.5 block truncate text-[11px] text-slate-500">Service desk & escalations</span>
          </span>
        </motion.button>
        )}

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          onClick={() => navigate('/knowledge')}
          className="group flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 transition-colors group-hover:bg-emerald-500 group-hover:text-white group-hover:ring-emerald-500">
            <BookIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-slate-900">Knowledge base</span>
            <span className="mt-0.5 block truncate text-[11px] text-slate-500">AI-grounded fixes & runbooks</span>
          </span>
        </motion.button>
      </div>

      {/* ── Alert banners ── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <motion.div
              key={alert.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx, duration: 0.3 }}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                alert.type === 'error'
                  ? 'border-red-500/25 bg-red-500/[0.07]'
                  : 'border-amber-400/25 bg-amber-400/[0.06]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                    alert.type === 'error'
                      ? 'bg-red-400/10 text-red-300 ring-red-400/25'
                      : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className={`text-[13px] font-semibold ${alert.type === 'error' ? 'text-red-200' : 'text-amber-200'}`}>
                    {alert.title}
                  </p>
                  <p className={`truncate text-xs ${alert.type === 'error' ? 'text-red-400/80' : 'text-amber-400/80'}`}>
                    {alert.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(alert.to)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                  alert.type === 'error'
                    ? 'bg-red-400/10 text-red-200 ring-red-400/30 hover:bg-red-400/20'
                    : 'bg-amber-400/10 text-amber-200 ring-amber-400/30 hover:bg-amber-400/20'
                }`}
              >
                {alert.actionLabel}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total devices"
          value={devices.length}
          color="primary"
          delay={0}
          to={canViewDevices ? '/devices' : undefined}
          sub={`${onlineDevices} online now`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
            </svg>
          }
        />
        <MetricCard
          title="Online"
          value={onlineDevices}
          color="emerald"
          delay={0.05}
          to={canViewDevices ? '/devices?status=ONLINE' : undefined}
          sub={offlineDevices + errorDevices > 0 ? `${offlineDevices} offline · ${errorDevices} error` : 'fleet fully online'}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <MetricCard
          title="Open issues"
          value={openIssues}
          color={criticalIssues.length > 0 ? 'red' : openIssues > 0 ? 'amber' : 'emerald'}
          delay={0.1}
          to="/issues?status=OPEN"
          sub={criticalIssues.length > 0 ? `${criticalIssues.length} critical — act now` : 'no criticals'}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
        />
        <MetricCard
          title="Resolved today"
          value={resolvedToday}
          color="purple"
          delay={0.15}
          to={canViewRemediation ? '/remediation' : undefined}
          sub="successful remediations · 24h"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          }
        />
      </div>

      {/* ── Chart row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HealthStatusCard />
        <DeviceHealthChart online={onlineDevices} offline={offlineDevices} error={errorDevices} />
        <IssueSummary
          critical={criticalIssues.length}
          high={highIssues.length}
          medium={mediumIssues.length}
          low={lowIssues.length}
        />
      </div>

      {/* ── Fleet health table (device managers only) ── */}
      {canViewDevices && <AgentHealthTable />}

      {/* ── Trend row (recent activity is admin-only) ── */}
      <div className={canViewAudit ? 'grid grid-cols-1 gap-4 xl:grid-cols-3' : 'grid grid-cols-1 gap-4'}>
        <div className={canViewAudit ? 'xl:col-span-2' : ''}>
          <IssueTrendChart data={trend} loading={trendLoading} />
        </div>
        {canViewAudit && <ActivityFeed logs={activity} loading={activityLoading} />}
      </div>

      {/* ── Bottom row ── */}
      <div className={`grid grid-cols-1 gap-4 ${canViewRemediation ? 'lg:grid-cols-2' : ''}`}>
        {canViewRemediation && <RemediationSummary remediations={remediations} />}

        {/* Recent issues */}
        <Panel padded={false} className="rise overflow-hidden" style={{ animationDelay: '0.26s' }}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">Triage</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-100">Recent issues</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/issues')}>
              View all
            </Button>
          </div>

          {issues.length === 0 ? (
            <div className="border-t border-line px-5 py-12 text-center">
              <p className="text-sm text-slate-500">No issues found</p>
              <p className="mt-1 text-xs text-slate-600">New detections will land here in real time.</p>
            </div>
          ) : (
            <div className="border-t border-line">
              {issues.slice(0, 5).map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => navigate(`/issues/${issue.id}`)}
                  className="group flex cursor-pointer items-center justify-between gap-3 border-b border-line/60 px-5 py-3 transition-colors last:border-b-0 hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-200 transition-colors group-hover:text-white">
                      {issue.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-600">
                      {issue.hostname || 'Unknown device'} · {formatDateTime(issue.createdAt)}
                    </p>
                  </div>
                  <SeverityBadge severity={issue.severity} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-12 0h16.5a2.25 2.25 0 0 0 2.25-2.25v-2.25a.75.75 0 0 0-.75-.75 1.5 1.5 0 0 1 0-3 .75.75 0 0 0 .75-.75V6.75A2.25 2.25 0 0 0 21 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25v2.25c0 .414.336.75.75.75a1.5 1.5 0 0 1 0 3 .75.75 0 0 0-.75.75v2.25A2.25 2.25 0 0 0 4.5 18Z"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'neutral' | 'info'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'neutral',
  LOW: 'info',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge tone={SEVERITY_TONE[severity] ?? 'neutral'} className="shrink-0">
      {severity}
    </Badge>
  );
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}
