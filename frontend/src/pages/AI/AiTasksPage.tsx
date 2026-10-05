import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getAiTaskGaps,
  getAiTaskQuality,
  getAiTaskSettings,
  getAiTaskSummary,
  getAiTaskTimeline,
  getAiTasks,
  updateAiTaskSettings,
  type AiTaskGap,
  type AiTaskQuality,
  type AiTaskRow,
  type AiTaskSettings,
  type AiTaskSummary,
  type AiTaskTimelineEntry,
  type TaskState,
} from '../../api/aiTaskApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import { toast } from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDate';

type Tab = 'tasks' | 'reports' | 'settings';
type Filter = 'ALL' | 'OPEN' | 'ESCALATED' | 'RESOLVED' | 'DECLINED';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'In progress' },
  { id: 'ESCALATED', label: 'With a technician' },
  { id: 'RESOLVED', label: 'Fixed' },
  { id: 'DECLINED', label: 'Declined' },
];

const STATE_LABEL: Record<TaskState, { label: string; cls: string }> = {
  ASK_KB: { label: 'Asked to check', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  PICK_RELATED: { label: 'Choosing related', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  OFFERED: { label: 'Fix offered', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  NO_FIX: { label: 'No fix found', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  NEEDS_INPUT: { label: 'Asking', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  RUNNING: { label: 'Running', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  UNDOING: { label: 'Undoing', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  AWAITING_CONFIRM: { label: 'Is it fixed?', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  RESOLVED: { label: 'Fixed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  ESCALATED: { label: 'With a technician', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  DECLINED: { label: 'Declined', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const REASON_LABEL: Record<string, string> = {
  NO_MATCH: 'Nothing in the knowledge base fit',
  FAILED: 'The fix failed',
  NOT_STARTED: 'The fix could not start',
  NOT_FIXED: 'Ran, but still not solved',
  UNDONE: 'Made things worse; undone, nothing else to try',
  UNDO_FAILED: 'The undo did not work',
  NO_ANSWER: 'No answer to "is it fixed?"',
  REQUESTED: 'The person asked for a technician',
};

const pill = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset';
const input =
  'border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

function StatePill({ state }: { state: TaskState }) {
  const s = STATE_LABEL[state] ?? { label: state, cls: 'bg-slate-100 text-slate-600 ring-slate-200' };
  return <span className={`${pill} ${s.cls}`}>{s.label}</span>;
}

function Stars({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-slate-400">—</span>;
  return (
    <span className="text-amber-500" title={`${rating} of 5`}>
      {'★'.repeat(rating)}
      <span className="text-slate-300">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * What the DEX AI assistant has been asked to do on people's PCs: every task with its whole conversation, what nothing in
 * the knowledge base could answer (a to-do list for new articles and scripts), how each fix is doing, and the settings an
 * admin can change (reminder and escalation timing, automatic tickets, attempts).
 */
export default function AiTasksPage() {
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const isAdmin = role === 'ROLE_ADMIN';
  const [tab, setTab] = useState<Tab>('tasks');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
        <Link to="/setup" className="text-sm text-slate-500 hover:text-slate-800" aria-label="Back to Setup" title="Back to Setup">
          ☰
        </Link>
        <h1 className="text-sm font-semibold text-slate-900">AI Tasks</h1>
        <span className="text-xs text-slate-400">What the assistant was asked to do on people's PCs</span>
      </div>

      <div className="flex gap-1 border-b border-slate-200" role="tablist">
        {(
          [
            ['tasks', 'Tasks'],
            ['reports', 'Reports'],
            ...(isAdmin ? ([['settings', 'Settings']] as [Tab, string][]) : []),
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium ${
              tab === id ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && <TasksTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'settings' && isAdmin && <SettingsTab />}
    </div>
  );
}

// ── tasks ──────────────────────────────────────────────────────────────────────────────

function TasksTab() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AiTaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<AiTaskRow | null>(null);

  const load = useCallback(() => {
    getAiTasks(filter === 'ALL' ? undefined : filter, 200)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [filter]);

  useEffect(() => {
    setRows(null);
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter((r) =>
      [r.request, r.hostname, r.requester, r.fixTitle, r.fixKey, r.ticketCode, r.code].some((t) => (t ?? '').toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search requests, devices, people, tickets…"
          aria-label="Search tasks"
          className={`${input} w-72 rounded`}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by state">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                filter === f.id ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {rows && <span className="ml-auto text-xs text-slate-400">{shown.length} shown</span>}
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={load} className="text-xs font-medium underline">
            Try again
          </button>
        </div>
      ) : rows === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">{rows.length === 0 ? 'Nothing asked yet' : 'No task matches'}</p>
          <p className="mt-1 text-xs text-slate-500">
            When someone tells the DEX AI tab what is wrong (&ldquo;my printer is not working&rdquo;), the task appears here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50 text-left text-[11px] font-semibold text-slate-600">
                <th className="px-3 py-2.5">Request</th>
                <th className="px-3 py-2.5">Device</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Fix</th>
                <th className="px-3 py-2.5">Ticket</th>
                <th className="px-3 py-2.5">Rating</th>
                <th className="px-3 py-2.5">When</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  <td className="max-w-[22rem] px-3 py-2.5">
                    <div className="truncate font-medium text-slate-900" title={r.request}>
                      {r.request}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {r.code}
                      {r.requester ? ` · ${r.requester}` : ''}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{r.hostname || r.agentId || '—'}</td>
                  <td className="px-3 py-2.5">
                    <StatePill state={r.state} />
                    {r.reason && r.state === 'ESCALATED' && <div className="mt-0.5 text-[11px] text-slate-400">{REASON_LABEL[r.reason] ?? r.reason}</div>}
                  </td>
                  <td className="max-w-[14rem] px-3 py-2.5 text-slate-600">
                    {r.fixTitle ? (
                      <>
                        <div className="truncate" title={r.fixTitle}>
                          {r.fixTitle}
                        </div>
                        {r.attempt > 1 && <div className="text-[11px] text-slate-400">attempt {r.attempt}</div>}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{r.ticketCode || <span className="text-slate-400">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Stars rating={r.rating} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500" title={formatDateTime(r.createdAt)}>
                    {formatRelativeTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <TimelineDrawer task={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  REQUEST: 'Asked',
  OFFER: 'Assistant',
  ANSWER: 'Answered',
  CONFIRM: 'Decided',
  RUN: 'Run',
  RESULT: 'Result',
  ESCALATE: 'Handed over',
  RESOLVE: 'Closed',
  REMIND: 'Reminder',
  RATE: 'Rated',
  NOTE: 'Note',
};

/** The whole conversation of one task, so whoever picks it up never has to ask the person again. */
function TimelineDrawer({ task, onClose }: { task: AiTaskRow; onClose: () => void }) {
  const [entries, setEntries] = useState<AiTaskTimelineEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAiTaskTimeline(task.id)
      .then(setEntries)
      .catch((e) => setError(getErrorMessage(e)));
  }, [task.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose} role="presentation">
      <aside
        role="dialog"
        aria-label={`Task ${task.code}`}
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{task.request}</h2>
            <p className="mt-1 text-[11px] text-slate-400">
              {task.code} · {task.hostname || task.agentId || 'no device'}
              {task.requester ? ` · ${task.requester}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatePill state={task.state} />
          <span className={`${pill} bg-slate-100 text-slate-600 ring-slate-200`}>{task.audience === 'TECHNICIAN' ? 'Technician' : 'User'}</span>
          {task.ticketCode && <span className={`${pill} bg-violet-50 text-violet-700 ring-violet-200`}>{task.ticketCode}</span>}
          {task.reason && <span className="text-[11px] text-slate-500">{REASON_LABEL[task.reason] ?? task.reason}</span>}
        </div>

        <ol className="mt-5 space-y-3 border-l border-slate-200 pl-4">
          {error && <li className="text-xs text-red-600">{error}</li>}
          {entries === null && !error && <li className="text-xs text-slate-400">Loading…</li>}
          {(entries ?? []).map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
              <div className="text-[11px] text-slate-400">
                {KIND_LABEL[e.kind] ?? e.kind}
                {e.actor ? ` · ${e.actor}` : ''} · {formatDateTime(e.at)}
              </div>
              <div className="whitespace-pre-wrap text-xs text-slate-800">{e.text}</div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

// ── reports ────────────────────────────────────────────────────────────────────────────

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

function ReportsTab() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<AiTaskSummary | null>(null);
  const [gaps, setGaps] = useState<AiTaskGap[] | null>(null);
  const [quality, setQuality] = useState<AiTaskQuality[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([getAiTaskSummary(days), getAiTaskGaps(days), getAiTaskQuality(days)])
      .then(([s, g, q]) => {
        setSummary(s);
        setGaps(g);
        setQuality(q);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [days]);

  if (error) return <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!summary || !gaps || !quality) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        Period
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${input} rounded`} aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Tasks" value={String(summary.tasks)} hint={`${summary.open} in progress`} />
        <Card
          label="Fixed without a technician"
          value={summary.resolvedShare == null ? '—' : `${summary.resolvedShare}%`}
          hint={`${summary.resolved} fixed · ${summary.escalated} handed over`}
        />
        <Card label="Nothing fit" value={String(summary.noMatch)} hint="requests with no article or script" />
        <Card label="Rating" value={summary.averageRating == null ? '—' : `${summary.averageRating} / 5`} />
      </div>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Not answered by the knowledge base</h2>
        <p className="mb-2 text-xs text-slate-500">What people asked for that no approved article or script could do, most often first. Each is a gap worth writing.</p>
        {gaps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">Nothing unanswered in this period.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50 text-left text-[11px] font-semibold text-slate-600">
                  <th className="px-3 py-2.5">Request</th>
                  <th className="px-3 py-2.5">Times asked</th>
                  <th className="px-3 py-2.5">Last asked</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.request} className="border-b border-slate-200 last:border-0">
                    <td className="max-w-[28rem] px-3 py-2.5">
                      <div className="truncate font-medium text-slate-900" title={g.request}>
                        {g.request}
                      </div>
                      {g.examples.length > 1 && <div className="truncate text-[11px] text-slate-400">also: {g.examples.slice(1).join(' · ')}</div>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-700">{g.count}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formatRelativeTime(g.lastAsked)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => navigate(`/knowledge/new?title=${encodeURIComponent(g.request)}`)}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        Write an article →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">How each fix is doing</h2>
        <p className="mb-2 text-xs text-slate-500">Fixed first time means the person confirmed it on the first fix offered.</p>
        {quality.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">No fix has been offered in this period.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50 text-left text-[11px] font-semibold text-slate-600">
                  <th className="px-3 py-2.5">Fix</th>
                  <th className="px-3 py-2.5">Offered</th>
                  <th className="px-3 py-2.5">Fixed</th>
                  <th className="px-3 py-2.5">Fixed first time</th>
                  <th className="px-3 py-2.5">Handed over</th>
                  <th className="px-3 py-2.5">Declined</th>
                  <th className="px-3 py-2.5">Rating</th>
                </tr>
              </thead>
              <tbody>
                {quality.map((q) => (
                  <tr key={q.scriptKey} className="border-b border-slate-200 last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900">{q.title}</div>
                      <div className="font-mono text-[11px] text-slate-400">{q.scriptKey}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono">{q.tasks}</td>
                    <td className="px-3 py-2.5 font-mono">{q.resolved}</td>
                    <td className="px-3 py-2.5 font-mono">{q.firstTimeFixes}</td>
                    <td className={`px-3 py-2.5 font-mono ${q.escalated > q.resolved ? 'font-semibold text-red-600' : ''}`}>{q.escalated}</td>
                    <td className="px-3 py-2.5 font-mono">{q.declined}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {q.averageRating == null ? <span className="text-slate-400">—</span> : <span className="font-mono">{q.averageRating} / 5</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── settings (admin) ───────────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<AiTaskSettings | null>(null);
  const [form, setForm] = useState<AiTaskSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAiTaskSettings()
      .then((s) => {
        setSettings(s);
        setForm(s);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (error) return <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!form || !settings) return <p className="text-sm text-slate-400">Loading…</p>;

  const dirty = JSON.stringify({ ...form, updatedAt: null, updatedBy: null }) !== JSON.stringify({ ...settings, updatedAt: null, updatedBy: null });
  const set = <K extends keyof AiTaskSettings>(k: K, v: AiTaskSettings[K]) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updateAiTaskSettings({
        enabled: form.enabled,
        remindMinutes: form.remindMinutes,
        escalateHours: form.escalateHours,
        autoTicketOnNoMatch: form.autoTicketOnNoMatch,
        askBeforeKbCheck: form.askBeforeKbCheck,
        maxAttempts: form.maxAttempts,
      });
      setSettings(saved);
      setForm(saved);
      toast('Settings saved', 'success');
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const row = 'flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 py-4 last:border-0';

  return (
    <div className="max-w-2xl rounded-lg border border-slate-200 bg-white px-5">
      <div className={row}>
        <div>
          <div className="text-sm font-medium text-slate-900">DEX AI does tasks</div>
          <p className="text-xs text-slate-500">When off, the assistant only chats; it never looks for a fix or raises a ticket.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} className="h-4 w-4 accent-sky-600" />
          {form.enabled ? 'On' : 'Off'}
        </label>
      </div>

      <div className={row}>
        <div>
          <div className="text-sm font-medium text-slate-900">Ask before checking the knowledge base</div>
          <p className="text-xs text-slate-500">When someone reports a problem, the assistant says what it understood and asks "shall I check the knowledge base?" first. Questions are never asked about.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={form.askBeforeKbCheck} onChange={(e) => set('askBeforeKbCheck', e.target.checked)} className="h-4 w-4 accent-sky-600" />
          {form.askBeforeKbCheck ? 'Ask first' : 'Look straight away'}
        </label>
      </div>

      <div className={row}>
        <div>
          <div className="text-sm font-medium text-slate-900">Remind after</div>
          <p className="text-xs text-slate-500">When someone has not said whether the fix worked, remind them after this long.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="number"
            min={1}
            max={1440}
            value={form.remindMinutes}
            onChange={(e) => set('remindMinutes', Number(e.target.value))}
            className={`${input} w-20 rounded`}
          />
          minutes
        </label>
      </div>

      <div className={row}>
        <div>
          <div className="text-sm font-medium text-slate-900">Hand to a technician after</div>
          <p className="text-xs text-slate-500">Still no answer after this long: the task becomes a ticket for a technician.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="number"
            min={1}
            max={720}
            value={form.escalateHours}
            onChange={(e) => set('escalateHours', Number(e.target.value))}
            className={`${input} w-20 rounded`}
          />
          hours
        </label>
      </div>

      <div className={row}>
        <div>
          <div className="text-sm font-medium text-slate-900">Raise a ticket when nothing fits</div>
          <p className="text-xs text-slate-500">When off, the person is asked first whether they want a ticket.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={form.autoTicketOnNoMatch}
            onChange={(e) => set('autoTicketOnNoMatch', e.target.checked)}
            className="h-4 w-4 accent-sky-600"
          />
          {form.autoTicketOnNoMatch ? 'Straight away' : 'Ask first'}
        </label>
      </div>

      <div className={row}>
        <div>
          <div className="text-sm font-medium text-slate-900">Fixes to try</div>
          <p className="text-xs text-slate-500">How many different fixes are tried for one request before a technician gets it.</p>
        </div>
        <select value={form.maxAttempts} onChange={(e) => set('maxAttempts', Number(e.target.value))} className={`${input} rounded`} aria-label="Fixes to try">
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </div>

      <div className="flex items-center justify-between py-4">
        <span className="text-[11px] text-slate-400">
          {settings.updatedBy ? `Last changed by ${settings.updatedBy}${settings.updatedAt ? ` · ${formatDateTime(settings.updatedAt)}` : ''}` : 'Using the defaults'}
        </span>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={() => setForm(settings)} className="text-xs text-slate-500 hover:text-slate-800">
              Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
