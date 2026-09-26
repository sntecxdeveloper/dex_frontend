import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as knowledgeApi from '../../api/knowledgeApi';
import type { KbScriptRun, KnowledgeScript } from '../../types/knowledge';
import { formatDate } from '../../utils/formatDate';
import { AdminBadge, RiskBadge, RunStatusBadge, ScriptKeyChip, ScriptStatusBadge } from './scriptMeta';
import { TRIGGER_LABEL, parseParams } from './scriptParams';

interface Props {
  script: KnowledgeScript;
  username?: string;
  canManage: boolean;
  canApprove: boolean;
  onClose: () => void;
  onEdit: (script: KnowledgeScript) => void;
  /** Called with the updated version after any workflow action (or null after delete). */
  onChanged: (updated: KnowledgeScript | null) => void;
  onOpenArticle?: (articleId: number) => void;
}

/**
 * One script version: what it does, how it runs, and its review workflow
 * (submit → approve/reject → retire), versions and recent runs.
 */
export default function ScriptDetailsModal({
  script: initial,
  username,
  canManage,
  canApprove,
  onClose,
  onEdit,
  onChanged,
  onOpenArticle,
}: Props) {
  const [script, setScript] = useState(initial);
  const [versions, setVersions] = useState<KnowledgeScript[]>([]);
  const [runs, setRuns] = useState<KbScriptRun[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    knowledgeApi.getScriptVersions(script.scriptKey).then((v) => !cancelled && setVersions(v)).catch(() => {});
    knowledgeApi.getScriptRuns(script.id, 10).then((r) => !cancelled && setRuns(r)).catch(() => !cancelled && setRuns([]));
    return () => {
      cancelled = true;
    };
  }, [script.id, script.scriptKey, script.status]);

  const params = parseParams(script.parametersSchema);
  const isAuthor =
    !!username && [script.createdBy, script.updatedBy].some((u) => u && u.toLowerCase() === username.toLowerCase());

  const act = async (fn: () => Promise<KnowledgeScript | null>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      if (updated) setScript(updated);
      setNote('');
      onChanged(updated);
    } catch (err) {
      setError(knowledgeApi.apiError(err, 'That didn’t work - please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const btn = 'px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
  const primary = `${btn} text-white bg-primary-600 hover:bg-primary-700`;
  const secondary = `${btn} text-slate-700 bg-slate-100 hover:bg-slate-200`;
  const danger = `${btn} text-white bg-red-600 hover:bg-red-700`;

  const lifecycle = (
    [
      ['Check', script.checkScript, 'exit 0 = problem present, exit 1 = nothing to fix'],
      ['Fix', script.content, null],
      ['Verify', script.verifyScript, 'exit 0 = fixed'],
      ['Undo', script.undoScript, 'runs if the fix or verify fails'],
    ] as const
  ).filter(([, body]) => !!body);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 space-y-5">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ScriptKeyChip script={script} />
              <ScriptStatusBadge status={script.status} />
              <RiskBadge risk={script.riskLevel} />
              {script.requiresAdmin && <AdminBadge />}
              {script.autoRun && (
                <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
                  Auto-run
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{script.title}</h2>
            {script.description && <p className="mt-1 text-sm text-slate-500">{script.description}</p>}
          </div>

          {/* Review state */}
          {script.status === 'PENDING_REVIEW' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Submitted by <b>{script.submittedBy}</b>
              {script.submittedAt && ` on ${formatDate(script.submittedAt)}`}. It can’t run on devices until someone other than
              its author approves it.
            </div>
          )}
          {script.status === 'REJECTED' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Rejected by <b>{script.reviewedBy}</b>: {script.reviewNote || 'no reason given'}. Edit it and submit again.
            </div>
          )}
          {script.status === 'APPROVED' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Approved by <b>{script.reviewedBy}</b>
              {script.reviewedAt && ` on ${formatDate(script.reviewedAt)}`} and signed - agents verify this signature before running
              it.
              {script.contentHash && <span className="mt-1 block font-mono text-[11px] text-emerald-700/80">sha256 {script.contentHash.slice(0, 24)}…</span>}
            </div>
          )}
          {script.status === 'RETIRED' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Retired - a newer version replaced it, or it was taken out of service. It no longer runs.
            </div>
          )}

          {/* Lifecycle scripts */}
          <div className="space-y-3">
            {lifecycle.map(([name, body, help]) => (
              <div key={name}>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</span>
                  {help && <span className="text-[11px] text-slate-400">{help}</span>}
                </div>
                <pre className="bg-slate-900 text-white rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-64">
                  {body}
                </pre>
              </div>
            ))}
          </div>

          {/* Details */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Detail label="Fixes issues matching" value={script.issueMatch || '—'} />
            <Detail label="Timeout" value={`${script.timeoutSeconds}s per step`} />
            <Detail label="Supported OS" value={script.supportedOs || 'WINDOWS'} />
            <Detail label="Author" value={script.author || script.createdBy || '—'} />
            <Detail label="Last edited by" value={script.updatedBy || '—'} />
            <Detail label="Updated" value={script.updatedAt ? formatDate(script.updatedAt) : '—'} />
          </dl>

          {params.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Parameters</p>
              <div className="flex flex-wrap gap-2">
                {params.map((p) => (
                  <span key={p.name} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">
                    {p.name}: {p.type}
                    {p.required ? ' *' : ''}
                    {p.default !== undefined ? ` = ${String(p.default)}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Versions */}
          {versions.length > 1 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Versions</p>
              <div className="flex flex-wrap gap-2">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setScript(v)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                      v.id === script.id ? 'border-primary-300 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    v{v.version} <ScriptStatusBadge status={v.status} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Runs */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent runs</p>
            {runs === null ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : runs.length === 0 ? (
              <p className="text-xs text-slate-400">Not run on any device yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {runs.map((r) => (
                  <div key={r.id} className="px-3 py-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setOpenRun(openRun === r.id ? null : r.id)}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <RunStatusBadge status={r.status} />
                      <span className="font-mono text-slate-600">{r.agentId}</span>
                      <span className="text-slate-400">v{r.scriptVersion}</span>
                      <span className="text-slate-400">· {TRIGGER_LABEL[r.triggerType] ?? r.triggerType}</span>
                      <span className="ml-auto text-slate-400">{formatDate(r.createdAt)}</span>
                    </button>
                    {openRun === r.id && r.output && (
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
                        {r.output}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review note (approvers) */}
          {canApprove && script.status === 'PENDING_REVIEW' && !isAuthor && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Review note (required to reject)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="What you checked, or what needs to change"
              />
            </div>
          )}
          {canApprove && script.status === 'PENDING_REVIEW' && isAuthor && (
            <p className="text-xs text-slate-500">You wrote or last edited this version, so another admin or operator has to review it.</p>
          )}

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-xs text-slate-400">
              {script.articleId && onOpenArticle ? (
                <button onClick={() => onOpenArticle(script.articleId!)} className="font-medium text-primary-600 hover:text-primary-700">
                  View related article →
                </button>
              ) : (
                `Created ${formatDate(script.createdAt)}`
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && (script.status === 'DRAFT' || script.status === 'REJECTED') && (
                <button type="button" disabled={busy} onClick={() => act(() => knowledgeApi.submitScript(script.id))} className={primary}>
                  Submit for review
                </button>
              )}
              {canApprove && script.status === 'PENDING_REVIEW' && !isAuthor && (
                <>
                  <button
                    type="button"
                    disabled={busy || !note.trim()}
                    onClick={() => act(() => knowledgeApi.rejectScript(script.id, note.trim()))}
                    className={danger}
                    title={note.trim() ? undefined : 'Add a note saying why'}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => knowledgeApi.approveScript(script.id, note.trim() || undefined))}
                    className={`${btn} text-white bg-emerald-600 hover:bg-emerald-700`}
                  >
                    Approve &amp; sign
                  </button>
                </>
              )}
              {canApprove && script.status === 'APPROVED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('Retire this script? It will stop being offered and can no longer run on devices.'))
                      act(() => knowledgeApi.retireScript(script.id));
                  }}
                  className={secondary}
                >
                  Retire
                </button>
              )}
              {canManage && (
                <button type="button" onClick={() => onEdit(script)} className={secondary}>
                  {script.status === 'APPROVED' || script.status === 'RETIRED' ? 'Edit as new version' : 'Edit'}
                </button>
              )}
              {canApprove && (script.status === 'DRAFT' || script.status === 'REJECTED') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Delete ${script.scriptKey} v${script.version}?`))
                      act(async () => {
                        await knowledgeApi.deleteScript(script.id);
                        onClose();
                        return null;
                      });
                  }}
                  className={`${btn} text-red-600 hover:bg-red-50`}
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={onClose} className={secondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="truncate text-slate-700" title={value}>
        {value}
      </dd>
    </div>
  );
}
