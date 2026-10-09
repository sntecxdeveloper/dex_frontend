import { useState } from 'react';
import * as knowledgeApi from '../../api/knowledgeApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import type { KnowledgeScript } from '../../types/knowledge';

const HOURS = [1, 3, 6, 12, 24, 72, 168];

/** Why this fix cannot be checked automatically, or null when it can. */
export function detectionBlocker(script: KnowledgeScript): string | null {
  if (script.status !== 'APPROVED') return 'Only an approved fix can be checked automatically.';
  if (script.riskLevel !== 'LOW') return 'Only a low-risk fix can be checked automatically.';
  if (script.audience !== 'USER') return 'Only a fix available to everyone can be checked automatically.';
  if (!script.checkScript?.trim()) return 'The fix needs a check step to be checked automatically.';
  const schema = (script.parametersSchema ?? '').replace(/\s/g, '');
  if (schema && schema !== '[]') return 'A fix that asks for values cannot be checked automatically.';
  return null;
}

/**
 * What the assistant will say before the fix runs, and the admin's switch for "agents check this fix by themselves": the agent runs
 * only the fix's check step now and then and, when it says the fix is needed, offers it to the person (and groups many devices).
 */
export default function ScriptDetectionPanel({ script, onSaved }: { script: KnowledgeScript; onSaved: (updated: KnowledgeScript) => void }) {
  const isAdmin = useAppSelector((s) => s.auth.user?.role) === 'ROLE_ADMIN';
  const [enabled, setEnabled] = useState(!!script.detectEnabled);
  const [hours, setHours] = useState(script.detectIntervalHours ?? 6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocker = detectionBlocker(script);
  const dirty = enabled !== !!script.detectEnabled || hours !== (script.detectIntervalHours ?? 6);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await knowledgeApi.setScriptDetection(script.id, enabled, hours));
    } catch (err) {
      setError(knowledgeApi.apiError(err, 'That didn’t work - please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {script.previewText && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="text-xs font-semibold text-sky-900">What will happen (shown to the person before they say yes)</div>
          <p className="mt-1 whitespace-pre-line text-xs text-sky-900">{script.previewText}</p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-800">Check automatically</div>
            <p className="mt-0.5 max-w-xl text-[11px] text-slate-500">
              Agents run only this fix&rsquo;s check step now and then, without asking, and offer the fix when it says the fix is needed. When several
              devices need it at once, one alert and one ticket stand for all of them. Nothing is ever changed by the check.
            </p>
          </div>
          {blocker ? (
            <span className="text-[11px] text-slate-400">{blocker}</span>
          ) : isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-sky-600" />
                {enabled ? 'On' : 'Off'}
              </label>
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                disabled={!enabled}
                aria-label="How often"
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-40"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    every {h === 168 ? 'week' : h === 24 ? 'day' : `${h} hour${h > 1 ? 's' : ''}`}
                  </option>
                ))}
              </select>
              <button
                onClick={save}
                disabled={!dirty || busy}
                className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500">{script.detectEnabled ? `On, every ${script.detectIntervalHours ?? 6} hours` : 'Off'} (an admin can change this)</span>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
