import { useCallback, useEffect, useState } from 'react';
import {
  getGrants,
  getLayoutHistory,
  getLayoutsAt,
  previewRole,
  removeGrant,
  resetLayoutAt,
  restoreLayout,
  setGrant,
  type CustomizeGrant,
  type CustomizeLevel,
  type LayoutScope,
  type LayoutVersion,
  type ResolvedLayout,
  type StoredLayout,
} from '../../api/uiLayoutApi';
import { useRoleTargets } from '../../hooks/useRoleTargets';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatRelativeTime } from '../../utils/formatDate';
import { useUiLayouts } from '../../context/UiLayoutContext';
import CustomFieldsBuilder from '../../components/customfields/CustomFieldsBuilder';
import { PacksTab, SuggestionsTab } from './InsightsTabs';
import RolesTab from '../../components/access/RolesTab';

type Tab = 'roles' | 'who' | 'defaults' | 'preview' | 'fields' | 'suggestions' | 'packs';

const ROLES = [
  { value: 'ROLE_OPERATOR', label: 'Operators' },
  { value: 'ROLE_ITSM_TECHNICIAN', label: 'ITSM technicians' },
  { value: 'ROLE_VIEWER', label: 'Viewers' },
];

// Groups only hold devices, so there is no "their groups" level any more: a person arranges their own view, or sets defaults for roles.
const LEVELS: { value: CustomizeLevel; label: string; hint: string }[] = [
  { value: 'NONE', label: 'Cannot customize', hint: 'Sees what is set for them' },
  { value: 'PERSONAL', label: 'Own view', hint: 'Arranges their own menu, dashboard, pages and lists (the default)' },
  { value: 'GLOBAL', label: 'Roles and everyone', hint: 'Also sets defaults for roles and everyone, and can lock them' },
];

/** What each area is called on screen. */
function areaLabel(area: string): string {
  if (area === 'sidebar') return 'Menu';
  if (area === 'dashboard') return 'Dashboard';
  if (area.startsWith('list.')) return `List: ${area.replace('list.dex.', '').replace('.list', '')}`;
  if (area.startsWith('detail.')) return `Details page: ${area.slice(7)}`;
  return area;
}

/**
 * Console customization for administrators: who may customize how much, the defaults set for everyone, a role or a group (with their
 * locks and earlier versions), and a preview of what a role gets.
 */
