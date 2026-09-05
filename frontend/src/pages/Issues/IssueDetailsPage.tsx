import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchIssueById, updateIssueStatus, assignIssue } from '../../features/issues/issuesSlice';
import { fetchRecommendation } from '../../features/ai/aiSlice';
import { formatDateTime } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Panel } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  getRemediationsByIssue,
  executeRemediation,
  cancelRemediation,
  type Remediation,
} from '../../api/remediationApi';
import { getTicketsByIssue, createTicket } from '../../api/itsmApi';
import { getSimilarIssues, type SimilarIssue } from '../../api/issueApi';
import type { ItsmTicket } from '../../types';

const REMEDIATION_TONE: Record<string, 'danger' | 'info' | 'success' | 'neutral'> = {
  PENDING: 'neutral',
  RUNNING: 'info',
  SUCCESS: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

const TICKET_STATUS_TONE: Record<string, 'danger' | 'info' | 'success' | 'neutral'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
};

const PRIORITY_BY_SEVERITY: Record<string, string> = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

const STATUS_FLOW = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

const STATUS_TONE: Record<string, 'danger' | 'info' | 'success' | 'neutral'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'neutral' | 'info'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'warning',
  LOW: 'info',
};

export default function IssueDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selected: issue, loading, error } = useAppSelector((state) => state.issues);
  const { recommendation, loading: aiLoading } = useAppSelector((state) => state.ai);
  const { user } = useAppSelector((state) => state.auth);

  const canUpdateStatus = !!user?.role && ACTION_PERMISSIONS.UPDATE_ISSUE_STATUS.includes(user.role);
  const canAssign = !!user?.role && ACTION_PERMISSIONS.ASSIGN_ISSUE.includes(user.role);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [remediationRuns, setRemediationRuns] = useState<Remediation[]>([]);
  const [linkedTickets, setLinkedTickets] = useState<ItsmTicket[]>([]);
  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [busyRunId, setBusyRunId] = useState<number | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [escalatedCode, setEscalatedCode] = useState<string | null>(null);

  const numericId = Number(id);

  const loadRelated = useCallback(async (issueId: number) => {
    setRelatedLoading(true);
    try {
      const [runs, tickets, similar] = await Promise.all([
        getRemediationsByIssue(issueId).catch(() => [] as Remediation[]),
        getTicketsByIssue(issueId).catch(() => [] as ItsmTicket[]),
        getSimilarIssues(issueId, 5).catch(() => [] as SimilarIssue[]),
      ]);
      setRemediationRuns(runs);
      setLinkedTickets(tickets);
      setSimilarIssues(similar);
    } finally {
      setRelatedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      dispatch(fetchIssueById(numericId));
      dispatch(fetchRecommendation(numericId));
      void loadRelated(numericId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  const goBack = () => navigate('/issues');

  /* ---- loading state ---- */
  if (loading && !issue) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-xl border border-line bg-panel p-6">
          <Skeleton className="h-6 w-2/3" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="mt-5 h-16 w-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error && !issue) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-red-500/25 bg-red-500/[0.06] px-6 py-16 text-center">
        <p className="text-sm font-medium text-red-200">Couldn’t load this issue</p>
        <p className="mt-1 text-xs text-red-300/70">{error}</p>
        <Button size="sm" variant="danger" className="mt-5" onClick={() => dispatch(fetchIssueById(numericId))}>
          Retry
        </Button>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-line bg-panel px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-300">Issue not found</p>
        <Button size="sm" className="mt-5" variant="secondary" onClick={goBack}>
          Back to issues
        </Button>
      </div>
    );
  }

  const aiExplanation =
    typeof recommendation?.explanation === 'string' ? recommendation.explanation : '';
  const aiActions = Array.isArray(recommendation?.recommendations)
    ? recommendation.recommendations
    : [];
  const aiConfidence =
    typeof recommendation?.confidence === 'number' ? recommendation.confidence : 0;

  const changeStatus = async (status: string) => {
    setStatusUpdating(true);
    try {
      await dispatch(updateIssueStatus({ id: issue.id, status })).unwrap();
      dispatch(fetchIssueById(issue.id));
    } finally {
      setStatusUpdating(false);
    }
  };

  const assignToMe = async () => {
    setAssigning(true);
    try {
      await dispatch(assignIssue({ id: issue.id, assignedTo: user?.username || 'unknown' })).unwrap();
      dispatch(fetchIssueById(issue.id));
    } finally {
      setAssigning(false);
    }
  };

  const runRemediation = async (runId: number) => {
    setBusyRunId(runId);
    try {
      await executeRemediation(runId);
      await loadRelated(issue.id);
    } finally {
      setBusyRunId(null);
    }
  };

  const cancelRun = async (runId: number) => {
    setBusyRunId(runId);
    try {
      await cancelRemediation(runId);
      await loadRelated(issue.id);
    } finally {
      setBusyRunId(null);
    }
  };

  const escalateToTicket = async () => {
    setEscalating(true);
    setEscalatedCode(null);
    try {
      const ticket = await createTicket({
        issueId: issue.id,
        priority: PRIORITY_BY_SEVERITY[issue.severity] ?? 'MEDIUM',
      });
      setEscalatedCode(ticket.ticketCode);
      await loadRelated(issue.id);
    } finally {
      setEscalating(false);
    }
  };

  const activeEscalation = linkedTickets.find(
    (t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS'
  );

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={goBack}
        className="group inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line transition-colors group-hover:border-line-strong">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </span>
        Back to issues
      </button>

      {/* Header card */}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-400">
                {issue.issueCode ? `Issue ${issue.issueCode}` : `Issue #${issue.id}`}
              </p>
              {issue.category && (
                <Badge tone="primary">{issue.category}</Badge>
              )}
            </div>
            <h1 className="mt-2 font-display text-[22px] font-semibold leading-snug tracking-[-0.01em] text-slate-900">
              {issue.title}
            </h1>
            {issue.description && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{issue.description}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[issue.severity] ?? 'neutral'} dot>
                {issue.severity} severity
              </Badge>
              <Badge
                tone={STATUS_TONE[issue.status] ?? 'neutral'}
                dot
                pulse={issue.status === 'OPEN' || issue.status === 'IN_PROGRESS'}
              >
                {STATUS_LABEL[issue.status] ?? issue.status}
              </Badge>
              {issue.assignedTo && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500/15 text-[10px] font-semibold text-primary-300 ring-1 ring-inset ring-primary-400/25">
                    {issue.assignedTo.charAt(0).toUpperCase()}
                  </span>
                  {issue.assignedTo}
                </span>
              )}
            </div>
          </div>

          {/* meta */}
          <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-2 lg:grid-cols-1 lg:text-right">
            <div>
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-600">Device</dt>
              <dd className="mt-0.5">
                {issue.hostname ? (
                  <Link
                    to={`/devices?agent=${issue.agentId ?? ''}`}
                    className="font-mono text-xs text-slate-300 hover:text-primary-300"
                  >
                    {issue.hostname}
                  </Link>
                ) : (
                  <span className="text-xs text-slate-600">—</span>
                )}
              </dd>
            </div>
            {issue.agentId && (
              <div>
                <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-600">Agent</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-500">{issue.agentId}</dd>
              </div>
            )}
            <div>
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-600">Detected</dt>
              <dd className="mt-0.5 font-mono text-xs text-slate-400">{formatDateTime(issue.createdAt)}</dd>
            </div>
            {issue.updatedAt && (
              <div>
                <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-600">Updated</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-400">{formatDateTime(issue.updatedAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Workflow bar */}
        {(canUpdateStatus || canAssign) && (
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            {canUpdateStatus ? (
              <div className="flex items-center gap-1.5">
                <span className="mr-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-600">
                  Status
                </span>
                {STATUS_FLOW.map((s) => {
                  const active = issue.status === s;
                  return (
                    <button
                      key={s}
                      disabled={statusUpdating}
                      onClick={() => void changeStatus(s)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-50 ${
                        active
                          ? 'bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-300'
                          : 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-800'
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              {canAssign && !issue.assignedTo && (
                <Button variant="secondary" size="sm" loading={assigning} onClick={() => void assignToMe()}>
                  Assign to me
                </Button>
              )}
              <Button
                size="sm"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                  </svg>
                }
                disabled={!issue.agentId}
                title={issue.agentId ? undefined : 'This issue has no linked device'}
                onClick={() =>
                  navigate(`/remediation/execute?issueId=${issue.id}&device=${encodeURIComponent(issue.agentId ?? '')}`)
                }
              >
                Run remediation
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* AI analysis */}
      <Panel className="border-primary-400/15 bg-gradient-to-br from-primary-500/[0.05] via-panel to-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/[0.14] text-primary-300 ring-1 ring-inset ring-primary-400/25">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
            </span>
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">Assist</p>
              <h2 className="mt-0.5 text-sm font-semibold text-slate-100">AI analysis & recommendations</h2>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={aiLoading}
            icon={
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            }
            onClick={() => dispatch(fetchRecommendation(issue.id))}
          >
            Re-analyze
          </Button>
        </div>

        {aiLoading && !recommendation ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : recommendation ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Likely cause
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                {aiExplanation || 'No explanation returned by the model.'}
              </p>

              {aiActions.length > 0 && (
                <div className="mt-5">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Recommended actions
                  </p>
                  <ol className="space-y-2.5">
                    {aiActions.map((rec: string, i: number) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-line/70 bg-slate-50 px-3.5 py-3"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15 font-mono text-[10px] font-semibold text-primary-300 ring-1 ring-inset ring-primary-400/25">
                          {i + 1}
                        </span>
                        <span className="text-[13px] leading-relaxed text-slate-300">{rec}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <div className="lg:border-l lg:border-line lg:pl-6">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Model confidence
              </p>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-700"
                    style={{ width: `${Math.round(aiConfidence * 100)}%`, boxShadow: '0 0 10px rgba(139,107,255,0.5)' }}
                  />
                </div>
                <span className="font-mono text-lg font-semibold text-slate-900">
                  {Math.round(aiConfidence * 100)}%
                </span>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-600">
                Grounded in your knowledge base. Always pair AI guidance with operator judgment before acting on a
                live machine.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-line/70 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm text-slate-500">No AI analysis available for this issue yet</p>
            <p className="mt-1 text-xs text-slate-600">Hit “Re-analyze” to generate one from the knowledge base.</p>
          </div>
        )}
      </Panel>

      {/* ── Linked remediations & ITSM escalation ── */}
      {relatedLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Remediation runs for this issue */}
          <Panel padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Remediation</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">Run history</h3>
              </div>
              <span className="font-mono text-[11px] text-slate-400">{remediationRuns.length} run{remediationRuns.length === 1 ? '' : 's'}</span>
            </div>
            <div className="border-t border-line">
              {remediationRuns.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-slate-500">No remediation runs for this issue yet</p>
                  <p className="mt-1 text-xs text-slate-400">Queue one from the Run remediation button above.</p>
                </div>
              ) : (
                remediationRuns.slice(0, 6).map((run) => (
                  <div key={run.id} className="flex items-center justify-between gap-3 border-b border-line/60 px-5 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-medium text-primary-600">{run.remediationCode}</span>
                        <Badge tone={REMEDIATION_TONE[run.status] ?? 'neutral'} dot pulse={run.status === 'RUNNING'}>
                          {run.status}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-medium text-slate-800">{run.action}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {run.executedBy || 'system'}
                        {run.hostname ? ` · ${run.hostname}` : ''}
                        {run.createdAt ? ` · ${formatDateTime(run.createdAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {run.status === 'PENDING' && (
                        <Button size="sm" variant="secondary" loading={busyRunId === run.id} onClick={() => void runRemediation(run.id)}>
                          Run
                        </Button>
                      )}
                      {run.status === 'RUNNING' && (
                        <Button size="sm" variant="danger" loading={busyRunId === run.id} onClick={() => void cancelRun(run.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* ITSM escalation for this issue */}
          <Panel padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">ITSM</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">Escalation tickets</h3>
              </div>
              {activeEscalation ? (
                <Badge tone="info" dot>Escalated</Badge>
              ) : (
                <Button
                  size="sm"
                  loading={escalating}
                  disabled={!!activeEscalation}
                  onClick={() => void escalateToTicket()}
                  title={activeEscalation ? 'This issue already has an open ticket' : undefined}
                >
                  Escalate to ITSM
                </Button>
              )}
            </div>
            <div className="border-t border-line">
              {linkedTickets.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-slate-500">Not escalated to ITSM yet</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {escalatedCode
                      ? `Created ${escalatedCode} — reopening this issue will refresh it.`
                      : 'Create a ticket to hand this issue off to the service desk.'}
                  </p>
                </div>
              ) : (
                linkedTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between gap-3 border-b border-line/60 px-5 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-medium text-primary-600">{ticket.ticketCode}</span>
                        <Badge tone={TICKET_STATUS_TONE[ticket.status] ?? 'neutral'} dot>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                        <Badge tone={PRIORITY_TONE[ticket.priority] ?? 'neutral'}>{ticket.priority}</Badge>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-medium text-slate-800">{ticket.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {ticket.assignedTo ? `Assigned to ${ticket.assignedTo}` : 'Unassigned'}
                        {ticket.createdAt ? ` · ${formatDateTime(ticket.createdAt)}` : ''}
                      </p>
                    </div>
                    <Link
                      to="/tickets"
                      className="shrink-0 text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
                    >
                      Open ITSM →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* ── Similar past issues ── */}
      <Panel padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Patterns</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Similar resolved issues</h3>
          </div>
          {!relatedLoading && (
            <span className="font-mono text-[11px] text-slate-400">
              {similarIssues.length > 0
                ? `Same category, fixed before — ${similarIssues.length} found`
                : 'No resolved lookalikes on record'}
            </span>
          )}
        </div>
        <div className="border-t border-line">
          {!relatedLoading && similarIssues.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-500">Nothing similar has been resolved yet</p>
              <p className="mt-1 text-xs text-slate-400">Once resolved issues exist, DEX will surface them here with the fix that worked.</p>
            </div>
          ) : (
            similarIssues.map((sim) => (
              <button
                key={sim.id}
                onClick={() => navigate(`/issues/${sim.id}`)}
                className="group flex w-full items-center justify-between gap-4 border-b border-line/60 px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-medium text-slate-400">
                      {sim.issueCode ?? `#${sim.id}`}
                    </span>
                    {sim.category && <Badge tone="primary">{sim.category}</Badge>}
                    <Badge tone="success" dot>Resolved</Badge>
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium text-slate-800 transition-colors group-hover:text-primary-700">
                    {sim.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {sim.hostname || 'Unknown device'}
                    {sim.resolvedAt ? ` · resolved ${formatDateTime(sim.resolvedAt)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {sim.fix ? (
                    <Badge tone="success">Fixed with “{sim.fix}”</Badge>
                  ) : (
                    <Badge tone="neutral">No fix recorded</Badge>
                  )}
                  <svg className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </button>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
