import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { createTicket } from '../../api/itsmApi';
import ErrorMessage from '../../components/common/ErrorMessage';
import { Badge } from '../../components/ui/Badge';
import { ITSM_SECTIONS, getSection, type ItsmSectionKey } from '../../utils/itsmSections';
import type { ItsmTicket, TicketPriority, TicketStatus } from '../../types';

const PREVIEW_ROWS = 5;
const CARD_SECTIONS: ItsmSectionKey[] = ['incidents', 'problems', 'service-requests', 'change-requests'];

interface QuickLink {
  label: string;
  kind: 'create' | 'open';
  section: ItsmSectionKey;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Report an Incident', kind: 'create', section: 'incidents' },
  { label: 'Request a Service', kind: 'create', section: 'service-requests' },
  { label: 'Report a Problem', kind: 'create', section: 'problems' },
  { label: 'Request a Change', kind: 'create', section: 'change-requests' },
  { label: 'Change Request(s)', kind: 'open', section: 'change-requests' },
  { label: 'Closed Incident(s)', kind: 'open', section: 'closed-incidents' },
  { label: 'Problem Ticket(s)', kind: 'open', section: 'problems' },
  { label: 'Service Request(s)', kind: 'open', section: 'service-requests' },
  { label: 'Open Incident(s)', kind: 'open', section: 'open-incidents' },
  { label: 'In Progress Incident(s)', kind: 'open', section: 'in-progress-incidents' },
];

const PRIORITY_TEXT: Record<TicketPriority, string> = {
  CRITICAL: 'text-red-600',
  HIGH: 'text-orange-600',
  MEDIUM: 'text-amber-600',
  LOW: 'text-slate-500',
};

const STATUS_TONE: Record<TicketStatus, 'danger' | 'info' | 'success' | 'neutral'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const PRIORITIES: TicketPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function ItsmHomePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tickets, loading, error } = useAppSelector((s) => s.itsm);
  const [creating, setCreating] = useState<ItsmSectionKey | null>(null);
  const [linksOpen, setLinksOpen] = useState(() => {
    try {
      return localStorage.getItem('itsm.quickLinksOpen') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleLinks = () => {
    setLinksOpen((v) => {
      try {
        localStorage.setItem('itsm.quickLinksOpen', String(!v));
      } catch {
        /* storage unavailable: the toggle still works for this visit */
      }
      return !v;
    });
  };

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const bySection = useMemo(() => {
    const map = new Map<ItsmSectionKey, ItsmTicket[]>();
    for (const s of ITSM_SECTIONS) map.set(s.key, tickets.filter(s.matches));
    return map;
  }, [tickets]);

  const open = (key: ItsmSectionKey) => navigate(`/tickets/${key}`);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-slate-900">ITSM</h1>
        <p className="mt-1 text-sm text-slate-500">Incidents, problems, service and change requests</p>
      </motion.div>

      {error && <ErrorMessage message={error} onRetry={() => dispatch(fetchTickets())} />}

      <div className={`grid gap-5 ${linksOpen ? 'lg:grid-cols-[280px_1fr]' : 'lg:grid-cols-[auto_1fr]'}`}>
        {/* Quick links */}
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            onClick={toggleLinks}
            aria-expanded={linksOpen}
            aria-label={linksOpen ? 'Hide quick links' : 'Show quick links'}
            className="flex w-full items-center justify-between gap-2 px-2 py-1 text-sm font-semibold text-slate-800"
          >
            Quick Links
            <svg
              className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${linksOpen ? '' : 'rotate-180'}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 19.5-7.5-7.5 7.5-7.5" />
            </svg>
          </button>
          <ul className={`mt-2 space-y-2 ${linksOpen ? '' : 'hidden'}`}>
            {QUICK_LINKS.map((l) => (
              <li key={l.label}>
                <button
                  onClick={() => (l.kind === 'create' ? setCreating(l.section) : open(l.section))}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  {l.label}
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    {l.kind === 'create' ? '+' : '≡'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Section cards */}
        <div className="space-y-5">
          {CARD_SECTIONS.map((key) => {
            const section = getSection(key)!;
            const rows = bySection.get(key) ?? [];
            return (
              <motion.section
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <button onClick={() => open(key)} className="flex items-center gap-2 text-left">
                    <span className="text-sm font-semibold text-slate-800">{section.title}</span>
                    <span className="rounded-full bg-primary-700 px-2 py-0.5 font-mono text-[11px] text-white">
                      {rows.length}
                    </span>
                  </button>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      onClick={() => dispatch(fetchTickets())}
                      className="text-slate-500 hover:text-slate-800"
                      aria-label="Refresh"
                    >
                      ↻
                    </button>
                    <button onClick={() => open(key)} className="font-medium text-primary-600 hover:text-primary-700">
                      View all
                    </button>
                  </div>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-slate-500">
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Category</th>
                        <th className="px-4 py-2">Priority</th>
                        <th className="px-4 py-2">Subject</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, PREVIEW_ROWS).map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => open(key)}
                          className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-4 py-2 font-mono text-xs text-slate-700">{t.ticketCode}</td>
                          <td className="px-4 py-2 text-slate-600">{t.category || '—'}</td>
                          <td className={`px-4 py-2 font-medium ${PRIORITY_TEXT[t.priority]}`}>{t.priority}</td>
                          <td className="max-w-xs truncate px-4 py-2 text-slate-800" title={t.title}>
                            {t.title}
                          </td>
                          <td className="px-4 py-2">
                            <Badge tone={STATUS_TONE[t.status]}>{t.status.replace('_', ' ')}</Badge>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            {loading ? 'Loading…' : 'Nothing here yet'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.section>
            );
          })}
        </div>
      </div>

      {creating && (
        <NewTicketModal
          section={creating}
          onClose={() => setCreating(null)}
          onCreated={() => {
            const key = creating;
            setCreating(null);
            dispatch(fetchTickets());
            open(key);
          }}
        />
      )}
    </div>
  );
}

function NewTicketModal({
  section,
  onClose,
  onCreated,
}: {
  section: ItsmSectionKey;
  onClose: () => void;
  onCreated: () => void;
}) {
  const def = getSection(section)!;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return setErr('Subject is required');
    setBusy(true);
    setErr(null);
    try {
      await createTicket({ title: title.trim(), description, priority, category: def.createCategory });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create ticket');
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900">New {def.createCategory}</h3>
        <input className={field} placeholder="Subject" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className={field}
          rows={4}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select className={field} value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
