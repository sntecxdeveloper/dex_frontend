import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import { Skeleton } from '../ui/Skeleton';
import GroupFormModal from './GroupFormModal';
import { HEALTH_INFO, KINDS, KIND_INFO, canEditGroups, initials } from './groupMeta';
import type { GroupKind, GroupSummary } from '../../types/group';

type KindFilter = 'ALL' | GroupKind;
type Quick = 'ALL' | 'ATTENTION' | 'ISSUES' | 'EMPTY';

const REFRESH_MS = 60_000;
const SHOWN = 8;
const FALLBACK_COLOR = '#64748b';

const QUICK: { id: Quick; label: string; match: (g: GroupSummary) => boolean }[] = [
  { id: 'ALL', label: 'All', match: () => true },
  { id: 'ATTENTION', label: 'Needs attention', match: (g) => g.health === 'CRITICAL' || g.health === 'WARNING' },
  { id: 'ISSUES', label: 'Open issues', match: (g) => g.openIssues > 0 },
  { id: 'EMPTY', label: 'No devices', match: (g) => g.deviceCount === 0 },
];

/**
 * The dashboard's group section, under the greeting: a compact list of organisation groups with filters above it
 * (search, kind, and quick filters), the same way the Groups page filters. One row per group; clicking a row opens it.
 */
export default function GroupStrip() {
  const navigate = useNavigate();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<KindFilter>('ALL');
  const [quick, setQuick] = useState<Quick>('ALL');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    getGroups()
      .then((g) => {
        setGroups(g);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const kindsPresent = useMemo(() => KINDS.filter((k) => (groups ?? []).some((g) => g.kind === k)), [groups]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rule = QUICK.find((x) => x.id === quick) ?? QUICK[0];
    const list = (groups ?? []).filter((g) => {
      if (kind !== 'ALL' && g.kind !== kind) return false;
      if (!rule.match(g)) return false;
      if (!q) return true;
      return [g.name, g.description, g.location, g.region, KIND_INFO[g.kind].label].some((t) => (t ?? '').toLowerCase().includes(q));
    });
    // Groups that need attention first, then the biggest.
    const rank = (g: GroupSummary) => (g.health === 'CRITICAL' ? 0 : g.health === 'WARNING' ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b) || b.deviceCount - a.deviceCount || a.name.localeCompare(b.name));
  }, [groups, kind, quick, search]);

  const total = groups?.length ?? 0;
  const filtered = kind !== 'ALL' || quick !== 'ALL' || search.trim() !== '';
  const rows = showAll ? visible : visible.slice(0, SHOWN);

  const clear = () => {
    setKind('ALL');
    setQuick('ALL');
    setSearch('');
  };

  return (
    <section aria-label="Groups" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">Groups</h2>
          {groups && <span className="text-xs text-slate-400">{filtered ? `${visible.length} of ${total}` : total}</span>}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              + New group
            </button>
          )}
          <button type="button" onClick={() => navigate('/groups')} className="text-xs font-medium text-primary-600 hover:text-primary-700">
            View all groups →
          </button>
        </div>
      </div>

      {/* Filters sit above the list */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups"
            aria-label="Search groups"
            className="h-8 w-48 rounded-lg border border-line bg-white px-2.5 text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          {kindsPresent.length > 1 && (
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as KindFilter)}
              aria-label="Kind"
              className="h-8 rounded-lg border border-line bg-white px-2.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="ALL">All kinds</option>
              {kindsPresent.map((k) => (
                <option key={k} value={k}>
                  {KIND_INFO[k].plural} ({(groups ?? []).filter((g) => g.kind === k).length})
                </option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick filters">
            {QUICK.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setQuick(x.id)}
                aria-pressed={quick === x.id}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors ${
                  quick === x.id ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-600 ring-line hover:bg-slate-50'
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
          {filtered && (
            <button type="button" onClick={clear} className="text-[11px] font-medium text-slate-500 hover:text-slate-700">
              Clear
            </button>
          )}
        </div>
      )}

      {groups === null && !failed ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : failed && groups === null ? (
        <div className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm text-slate-500">
          Groups could not be loaded.
          <button type="button" onClick={load} className="text-xs font-medium text-primary-600 hover:text-primary-700">
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-panel px-5 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">{total === 0 ? 'No groups yet' : 'No group matches these filters'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {total === 0
              ? 'A group is a department, site or team. Put its devices, technicians and users inside to see their health together and act on them at once.'
              : 'Try a different search or clear the filters.'}
          </p>
          {canEdit && total === 0 ? (
            <button type="button" onClick={() => setCreating(true)} className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700">
              Create the first group
            </button>
          ) : (
            total > 0 && (
              <button type="button" onClick={clear} className="mt-3 text-xs font-medium text-primary-600 hover:text-primary-700">
                Clear filters
              </button>
            )
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-line bg-slate-50/70 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Group</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Devices</th>
                  <th className="px-3 py-2 text-right">Technicians</th>
                  <th className="px-3 py-2 text-right">Users</th>
                  <th className="px-3 py-2 text-right">Issues</th>
                  <th className="px-3 py-2">Health</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const health = HEALTH_INFO[g.health];
                  const color = g.color || FALLBACK_COLOR;
                  return (
                    <tr
                      key={g.id}
                      onClick={() => navigate(`/groups/${g.id}`)}
                      className="cursor-pointer border-b border-line/60 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/groups/${g.id}`);
                          }}
                          className="flex min-w-0 items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white" style={{ backgroundColor: color }} aria-hidden="true">
                            {initials(g.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">{g.name}</span>
                            {(g.location || g.region) && (
                              <span className="block truncate text-[11px] text-slate-500">{[g.location, g.region].filter(Boolean).join(' · ')}</span>
                            )}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{KIND_INFO[g.kind].label}</td>
                      <td className="px-3 py-2">
                        {g.deviceCount === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="w-28">
                            <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                              <div className="bg-emerald-500" style={{ width: `${(g.online / g.deviceCount) * 100}%` }} />
                              <div className="bg-amber-400" style={{ width: `${(g.offline / g.deviceCount) * 100}%` }} />
                            </div>
                            <span className="mt-1 block text-[11px] text-slate-500">
                              {g.online} / {g.deviceCount} online
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{g.technicianCount}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{g.userCount}</td>
                      <td className={`px-3 py-2 text-right font-mono ${g.openIssues > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{g.openIssues}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${health.ring} ${health.text}`}>{health.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visible.length > SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full border-t border-line/70 bg-slate-50/60 px-4 py-2 text-center text-[11px] font-medium text-primary-600 hover:bg-slate-50"
            >
              {showAll ? 'Show fewer' : `Show all ${visible.length}`}
            </button>
          )}
        </div>
      )}

      {creating && (
        <GroupFormModal
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            navigate(`/groups/${saved.summary.id}`);
          }}
        />
      )}
    </section>
  );
}
