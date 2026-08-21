import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import DataTable, { type Column } from '../../components/common/DataTable';
import ErrorMessage from '../../components/common/ErrorMessage';
import { formatDateTime } from '../../utils/formatDate';
import { SEVERITY_COLORS, ISSUE_STATUS_COLORS } from '../../utils/constants';
import type { ItsmTicket } from '../../types';

export default function TicketsPage() {
  const dispatch = useAppDispatch();
  const { tickets, loading, error } = useAppSelector((state) => state.itsm);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const filtered = tickets.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        t.ticketId.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        (t.assignedAgent && t.assignedAgent.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const columns: Column<ItsmTicket>[] = [
    {
      key: 'ticketId',
      label: 'Ticket ID',
      sortable: true,
      render: (t) => <span className="font-mono text-xs font-medium text-slate-900">{t.ticketId}</span>,
    },
    {
      key: 'subject',
      label: 'Subject',
      sortable: true,
      render: (t) => <span className="font-medium text-slate-900">{t.subject}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (t) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ISSUE_STATUS_COLORS[t.status] || ''}`}>
          {t.status}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (t) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[t.priority] || ''}`}>
          {t.priority}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (t) => <span className="text-slate-500">{formatDateTime(t.createdAt)}</span>,
    },
    {
      key: 'assignedAgent',
      label: 'Assigned To',
      render: (t) => <span className="text-slate-600">{t.assignedAgent || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-slate-900">ITSM Tickets</h1>
        <p className="text-sm text-slate-500 mt-1">Manage IT Service Management tickets</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200"
          />
        </div>
      </motion.div>

      {error ? (
        <ErrorMessage message={error} onRetry={() => dispatch(fetchTickets())} />
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
            keyExtractor={(t) => t.id}
            emptyMessage="No tickets found"
          />
        </motion.div>
      )}
    </div>
  );
}
