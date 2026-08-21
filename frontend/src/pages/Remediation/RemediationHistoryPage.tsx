import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchRemediations } from '../../features/remediation/remediationSlice';
import DataTable, { type Column } from '../../components/common/DataTable';
import ErrorMessage from '../../components/common/ErrorMessage';
import { formatDateTime } from '../../utils/formatDate';
import { REMEDIATION_STATUS_COLORS } from '../../utils/constants';
import type { Remediation } from '../../types';

export default function RemediationHistoryPage() {
  const dispatch = useAppDispatch();
  const { items, loading, error } = useAppSelector((state) => state.remediation);

  useEffect(() => {
    dispatch(fetchRemediations());
  }, [dispatch]);

  const columns: Column<Remediation>[] = [
    {
      key: 'issueTitle',
      label: 'Issue',
      sortable: true,
      render: (r) => <span className="font-medium text-slate-900">{r.issueTitle || `Issue #${r.issueId}`}</span>,
    },
    {
      key: 'action',
      label: 'Action',
      sortable: true,
      render: (r) => <span className="text-slate-600">{r.action}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${REMEDIATION_STATUS_COLORS[r.status] || ''}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: 'startedAt',
      label: 'Started',
      sortable: true,
      render: (r) => <span className="text-slate-500">{formatDateTime(r.startedAt)}</span>,
    },
    {
      key: 'completedAt',
      label: 'Completed',
      sortable: true,
      render: (r) => <span className="text-slate-500">{formatDateTime(r.completedAt)}</span>,
    },
    {
      key: 'result',
      label: 'Result',
      render: (r) => (
        <span className="text-slate-600 max-w-[200px] truncate block">{r.result || '—'}</span>
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
        <h1 className="text-2xl font-bold text-slate-900">Remediation History</h1>
        <p className="text-sm text-slate-500 mt-1">View past remediation actions and their outcomes</p>
      </motion.div>

      {error ? (
        <ErrorMessage message={error} onRetry={() => dispatch(fetchRemediations())} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            keyExtractor={(r) => r.id}
            emptyMessage="No remediation history found"
          />
        </motion.div>
      )}
    </div>
  );
}
