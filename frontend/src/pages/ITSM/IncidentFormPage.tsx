import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { getTicketById, updateTicketStatus } from '../../api/itsmApi';
import { getUsers } from '../../api/userApi';
import ErrorMessage from '../../components/common/ErrorMessage';
import { getSection } from '../../utils/itsmSections';
import type { ItsmTicket, TicketPriority, TicketStatus } from '../../types';

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  CRITICAL: '1 - Critical',
  HIGH: '2 - High',
  MEDIUM: '3 - Moderate',
  LOW: '4 - Low',
};

const STATE_LABEL: Record<TicketStatus, string> = {
  OPEN: 'New',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

interface Note {
  kind: 'Work notes' | 'Additional comments' | 'Field changes';
  at: string;
  by: string;
  text?: string;
  changes?: [string, string][];
}

// The backend has no notes API yet: notes and comments are kept in this browser, per incident.
const notesKey = (id: number) => `dex.incident.notes.${id}`;
function loadNotes(id: number): Note[] {
  try {
    return JSON.parse(localStorage.getItem(notesKey(id)) ?? '[]') as Note[];
  } catch {
    return [];
  }
}
function saveNotes(id: number, notes: Note[]) {
  try {
    localStorage.setItem(notesKey(id), JSON.stringify(notes));
  } catch {
    /* storage unavailable: notes stay for this visit only */
  }
}

const SLA_HOURS: Record<TicketPriority, number> = { CRITICAL: 4, HIGH: 8, MEDIUM: 24, LOW: 72 };

const stamp = (iso?: string | number) => {
  if (iso == null) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const isFinished = (t: ItsmTicket) => t.status === 'RESOLVED' || t.status === 'CLOSED';

const TABS = ['Notes', 'Related Records', 'Resolution Information'] as const;
const LINK_TABS = ['Task SLAs', 'Affected CIs', 'Impacted Services/CIs', 'Child Incidents'] as const;
type LinkTab = (typeof LINK_TABS)[number];
type Tab = (typeof TABS)[number];

const control =
  'w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-600';

const READONLY_HINT = 'Read-only: the backend can only update the ticket state for now.';

interface Fields {
  caller: string;
  category: string;
  subcategory: string;
  service: string;
  serviceOffering: string;
  ci: string;
  channel: string;
  impact: string;
  urgency: string;
  assignmentGroup: string;
  assignedTo: string;
}

const NO_FIELDS: Fields = {
  caller: '',
  category: '',
  subcategory: '',
  service: '',
  serviceOffering: '',
  ci: '',
  channel: '',
  impact: '',
  urgency: '',
  assignmentGroup: '',
  assignedTo: '',
};

// The backend only stores the ticket state: the other fields are kept in this browser, per incident.
const fieldsKey = (id: number) => `dex.incident.fields.${id}`;
function loadFields(id: number): Fields {
  try {
    return { ...NO_FIELDS, ...(JSON.parse(localStorage.getItem(fieldsKey(id)) ?? '{}') as Partial<Fields>) };
  } catch {
    return NO_FIELDS;
  }
}
function saveFields(id: number, f: Fields) {
  try {
    localStorage.setItem(fieldsKey(id), JSON.stringify(f));
  } catch {
    /* storage unavailable: values stay for this visit only */
  }
}

const CATEGORIES: Record<string, string[]> = {
  'Inquiry / Help': ['Access', 'How-to', 'General question'],
  Software: ['Email', 'Operating System', 'Application'],
  Hardware: ['Laptop / Desktop', 'Printer', 'Peripheral'],
  Network: ['Connectivity', 'VPN', 'Wi-Fi'],
  Database: ['Performance', 'Access', 'Backup'],
};
const CHANNELS = ['Self-service', 'Phone', 'Email', 'Chat', 'Walk-in'];
const LEVELS = ['1 - High', '2 - Medium', '3 - Low'];
const GROUPS = ['Service Desk', 'Network', 'Hardware', 'Software', 'Database'];

// Impact x urgency decides the priority, as in ServiceNow.
function derivedPriority(impact: string, urgency: string): string | null {
  const i = parseInt(impact, 10);
  const u = parseInt(urgency, 10);
  if (!i || !u) return null;
  const sum = i + u;
  return sum <= 2 ? '1 - Critical' : sum === 3 ? '2 - High' : sum === 4 ? '3 - Moderate' : '4 - Low';
}

function Sel({
  value,
  onChange,
  options,
  blank = '-- None --',
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  blank?: string;
}) {
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={control}>
      <option value="">{blank}</option>
      {list.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Inp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={control} />;
}

function Row({ label, required, children }: { label: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] items-center gap-3">
      <label className="text-right text-[13px] text-slate-600">
        {required && <span className="mr-1 text-red-500">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function Text({ value, placeholder }: { value?: string; placeholder?: string }) {
  return <input disabled readOnly value={value ?? ''} placeholder={placeholder} title={READONLY_HINT} className={control} />;
}

const iconBtn = 'flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white';
const actionBtn = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white';

export default function IncidentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { tickets: all } = useAppSelector((s) => s.itsm);
  const ticketId = Number(id);

  const [ticket, setTicket] = useState<ItsmTicket | null>(null);
  const [state, setState] = useState<TicketStatus>('OPEN');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Notes');
  const [linkTab, setLinkTab] = useState<LinkTab>('Task SLAs');
  const username = useAppSelector((s) => s.auth.user?.username) ?? 'unknown';
  const [notes, setNotes] = useState<Note[]>(() => loadNotes(ticketId));
  const [workNote, setWorkNote] = useState('');
  const [comment, setComment] = useState('');
  const [fields, setFields] = useState<Fields>(() => loadFields(ticketId));
  const [saved, setSaved] = useState<Fields>(() => loadFields(ticketId));
  const [users, setUsers] = useState<string[]>([]);
  const set = (k: keyof Fields) => (v: string) =>
    setFields((f) => (k === 'category' ? { ...f, category: v, subcategory: '' } : { ...f, [k]: v }));

  useEffect(() => {
    if (all.length === 0) dispatch(fetchTickets());
  }, [all.length, dispatch]);

  useEffect(() => {
    getUsers()
      .then((u) => setUsers(u.filter((x) => x.enabled).map((x) => x.username)))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    const f = loadFields(ticketId);
    setFields(f);
    setSaved(f);
    setNotes(loadNotes(ticketId));
    setWorkNote('');
    setComment('');
  }, [ticketId]);

  useEffect(() => {
    let live = true;
    getTicketById(ticketId)
      .then((t) => {
        if (!live) return;
        setTicket(t);
        setState(t.status);
        setError(null);
        setFields((f) => ({ ...f, category: f.category || t.category || '', assignedTo: f.assignedTo || t.assignedTo || '' }));
        setSaved((f) => ({ ...f, category: f.category || t.category || '', assignedTo: f.assignedTo || t.assignedTo || '' }));
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Failed to load the incident'));
    return () => {
      live = false;
    };
  }, [ticketId]);

  // Prev / next walk the incident list in the same order as the Incidents page (newest first).
  const siblings = useMemo(() => {
    const section = getSection('incidents')!;
    return all.filter(section.matches).sort((a, b) => (a.ticketCode < b.ticketCode ? 1 : -1));
  }, [all]);
  const at = siblings.findIndex((t) => t.id === ticketId);
  const go = (offset: number) => {
    const t = siblings[at + offset];
    if (t) navigate(`/tickets/incidents/${t.id}`);
  };

  const apply = async (next: TicketStatus) => {
    if (!ticket) return;
    setSaving(true);
    setMessage(null);
    try {
      const fresh: Note[] = [];
      const at = new Date().toISOString();
      if (workNote.trim()) fresh.push({ kind: 'Work notes', at, by: username, text: workNote.trim() });
      if (comment.trim()) fresh.push({ kind: 'Additional comments', at, by: username, text: comment.trim() });
      let current = ticket;
      if (next !== ticket.status) {
        current = await updateTicketStatus(ticket.id, next);
        fresh.push({
          kind: 'Field changes',
          at,
          by: username,
          changes: [['Incident state', `${STATE_LABEL[ticket.status]} → ${STATE_LABEL[next]}`]],
        });
      }
      const changes: [string, string][] = (Object.keys(fields) as (keyof Fields)[])
        .filter((k) => fields[k] !== saved[k])
        .map((k) => [k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), fields[k] || '(empty)']);
      if (changes.length) fresh.push({ kind: 'Field changes', at, by: username, changes });
      saveFields(ticket.id, fields);
      setSaved(fields);
      const merged = [...fresh, ...notes];
      setNotes(merged);
      saveNotes(ticket.id, merged);
      setWorkNote('');
      setComment('');
      setTicket(current);
      setState(current.status);
      setMessage('Incident updated. Fields other than the state are saved in this browser only.');
      dispatch(fetchTickets());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to update the incident');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorMessage message={error} onRetry={() => navigate(0)} />;
  if (!ticket) return <p className="py-12 text-center text-sm text-slate-400">Loading…</p>;

  const dirty = state !== ticket.status || !!workNote.trim() || !!comment.trim() || JSON.stringify(fields) !== JSON.stringify(saved);
  const priority = derivedPriority(fields.impact, fields.urgency) ?? PRIORITY_LABEL[ticket.priority];
  const subOptions = CATEGORIES[fields.category] ?? [];
  const assignees = Array.from(new Set([...users, ...(ticket.assignedTo ? [ticket.assignedTo] : []), username]));
  const targetHours = SLA_HOURS[ticket.priority] ?? 24;
  const due = new Date(ticket.createdAt).getTime() + targetHours * 3_600_000;
  const finishedAt = isFinished(ticket) ? new Date(ticket.updatedAt ?? ticket.createdAt).getTime() : Date.now();
  const breached = finishedAt > due;
  const slaStage = isFinished(ticket) ? 'Completed' : breached ? 'Breached' : 'In progress';
  const activities: Note[] = [
    ...notes,
    {
      kind: 'Field changes',
      at: ticket.createdAt,
      by: 'System',
      changes: [
        ['Incident state', 'New'],
        ['Priority', PRIORITY_LABEL[ticket.priority]],
        ...(ticket.category ? ([['Category', ticket.category]] as [string, string][]) : []),
      ],
    },
  ];
  const resolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <div className="-mx-1">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <button onClick={() => navigate('/tickets/incidents')} aria-label="Back to incidents" className={iconBtn}>
          ‹
        </button>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-slate-900">Incident</p>
          <p className="text-[12px] text-slate-600">{ticket.ticketCode}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button disabled={!dirty || saving} onClick={() => void apply(state)} className={actionBtn}>
            Update
          </button>
          <button disabled={resolved || saving} onClick={() => void apply('RESOLVED')} className={actionBtn}>
            Resolve
          </button>
          <button
            onClick={() => setMessage('Delete is not available yet: the backend has no delete endpoint for tickets.')}
            className={actionBtn}
          >
            Delete
          </button>
          <button disabled={at <= 0} onClick={() => go(-1)} aria-label="Previous incident" className={iconBtn}>
            ↑
          </button>
          <button disabled={at < 0 || at >= siblings.length - 1} onClick={() => go(1)} aria-label="Next incident" className={iconBtn}>
            ↓
          </button>
        </div>
      </div>
      {message && <p className="bg-amber-50 px-3 py-1.5 text-[13px] text-amber-700">{message}</p>}

      {/* Form */}
      <div className="grid gap-x-10 gap-y-3 px-4 py-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Row label="Number">
            <Text value={ticket.ticketCode} />
          </Row>
          <Row label="Caller" required>
            <Inp value={fields.caller} onChange={set('caller')} />
          </Row>
          <Row label="Category">
            <Sel value={fields.category} onChange={set('category')} options={Object.keys(CATEGORIES)} />
          </Row>
          <Row label="Subcategory">
            <Sel value={fields.subcategory} onChange={set('subcategory')} options={subOptions} />
          </Row>
          <Row label="Service">
            <Inp value={fields.service} onChange={set('service')} />
          </Row>
          <Row label="Service offering">
            <Inp value={fields.serviceOffering} onChange={set('serviceOffering')} />
          </Row>
          <Row label="Configuration item">
            <Inp value={fields.ci} onChange={set('ci')} />
          </Row>
        </div>

        <div className="space-y-3">
          <Row label="Channel">
            <Sel value={fields.channel} onChange={set('channel')} options={CHANNELS} />
          </Row>
          <Row label="State">
            <select value={state} onChange={(e) => setState(e.target.value as TicketStatus)} className={control}>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s]}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Impact">
            <Sel value={fields.impact} onChange={set('impact')} options={LEVELS} />
          </Row>
          <Row label="Urgency">
            <Sel value={fields.urgency} onChange={set('urgency')} options={LEVELS} />
          </Row>
          <Row label={<span className="text-primary-700 underline">Priority</span>}>
            <input disabled readOnly value={priority} className={control} />
          </Row>
          <Row label="Assignment group">
            <Sel value={fields.assignmentGroup} onChange={set('assignmentGroup')} options={GROUPS} />
          </Row>
          <Row label="Assigned to">
            <Sel value={fields.assignedTo} onChange={set('assignedTo')} options={assignees} blank="-- None --" />
          </Row>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-[150px_1fr] items-center gap-3 lg:grid-cols-[150px_1fr]">
            <label className="text-right text-[13px] text-slate-600">
              <span className="mr-1 text-red-500">*</span>Short description
            </label>
            <input disabled readOnly value={ticket.title} title={READONLY_HINT} className={control} />
          </div>
          <div className="grid grid-cols-[150px_1fr] gap-3">
            <label className="pt-1.5 text-right text-[13px] text-slate-600">Description</label>
            <textarea disabled readOnly rows={4} value={ticket.description ?? ''} title={READONLY_HINT} className={control} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-2 border-t border-slate-300 px-3 pt-4">
        <div className="flex gap-0.5 border-b border-slate-300">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px rounded-t border border-b-0 px-3.5 py-2 text-[13px] ${
                tab === t
                  ? 'border-slate-300 border-t-2 border-t-primary-600 bg-white font-medium text-slate-900'
                  : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="py-4">
          {tab === 'Notes' && (
            <div className="space-y-4">
              <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
                <Row label="Watch list">
                  <Text />
                </Row>
                <Row label="Work notes list">
                  <Text />
                </Row>
              </div>
              <div className="grid grid-cols-[150px_1fr] gap-3">
                <label className="pt-1.5 text-right text-[13px] text-slate-600">
                  <span className="mr-1 text-red-500">*</span>Work notes
                </label>
                <textarea
                  rows={2}
                  value={workNote}
                  onChange={(e) => setWorkNote(e.target.value)}
                  placeholder="Work notes"
                  className={`${control} border-l-4 border-l-yellow-400`}
                />
              </div>
              <div className="grid grid-cols-[150px_1fr] gap-3">
                <label className="pt-1.5 text-right text-[13px] leading-tight text-slate-600">Additional comments (Customer visible)</label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Additional comments (Customer visible)"
                  className={control}
                />
              </div>
              <div className="grid grid-cols-[150px_1fr] gap-3">
                <label className="pt-2 text-right text-[13px] text-slate-600">Activities: {activities.length}</label>
                <ul className="space-y-2">
                  {activities.map((n, i) => (
                    <li
                      key={`${n.at}-${i}`}
                      className={`rounded border border-slate-200 bg-white px-3 py-2 text-[13px] ${
                        n.kind === 'Work notes' ? 'border-l-4 border-l-yellow-400' : n.kind === 'Additional comments' ? 'border-l-4 border-l-primary-400' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-800">
                        <span className="font-medium">{n.by}</span>
                        <span className="text-[12px] text-slate-600">
                          {n.kind} <span className="mx-1">•</span> {stamp(n.at)}
                        </span>
                      </div>
                      {n.text && <p className="mt-1 whitespace-pre-wrap text-slate-700">{n.text}</p>}
                      {n.changes && (
                        <dl className="mt-1.5 grid grid-cols-[130px_1fr] gap-y-0.5 text-[12.5px]">
                          {n.changes.map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="text-right text-slate-500">{k}</dt>
                              <dd className="pl-3 text-slate-800">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === 'Related Records' && (
            <div className="space-y-3">
              <Row label="Source issue">
                {ticket.issueId && ticket.issueCode ? (
                  <Link to={`/issues/${ticket.issueId}`} className="font-mono text-[13px] text-primary-700 hover:underline">
                    {ticket.issueCode}
                  </Link>
                ) : (
                  <span className="text-[13px] text-slate-400">No related records</span>
                )}
              </Row>
            </div>
          )}

          {tab === 'Resolution Information' && (
            <div className="space-y-3">
              <Row label="State">
                <span className="text-[13px] text-slate-800">{STATE_LABEL[ticket.status]}</span>
              </Row>
              <Row label="Resolved / closed">
                <span className="text-[13px] text-slate-800">
                  {resolved && ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : 'Not resolved yet'}
                </span>
              </Row>
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex gap-2 px-3 pb-2">
        <button disabled={!dirty || saving} onClick={() => void apply(state)} className={actionBtn}>
          Update
        </button>
        <button disabled={isFinished(ticket) || saving} onClick={() => void apply('RESOLVED')} className={actionBtn}>
          Resolve
        </button>
        <button onClick={() => setMessage('Delete is not available yet: the backend has no delete endpoint for tickets.')} className={actionBtn}>
          Delete
        </button>
      </div>

      <div className="px-3 pb-6">
        <h2 className="mt-3 text-[17px] font-semibold text-slate-900">Related Links</h2>
        <button onClick={() => setLinkTab('Task SLAs')} className="text-[13px] text-primary-700 underline">
          Repair SLAs
        </button>

        <div className="mt-4 flex gap-0.5 border-b border-slate-300">
          {LINK_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setLinkTab(t)}
              className={`-mb-px rounded-t border border-b-0 px-3.5 py-2 text-[13px] ${
                linkTab === t
                  ? 'border-slate-300 border-t-2 border-t-primary-600 bg-white font-medium text-slate-900'
                  : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="border-x border-b border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <select disabled className={`${control} w-44`} aria-label="Search field">
              <option>{linkTab === 'Task SLAs' ? 'SLA definition' : 'Name'}</option>
            </select>
            <input disabled placeholder="Search" className={`${control} w-48`} aria-label="Search" />
          </div>
          <p className="px-3 py-2 text-[13px] text-slate-700">Task = {ticket.ticketCode}</p>

          {linkTab === 'Task SLAs' ? (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-y border-slate-200 text-left text-slate-900">
                  {['SLA definition', 'Start time', 'Breach time', 'Stage', 'Has breached'].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 text-slate-800">
                    Resolution within {targetHours}h ({ticket.priority.toLowerCase()} priority)
                  </td>
                  <td className="px-3 py-2 text-slate-700">{stamp(ticket.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-700">{stamp(due)}</td>
                  <td className="px-3 py-2 text-slate-800">{slaStage}</td>
                  <td className="px-3 py-2 text-slate-800">{breached ? 'true' : 'false'}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="px-3 py-6 text-center text-[13px] text-slate-400">No records to display</p>
          )}
        </div>
      </div>
    </div>
  );
}
