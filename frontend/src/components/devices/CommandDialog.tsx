import { useState, type FormEvent } from 'react';
import { queueCommand } from '../../api/commandApi';

interface CommandDialogProps {
  agentId: string;
  agentHostname: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMAND_TYPES = [
  { value: 'SCRIPT', label: 'Run script', description: 'Execute a command or script' },
  { value: 'RESTART', label: 'Restart service', description: 'Restart a Windows service' },
  { value: 'CLEANUP', label: 'Cleanup', description: 'Disk / temp cleanup tasks' },
  { value: 'UPDATE', label: 'Update', description: 'Trigger agent update' },
  { value: 'DIAGNOSE', label: 'Diagnose', description: 'Run diagnostic checks' },
];

const PRESET_ACTIONS: Record<string, string[]> = {
  SCRIPT: [
    'tasklist /fi "CPU gt 50"',
    'sfc /scannow',
    'DISM /Online /Cleanup-Image /RestoreHealth',
    'ipconfig /flushdns',
    'netsh winsock reset',
  ],
  RESTART: [
    'Restart-Service -Name "Spooler"',
    'Restart-Service -Name "wuauserv"',
    'Restart-Computer -Force',
  ],
  CLEANUP: [
    'cleanmgr /sagerun:1',
    'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force',
    'Clear-RecycleBin -Force',
  ],
  UPDATE: [
    'Update-DexAgent',
    'winget upgrade DEXResolveAgent',
  ],
  DIAGNOSE: [
    'Get-EventLog -LogName System -EntryType Error -Newest 10',
    'Get-Process | Sort-Object CPU -Descending | Select-Object -First 10',
    'Get-Service | Where-Object {$_.Status -ne "Running"}',
  ],
};

const fieldClass =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2.5 font-mono text-[13px] text-slate-800 placeholder:text-slate-400 transition-all focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export default function CommandDialog({ agentId, agentHostname, isOpen, onClose, onSuccess }: CommandDialogProps) {
  const [commandType, setCommandType] = useState('SCRIPT');
  const [action, setAction] = useState('');
  const [parameters, setParameters] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!action.trim()) {
      setError('Please enter an action');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await queueCommand(agentId, {
        type: commandType,
        action: action.trim(),
        parameters: parameters.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch {
      setError('Failed to queue command. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    setAction(preset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_40px_120px_-20px_rgba(15,23,42,0.3)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line bg-slate-50 px-6 py-5">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-400">
              Remote action
            </p>
            <h2 className="mt-1.5 font-display text-[17px] font-semibold text-slate-900">Send command</h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
              {agentHostname} · {agentId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/30">
              <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
            <h3 className="mt-4 font-display text-[16px] font-semibold text-slate-900">Command queued</h3>
            <p className="mt-1 text-[13px] text-slate-500">The agent will execute this command shortly.</p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
            {/* Command Type */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Command type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COMMAND_TYPES.map((type) => {
                  const active = commandType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setCommandType(type.value);
                        setAction('');
                      }}
                      className={`rounded-xl border p-3 text-left transition-all duration-150 ${
                        active
                          ? 'border-primary-300 bg-primary-50 ring-1 ring-inset ring-primary-300'
                          : 'border-line bg-white hover:border-line-strong'
                      }`}
                    >
                      <div className={`text-[13px] font-medium ${active ? 'text-primary-700' : 'text-slate-600'}`}>
                        {type.label}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{type.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Action / command
              </label>
              <textarea
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="Enter command to execute…"
                className={`${fieldClass} resize-none`}
                rows={3}
              />
            </div>

            {/* Preset Actions */}
            {PRESET_ACTIONS[commandType] && (
              <div>
                <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  Quick actions
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_ACTIONS[commandType].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="max-w-full truncate rounded-md border border-line bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600 transition-colors hover:border-primary-300 hover:text-slate-900"
                      title={preset}
                    >
                      {preset.length > 34 ? `${preset.substring(0, 34)}…` : preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Parameters (optional) */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Parameters <span className="normal-case text-slate-600">(optional)</span>
              </label>
              <input
                type="text"
                value={parameters}
                onChange={(e) => setParameters(e.target.value)}
                placeholder="Additional parameters…"
                className={fieldClass}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-line px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !action.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Queueing…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" />
                    </svg>
                    Send command
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
