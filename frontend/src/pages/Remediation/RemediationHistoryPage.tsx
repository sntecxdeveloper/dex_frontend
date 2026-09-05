import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchRemediations } from '../../features/remediation/remediationSlice';
import { executeRemediation, cancelRemediation } from '../../api/remediationApi';
import DataTable, { type Column } from '../../components/common/DataTable';
import ErrorMessage from '../../components/common/ErrorMessage';
import { Button } from '../../components/ui/Button';
import { formatDateTime } from '../../utils/formatDate';
import { REMEDIATION_STATUS_COLORS } from '../../utils/constants';
import type { Remediation } from '../../types';

export default function RemediationHistoryPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, loading, error } = useAppSelector((state) => state.remediation);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchRemediations());
  }, [dispatch]);

  const run = async (id: number) => {
    setBusyId(id);
    try {
      await executeRemediation(id);
      dispatch(fetchRemediations());
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id: number) => {
    setBusyId(id);
    try {
      await cancelRemediation(id);
      dispatch(fetchRemediations());
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<Remediation>[] = [
    {
      key: 'issueCode',
      label: 'Issue',
      sortable: true,
      render: (r) => <span className="font-medium text-slate-900">{r.issueCode || `Issue #${r.issueId}`}</span>,
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
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (r) => <span className="text-slate-500">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'executedBy',
      label: 'Executed By',
      render: (r) => <span className="text-slate-600">{r.executedBy || '—'}</span>,
    },
    {
      key: 'result',
      label: 'Result',
      render: (r) => (
        <span className="text-slate-600 max-w-[200px] truncate block">{r.result || '—'}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.status === 'PENDING' && (
            <Button
              size="sm"
              variant="secondary"
              loading={busyId === r.id}
              onClick={(e) => {
                e.stopPropagation();
                void run(r.id);
              }}
            >
              Run
            </Button>
          )}
          {r.status === 'RUNNING' && (
            <Button
              size="sm"
              variant="danger"
              loading={busyId === r.id}
              onClick={(e) => {
                e.stopPropagation();
                void cancel(r.id);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
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
            onRowClick={(r) => {
              if (r.issueId) navigate(`/issues/${r.issueId}`);
            }}
            keyExtractor={(r) => r.id}
            emptyMessage="No remediation history found"
          />
        </motion.div>
      )}
    </div>
  );
}
