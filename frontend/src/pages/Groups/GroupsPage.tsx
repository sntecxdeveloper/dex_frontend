import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import GroupCard from '../../components/groups/GroupCard';
import GroupFormModal from '../../components/groups/GroupFormModal';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { TYPE_INFO, canEditGroups } from '../../components/groups/groupMeta';
import type { GroupSummary, GroupType } from '../../types/group';

type Section = 'ALL' | GroupType;
const SECTIONS: Section[] = ['ALL', 'DEVICE', 'TECHNICIAN', 'USER'];

export default function GroupsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const initial = (params.get('type') ?? 'ALL').toUpperCase();
  const [section, setSection] = useState<Section>((SECTIONS as string[]).includes(initial) ? (initial as Section) : 'ALL');
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

  const choose = (s: Section) => {
    setSection(s);
    setParams(s === 'ALL' ? {} : { type: s }, { replace: true });
  };

  const counts = useMemo(() => {
    const c: Record<Section, number> = { ALL: 0, DEVICE: 0, TECHNICIAN: 0, USER: 0 };
    (groups ?? []).forEach((g) => {
      c.ALL++;
      c[g.groupType]++;
    });
    return c;
  }, [groups]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groups ?? []).filter(
      (g) =>
        (section === 'ALL' || g.groupType === section) &&
        (!q || g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q)),
    );
  }, [groups, section, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-400">Organise</p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">Groups</h1>
          <p className="mt-1 text-sm text-slate-500">
            Collect devices, technicians or users. Static groups are listed by hand; dynamic groups follow a rule and update themselves.
          </p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>New group</Button>}
      </div>

      {/* Sections to choose from */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="tablist" aria-label="Group sections">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={section === s}
            onClick={() => choose(s)}
            className={`rounded-xl border p-4 text-left transition-all ${
              section === s ? 'border-primary-400 bg-primary-50/60 ring-2 ring-primary-500/20' : 'border-line bg-panel hover:border-line-strong'
            }`}
          >
            <p className="font-display text-[24px] font-semibold leading-none text-slate-900">{counts[s]}</p>
            <p className="mt-1.5 text-[13px] font-medium text-slate-800">{s === 'ALL' ? 'All groups' : `${TYPE_INFO[s].plural} groups`}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{s === 'ALL' ? 'Everything in one place' : TYPE_INFO[s].blurb}</p>
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search groups…"
        aria-label="Search groups"
        className="h-10 w-full max-w-sm rounded-lg border border-line bg-panel px-3 text-[13px] placeholder:text-slate-400 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />

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
            <Skeleton key={i} className="h-[148px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">{groups.length === 0 ? 'No groups yet' : 'No group matches'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {groups.length === 0 ? 'Create one to see its health together and act on all of its members at once.' : 'Try another section or search.'}
          </p>
          {canEdit && groups.length === 0 && (
            <Button className="mt-4" onClick={() => setCreating(true)}>
              Create the first group
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((g) => (
            <GroupCard key={g.id} group={g} onOpen={() => navigate(`/groups/${g.id}`)} />
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
    </div>
  );
}