export default function ConsoleCustomizationPage() {
  const [tab, setTab] = useState<Tab>('roles');
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900">Console customization</h1>
        <p className="mt-0.5 text-sm text-slate-500">Decide who can arrange the console, and set the defaults people start from.</p>
      </header>
      <div className="flex border-b border-line" role="tablist">
        {([
          ['roles', 'Roles and people'],
          ['who', 'Who can customize'],
          ['defaults', 'Defaults and locks'],
          ['preview', 'Preview a role'],
          ['fields', 'Ticket fields'],
          ['suggestions', 'Suggestions'],
          ['packs', 'Industry packs'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium ${tab === key ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'roles' && <RolesTab />}
      {tab === 'who' && <WhoTab />}
      {tab === 'defaults' && <DefaultsTab />}
      {tab === 'preview' && <PreviewTab />}
      {tab === 'fields' && <CustomFieldsBuilder />}
      {tab === 'suggestions' && <SuggestionsTab />}
      {tab === 'packs' && <PacksTab />}
    </div>
  );
}

function WhoTab() {
  const [grants, setGrants] = useState<CustomizeGrant[] | null>(null);
  const [username, setUsername] = useState('');
  const [userLevel, setUserLevel] = useState<CustomizeLevel>('TEAM');

  const load = useCallback(async () => {
    try {
      setGrants(await getGrants());
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const change = async (type: 'ROLE' | 'USER', key: string, level: CustomizeLevel) => {
    try {
      await setGrant(type, key, level);
      await load();
      toast('Saved', 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  // Without a setting a role has "Own view" (everyone may arrange their own view unless switched off).
  const roleLevel = (role: string): CustomizeLevel => grants?.find((g) => g.subjectType === 'ROLE' && g.subjectKey === role)?.level ?? 'PERSONAL';
  const people = grants?.filter((g) => g.subjectType === 'USER') ?? [];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-panel p-5">
        <h3 className="text-sm font-semibold text-slate-800">By role</h3>
        <p className="text-[12px] text-slate-500">Administrators can always customize everything.</p>
        <table className="mt-3 w-full text-left text-[13px]">
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.value} className="border-t border-line">
                <td className="py-2.5 pr-4 font-medium text-slate-800">{r.label}</td>
                <td className="py-2.5">
                  <select value={roleLevel(r.value)} onChange={(e) => void change('ROLE', r.value, e.target.value as CustomizeLevel)} className="rounded-lg border border-line bg-white px-2 py-1 text-[13px]">
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label} — {l.hint}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-panel p-5">
        <h3 className="text-sm font-semibold text-slate-800">For one person</h3>
        <p className="text-[12px] text-slate-500">A setting for one person replaces their role's level (it can give more or take it away).</p>
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim()) void change('USER', username.trim(), userLevel).then(() => setUsername(''));
          }}
        >
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" aria-label="Username" className="h-9 rounded-lg border border-line px-3 text-[13px]" />
          <select value={userLevel} onChange={(e) => setUserLevel(e.target.value as CustomizeLevel)} className="h-9 rounded-lg border border-line bg-white px-2 text-[13px]" aria-label="Level">
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <Button size="sm" type="submit" disabled={!username.trim()}>
            Give
          </Button>
        </form>
        {people.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-[13px]">
            {people.map((g) => (
              <li key={g.subjectKey} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-medium text-slate-800">{g.subjectKey}</span>
                  <span className="ml-2 text-slate-500">{LEVELS.find((l) => l.value === g.level)?.label}</span>
                </span>
                <button
                  type="button"
                  className="text-[12px] text-red-600 hover:text-red-700"
                  onClick={() => void removeGrant('USER', g.subjectKey).then(load).catch((err) => toast(getErrorMessage(err), 'error'))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DefaultsTab() {
  const { refresh } = useUiLayouts();
  const [target, setTarget] = useState('global');
  const roles = useRoleTargets();
  const [items, setItems] = useState<StoredLayout[] | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [versions, setVersions] = useState<LayoutVersion[]>([]);

  const scope = (): [LayoutScope, string] => (target === 'global' ? ['GLOBAL', ''] : ['ROLE', target.slice(5)]);

  const load = useCallback(async () => {
    const [s, k] = target === 'global' ? (['GLOBAL', ''] as const) : (['ROLE', target.slice(5)] as const);
    try {
      setItems(await getLayoutsAt(s, k));
      setHistoryOf(null);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }, [target]);
  useEffect(() => {
    void load();
  }, [load]);

  const showHistory = async (area: string) => {
    const [s, k] = scope();
    try {
      setVersions(await getLayoutHistory(s, k, area));
      setHistoryOf(area);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="defaults-target" className="text-[13px] font-medium text-slate-700">
          Defaults for
        </label>
        <select id="defaults-target" value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-[13px]">
          <option value="global">Everyone</option>
          {roles.map((r) => (
            <option key={r.value} value={`role:${r.value}`}>
              Role: {r.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[12px] text-slate-500">
        To set a default, open the menu, the dashboard or a list, choose Customize (or Views) and save it for these people. Here you can see, unlock, undo or remove them.
      </p>
      {items && items.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Nothing is set at this level.</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-line text-[13px]">
          {items.map((l) => (
            <li key={l.area} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium text-slate-800">{areaLabel(l.area)}</span>
                  {l.locked && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Locked</span>}
                  <span className="ml-2 text-[11px] text-slate-400">
                    v{l.version} by {l.updatedBy ?? 'unknown'} {l.updatedAt ? formatRelativeTime(l.updatedAt) : ''}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button type="button" className="text-[12px] text-slate-600 hover:text-slate-900" onClick={() => void showHistory(l.area)}>
                    Earlier versions
                  </button>
                  <button
                    type="button"
                    className="text-[12px] text-red-600 hover:text-red-700"
                    onClick={() => {
                      const [s, k] = scope();
                      void resetLayoutAt(s, k, l.area).then(load).then(refresh).catch((err) => toast(getErrorMessage(err), 'error'));
                    }}
                  >
                    Remove
                  </button>
                </span>
              </div>
              {historyOf === l.area && (
                <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2">
                  {versions.length === 0 && <li className="text-[12px] text-slate-400">No earlier versions.</li>}
                  {versions.map((v) => (
                    <li key={v.version} className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-600">
                        v{v.version} by {v.changedBy ?? 'unknown'} {v.changedAt ? formatRelativeTime(v.changedAt) : ''}
                        {v.locked ? ' (locked)' : ''}
                      </span>
                      <button
                        type="button"
                        className="text-primary-600 hover:text-primary-700"
                        onClick={() => {
                          const [s, k] = scope();
                          void restoreLayout(s, k, l.area, v.version)
                            .then(load)
                            .then(refresh)
                            .then(() => toast(`Version ${v.version} is back`, 'success'))
                            .catch((err) => toast(getErrorMessage(err), 'error'));
                        }}
                      >
                        Put back
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreviewTab() {
  const [role, setRole] = useState('ROLE_OPERATOR');
  const [result, setResult] = useState<Record<string, ResolvedLayout> | null>(null);

  useEffect(() => {
    previewRole(role)
      .then(setResult)
      .catch((err) => toast(getErrorMessage(err), 'error'));
  }, [role]);

  return (
    <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <div className="flex items-center gap-2">
        <label htmlFor="preview-role" className="text-[13px] font-medium text-slate-700">
          What a new
        </label>
        <select id="preview-role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-[13px]">
          {[{ value: 'ROLE_ADMIN', label: 'Administrators' }, ...ROLES].map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <span className="text-[13px] text-slate-700">person starts with</span>
      </div>
      {result && Object.keys(result).length === 0 && <p className="py-4 text-center text-sm text-slate-400">The built-in arrangement everywhere.</p>}
      {result && (
        <ul className="divide-y divide-line text-[13px]">
          {Object.values(result).map((r) => {
            const order = Array.isArray(r.config.order) ? (r.config.order as string[]) : [];
            const hidden = Array.isArray(r.config.hidden) ? (r.config.hidden as string[]) : [];
            const columns = Array.isArray(r.config.columns) ? (r.config.columns as string[]) : [];
            return (
              <li key={r.area} className="py-2.5">
                <p className="font-medium text-slate-800">
                  {areaLabel(r.area)} <span className="text-[11px] font-normal text-slate-400">from {r.source === 'GLOBAL' ? 'everyone' : 'the role'}{r.locked ? ', locked' : ''}</span>
                </p>
                {order.length > 0 && <p className="text-[12px] text-slate-600">Order: {order.join(' → ')}</p>}
                {hidden.length > 0 && <p className="text-[12px] text-slate-600">Hidden: {hidden.join(', ')}</p>}
                {columns.length > 0 && <p className="text-[12px] text-slate-600">Columns: {columns.join(', ')}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
