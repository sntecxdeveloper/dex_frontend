import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import GroupCard from '../../components/groups/GroupCard';
import GroupFormModal from '../../components/groups/GroupFormModal';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { GROUP_TYPES, HEALTH_INFO, KINDS, KIND_INFO, TYPE_INFO, canEditGroups, initials } from '../../components/groups/groupMeta';
import type { GroupKind, GroupSummary, GroupType } from '../../types/group';

type KindFilter = 'ALL' | GroupKind;
type TypeFilter = 'ALL' | 'GENERAL' | GroupType;
type View = 'list' | 'cards';

const VIEW_KEY = 'dex.groupsView';

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list';
  } catch {
    return 'list';
  }
}

function TypeChip({ type }: { type?: GroupType | null }) {
  if (!type) return <span className="text-[11px] text-slate-400">General group</span>;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TYPE_INFO[type].chip}`}>{TYPE_INFO[type].label}</span>;
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex flex-col items-center leading-tight" title={`${n} ${label}`}>
      <span className={`font-mono text-[13px] font-semibold ${n === 0 ? 'text-slate-300' : 'text-slate-800'}`}>{n}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    </span>
  );
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const fromUrl = (params.get('kind') ?? 'ALL').toUpperCase();
  const [kind, setKind] = useState<KindFilter>((KINDS as string[]).includes(fromUrl) ? (fromUrl as GroupKind) : 'ALL');
  const typeFromUrl = (params.get('type') ?? 'ALL').toUpperCase();
  const [type, setType] = useState<TypeFilter>(
    typeFromUrl === 'GENERAL' || (GROUP_TYPES as string[]).includes(typeFromUrl) ? (typeFromUrl as TypeFilter) : 'ALL',
  );
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<View>(loadView);

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

  const updateParams = (k: KindFilter, t: TypeFilter) => {
    const next: Record<string, string> = {};
    if (k !== 'ALL') next.kind = k;
    if (t !== 'ALL') next.type = t;
    setParams(next, { replace: true });
  };
  const chooseKind = (k: KindFilter) => {
    setKind(k);
    updateParams(k, type);
  };
  const chooseType = (t: TypeFilter) => {
    const next = t === type ? 'ALL' : t;
    setType(next);
    updateParams(kind, next);
  };
  const chooseView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* the choice just isn't remembered */
    }
  };

  const typeCounts = useMemo(() => {
    const c: Record<GroupType, number> = { TECHNICIAN: 0, USER: 0, DEVICE: 0 };
    let general = 0;
    (groups ?? []).forEach((g) => {
      if (g.type) c[g.type] += 1;
      else general += 1;
    });
    return { c, general };
  }, [groups]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groups ?? []).filter((g) => {
      if (kind !== 'ALL' && g.kind !== kind) return false;
      if (type === 'GENERAL' ? !!g.type : type !== 'ALL' && g.type !== type) return false;
      return !q || g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q);
    });
  }, [groups, kind, type, search]);

  const totals = useMemo(() => {
    const t = { members: 0, issues: 0 };
    (groups ?? []).forEach((g) => {
      t.members += g.technicianCount + g.userCount;
      t.issues += g.openIssues;
    });
    return t;
  }, [groups]);

  const tile = 'rounded-xl border p-3.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-400">Organise</p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">Groups</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            A group is a collection of people who share a purpose, skill set or responsibility. Create a technician group such as Software or Hardware, add its
            technicians, and assign incidents to the group so any member can handle them.
          </p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>New group</Button>}
      </div>

      {groups !== null && (
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {[
            { label: 'Groups', value: groups.length },
            { label: 'People in groups', value: totals.members },
            { label: 'Open issues', value: totals.issues },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-panel px-3.5 py-2.5">
              <p className="font-display text-xl font-semibold text-slate-900">{s.value}</p>
              <p className="text-[11px] text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Group types: click one to filter */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {GROUP_TYPES.map((t) => {
          const info = TYPE_INFO[t];
          const on = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => chooseType(t)}
              aria-pressed={on}
              className={`${tile} ${on ? `${info.tile} ring-1` : 'border-line bg-panel hover:border-line-strong hover:shadow-card'}`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ${info.chip}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d={info.icon} />
                    </svg>
                  </span>
                  <span className="text-[13px] font-semibold text-slate-900">{info.plural}</span>
                </span>
                <span className="font-mono text-[12px] text-slate-500">{typeCounts.c[t]}</span>
              </span>
              <span className="mt-2 block text-[11.5px] leading-snug text-slate-500">{info.blurb}</span>
              <span className="mt-1.5 block text-[11px] text-slate-400">e.g. {info.example}</span>
            </button>
          );
        })}
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
        {typeCounts.general > 0 && (
          <button
            type="button"
            onClick={() => chooseType('GENERAL')}
            aria-pressed={type === 'GENERAL'}
            className={`h-10 rounded-lg border px-3 text-[13px] ${type === 'GENERAL' ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-line bg-panel text-slate-600 hover:border-line-strong'}`}
          >
            General groups ({typeCounts.general})
          </button>
        )}
        {(type !== 'ALL' || kind !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setKind('ALL');
              setType('ALL');
              setParams({}, { replace: true });
            }}
            className="text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-line bg-panel text-[12px]" role="group" aria-label="View">
          {(['list', 'cards'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => chooseView(v)}
              aria-pressed={view === v}
              className={`px-3 py-2 font-medium capitalize ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {v}
            </button>
          ))}
        </div>
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
            {groups.length === 0 ? 'Create a group such as Software, then add its technicians.' : 'Try another type, kind or search.'}
          </p>
          {canEdit && groups.length === 0 && (
            <Button className="mt-4" onClick={() => setCreating(true)}>
              Create the first group
            </Button>
          )}
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((g) => (
            <GroupCard key={g.id} group={g} onOpen={() => navigate(`/groups/${g.id}`)} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-card">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_auto_auto] items-center gap-4 border-b border-line bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
            <span>Group</span>
            <span>Type</span>
            <span className="w-[200px] text-center">Members</span>
            <span className="w-[110px] text-right">Status</span>
          </div>
          <ul className="divide-y divide-line/70">
            {visible.map((g) => {
              const health = HEALTH_INFO[g.health];
              const color = g.color || '#64748b';
              const inactive = g.status === 'INACTIVE';
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/groups/${g.id}`)}
                    className={`grid w-full grid-cols-1 items-center gap-2 px-4 py-3 text-left hover:bg-slate-50/70 focus:outline-none focus-visible:bg-slate-50 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_auto_auto] md:gap-4 ${inactive ? 'opacity-60' : ''}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold text-white" style={{ backgroundColor: color }} aria-hidden="true">
                        {initials(g.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-slate-900">{g.name}</span>
                        <span className="block truncate text-[11.5px] text-slate-500">{g.description || KIND_INFO[g.kind].label}</span>
                      </span>
                    </span>
                    <TypeChip type={g.type} />
                    <span className="flex w-[200px] justify-between gap-3 md:justify-around">
                      <Count n={g.technicianCount} label="Techs" />
                      <Count n={g.userCount} label="Users" />
                      <Count n={g.deviceCount} label="Devices" />
                    </span>
                    <span className="flex w-[110px] flex-col items-start gap-1 md:items-end">
                      {inactive ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">Inactive</span>
                      ) : g.deviceCount > 0 ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${health.ring} ${health.text}`}>{health.label}</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Active</span>
                      )}
                      {g.openIssues > 0 && <span className="text-[11px] font-medium text-red-600">{g.openIssues} open issue{g.openIssues === 1 ? '' : 's'}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
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
