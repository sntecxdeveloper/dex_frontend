import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deleteDevices, getDevicesPaged, getHealthSummary, exportDevices } from '../../api/deviceApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../../components/common/Toast';
import DeviceTable from '../../components/devices/DeviceTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import type { Device } from '../../types/device';

const STATUS_OPTIONS = ['ALL', 'ONLINE', 'OFFLINE', 'ERROR', 'ENROLLING'] as const;

const PAGE_SIZES = [10, 20, 50, 100];

export default function DevicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status')?.toUpperCase() ?? 'ALL';
  const [statusFilter, setStatusFilter] = useState(
    (STATUS_OPTIONS as readonly string[]).includes(statusParam) ? statusParam : 'ALL'
  );
  const [osFilter, setOsFilter] = useState('ALL');
  const [searchInput, setSearchInput] = useState(searchParams.get('agent') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [onlineCount, setOnlineCount] = useState(0);
  const [problemCount, setProblemCount] = useState(0);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to first page whenever filters/search change
  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
  }, [statusFilter, osFilter, debouncedSearch]);

  const load = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDevicesPaged({
        page: targetPage,
        size,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        os: osFilter === 'ALL' ? undefined : osFilter,
        q: debouncedSearch || undefined,
      });
      setDevices(result.content);
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
  }, [statusFilter, osFilter, debouncedSearch, size]);

  // Health summary for the header badges
  useEffect(() => {
    getHealthSummary()
      .then((s) => {
        setOnlineCount(s.onlineAgents);
        setProblemCount(s.totalAgents - s.onlineAgents);
      })
      .catch(() => {
        /* badges are optional */
      });
  }, []);

  // Close the export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const osOptions = useMemo(() => {
    const set = new Set(devices.map((d) => d.os).filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [devices]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? devices.map((d) => d.id) : []);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const n = selectedIds.length;
    const ok = window.confirm(
      `Delete ${n} device${n === 1 ? '' : 's'}? It will be removed from the list (its history is kept).`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteDevices(selectedIds);
      setSelectedIds([]);
      // If we deleted everything on this page, step back one page
      const next = devices.length === selectedIds.length && page > 0 ? page - 1 : page;
      void load(next);
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
      await exportDevices(format);
      toast(`Devices exported as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setExporting(null);
    }
  };

  const setStatus = (value: string) => {
    setStatusFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'ALL') next.delete('status');
    else next.set('status', value);
    setSearchParams(next, { replace: true });
  };

  const goToPage = (p: number) => {
    const clamped = Math.max(0, Math.min(p, Math.max(totalPages - 1, 0)));
    if (clamped !== page) void load(clamped);
  };

  const selectClass =
    'h-9 rounded-lg border border-line bg-panel px-2.5 text-[13px] text-slate-700 transition-colors hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-600">
            Fleet inventory
          </p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">
            Devices
          </h1>
          <p className="mt-1 text-sm text-slate-500">Every machine running the DEX agent, in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success" dot pulse>
            {onlineCount} online
          </Badge>
          {problemCount > 0 && (
            <Badge tone="warning" dot>
              {problemCount} need attention
            </Badge>
          )}
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
          <Button
            variant="secondary"
            size="sm"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            }
            onClick={() => void load(page)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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
            placeholder="Search hostname, agent ID, IP…"
            className="h-9 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Status chips */}
          <div className="inline-flex items-center gap-0.5 self-start rounded-lg border border-line bg-panel p-0.5 sm:self-auto">
            {STATUS_OPTIONS.map((opt) => {
              const active = statusFilter === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setStatus(opt)}
                  className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] font-medium transition-all duration-150 ${
                    active
                      ? 'bg-primary-600 text-white shadow-sm ring-1 ring-inset ring-primary-700'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {opt === 'ALL' ? 'All' : opt}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <select value={osFilter} onChange={(e) => setOsFilter(e.target.value)} className={selectClass} aria-label="Filter by OS">
              <option value="ALL">All OS</option>
              {osOptions.map((os) => (
                <option key={os} value={os}>
                  {os}
                </option>
              ))}
            </select>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className={selectClass} aria-label="Rows per page">
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center rounded-xl border border-red-500/25 bg-red-500/[0.06] px-6 py-12 text-center">
          <p className="text-sm font-medium text-red-200">Couldn’t load devices</p>
          <p className="mt-1 text-xs text-red-300/70">{error}</p>
          <Button size="sm" variant="danger" className="mt-5" onClick={() => void load(page)}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <DeviceTable
            devices={devices}
            loading={loading}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
          {!loading && total > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-[11px] text-slate-600">
                {devices.length} of {total} devices
                {statusFilter !== 'ALL' ? ` · ${statusFilter.toLowerCase()}` : ''}
                {osFilter !== 'ALL' ? ` · ${osFilter}` : ''}
                {searchInput ? ` · matching “${searchInput}”` : ''}
              </p>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPrev={() => goToPage(page - 1)}
                onNext={() => goToPage(page + 1)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <p className="font-mono text-[11px] text-slate-600">
        Page {page + 1} of {totalPages}
      </p>
      <Button variant="secondary" size="sm" disabled={page <= 0} onClick={onPrev}>
        ← Prev
      </Button>
      <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={onNext}>
        Next →
      </Button>
    </div>
  );
}