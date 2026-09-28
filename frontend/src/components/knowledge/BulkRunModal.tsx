import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import * as knowledgeApi from '../../api/knowledgeApi';
import { getDevices } from '../../api/deviceApi';
import { subscribeTopic } from '../../api/liveBus';
import type { BulkRunResult, BulkTarget, Device, KbScriptRun, KnowledgeScript } from '../../types';
import { AdminBadge, RiskBadge, RunStatusBadge, ScriptParamsInputs } from './scriptMeta';
import { coerceParams, defaultParamValues, parseParams } from './scriptParams';

interface Props {
  script: KnowledgeScript;
  onClose: () => void;
}

type Step = 'pick' | 'params' | 'progress';

/**
 * Runs one approved fix on many devices at once: suggested devices (open
 * issue the fix matches) are pre-selected, any other device can be added,
 * parameters are entered once, and progress streams in live per device.
 */
export default function BulkRunModal({ script, onClose }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [targets, setTargets] = useState<BulkTarget[] | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [showAllDevices, setShowAllDevices] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkRunResult | null>(null);
  const [runs, setRuns] = useState<Map<number, KbScriptRun>>(new Map());

  const params = useMemo(() => parseParams(script.parametersSchema), [script.parametersSchema]);

  useEffect(() => {
    let cancelled = false;
    knowledgeApi.getBulkTargets(script.id).then((t) => {
      if (cancelled) return;
      setTargets(t);
      setSelected(new Set(t.map((x) => x.deviceId)));
    }).catch(() => !cancelled && setTargets([]));
    return () => {
      cancelled = true;
    };
  }, [script.id]);

  useEffect(() => {
    if (!showAllDevices || devices !== null) return;
    getDevices().then(setDevices).catch(() => setDevices([]));
  }, [showAllDevices, devices]);

  // Live progress once running: seed from the batch endpoint, then update from pushes.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    knowledgeApi.getBulkBatch(result.batchId).then((list) => {
      if (cancelled) return;
      setRuns((prev) => {
        const next = new Map(prev);
        list.forEach((r) => {
          const q = result.queued.find((x) => x.runId === r.id);
          if (q) next.set(q.deviceId, r);
        });
        return next;
      });
    });
    const unsubscribe = subscribeTopic(`/topic/kb-batches/${result.batchId}`, (data) => {
      const r = data as KbScriptRun;
      const q = result.queued.find((x) => x.runId === r.id);
      if (!q) return;
      setRuns((prev) => new Map(prev).set(q.deviceId, r));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [result]);

  const deviceById = useMemo(() => new Map((devices ?? []).map((d) => [d.id, d])), [devices]);
  const targetIds = useMemo(() => new Set((targets ?? []).map((t) => t.deviceId)), [targets]);
  const visibleDevices = useMemo(() => {
    if (!showAllDevices || !devices) return [];
    const q = query.trim().toLowerCase();
    return devices.filter((d) => !targetIds.has(d.id) && (!q || d.hostname.toLowerCase().includes(q) || d.agentId.toLowerCase().includes(q)));
  }, [devices, showAllDevices, query, targetIds]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const goToParams = () => {
    if (selected.size === 0) {
      setError('Pick at least one device.');
      return;
    }
    setError(null);
    setParamValues(defaultParamValues(params));
    setStep('params');
  };

  const submit = async () => {
    const coerced = coerceParams(params, paramValues);
    if ('error' in coerced) {
      setError(coerced.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await knowledgeApi.runBulk(script.id, [...selected], coerced.values);
      setResult(r);
      setStep('progress');
    } catch (err) {
      setError(knowledgeApi.apiError(err, 'Could not start the run.'));
    } finally {
      setSubmitting(false);
    }
  };

  const btn = 'px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
  const primary = `${btn} text-white bg-primary-600 hover:bg-primary-700`;
  const secondary = `${btn} text-slate-700 bg-slate-100 hover:bg-slate-200`;

  const finishedCount = result ? [...runs.values()].filter((r) => r.status !== 'QUEUED').length : 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run on multiple devices</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{script.title}</h2>
            <p className="text-xs text-slate-500">
              {script.scriptKey} v{script.version}
              {script.requiresAdmin && <span className="ml-2"><AdminBadge /></span>}
              <span className="ml-2"><RiskBadge risk={script.riskLevel} /></span>
            </p>
          </div>

          {step === 'pick' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {targets === null
                  ? 'Looking for devices with a matching open issue…'
                  : targets.length === 0
                    ? 'No device currently has an open issue this fix matches - pick devices manually below.'
                    : `${targets.length} device${targets.length === 1 ? '' : 's'} have a matching open issue and are pre-selected.`}
              </p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {(targets ?? []).map((t) => (
                  <label key={t.deviceId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(t.deviceId)} onChange={() => toggle(t.deviceId)} className="h-4 w-4 accent-sky-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-800">{t.hostname}</span>
                      <span className="block truncate text-[11px] text-amber-700">Suggested: {t.matchingIssue}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">{t.status}</span>
                  </label>
                ))}
                {targets !== null && targets.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-400">No suggested devices.</p>}
              </div>

              {!showAllDevices ? (
                <button type="button" onClick={() => setShowAllDevices(true)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  + Add other devices…
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search devices by hostname…"
                    className="w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {devices === null ? (
                      <p className="px-2 py-3 text-center text-xs text-slate-400">Loading devices…</p>
                    ) : visibleDevices.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-slate-400">No matching devices.</p>
                    ) : (
                      visibleDevices.map((d) => (
                        <label key={d.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                          <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="h-4 w-4 accent-sky-600" />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800">{d.hostname}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{d.os}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500">{selected.size} device{selected.size === 1 ? '' : 's'} selected.</p>
            </div>
          )}

          {step === 'params' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Running on {selected.size} device{selected.size === 1 ? '' : 's'}. Each device's user still sees the approval
                window before anything runs.
              </p>
              <ScriptParamsInputs params={params} values={paramValues} onChange={setParamValues} />
            </div>
          )}

          {step === 'progress' && result && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {finishedCount} of {result.queued.length} finished · batch <span className="font-mono text-[11px]">{result.batchId}</span>
              </p>
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {result.queued.map((q) => {
                  const run = runs.get(q.deviceId);
                  return (
                    <div key={q.deviceId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800">
                        {deviceById.get(q.deviceId)?.hostname ?? q.hostname ?? `Device #${q.deviceId}`}
                      </span>
                      <RunStatusBadge status={run?.status ?? 'QUEUED'} />
                    </div>
                  );
                })}
              </div>
              {result.skipped.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Skipped</p>
                  <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {result.skipped.map((s) => (
                      <div key={s.deviceId} className="flex items-center gap-2.5 px-2 py-1 text-[12px]">
                        <span className="min-w-0 flex-1 truncate text-slate-700">{s.hostname ?? `Device #${s.deviceId}`}</span>
                        <span className="shrink-0 text-slate-500">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            {step === 'pick' && (
              <>
                <button type="button" onClick={onClose} className={secondary}>Cancel</button>
                <button type="button" onClick={goToParams} className={primary}>
                  Continue with {selected.size} device{selected.size === 1 ? '' : 's'}
                </button>
              </>
            )}
            {step === 'params' && (
              <>
                <button type="button" onClick={() => setStep('pick')} className={secondary}>Back</button>
                <button type="button" disabled={submitting} onClick={() => void submit()} className={primary}>
                  {submitting ? 'Starting…' : `Run on ${selected.size} device${selected.size === 1 ? '' : 's'}`}
                </button>
              </>
            )}
            {step === 'progress' && (
              <button type="button" onClick={onClose} className={primary}>Close</button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
