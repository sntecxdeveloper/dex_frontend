import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { getDeletedDevices, restoreDevice, restoreDevices } from '../../api/deviceApi';
import { getDeletedIssues, restoreIssue, restoreIssues } from '../../api/issueApi';
import { formatDateTime } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../../components/common/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import type { Device, Issue } from '../../types';

type Tab = 'devices' | 'issues';

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'neutral' | 'info'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'warning',
  LOW: 'info',
};

const STATUS_TONE: Record<string, 'danger' | 'info' | 'success' | 'neutral'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

export default function DeletedItemsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [tab, setTab] = useState<Tab>('devices');

  const [devices, setDevices] = useState<Device[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actingOn, setActingOn] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  // Render the list in chunks — thousands of deleted issues would otherwise freeze the tab
  const [visibleCount, setVisibleCount] = useState(50);

  const canRestoreDevices =
    !!user?.role && ACTION_PERMISSIONS.DELETE_DEVICE.includes(user.role);
  const canRestoreIssues =
    !!user?.role && ACTION_PERMISSIONS.DELETE_ISSUE.includes(user.role);
  const canRestore = tab === 'devices' ? canRestoreDevices : canRestoreIssues;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'devices') {
        setDevices(await getDeletedDevices());
      } else {
        setIssues(await getDeletedIssues());
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedIds([]);
    setVisibleCount(50);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const switchTab = (next: Tab) => {
    if (next !== tab) setTab(next);
  };

  const filteredDevices = useMemo(() => {
    if (!search) return devices;
    const q = search.toLowerCase();
    return devices.filter(
      (d) =>
        d.hostname.toLowerCase().includes(q) ||
        d.agentId.toLowerCase().includes(q) ||
        (d.ipAddress ?? '').toLowerCase().includes(q) ||
        (d.os ?? '').toLowerCase().includes(q)
    );
  }, [devices, search]);

  const filteredIssues = useMemo(() => {
    if (!search) return issues;
    const q = search.toLowerCase();
    return issues.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.issueCode ?? '').toLowerCase().includes(q) ||
        (i.hostname ?? '').toLowerCase().includes(q)
    );
  }, [issues, search]);

  const rendered = (tab === 'devices' ? filteredDevices : filteredIssues).slice(0, visibleCount);
  const total = tab === 'devices' ? filteredDevices.length : filteredIssues.length;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? rendered.map((i) => (tab === 'devices' ? (i as Device).id : (i as Issue).id)) : []);
  };

  const handleRestoreOne = async (id: number) => {
    setActingOn(id);
    try {
      if (tab === 'devices') {
        await restoreDevice(id);
      } else {
        await restoreIssue(id);
      }
      toast(`${tab === 'devices' ? 'Device' : 'Issue'} restored`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setActingOn(null);
      void load();
    }
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    const n = selectedIds.length;
    const ok = window.confirm(`Restore ${n} deleted ${tab === 'devices' ? 'device' : 'issue'}${n === 1 ? '' : 's'}?`);
    if (!ok) return;
    setRestoring(true);
    try {
      if (tab === 'devices') {
        await restoreDevices(selectedIds);
      } else {
        await restoreIssues(selectedIds);
      }
      setSelectedIds([]);
      toast(`${n} ${tab === 'devices' ? 'device' : 'issue'}${n === 1 ? '' : 's'} restored`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setRestoring(false);
      void load();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-600">
            Recycle bin
          </p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">
            Deleted Items
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Soft-deleted devices and issues. Restore them to bring them back to the fleet.
          </p>
        </div>
        {selectedIds.length > 0 && canRestore && (
          <Button variant="primary" size="sm" loading={restoring} onClick={() => void handleBulkRestore()}>
            Restore {selectedIds.length}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5">
        {(['devices', 'issues'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`rounded-md px-3.5 py-1.5 font-mono text-[11px] font-medium capitalize transition-all duration-150 ${
              tab === t
                ? 'bg-primary-600 text-white shadow-sm ring-1 ring-inset ring-primary-700'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="relative w-full lg:w-72">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(50);
          }}
          placeholder={tab === 'devices' ? 'Search hostname, agent id, IP…' : 'Search title, code, device…'}
          className="h-9 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center rounded-xl border border-red-500/25 bg-red-500/[0.06] px-6 py-12 text-center">
          <p className="text-sm font-medium text-red-200">Couldn’t load deleted items</p>
          <p className="mt-1 text-xs text-red-300/70">{error}</p>
          <Button size="sm" className="mt-5" variant="danger" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-line bg-panel">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line/60 px-5 py-4 last:border-b-0">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="hidden h-5 w-24 sm:block" />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-line bg-panel px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
            <svg className="h-6 w-6 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-300">
            {search ? 'Nothing matches your search' : `No deleted ${tab} — the bin is empty`}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {search ? 'Try a different search' : 'Deleted devices and issues will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          {/* column headers */}
          <div className="hidden items-center gap-3 border-b border-line bg-white/[0.015] px-5 py-2.5 md:flex">
            {canRestore && (
              <label className="flex w-6 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={rendered.length > 0 && rendered.every((i) => selectedIds.includes(tab === 'devices' ? (i as Device).id : (i as Issue).id))}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600"
                  aria-label="Select all visible items"
                />
              </label>
            )}
            <p className="flex-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {tab === 'devices' ? 'Device' : 'Issue'}
            </p>
            {tab === 'issues' && (
              <p className="w-24 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Severity
              </p>
            )}
            {tab === 'issues' && (
              <p className="w-28 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Status
              </p>
            )}
            <p className="hidden w-32 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 lg:block">
              {tab === 'devices' ? 'IP address' : 'Device'}
            </p>
            <p className="hidden w-36 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 xl:block">
              Created
            </p>
            <p className="w-24 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Actions
            </p>
          </div>

          {rendered.map((item) => {
            const id = tab === 'devices' ? (item as Device).id : (item as Issue).id;
            const busy = actingOn === id;
            return (
              <div
                key={id}
                className={`flex cursor-default flex-wrap items-center gap-3 border-b border-line/60 px-5 py-3.5 transition-colors last:border-b-0 md:flex-nowrap ${
                  selectedIds.includes(id) ? 'bg-primary-50' : 'hover:bg-slate-50'
                }`}
              >
                {canRestore && (
                  <label className="flex w-6 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(id)}
                      onChange={() => toggleSelect(id)}
                      className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600"
                      aria-label={`Select ${tab === 'devices' ? 'device' : 'issue'} #${id}`}
                    />
                  </label>
                )}

                {tab === 'issues' ? (
                  <>
                    {/* Severity rail */}
                    <span
                      className={`hidden h-9 w-1 shrink-0 rounded-full sm:block ${
                        (item as Issue).severity === 'CRITICAL'
                          ? 'bg-red-400'
                          : (item as Issue).severity === 'HIGH'
                            ? 'bg-orange-400'
                            : (item as Issue).severity === 'MEDIUM'
                              ? 'bg-amber-400'
                              : 'bg-sky-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-500 line-through decoration-slate-400">
                        {(item as Issue).title}
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-slate-600">
                        #{(item as Issue).issueCode ?? id}
                        {(item as Issue).assignedTo ? ` · ${(item as Issue).assignedTo}` : ' · unassigned'}
                      </p>
                    </div>
                    <span className="w-24 shrink-0">
                      <Badge tone={SEVERITY_TONE[(item as Issue).severity] ?? 'neutral'} dot>
                        {(item as Issue).severity}
                      </Badge>
                    </span>
                    <span className="w-28 shrink-0">
                      <Badge tone={STATUS_TONE[(item as Issue).status] ?? 'neutral'} dot>
                        {(item as Issue).status}
                      </Badge>
                    </span>
                    <span className="hidden w-32 truncate font-mono text-[11px] text-slate-500 lg:block">
                      {(item as Issue).hostname || '—'}
                    </span>
                    <span className="hidden w-36 font-mono text-[11px] text-slate-600 xl:block">
                      {formatDateTime((item as Issue).createdAt)}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
                      <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-500 line-through decoration-slate-400">
                        {(item as Device).hostname}
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-slate-600">{(item as Device).agentId}</p>
                    </div>
                    <span className="hidden w-32 truncate font-mono text-[11px] text-slate-500 lg:block">
                      {(item as Device).ipAddress || '—'}
                    </span>
                    <span className="hidden w-36 font-mono text-[11px] text-slate-600 xl:block">
                      {formatDateTime((item as Device).createdAt)}
                    </span>
                  </>
                )}

                {/* Actions */}
                <span className="flex w-24 shrink-0 items-center justify-end gap-1.5">
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
                  ) : canRestore ? (
                    <Button variant="secondary" size="sm" onClick={() => void handleRestoreOne(id)}>
                      Restore
                    </Button>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* footer count */}
      {!error && !loading && total > 0 && (
        <p className="text-right font-mono text-[11px] text-slate-600">
          {rendered.length} of {total} deleted {tab === 'devices' ? 'device' : 'issue'}
          {total === 1 ? '' : 's'}
        </p>
      )}

      {/* show more */}
      {!error && !loading && total > visibleCount && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setVisibleCount((c) => c + 100)}>
            Show more ({total - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}