import type { SystemEvent } from '../../types/device';

interface EventLogTabProps {
  events: SystemEvent[];
  loading?: boolean;
}

const levelTone: Record<string, { chip: string; dot: string }> = {
  Critical: { chip: 'bg-red-500/10 text-red-300 ring-red-400/25', dot: 'bg-red-400' },
  Error: { chip: 'bg-red-500/10 text-red-300 ring-red-400/25', dot: 'bg-red-400' },
  Warning: { chip: 'bg-amber-500/10 text-amber-300 ring-amber-400/25', dot: 'bg-amber-400' },
  Information: { chip: 'bg-sky-500/10 text-sky-300 ring-sky-400/25', dot: 'bg-sky-400' },
};

function formatTime(timeStr: string): string {
  try {
    return new Date(timeStr).toLocaleString();
  } catch {
    return timeStr;
  }
}

export const EventLogTab: React.FC<EventLogTabProps> = ({ events, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <p className="text-sm text-slate-500">No recent events</p>
        <p className="mt-1 text-xs text-slate-600">Windows event log entries will appear here as the agent reports them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-5">
      {events.map((event, idx) => {
        const tone = levelTone[event.level] || levelTone.Information;
        return (
          <div
            key={`${event.recordId || idx}`}
            className="rounded-lg border border-line bg-white/[0.02] px-4 py-3 transition-colors hover:border-line-strong"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tone.chip}`}>
                <span className={`h-1 w-1 rounded-full ${tone.dot}`} />
                {event.level}
              </span>
              <span className="font-mono text-xs text-slate-400">{event.source}</span>
              <span className="text-[11px] text-slate-600">Log: {event.logName}</span>
              <span className="ml-auto font-mono text-[11px] text-slate-500">{formatTime(event.timeCreated)}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-slate-300">{event.message}</p>
          </div>
        );
      })}
    </div>
  );
};

export default EventLogTab;
