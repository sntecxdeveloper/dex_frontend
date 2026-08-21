import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchDashboardData } from '../../features/dashboard/dashboardSlice';
import MetricCard from '../../components/dashboard/MetricCard';
import DeviceHealthChart from '../../components/dashboard/DeviceHealthChart';
import IssueSummary from '../../components/dashboard/IssueSummary';
import RemediationSummary from '../../components/dashboard/RemediationSummary';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { devices, issues, remediations, loading, error } = useAppSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  if (loading) return <Loading size="lg" text="Loading dashboard..." />;
  if (error) return <ErrorMessage message={error} onRetry={() => dispatch(fetchDashboardData())} />;

  const onlineDevices = devices.filter((d) => d.status === 'ONLINE').length;
  const openIssues = issues.filter((i) => i.status === 'OPEN').length;
  const resolvedToday = remediations.filter(
    (r) => r.status === 'COMPLETED' && r.completedAt && isToday(r.completedAt)
  ).length;

  const criticalIssues = issues.filter((i) => i.severity === 'CRITICAL').length;
  const highIssues = issues.filter((i) => i.severity === 'HIGH').length;
  const mediumIssues = issues.filter((i) => i.severity === 'MEDIUM').length;
  const lowIssues = issues.filter((i) => i.severity === 'LOW').length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your IT operations</p>
      </motion.div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Devices"
          value={devices.length}
          color="primary"
          delay={0}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
            </svg>
          }
        />
        <MetricCard
          title="Online Devices"
          value={onlineDevices}
          color="emerald"
          delay={0.05}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <MetricCard
          title="Open Issues"
          value={openIssues}
          color={openIssues > 0 ? 'amber' : 'emerald'}
          delay={0.1}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
        />
        <MetricCard
          title="Resolved Today"
          value={resolvedToday}
          color="purple"
          delay={0.15}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DeviceHealthChart
          online={onlineDevices}
          offline={devices.filter((d) => d.status === 'OFFLINE').length}
          error={devices.filter((d) => d.status === 'ERROR').length}
        />
        <IssueSummary
          critical={criticalIssues}
          high={highIssues}
          medium={mediumIssues}
          low={lowIssues}
        />
      </div>

      {/* Remediation summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RemediationSummary remediations={remediations} />

        {/* Recent issues */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="card-hover rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Recent Issues</h3>
          {issues.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No issues found</p>
          ) : (
            <div className="space-y-3">
              {issues.slice(0, 5).map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{issue.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{issue.deviceHostname || 'Unknown device'}</p>
                  </div>
                  <span
                    className={`ml-3 flex-shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      issue.severity === 'CRITICAL'
                        ? 'bg-red-100 text-red-800'
                        : issue.severity === 'HIGH'
                        ? 'bg-orange-100 text-orange-800'
                        : issue.severity === 'MEDIUM'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
