import { useEffect, useMemo, useRef, useState } from 'react';
import * as knowledgeApi from '../../api/knowledgeApi';
import { getDeviceByAgentId } from '../../api/deviceApi';
import { isFinished, runKbScript, waitForCommandResult, type AgentCommand } from '../../api/commandApi';
import type { KnowledgeScript } from '../../types/knowledge';
import { describeStatus, formatOutput } from '../../utils/agentCommands';
import { AdminBadge, RiskBadge, ScriptKeyChip, ScriptParamsInputs } from './scriptMeta';
import { coerceParams, defaultParamValues, parseParams } from './scriptParams';

/**
 * Approved KB fixes for one issue: the ones whose issue match fits it first,
 * then any other approved fix. Running one queues the signed version on the
 * issue's device, linked to the issue, and follows it to its outcome.
 */
export default function IssueFixesPanel({ issueId, agentId }: { issueId: number; agentId?: string }) {
  const [suggested, setSuggested] = useState<KnowledgeScript[] | null>(null);
  const [approved, setApproved] = useState<KnowledgeScript[]>([]);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [selected, setSelected] = useState<KnowledgeScript | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [tracked, setTracked] = useState<AgentCommand | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    knowledgeApi.getScriptSuggestions(issueId).then((s) => !cancelled && setSuggested(s)).catch(() => !cancelled && setSuggested([]));
    knowledgeApi.getApprovedScripts().then((s) => !cancelled && setApproved(s)).catch(() => {});
    if (agentId) getDeviceByAgentId(agentId).then((d) => !cancelled && setDeviceId(d.id)).catch(() => {});
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [issueId, agentId]);

  const others = useMemo(
    () => approved.filter((a) => !(suggested ?? []).some((s) => s.id === a.id)),
    [approved, suggested],
  );
  const params = useMemo(() => parseParams(selected?.parametersSchema), [selected]);

  const choose = (s: KnowledgeScript | null) => {
    setSelected(s);
    setValues(defaultParamValues(parseParams(s?.parametersSchema)));
    setError(null);
    setTracked(null);
  };

  const run = async () => {
    if (!selected || !deviceId) return;
    const coerced = coerceParams(params, values);
    if ('error' in coerced) {
      setError(coerced.error);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const queued = await runKbScript(deviceId, selected.id, coerced.values, issueId);
      setTracked(queued);
      const controller = new AbortController();
      abortRef.current = controller;
      await waitForCommandResult(deviceId, queued.commandId, { onUpdate: setTracked, signal: controller.signal, agentId });
    } catch (err) {
      setError(knowledgeApi.apiError(err, 'Could not send that fix to the device.'));
    } finally {
      setSending(false);
    }
  };

  if (!agentId) {
    return <p className="px-5 py-3 text-xs text-slate-500">This issue has no linked device, so fixes can’t be run from here.</p>;
  }

  const row = (s: KnowledgeScript, isSuggested: boolean) => (
    <button
      key={s.id}
      type="button"
      onClick={() => choose(selected?.id === s.id ? null : s)}
      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
        selected?.id === s.id ? 'border-primary-300 bg-primary-50' : 'border-line bg-white hover:border-line-strong'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-800">{s.title}</span>
        <ScriptKeyChip script={s} />
      </span>
      {isSuggested && <span className="shrink-0 text-[11px] font-medium text-amber-700">Suggested</span>}
      <RiskBadge risk={s.riskLevel} />
      {s.requiresAdmin && <AdminBadge />}
    </button>
  );

  return (
    <div className="space-y-3 border-t border-line px-5 py-4">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Knowledge-base fixes</p>
      {suggested === null ? (
        <p className="text-xs text-slate-400">Looking for matching fixes…</p>
      ) : suggested.length === 0 ? (
        <p className="text-xs text-slate-500">No approved fix matches this issue yet.</p>
      ) : (
        <div className="space-y-1.5">{suggested.map((s) => row(s, true))}</div>
      )}
      {others.length > 0 && (
        <select
          value=""
          onChange={(e) => choose(others.find((o) => o.id === Number(e.target.value)) ?? null)}
          className="h-8 w-full rounded-lg border border-line bg-panel px-2 text-[12px] text-slate-700"
          aria-label="Pick another approved fix"
        >
          <option value="">Another approved fix…</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title} ({o.scriptKey} v{o.version})
            </option>
          ))}
        </select>
      )}
      {selected && !suggested?.some((s) => s.id === selected.id) && row(selected, false)}

      {selected && !tracked && (
        <div className="space-y-3 rounded-lg border border-line bg-slate-50 p-3">
          <ScriptParamsInputs params={params} values={values} onChange={setValues} />
          <p className="text-[11px] text-slate-500">
            The user at the device sees this fix, its version and risk, and must approve it
            {selected.requiresAdmin ? ' - plus one Windows admin prompt' : ''}.
          </p>
          <button
            type="button"
            onClick={() => void run()}
            disabled={sending || !deviceId}
            className="w-full rounded-lg bg-primary-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Run on device'}
          </button>
        </div>
      )}

      {tracked && (
        <div className="space-y-2 rounded-lg border border-line bg-white p-3">
          <p className="text-[13px] font-medium text-slate-800">{selected?.title}</p>
          <p className="text-[12px] text-slate-500">{describeStatus(tracked.status, true)}</p>
          {isFinished(tracked.status) && (
            <pre
              className={`max-h-56 overflow-auto whitespace-pre-wrap rounded border px-2 py-1.5 font-mono text-[11px] ${
                tracked.status !== 'COMPLETED' ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-slate-50 text-slate-700'
              }`}
            >
              {formatOutput(tracked.result)}
            </pre>
          )}
        </div>
      )}
      {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}
    </div>
  );
}
