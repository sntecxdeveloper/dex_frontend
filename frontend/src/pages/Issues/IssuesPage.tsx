import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchIssues } from '../../features/issues/issuesSlice';
import DataTable, { type Column } from '../../components/common/DataTable';
import ErrorMessage from '../../components/common/ErrorMessage';
import { formatDateTime } from '../../utils/formatDate';
import { SEVERITY_COLORS, ISSUE_STATUS_COLORS } from '../../utils/constants';
import type { Issue } from '../../types';

const SEVERITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_OPTIONS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function IssuesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, loading, error } = useAppSelector((state) => state.issues);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params: { severity?: string; status?: string } = {};
    if (severityFilter !== 'ALL') params.severity = severityFilter;
    if (statusFilter !== 'ALL') params.status = statusFilter;
    dispatch(fetchIssues(Object.keys(params).length > 0 ? params : undefined));
  }, [dispatch, severityFilter, statusFilter]);

  const filtered = items.filter((i) => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) &&
        !(i.deviceHostname && i.deviceHostname.toLowerCase().includes(search.toLowerCase()))) {
      return false;
    }
    return true;
  });

  const columns: Column<Issue>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (issue) => <span className="font-medium text-slate-900">{issue.title}</span>,
    },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (issue) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[issue.severity] || ''}`}>
          {issue.severity}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (issue) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ISSUE_STATUS_COLORS[issue.status] || ''}`}>
          {issue.status}
        </span>
      ),
    },
    {
      key: 'deviceHostname',
      label: 'Device',
      render: (issue) => (
        <span className="text-slate-600">{issue.deviceHostname || '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (issue) => (
        <span className="text-slate-500">{formatDateTime(issue.createdAt)}</span>
      ),
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      render: (issue) => (
        <span className="text-slate-600">{issue.assignedTo || '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-slate-900">Issues</h1>
        <p className="text-sm text-slate-500 mt-1">Track and manage IT issues</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
      >
        <div className="relative w-full sm:w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
            {SEVERITY_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setSeverityFilter(f)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg btn-press transition-all duration-200 ${
                  severityFilter === f
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
            {STATUS_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg btn-press transition-all duration-200 ${
                  statusFilter === f
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {error ? (
        <ErrorMessage message={error} onRetry={() => dispatch(fetchIssues())} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <DataTable
            columns={columns}
            data={filtered}
            loading={loading}
            keyExtractor={(i) => i.id}
            onRowClick={(i) => navigate(`/issues/${i.id}`)}
            emptyMessage="No issues found"
          />
        </motion.div>
      )}
    </div>
  );
}
