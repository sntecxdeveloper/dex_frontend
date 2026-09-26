import { useState } from 'react';
import type { ScriptParameter, ScriptParameterType, ScriptRisk } from '../../types/knowledge';
import type { GovernanceForm } from './scriptGovernance';

const input =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400';
const label = 'block text-xs font-medium text-slate-500 mb-1';
const code =
  'w-full px-3 py-2 rounded-lg border border-slate-700 bg-black text-xs font-mono text-white placeholder-slate-500 focus:outline-none resize-y';

/** Right-sidebar settings: identity, risk, admin, timeout, issue matching, auto-run. */
export function ScriptSettingsFields({
  value,
  onChange,
  keyEditable,
}: {
  value: GovernanceForm;
  onChange: (next: GovernanceForm) => void;
  keyEditable: boolean;
}) {
  const set = <K extends keyof GovernanceForm>(k: K, v: GovernanceForm[K]) => {
    const next = { ...value, [k]: v };
    // Auto-run is only allowed for low-risk scripts without admin rights.
    if ((k === 'riskLevel' && v !== 'LOW') || (k === 'requiresAdmin' && v)) next.autoRun = false;
    onChange(next);
  };
  const autoRunAllowed = value.riskLevel === 'LOW' && !value.requiresAdmin;

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>Script key</label>
        <input
          type="text"
          value={value.scriptKey}
          onChange={(e) => set('scriptKey', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '-'))}
          disabled={!keyEditable}
          placeholder="Generated from the title"
          className={`${input} font-mono disabled:bg-slate-50 disabled:text-slate-500`}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          {keyEditable ? 'Stable name the agent shows, e.g. CLEAR-DNS-CACHE.' : 'The key stays the same across versions.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Risk</label>
          <select value={value.riskLevel} onChange={(e) => set('riskLevel', e.target.value as ScriptRisk)} className={input}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <div>
          <label className={label}>Timeout (s)</label>
          <input
            type="number"
            min={5}
            max={3600}
            value={value.timeoutSeconds}
            onChange={(e) => set('timeoutSeconds', Number(e.target.value) || 120)}
            className={input}
          />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={value.requiresAdmin}
          onChange={(e) => set('requiresAdmin', e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-sky-600"
        />
        <span>
          Needs administrator rights
          <span className="block text-[11px] text-slate-400">The user approves one Windows UAC prompt for the whole run.</span>
        </span>
      </label>
      <div>
        <label className={label}>Fixes issues matching</label>
        <input
          type="text"
          value={value.issueMatch}
          onChange={(e) => set('issueMatch', e.target.value)}
          placeholder="e.g. DISK, temp"
          className={input}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Issue categories (CPU, MEMORY, DISK, NETWORK, SYSTEM, HEALTH) or words in the issue title, comma-separated.
        </p>
      </div>
      <label className={`flex items-start gap-2 text-sm ${autoRunAllowed ? 'text-slate-700' : 'text-slate-400'}`}>
        <input
          type="checkbox"
          checked={value.autoRun}
          disabled={!autoRunAllowed}
          onChange={(e) => set('autoRun', e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-sky-600"
        />
        <span>
          Offer automatically on matching issues
          <span className="block text-[11px] text-slate-400">
            {autoRunAllowed
              ? 'Queued when a matching issue opens; the user still confirms.'
              : 'Only for low-risk scripts that don’t need admin rights.'}
          </span>
        </span>
      </label>
    </div>
  );
}

const TYPES: ScriptParameterType[] = ['string', 'int', 'bool', 'choice'];

/** Parameter editor plus the optional check / verify / undo scripts. */
export function ScriptLifecycleFields({ value, onChange }: { value: GovernanceForm; onChange: (next: GovernanceForm) => void }) {
  const [open, setOpen] = useState(
    !!(value.checkScript || value.verifyScript || value.undoScript || value.params.length),
  );
  const setParam = (i: number, patch: Partial<ScriptParameter>) =>
    onChange({ ...value, params: value.params.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-slate-900">Parameters &amp; safety steps</span>
          <span className="block text-xs text-slate-500">
            Typed inputs, and check → fix → verify → undo so the agent can confirm the fix worked.
          </span>
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="space-y-5 border-t border-slate-100 px-4 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Parameters <span className="font-normal text-slate-400">- declare them in the script with param(...)</span>
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...value, params: [...value.params, { name: '', type: 'string' }] })}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                + Add parameter
              </button>
            </div>
            {value.params.length === 0 && <p className="text-xs text-slate-400">No parameters.</p>}
            <div className="space-y-2">
              {value.params.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                  <input
                    value={p.name}
                    onChange={(e) => setParam(i, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                    placeholder="Name"
                    className={`${input} col-span-3 font-mono`}
                  />
                  <input
                    value={p.label ?? ''}
                    onChange={(e) => setParam(i, { label: e.target.value })}
                    placeholder="Label"
                    className={`${input} col-span-3`}
                  />
                  <select
                    value={p.type}
                    onChange={(e) => setParam(i, { type: e.target.value as ScriptParameterType })}
                    className={`${input} col-span-2`}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    value={p.default === undefined ? '' : String(p.default)}
                    onChange={(e) => setParam(i, { default: e.target.value })}
                    placeholder="Default"
                    className={`${input} col-span-3`}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, params: value.params.filter((_, idx) => idx !== i) })}
                    className="col-span-1 text-slate-400 hover:text-red-500"
                    aria-label="Remove parameter"
                  >
                    ✕
                  </button>
                  <label className="col-span-3 flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!p.required}
                      onChange={(e) => setParam(i, { required: e.target.checked })}
                      className="h-3.5 w-3.5 accent-sky-600"
                    />
                    Required
                  </label>
                  {p.type === 'choice' && (
                    <input
                      value={(p.options ?? []).join(', ')}
                      onChange={(e) =>
                        setParam(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })
                      }
                      placeholder="Options, comma-separated"
                      className={`${input} col-span-9`}
                    />
                  )}
                  {p.type === 'int' && (
                    <>
                      <input
                        type="number"
                        value={p.min ?? ''}
                        onChange={(e) => setParam(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="Min"
                        className={`${input} col-span-3`}
                      />
                      <input
                        type="number"
                        value={p.max ?? ''}
                        onChange={(e) => setParam(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="Max"
                        className={`${input} col-span-3`}
                      />
                    </>
                  )}
                  {p.type === 'string' && (
                    <input
                      value={p.pattern ?? ''}
                      onChange={(e) => setParam(i, { pattern: e.target.value })}
                      placeholder="Allowed pattern (regex), e.g. ^[A-Za-z0-9_.-]+$"
                      className={`${input} col-span-9 font-mono`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {(
            [
              ['checkScript', 'Check (optional)', 'Runs first. exit 0 = the problem is there, exit 1 = nothing to fix (stops).'],
              ['verifyScript', 'Verify (optional)', 'Runs after the fix. exit 0 = fixed; anything else = not fixed.'],
              ['undoScript', 'Undo (optional)', 'Runs if the fix or verify fails, to put things back.'],
            ] as const
          ).map(([key, title, help]) => (
            <div key={key}>
              <label className={label}>{title}</label>
              <textarea
                value={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                rows={3}
                spellCheck={false}
                className={code}
                placeholder={key === 'verifyScript' ? "if ((Get-Service Spooler).Status -ne 'Running') { exit 1 }" : ''}
              />
              <p className="mt-1 text-[11px] text-slate-400">{help} Gets the same parameters as the fix.</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
