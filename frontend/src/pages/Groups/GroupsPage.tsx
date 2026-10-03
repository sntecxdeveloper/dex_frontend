import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { deleteGroup, getFeatureCatalog, getGroup, getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import ColumnMenu, { NO_FILTER, isFiltered, type ColumnFilter, type ColumnKind, type ColumnValue } from '../../components/common/ColumnMenu';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FeatureFilterList, { matchesFeatureChoice } from '../../components/groups/FeatureFilterList';
import GroupFormModal from '../../components/groups/GroupFormModal';
import { toast } from '../../components/common/Toast';
import { HEALTH_INFO, KINDS, KIND_INFO, canEditGroups } from '../../components/groups/groupMeta';
import { getErrorMessage } from '../../utils/errorHandler';
import ColumnChooser from '../../components/common/ColumnChooser';
import { useColumnChoice, type ChoosableColumn } from '../../hooks/useColumnChoice';
import { formatDate, formatRelativeTime } from '../../utils/formatDate';
import type { FeatureTab, GroupDetail, GroupSummary } from '../../types/group';

const PAGE_SIZE = 20;
const EMPTY = '(empty)';

const input =
  'border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

type View = 'ALL' | 'TECHNICIANS' | 'USERS' | (typeof KINDS)[number];

interface Column extends ChoosableColumn {
  key: string;
  label: string;
  kind: ColumnKind;
  /** What the cell shows, and what the menu searches and lists as a value. */
  text: (g: GroupSummary) => string;
  /** What the list sorts by. */
  sort: (g: GroupSummary) => string | number;
}

const VIEW_TITLE: Record<string, string> = { ALL: 'Groups', TECHNICIANS: 'Technician groups', USERS: 'User groups' };

/**
 * Organisation groups as a list. Every column heading has a menu to sort it, search inside it and tick which values to show;
 * the Features column lists the agent tabs and features in the same menu. Everything applies the moment it is chosen.
 */
export default function GroupsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const fromUrl = (params.get('view') ?? 'ALL').toUpperCase();
  const view: View = (['ALL', 'TECHNICIANS', 'USERS', ...KINDS] as string[]).includes(fromUrl) ? (fromUrl as View) : 'ALL';

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [catalog, setCatalog] = useState<FeatureTab[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; asc: boolean }>({ key: 'name', asc: true });
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
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
    getFeatureCatalog().then(setCatalog).catch(() => undefined);
  }, [load]);

  const featureLabel = useMemo(() => {
    const m = new Map<string, string>();
    catalog.forEach((t) => {
      m.set(t.key, t.label);
      t.features.forEach((f) => m.set(f.key, `${t.label}: ${f.label}`));
    });
    return m;
  }, [catalog]);

  /** What the Features column says for a group, in words. */
  const featureText = useCallback(
    (g: GroupSummary) => {
      if (!g.featuresManaged) return 'Default';
      if (g.hiddenFeatureKeys.length === 0) return 'All shown';
      return 'Hides ' + g.hiddenFeatureKeys.map((k) => featureLabel.get(k) ?? k).join(', ');
    },
    [featureLabel],
  );

  const columns: Column[] = useMemo(
    () => [
      { key: 'name', label: 'Name', fixed: true, kind: 'text', text: (g) => g.name, sort: (g) => g.name.toLowerCase() },
      { key: 'kind', label: 'Kind', initial: true, kind: 'text', text: (g) => KIND_INFO[g.kind].label, sort: (g) => KIND_INFO[g.kind].label },
      { key: 'location', label: 'Location', initial: true, kind: 'text', text: (g) => g.location ?? '', sort: (g) => (g.location ?? '').toLowerCase() },
      { key: 'region', label: 'Region', initial: true, kind: 'text', text: (g) => g.region ?? '', sort: (g) => (g.region ?? '').toLowerCase() },
      { key: 'description', label: 'Description', initial: true, kind: 'text', text: (g) => g.description ?? '', sort: (g) => (g.description ?? '').toLowerCase() },
      { key: 'devices', label: 'Devices', initial: true, kind: 'number', text: (g) => String(g.deviceCount), sort: (g) => g.deviceCount },
      { key: 'online', label: 'Online', initial: true, kind: 'number', text: (g) => (g.deviceCount === 0 ? '' : `${g.online} / ${g.deviceCount}`), sort: (g) => g.online },
      { key: 'offline', label: 'Offline', kind: 'number', text: (g) => String(g.offline), sort: (g) => g.offline },
      { key: 'technicians', label: 'Technicians', initial: true, kind: 'number', text: (g) => String(g.technicianCount), sort: (g) => g.technicianCount },
      { key: 'users', label: 'Users', initial: true, kind: 'number', text: (g) => String(g.userCount), sort: (g) => g.userCount },
      { key: 'issues', label: 'Open issues', initial: true, kind: 'number', text: (g) => String(g.openIssues), sort: (g) => g.openIssues },
      { key: 'health', label: 'Health', initial: true, kind: 'text', text: (g) => (g.deviceCount === 0 ? '' : HEALTH_INFO[g.health].label), sort: (g) => g.health },
      { key: 'features', label: 'Features shown', initial: true, kind: 'text', text: featureText, sort: (g) => (g.featuresManaged ? g.hiddenFeatureKeys.length : -1) },
      { key: 'retention', label: 'Keep logs', kind: 'number', text: (g) => (g.retentionDays ? `${g.retentionDays} days` : 'Default'), sort: (g) => g.retentionDays ?? 0 },
      { key: 'fixes', label: 'Fixes allowed', kind: 'number', text: (g) => (g.allowedFixes == null ? 'All approved' : `${g.allowedFixes} allowed`), sort: (g) => g.allowedFixes ?? 1e9 },
      { key: 'assign', label: 'Auto-assign issues', kind: 'text', text: (g) => (g.autoAssignIssues ? 'On' : 'Off'), sort: (g) => (g.autoAssignIssues ? 1 : 0) },
      { key: 'chosen', label: 'Devices chosen by', kind: 'text', text: (g) => (g.membershipMode === 'DYNAMIC' ? 'A rule' : 'Listed by hand'), sort: (g) => g.membershipMode },
      { key: 'createdBy', label: 'Created by', kind: 'text', text: (g) => g.createdBy ?? '', sort: (g) => (g.createdBy ?? '').toLowerCase() },
      { key: 'created', label: 'Created', kind: 'date', text: (g) => (g.createdAt ? formatDate(g.createdAt) : ''), sort: (g) => new Date(g.createdAt ?? 0).getTime() },
      { key: 'updated', label: 'Updated', initial: true, kind: 'date', text: (g) => (g.updatedAt ? formatRelativeTime(g.updatedAt) : ''), sort: (g) => new Date(g.updatedAt ?? 0).getTime() },
    ],
    [featureText],
  );

  const choice = useColumnChoice('dex.groups.columns', columns);
  const shown = columns.filter((c) => choice.isOn(c.key));

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

  /** The distinct values of each column, for the menus (with how many groups have each). */
  const valuesOf = useMemo(() => {
    const out: Record<string, ColumnValue[]> = {};
    columns.forEach((c) => {
      const counts = new Map<string, number>();
      inView.forEach((g) => counts.set(c.text(g), (counts.get(c.text(g)) ?? 0) + 1));
      const list = [...counts.entries()].map(([value, count]) => ({ value, count, label: value === '' ? EMPTY : value }));
      list.sort((a, b) => (c.kind === 'number' ? Number(a.value) - Number(b.value) : a.label.localeCompare(b.label)));
      out[c.key] = list;
    });
    return out;
  }, [columns, inView]);

  const activeFilters = shown.filter((c) => isFiltered(filters[c.key]));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = inView.filter((g) => {
      if (q && !(g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q))) return false;
      return shown.every((c) => {
        const f = filters[c.key];
        if (!f) return true;
        const text = c.text(g);
        if (f.text.trim() && !text.toLowerCase().includes(f.text.trim().toLowerCase())) return false;
        if (f.values !== null) return c.key === 'features' ? matchesFeatureChoice(g, f.values) : f.values.has(text);
        return true;
      });
    });
    const col = columns.find((c) => c.key === sort.key) ?? columns[0];
    return [...filtered].sort((a, b) => {
      const x = col.sort(a);
      const y = col.sort(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.asc ? c : -c;
    });
  }, [inView, search, filters, sort, columns, shown]);

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

  const setFilter = (key: string, next: ColumnFilter) => {
    setFilters((prev) => ({ ...prev, [key]: next }));
    setPage(0);
  };

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const th = (c: Column) => {
    const f = filters[c.key] ?? NO_FILTER;
    return (
      <th key={c.key} className="whitespace-nowrap px-2.5 py-3 text-left font-semibold text-slate-800">
        <button
          type="button"
          onClick={() => setSort((s) => (s.key === c.key ? { key: c.key, asc: !s.asc } : { key: c.key, asc: true }))}
          className="font-semibold hover:text-primary-700"
        >
          {c.label}
        </button>
        <ColumnMenu
          label={c.label}
          kind={c.kind}
          values={valuesOf[c.key] ?? []}
          filter={f}
          onFilter={(next) => setFilter(c.key, next)}
          sorted={sort.key === c.key ? (sort.asc ? 'asc' : 'desc') : null}
          onSort={(dir) => setSort({ key: c.key, asc: dir === 'asc' })}
        >
          {c.key === 'features' ? <FeatureFilterList catalog={catalog} filter={f} onFilter={(next) => setFilter(c.key, next)} /> : undefined}
        </ColumnMenu>
      </th>
    );
  };

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

  const cell = 'px-2.5 py-1.5 align-top';

  return (
    <div className="-mx-1 space-y-0">
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <Link to="/setup" className="text-sm text-slate-500 hover:text-slate-800" aria-label="Back to Setup" title="Back to Setup">
          ☰
        </Link>
        <h1 className="text-sm font-semibold text-slate-900">{VIEW_TITLE[view] ?? KIND_INFO[view as (typeof KINDS)[number]].plural}</h1>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search name or description"
          className={`${input} w-64 rounded`}
          aria-label="Search"
        />
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

      {/* Views and active filters */}
      <div className="flex flex-wrap items-center px-3 py-2 text-xs">
        {viewLink('ALL', 'All')}
        {KINDS.filter((k) => counts[k] > 0).map((k) => viewLink(k, KIND_INFO[k].plural))}
        {viewLink('TECHNICIANS', 'With technicians')}
        {viewLink('USERS', 'With users')}
        {activeFilters.length > 0 && (
          <span className="ml-auto flex items-center gap-2 text-slate-600">
            Filtered by {activeFilters.map((c) => c.label).join(', ')}
            <button type="button" onClick={() => setFilters({})} className="font-medium text-primary-700 hover:underline">
              Clear all
            </button>
          </span>
        )}
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
                {shown.map(th)}
                <th className="whitespace-nowrap px-2.5 py-3 text-right">
                  <ColumnChooser columns={columns} isOn={choice.isOn} onToggle={choice.toggle} onReset={choice.reset} />
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g, i) => {
                const health = HEALTH_INFO[g.health];
                return (
                  <tr key={g.id} className={`border-b border-slate-100 hover:bg-primary-50/40 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                    <td className={cell}>
                      <input type="checkbox" checked={checked.has(g.id)} onChange={() => toggle(g.id)} aria-label={`Select ${g.name}`} />
                    </td>
                    {shown.map((c) => {
                      switch (c.key) {
                        case 'name':
                          return (
                            <td key={c.key} className={`${cell} whitespace-nowrap`}>
                              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: g.color || '#64748b' }} aria-hidden="true" />
                              <button onClick={() => navigate(`/groups/${g.id}`)} className="font-medium text-primary-700 hover:underline">
                                {g.name}
                              </button>
                            </td>
                          );
                        case 'issues':
                          return (
                            <td key={c.key} className={cell}>
                              {g.openIssues > 0 ? <span className="rounded bg-red-400 px-2 py-0.5 font-medium text-white">{g.openIssues}</span> : <span className="text-slate-800">0</span>}
                            </td>
                          );
                        case 'health':
                          return (
                            <td key={c.key} className={`${cell} whitespace-nowrap ${health.text}`}>
                              {g.deviceCount === 0 ? EMPTY : health.label}
                            </td>
                          );
                        case 'features':
                          return (
                            <td key={c.key} className={`${cell} max-w-[220px] text-slate-800`} title={featureText(g)}>
                              <span className="line-clamp-2">{g.featuresManaged ? featureText(g) : <span className="text-slate-500">Default</span>}</span>
                            </td>
                          );
                        case 'description':
                          return (
                            <td key={c.key} className={`${cell} max-w-xs text-slate-800`}>
                              {g.description || <span className="text-slate-500">{EMPTY}</span>}
                            </td>
                          );
                        default: {
                          const value = c.text(g);
                          return (
                            <td key={c.key} className={`${cell} whitespace-nowrap text-slate-800`}>
                              {value === '' ? <span className="text-slate-500">{EMPTY}</span> : value}
                            </td>
                          );
                        }
                      }
                    })}
                    <td className={`${cell} whitespace-nowrap text-right`}>
                      {canEdit && (
                      <>
                        <button onClick={() => openEdit(g)} className="mr-3 text-primary-700 hover:underline">
                          Edit
                        </button>
                        <button onClick={() => navigate(`/groups/${g.id}?tab=features`)} className="text-primary-700 hover:underline">
                          Features
                        </button>
                      </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={shown.length + 2} className="px-3 py-12 text-center text-slate-400">
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
