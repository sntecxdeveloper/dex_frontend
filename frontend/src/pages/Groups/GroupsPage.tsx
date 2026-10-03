import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import GroupCard from '../../components/groups/GroupCard';
import GroupFormModal from '../../components/groups/GroupFormModal';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { KINDS, KIND_INFO, canEditGroups } from '../../components/groups/groupMeta';
import type { GroupKind, GroupSummary } from '../../types/group';

type KindFilter = 'ALL' | GroupKind;

export default function GroupsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const fromUrl = (params.get('kind') ?? 'ALL').toUpperCase();
  const [kind, setKind] = useState<KindFilter>((KINDS as string[]).includes(fromUrl) ? (fromUrl as GroupKind) : 'ALL');
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    getGroups()
      .then((g) => {
        setGroups(g);
        setError(null);
      })
      .catch(() => setError('Groups could not be loaded.'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chooseKind = (k: KindFilter) => {
    setKind(k);
    setParams(k === 'ALL' ? {} : { kind: k }, { replace: true });
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groups ?? []).filter((g) => (kind === 'ALL' || g.kind === kind) && (!q || g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q)));
  }, [groups, kind, search]);

  const totals = useMemo(() => {
    const t = { devices: 0, technicians: 0, users: 0, issues: 0 };
    visible.forEach((g) => {
      t.devices += g.deviceCount;
      t.technicians += g.technicianCount;
      t.users += g.userCount;
      t.issues += g.openIssues;
    });
    return t;
  }, [visible]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-400">Organise</p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">Groups</h1>
          <p className="mt-1 text-sm text-slate-500">
            Departments, sites and teams. Open a group to see the devices, technicians and users inside it.
          </p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>New group</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups…"
          aria-label="Search groups"
          className="h-10 w-full max-w-xs rounded-lg border border-line bg-panel px-3 text-[13px] placeholder:text-slate-400 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <select
          value={kind}
          onChange={(e) => chooseKind(e.target.value as KindFilter)}
          aria-label="Kind"
          className="h-10 rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="ALL">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_INFO[k].plural}
            </option>
          ))}
        </select>
        {groups !== null && visible.length > 0 && (
          <p className="text-xs text-slate-500">
            {visible.length} group{visible.length === 1 ? '' : 's'} · {totals.devices} devices · {totals.technicians} technicians · {totals.users} users
            {totals.issues > 0 ? ` · ${totals.issues} open issues` : ''}
          </p>
        )}
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            Try again
          </Button>
        </div>
      ) : groups === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[190px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">{groups.length === 0 ? 'No groups yet' : 'No group matches'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {groups.length === 0 ? 'Create one, then put its devices, technicians and users inside.' : 'Try another kind or search.'}
          </p>
          {canEdit && groups.length === 0 && (
            <Button className="mt-4" onClick={() => setCreating(true)}>
              Create the first group
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((g) => (
            <GroupCard key={g.id} group={g} onOpen={() => navigate(`/groups/${g.id}`)} />
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
    </div>
  );
}
