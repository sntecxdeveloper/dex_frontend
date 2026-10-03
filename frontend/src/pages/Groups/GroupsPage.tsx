import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { deleteGroup, getGroup, getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import GroupFormModal from '../../components/groups/GroupFormModal';
import { toast } from '../../components/common/Toast';
import { HEALTH_INFO, KINDS, KIND_INFO, canEditGroups } from '../../components/groups/groupMeta';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatRelativeTime } from '../../utils/formatDate';
import type { GroupDetail, GroupSummary } from '../../types/group';

const PAGE_SIZE = 20;
const EMPTY = '(empty)';

const input =
  'border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

type View = 'ALL' | 'TECHNICIANS' | 'USERS' | (typeof KINDS)[number];

const FIELDS: { key: string; label: string; get: (g: GroupSummary) => string }[] = [
  { key: 'name', label: 'Name', get: (g) => g.name },
  { key: 'kind', label: 'Kind', get: (g) => KIND_INFO[g.kind].label },
  { key: 'description', label: 'Description', get: (g) => g.description ?? '' },
];

type SortKey = 'name' | 'kind' | 'devices' | 'technicians' | 'users' | 'issues' | 'updated';

const SORT_VALUE: Record<SortKey, (g: GroupSummary) => string | number> = {
  name: (g) => g.name.toLowerCase(),
  kind: (g) => KIND_INFO[g.kind].label,
  devices: (g) => g.deviceCount,
  technicians: (g) => g.technicianCount,
  users: (g) => g.userCount,
  issues: (g) => g.openIssues,
  updated: (g) => new Date(g.updatedAt ?? 0).getTime(),
};

const VIEW_TITLE: Record<string, string> = { ALL: 'Groups', TECHNICIANS: 'Technician groups', USERS: 'User groups' };

