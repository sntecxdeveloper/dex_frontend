import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';

interface TerminalEntry {
  command: string;
  output: string;
  success: boolean;
  timestamp: Date;
  executionTimeMs?: number;
}

interface RemoteTerminalProps {
  agentId: string;
  onExecute: (command: string) => Promise<{ success: boolean; output: string; executionTimeMs?: number }>;
}

export const RemoteTerminal: React.FC<RemoteTerminalProps> = ({ agentId, onExecute }) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<TerminalEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isExecuting) return;

    const cmd = command.trim();
    setCommand('');
    setIsExecuting(true);

    // Add to command history
    setCommandHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);

    try {
      const result = await onExecute(cmd);
      setHistory((prev) => [
        ...prev,
        {
          command: cmd,
          output: result.output,
          success: result.success,
          timestamp: new Date(),
          executionTimeMs: result.executionTimeMs,
        },
      ]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        {
          command: cmd,
          output: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          success: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#070b14]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line bg-white/[0.02] px-4 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-mono text-xs text-slate-400">Remote terminal</span>
        <span className="font-mono text-xs text-slate-600">—</span>
        <span className="truncate font-mono text-xs text-slate-500">{agentId}</span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-slate-600">queued via agent channel</span>
      </div>

      {/* Output */}
      <div ref={outputRef} className="flex-1 overflow-y-auto p-4 font-mono text-[12.5px] leading-relaxed">
        {history.length === 0 && (
          <div className="space-y-1">
            <p className="text-slate-600"># Commands are queued to the DEX agent and executed on the remote machine.</p>
            <p className="text-slate-500">Type a command and press <span className="rounded border border-line bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-300">Enter</span> to execute. ↑/↓ cycles history.</p>
          </div>
        )}
        {history.map((entry, idx) => (
          <div key={idx} className="mb-3">
            <div className="flex items-center gap-2">
              <span className="select-none text-emerald-400">❯</span>
              <span className="text-slate-100">{entry.command}</span>
              {entry.executionTimeMs !== undefined && (
                <span className="text-xs text-slate-600">({entry.executionTimeMs}ms)</span>
              )}
            </div>
            <pre
              className={`mt-1 whitespace-pre-wrap pl-5 text-[12.5px] ${
                entry.success ? 'text-slate-400' : 'text-red-400'
              }`}
            >
              {entry.output}
            </pre>
          </div>
        ))}
        {isExecuting && (
          <div className="flex items-center gap-2 pl-5 text-amber-300">
            <span className="h-3 w-3 animate-spin rounded-full border border-amber-400/40 border-t-amber-300" />
            executing…
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line bg-white/[0.02] px-3 py-2.5">
        <span className="select-none font-mono text-sm text-emerald-400">❯</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Get-Service | Where-Object {$_.Status -ne 'Running'}"
          disabled={isExecuting}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent font-mono text-[13px] text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-50"
          autoFocus
        />
        <button
          type="submit"
          disabled={isExecuting || !command.trim()}
          className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-400 disabled:opacity-40"
        >
          Run
        </button>
      </form>
    </div>
  );
};

export default RemoteTerminal;
