import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import { Skeleton } from '../ui/Skeleton';
import GroupCard from './GroupCard';
import GroupFormModal from './GroupFormModal';
import { TYPE_INFO, canEditGroups } from './groupMeta';
import type { GroupSummary, GroupType } from '../../types/group';

type Section = 'ALL' | GroupType;

const SECTIONS: Section[] = ['ALL', 'DEVICE', 'TECHNICIAN', 'USER'];
const REFRESH_MS = 60_000;

/**
 * The dashboard's group section, under the greeting: a scrolling row of group cards with section chips to choose
 * devices, technicians or users, a way to open the full page, and (for admins and operators) a way to start a new group.
 */
export default function GroupStrip() {
  const navigate = useNavigate();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<Section>('ALL');
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

  const counts = useMemo(() => {
    const c: Record<Section, number> = { ALL: 0, DEVICE: 0, TECHNICIAN: 0, USER: 0 };
    (groups ?? []).forEach((g) => {
      c.ALL++;
      c[g.groupType]++;
    });
    return c;
  }, [groups]);

  const visible = useMemo(() => {
    const list = (groups ?? []).filter((g) => section === 'ALL' || g.groupType === section);
    // Groups that need attention first, then the biggest.
    const rank = (g: GroupSummary) => (g.health === 'CRITICAL' ? 0 : g.health === 'WARNING' ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b) || b.memberCount - a.memberCount || a.name.localeCompare(b.name));
  }, [groups, section]);

  const open = (g: GroupSummary) => navigate(`/groups/${g.id}`);

  return (
    <section aria-label="Groups" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">Groups</h2>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Group sections">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={section === s}
                onClick={() => setSection(s)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-inset transition-colors ${
                  section === s ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {s === 'ALL' ? 'All' : TYPE_INFO[s].plural}
                <span className={`ml-1.5 font-mono text-[10px] ${section === s ? 'text-white/80' : 'text-slate-400'}`}>{counts[s]}</span>
              </button>
            ))}
          </div>
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
            <Skeleton key={i} className="h-[148px] w-[248px] shrink-0" />
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
          <p className="text-sm font-medium text-slate-700">
            {counts.ALL === 0 ? 'No groups yet' : `No ${section === 'ALL' ? '' : TYPE_INFO[section].plural.toLowerCase() + ' '}groups`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Groups collect devices, technicians or users so you can see their health together and act on all of them at once.
          </p>
          {canEdit && (
            <button type="button" onClick={() => setCreating(true)} className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700">
              Create the first group
            </button>
          )}
        </div>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {visible.map((g) => (
            <GroupCard key={g.id} group={g} onOpen={open} compact />
          ))}
        </div>
      )}

      {creating && (
        <GroupFormModal
          defaultType={section === 'ALL' ? 'DEVICE' : section}
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