/** Organisation groups as a list: open one to see what is inside, edit it, or choose which agent features its devices show. */
export default function GroupsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const fromUrl = (params.get('view') ?? 'ALL').toUpperCase();
  const view: View = (['ALL', 'TECHNICIANS', 'USERS', ...KINDS] as string[]).includes(fromUrl) ? (fromUrl as View) : 'ALL';

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState('name');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true });
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GroupDetail | null>(null);
  const [deleting, setDeleting] = useState<GroupSummary[] | null>(null);

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

  const inView = useMemo(
    () =>
      (groups ?? []).filter((g) => {
        if (view === 'ALL') return true;
        if (view === 'TECHNICIANS') return g.technicianCount > 0;
        if (view === 'USERS') return g.userCount > 0;
        return g.kind === view;
      }),
    [groups, view],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const get = FIELDS.find((f) => f.key === field)!.get;
    const filtered = q ? inView.filter((g) => get(g).toLowerCase().includes(q)) : inView;
    const value = SORT_VALUE[sort.key];
    return [...filtered].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.asc ? c : -c;
    });
  }, [inView, search, field, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const allChecked = visible.length > 0 && visible.every((g) => checked.has(g.id));
  const picked = (groups ?? []).filter((g) => checked.has(g.id));

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: (groups ?? []).length, TECHNICIANS: 0, USERS: 0 };
    KINDS.forEach((k) => (c[k] = 0));
    (groups ?? []).forEach((g) => {
      c[g.kind]++;
      if (g.technicianCount > 0) c.TECHNICIANS++;
      if (g.userCount > 0) c.USERS++;
    });
    return c;
  }, [groups]);

  const chooseView = (v: View) => {
    setParams(v === 'ALL' ? {} : { view: v }, { replace: true });
    setPage(0);
    setChecked(new Set());
    setNotice(null);
  };

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));

  const th = (label: string, key?: SortKey) => (
    <th className="whitespace-nowrap px-2.5 py-3 text-left font-semibold text-slate-800">
      {key ? (
        <button type="button" onClick={() => sortBy(key)} className="font-semibold hover:text-primary-700">
          {label} {sort.key === key ? (sort.asc ? '▲' : '▼') : ''}
        </button>
      ) : (
        label
      )}
    </th>
  );

  /** The editor needs the whole group (including a rule), not just the list row. */
  const openEdit = (g: GroupSummary) => {
    getGroup(g.id)
      .then(setEditing)
      .catch((err) => toast(getErrorMessage(err), 'error'));
  };

  const runAction = (action: string) => {
    setNotice(null);
    if (!action) return;
    if (picked.length === 0) {
      setNotice('Select at least one group first.');
      return;
    }
    if (action === 'delete') {
      setDeleting(picked);
      return;
    }
    if (picked.length > 1) {
      setNotice('Select one group for this action.');
      return;
    }
    if (action === 'edit') openEdit(picked[0]);
    if (action === 'features') navigate(`/groups/${picked[0].id}?tab=features`);
  };

  const doDelete = async () => {
    const list = deleting ?? [];
    setDeleting(null);
    try {
      await Promise.all(list.map((g) => deleteGroup(g.id)));
      toast(list.length === 1 ? 'Group deleted' : `${list.length} groups deleted`, 'success');
      setChecked(new Set());
      load();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
      load();
    }
  };

  const viewLink = (v: View, label: string) => (
    <button key={v} type="button" onClick={() => chooseView(v)} className={`mr-4 ${view === v ? 'font-medium text-primary-700' : 'text-slate-500 hover:text-slate-800'}`}>
      {label} <span className="text-slate-400">({counts[v]})</span>
    </button>
  );

  return (
    <div className="-mx-1 space-y-0">
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <Link to="/setup" className="text-sm text-slate-500 hover:text-slate-800" aria-label="Back to Setup" title="Back to Setup">
          ☰
        </Link>
        <h1 className="text-sm font-semibold text-slate-900">{VIEW_TITLE[view] ?? `${KIND_INFO[view as (typeof KINDS)[number]].plural}`}</h1>
        <div className="flex items-center">
          <select value={field} onChange={(e) => setField(e.target.value)} className={`${input} w-36 rounded-l`} aria-label="Search field">
            {FIELDS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search"
            className={`${input} -ml-px w-56 rounded-r`}
            aria-label="Search"
          />
        </div>
        {canEdit && (
          <div className="ml-auto flex items-center gap-3">
            <select value="" onChange={(e) => runAction(e.target.value)} className={`${input} w-56 rounded`} aria-label="Actions on selected rows">
              <option value="">Actions on selected rows...</option>
              <option value="edit">Edit</option>
              <option value="features">Features shown</option>
              <option value="delete">Delete</option>
            </select>
            <button onClick={() => setCreating(true)} className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900">
              New
            </button>
          </div>
        )}
      </div>

      {/* Views */}
      <div className="px-3 py-2 text-xs">
        {viewLink('ALL', 'All')}
        {KINDS.filter((k) => counts[k] > 0).map((k) => viewLink(k, KIND_INFO[k].plural))}
        {viewLink('TECHNICIANS', 'With technicians')}
        {viewLink('USERS', 'With users')}
        {notice && <span className="ml-2 text-amber-600">{notice}</span>}
      </div>

      {error ? (
        <div className="m-3 flex items-center justify-between rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={load} className="text-xs font-medium underline">
            Try again
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-y border-slate-300">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => setChecked(e.target.checked ? new Set(visible.map((g) => g.id)) : new Set())}
                    aria-label="Select all"
                  />
                </th>
                {th('Name', 'name')}
                {th('Kind', 'kind')}
                {th('Description')}
                {th('Devices', 'devices')}
                {th('Online')}
                {th('Technicians', 'technicians')}
                {th('Users', 'users')}
                {th('Open issues', 'issues')}
                {th('Health')}
                {th('Features shown')}
                {th('Updated', 'updated')}
                {canEdit && th('')}
              </tr>
            </thead>
            <tbody>
              {visible.map((g, i) => {
                const health = HEALTH_INFO[g.health];
                return (
                  <tr key={g.id} className={`border-b border-slate-100 hover:bg-primary-50/40 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                    <td className="px-2.5 py-1.5 align-top">
                      <input type="checkbox" checked={checked.has(g.id)} onChange={() => toggle(g.id)} aria-label={`Select ${g.name}`} />
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 align-top">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: g.color || '#64748b' }} aria-hidden="true" />
                      <button onClick={() => navigate(`/groups/${g.id}`)} className="font-medium text-primary-700 hover:underline">
                        {g.name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 align-top text-slate-800">{KIND_INFO[g.kind].label}</td>
                    <td className="max-w-xs px-2.5 py-1.5 align-top text-slate-800">{g.description || <span className="text-slate-500">{EMPTY}</span>}</td>
                    <td className="px-2.5 py-1.5 align-top text-slate-800">{g.deviceCount}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 align-top text-slate-700">{g.deviceCount === 0 ? EMPTY : `${g.online} / ${g.deviceCount}`}</td>
                    <td className="px-2.5 py-1.5 align-top text-slate-800">{g.technicianCount}</td>
                    <td className="px-2.5 py-1.5 align-top text-slate-800">{g.userCount}</td>
                    <td className="px-2.5 py-1.5 align-top">{g.openIssues > 0 ? <span className="rounded bg-red-400 px-2 py-0.5 font-medium text-white">{g.openIssues}</span> : <span className="text-slate-800">0</span>}</td>
                    <td className={`whitespace-nowrap px-2.5 py-1.5 align-top ${health.text}`}>{g.deviceCount === 0 ? EMPTY : health.label}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 align-top text-slate-800">
                      {g.featuresManaged ? (g.hiddenFeatures === 0 ? 'All shown' : `${g.hiddenFeatures} hidden`) : <span className="text-slate-500">Default</span>}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 align-top text-slate-700">{g.updatedAt ? formatRelativeTime(g.updatedAt) : EMPTY}</td>
                    {canEdit && (
                      <td className="whitespace-nowrap px-2.5 py-1.5 align-top">
                        <button onClick={() => openEdit(g)} className="mr-3 text-primary-700 hover:underline">
                          Edit
                        </button>
                        <button onClick={() => navigate(`/groups/${g.id}?tab=features`)} className="text-primary-700 hover:underline">
                          Features
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 13 : 12} className="px-3 py-12 text-center text-slate-400">
                    {groups === null ? 'Loading…' : groups.length === 0 ? 'No groups yet. Use New to create the first one.' : 'No records to display'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3 border-t border-slate-200 py-2.5 text-xs text-slate-600">
        <button disabled={current === 0} onClick={() => setPage(0)} aria-label="First page" className="px-1 disabled:text-slate-300">
          «
        </button>
        <button disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page" className="px-1 disabled:text-slate-300">
          ‹
        </button>
        <span>
          {rows.length === 0 ? 0 : current * PAGE_SIZE + 1} to {Math.min((current + 1) * PAGE_SIZE, rows.length)} of {rows.length}
        </span>
        <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page" className="px-1 disabled:text-slate-300">
          ›
        </button>
        <button disabled={current >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Last page" className="px-1 disabled:text-slate-300">
          »
        </button>
      </div>

      {creating && (
        <GroupFormModal
          onClose={() => setCreating(false)}
          onSaved={(saved: GroupDetail) => {
            setCreating(false);
            navigate(`/groups/${saved.summary.id}`);
          }}
        />
      )}
      {editing && (
        <GroupFormModal
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast('Group saved', 'success');
            load();
          }}
        />
      )}
      <ConfirmDialog
        isOpen={deleting !== null}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} groups?` : 'Delete this group?'}
        message="The devices, technicians and users inside are not affected."
        confirmLabel="Delete"
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
