import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import NewTicketModal from '../../components/itsm/NewTicketModal';
import ErrorMessage from '../../components/common/ErrorMessage';
import { type ItsmSectionKey } from '../../utils/itsmSections';


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
  { label: 'Closed Tickets', kind: 'open', section: 'closed-tickets' },
  { label: 'In Progress Incident(s)', kind: 'open', section: 'in-progress-incidents' },
];

export default function ItsmHomePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { error } = useAppSelector((s) => s.itsm);
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
        <aside className="h-fit p-1">
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
          <ul className={`mt-2 space-y-1.5 ${linksOpen ? '' : 'hidden'}`}>
            {QUICK_LINKS.map((l) => (
              <li key={l.label}>
                <button
                  onClick={() => (l.kind === 'create' ? setCreating(l.section) : open(l.section))}
                  className="px-2 py-0.5 text-left text-[13px] font-medium text-primary-600 hover:text-primary-800 hover:underline"
                >
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>
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
