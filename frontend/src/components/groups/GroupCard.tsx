import type { GroupSummary } from '../../types/group';
import { HEALTH_INFO, MODE_INFO, TYPE_INFO, initials } from './groupMeta';

const FALLBACK_COLOR = '#64748b';

function BoltIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

/** Online / offline split as a thin bar. Nothing to show for an empty group. */
function SplitBar({ online, offline }: { online: number; offline: number }) {
  const total = online + offline;
  if (total === 0) return <div className="h-1.5 rounded-full bg-slate-100" />;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <div className="bg-emerald-500" style={{ width: `${(online / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(offline / total) * 100}%` }} />
    </div>
  );
}

interface Props {
  group: GroupSummary;
  onOpen: (group: GroupSummary) => void;
  /** Fixed width for the dashboard strip; the Groups page lets the grid size it. */
  compact?: boolean;
}

export default function GroupCard({ group, onOpen, compact = false }: Props) {
  const color = group.color || FALLBACK_COLOR;
  const isDevice = group.groupType === 'DEVICE';
  const health = HEALTH_INFO[group.health ?? 'EMPTY'];
  const countLabel = isDevice ? (group.memberCount === 1 ? 'device' : 'devices') : group.memberCount === 1 ? 'person' : 'people';

  return (
    <button
      type="button"
      onClick={() => onOpen(group)}
      title={group.description || undefined}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-line bg-panel p-4 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
        compact ? 'w-[248px] shrink-0' : 'w-full'
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />

      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold text-white"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        >
          {initials(group.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-900">{group.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>{TYPE_INFO[group.groupType].plural}</span>
            <span className="text-slate-300">·</span>
            <span className={`inline-flex items-center gap-1 ${group.membershipMode === 'DYNAMIC' ? 'text-primary-600' : ''}`}>
              {group.membershipMode === 'DYNAMIC' && <BoltIcon />}
              {MODE_INFO[group.membershipMode].label}
            </span>
          </p>
        </div>
        {isDevice && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${health.ring} ${health.text}`}>
            {health.label}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-[26px] font-semibold leading-none text-slate-900">
          {group.memberCount}
          <span className="ml-1.5 text-[12px] font-normal text-slate-500">
            {countLabel}
          </span>
        </p>
        {isDevice && (group.openIssues ?? 0) > 0 && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 ring-1 ring-inset ring-red-200">
            {group.openIssues} open issue{group.openIssues === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {isDevice ? (
        <div className="space-y-1.5">
          <SplitBar online={group.online ?? 0} offline={group.offline ?? 0} />
          <p className="text-[11px] text-slate-500">
            {group.online ?? 0} online · {group.offline ?? 0} offline
          </p>
        </div>
      ) : (
        <p className="line-clamp-2 min-h-[2rem] text-[11px] text-slate-500">
          {group.description || TYPE_INFO[group.groupType].blurb}
        </p>
      )}
    </button>
  );
}
