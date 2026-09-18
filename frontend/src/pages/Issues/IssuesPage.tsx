import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import {
  getIssuesPaged,
  getIssueStats,
  deleteIssues,
  exportIssues,
  type IssueStats,
} from '../../api/issueApi';
import { formatDateTime } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../../components/common/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { getDevices } from '../../api/deviceApi';
import type { Device, Issue } from '../../types';

const SEVERITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const STATUS_OPTIONS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const PAGE_SIZES = [10, 20, 50, 100];

/** Severity badge colors matching the rail colors */
const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'neutral' | 'success'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'warning',
  LOW: 'success',
};

const STATUS_TONE: Record<string, 'danger' | 'info' | 'success' | 'neutral'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export default function IssuesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);

  const severityParam = searchParams.get('severity')?.toUpperCase() ?? 'ALL';
  const statusParam = searchParams.get('status')?.toUpperCase() ?? 'ALL';
  const [severityFilter, setSeverityFilter] = useState(
    (SEVERITY_OPTIONS as readonly string[]).includes(severityParam) ? severityParam : 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState(
    (STATUS_OPTIONS as readonly string[]).includes(statusParam) ? statusParam : 'ALL'
  );
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  const [items, setItems] = useState<Issue[]>([]);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const deviceParam = searchParams.get('device');
  const [deviceFilter, setDeviceFilter] = useState<number | null>(
    deviceParam ? Number(deviceParam) : null
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const canDeleteIssue = !!user?.role && ACTION_PERMISSIONS.DELETE_ISSUE.includes(user.role);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Global filter counts for the segmented controls
  useEffect(() => {
    getIssueStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  // Systems (devices) for the per-system filter
  useEffect(() => {
    getDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  // Reset to first page whenever filters/search change
  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
  }, [severityFilter, statusFilter, deviceFilter, debouncedSearch]);

  const load = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getIssuesPaged({
        page: targetPage,
        size,
        severity: severityFilter === 'ALL' ? undefined : severityFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        agentId: deviceFilter ?? undefined,
        q: debouncedSearch || undefined,
      });
      setItems(result.content);
      setTotal(result.totalElements);
      setTotalPages(result.totalPages);
      setPage(result.page);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severityFilter, statusFilter, deviceFilter, debouncedSearch, size]);

  // Close the export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const severityCounts = useMemo(
    () => ({
      CRITICAL: stats?.critical ?? 0,
      HIGH: stats?.high ?? 0,
      MEDIUM: stats?.medium ?? 0,
      LOW: stats?.low ?? 0,
    }),
    [stats]
  );

  const statusCounts = useMemo(
    () => ({
      OPEN: stats?.open ?? 0,
      IN_PROGRESS: stats?.inProgress ?? 0,
      RESOLVED: stats?.resolved ?? 0,
      CLOSED: stats?.closed ?? 0,
    }),
    [stats]
  );

  const openCount = statusCounts.OPEN;

  const setFilter = (kind: 'severity' | 'status', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'ALL') next.delete(kind);
    else next.set(kind, value);
    setSearchParams(next, { replace: true });
    if (kind === 'severity') setSeverityFilter(value);
    else setStatusFilter(value);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map((i) => i.id) : []);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const n = selectedIds.length;
    const ok = window.confirm(`Delete ${n} issue${n === 1 ? '' : 's'}? They will be removed from the list.`);
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteIssues(selectedIds);
      setSelectedIds([]);
      const next = items.length === selectedIds.length && page > 0 ? page - 1 : page;
      void load(next);
      getIssueStats().then(setStats).catch(() => undefined);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    setExportOpen(false);
    try {
      await exportIssues(format);
      toast(`Issues exported as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setExporting(null);
    }
  };

  const goToPage = (p: number) => {
    const clamped = Math.max(0, Math.min(p, Math.max(totalPages - 1, 0)));
    if (clamped !== page) void load(clamped);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-600">
            Incident triage
          </p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">
            Issues
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Detect, triage and resolve problems across the fleet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={openCount > 0 ? 'danger' : 'success'} dot pulse>
            {openCount} open
          </Badge>
          {selectedIds.length > 0 && (
            <Button variant="danger" size="sm" loading={deleting} onClick={() => void handleBulkDelete()}>
              Delete {selectedIds.length}
            </Button>
          )}
          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <Button
              variant="secondary"
              size="sm"
              loading={exporting !== null}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              }
              onClick={() => setExportOpen((v) => !v)}
            >
              Export
            </Button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
                <button
                  onClick={() => void handleExport('csv')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 hover:text-slate-900"
                >
                  CSV file
                </button>
                <button
                  onClick={() => void handleExport('json')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 hover:text-slate-900"
                >
                  JSON file
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search */}
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, code, device…"
            className="h-9 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Severity */}
          <Segmented
            options={SEVERITY_OPTIONS}
            value={severityFilter}
            onChange={(v) => setFilter('severity', v)}
            counts={severityCounts}
          />
          {/* System (device) filter — issues per system */}
          <select
            value={deviceFilter ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              setDeviceFilter(value ? Number(value) : null);
              const next = new URLSearchParams(searchParams);
              if (value) next.set('device', value);
              else next.delete('device');
              setSearchParams(next, { replace: true });
            }}
            className="h-9 self-start rounded-lg border border-line bg-panel px-2.5 text-[13px] text-slate-700 transition-colors hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:self-auto"
            aria-label="Filter by system"
          >
            <option value="">All systems</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.hostname}
              </option>
            ))}
          </select>
          {/* Status */}
          <Segmented
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => setFilter('status', v)}
            counts={statusCounts}
          />
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-9 self-start rounded-lg border border-line bg-panel px-2.5 text-[13px] text-slate-700 transition-colors hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:self-auto"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center rounded-xl border border-red-500/25 bg-red-500/[0.06] px-6 py-12 text-center">
          <p className="text-sm font-medium text-red-200">Couldn’t load issues</p>
          <p className="mt-1 text-xs text-red-300/70">{error}</p>
          <Button size="sm" className="mt-5" variant="danger" onClick={() => void load(page)}>
            Retry
          </Button>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line/60 px-5 py-4 last:border-b-0">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="hidden h-5 w-24 sm:block" />
              <Skeleton className="hidden h-5 w-32 lg:block" />
              <Skeleton className="hidden h-5 w-40 xl:block" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-line bg-panel px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
            <svg className="h-6 w-6 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500">No issues match</p>
          <p className="mt-1 text-xs text-slate-600">
            {searchInput ? 'Try a different search' : 'Nothing here — the fleet is behaving.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          {/* column headers */}
          <div className="hidden items-center gap-3 border-b border-line bg-white/[0.015] px-5 py-3 md:flex">
            {canDeleteIssue && (
              <label className="flex w-6 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={items.length > 0 && items.every((i) => selectedIds.includes(i.id))}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600"
                  aria-label="Select all visible issues"
                />
              </label>
            )}
            <p className="flex-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Issue
            </p>
            <p className="w-28 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Severity
            </p>
            <p className="w-28 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Status
            </p>
            <p className="hidden w-36 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:block">
              Device
            </p>
            <p className="hidden w-40 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 xl:block">
              Created
            </p>
          </div>

          {items.map((issue) => {
            return (
              <div
                key={issue.id}
                onClick={() => navigate(`/issues/${issue.id}`)}
                className={`group flex cursor-pointer flex-wrap items-center gap-3 border-b border-line/60 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-slate-50 md:flex-nowrap ${
                  selectedIds.includes(issue.id) ? 'bg-primary-500/[0.06]' : ''
                }`}
              >
                {canDeleteIssue && (
                  <label
                    className="flex w-6 shrink-0 items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(issue.id)}
                      onChange={() => toggleSelect(issue.id)}
                      className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600"
                      aria-label={`Select issue #${issue.issueCode ?? issue.id}`}
                    />
                  </label>
                )}
                {/* Severity rail */}
                <span
                  className={`hidden h-9 w-1 shrink-0 rounded-full sm:block ${
                    issue.severity === 'CRITICAL'
                      ? 'bg-red-400'
                      : issue.severity === 'HIGH'
                        ? 'bg-orange-400'
                        : issue.severity === 'MEDIUM'
                          ? 'bg-amber-400'
                          : 'bg-green-400'
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800 transition-colors group-hover:text-slate-900">
                    {issue.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    {issue.issueCode ? `#${issue.issueCode}` : `#${issue.id}`}
                    {issue.assignedTo ? ` · ${issue.assignedTo}` : ' · unassigned'}
                  </p>
                </div>

                <span className="w-28 shrink-0">
                  <Badge tone={SEVERITY_TONE[issue.severity] ?? 'neutral'} dot>
                    {issue.severity}
                  </Badge>
                </span>

                <span className="w-28 shrink-0">
                  <Badge
                    tone={STATUS_TONE[issue.status] ?? 'neutral'}
                    dot
                    pulse={issue.status === 'OPEN' || issue.status === 'IN_PROGRESS'}
                  >
                    {STATUS_LABEL[issue.status] ?? issue.status}
                  </Badge>
                </span>

                <span className="hidden w-36 truncate font-mono text-[12px] text-slate-600 lg:block">
                  {issue.hostname || '—'}
                </span>

                <span className="hidden w-40 font-mono text-[12px] text-slate-500 xl:block">
                  {formatDateTime(issue.createdAt)}
                </span>

                {/* Actions */}
                <span className="flex w-40 shrink-0 items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="rounded-md border border-line p-1.5 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* footer */}
      {!error && !(loading && items.length === 0) && total > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] text-slate-600">
            {items.length} of {total} issue{total === 1 ? '' : 's'}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <p className="font-mono text-[11px] text-slate-600">
                Page {page + 1} of {totalPages}
              </p>
              <Button variant="secondary" size="sm" disabled={page <= 0} onClick={() => goToPage(page - 1)}>
                ← Prev
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => goToPage(page + 1)}>
                Next →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Segmented({
  options,
  value,
  onChange,
  counts,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5">
      {options.map((opt) => {
        const active = value === opt;
        const toneClass =
          opt === 'CRITICAL' || opt === 'OPEN'
            ? 'text-red-300'
            : opt === 'HIGH'
              ? 'text-orange-300'
              : opt === 'MEDIUM' || opt === 'IN_PROGRESS'
                ? 'text-amber-300'
                : opt === 'LOW'
                  ? 'text-green-300'
                  : opt === 'RESOLVED'
                    ? 'text-emerald-300'
                    : 'text-slate-300';
        const dotColor =
          opt === 'CRITICAL'
            ? 'bg-red-400'
            : opt === 'HIGH'
              ? 'bg-orange-400'
              : opt === 'MEDIUM'
                ? 'bg-amber-400'
                : opt === 'LOW'
                  ? 'bg-green-400'
                  : null;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] font-medium transition-all duration-150 ${
              active ? 'bg-primary-600 text-white shadow-sm ring-1 ring-inset ring-primary-700' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {opt === 'ALL' ? 'All' : (
              <span className="inline-flex items-center gap-1">
                {dotColor && (
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
                )}
                <span>{opt.replace(/_/g, ' ')}</span>
                <span className={`${active ? toneClass : 'text-slate-600'}`}>{counts[opt] ?? 0}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}