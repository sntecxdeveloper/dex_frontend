import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import { Skeleton } from '../ui/Skeleton';
import GroupCard from './GroupCard';
import GroupFormModal from './GroupFormModal';
import { KINDS, KIND_INFO, canEditGroups } from './groupMeta';
import type { GroupKind, GroupSummary } from '../../types/group';

type KindFilter = 'ALL' | GroupKind;

const REFRESH_MS = 60_000;

/**
 * The dashboard's group section, under the greeting: a scrolling row of organisation groups. Each card has its devices,
 * technicians and users as dropdowns inside it. A kind dropdown narrows the row; admins and operators can start a new group.
 */
export default function GroupStrip() {
  const navigate = useNavigate();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<KindFilter>('ALL');
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
    const list = (groups ?? []).filter((g) => kind === 'ALL' || g.kind === kind);
    // Groups that need attention first, then the biggest.
    const rank = (g: GroupSummary) => (g.health === 'CRITICAL' ? 0 : g.health === 'WARNING' ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b) || b.deviceCount - a.deviceCount || a.name.localeCompare(b.name));
  }, [groups, kind]);

  const total = groups?.length ?? 0;

  return (
    <section aria-label="Groups" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">Groups</h2>
          {kindsPresent.length > 1 && (
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as KindFilter)}
              aria-label="Show kind"
              className="h-8 rounded-lg border border-line bg-white px-2.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="ALL">All kinds ({total})</option>
              {kindsPresent.map((k) => (
                <option key={k} value={k}>
                  {KIND_INFO[k].plural} ({(groups ?? []).filter((g) => g.kind === k).length})
                </option>
              ))}
            </select>
          )}
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

      {groups === null && !failed ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[190px] w-[260px] shrink-0" />
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
          <p className="text-sm font-medium text-slate-700">{total === 0 ? 'No groups yet' : 'No group of that kind'}</p>
          <p className="mt-1 text-xs text-slate-500">
            A group is a department, site or team. Put its devices, technicians and users inside to see their health together and act on them at once.
          </p>
          {canEdit && total === 0 && (
            <button type="button" onClick={() => setCreating(true)} className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700">
              Create the first group
            </button>
          )}
        </div>
      ) : (
        <div className="-mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-2">
          {visible.map((g) => (
            <GroupCard key={g.id} group={g} onOpen={(x) => navigate(`/groups/${x.id}`)} compact />
          ))}
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
