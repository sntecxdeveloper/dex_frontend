import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deleteDevices, getAllDevicesDetailed, getHealthSummary, exportDevices } from '../../api/deviceApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatDate, formatRelativeTime } from '../../utils/formatDate';
import { toast } from '../../components/common/Toast';
import DeviceTable from '../../components/devices/DeviceTable';
import ListToolbar from '../../components/listview/ListToolbar';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useDeviceStatusUpdates } from '../../hooks/useWebSocket';
import { useListView } from '../../hooks/useListView';
import { newRuleId, type ChoiceOption, type Field, type QuickFilter } from '../../utils/listView';
import type { Device } from '../../types/device';

const STATUSES = ['ONLINE', 'OFFLINE', 'ERROR', 'ENROLLING'];
const PAGE_SIZES = [10, 20, 50, 100];
const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : null);

const QUICK: QuickFilter[] = [
  { id: 'online', label: 'Online', rules: [{ field: 'status', op: 'is_any_of', value: '', values: ['ONLINE'] }] },
  { id: 'offline', label: 'Offline', rules: [{ field: 'status', op: 'is_any_of', value: '', values: ['OFFLINE'] }] },
  { id: 'problems', label: 'Needs attention', rules: [{ field: 'status', op: 'is_any_of', value: '', values: ['OFFLINE', 'ERROR'] }] },
  { id: 'issues', label: 'Has open issues', rules: [{ field: 'issues', op: 'gt', value: '0' }] },
  { id: 'silent', label: 'Not seen for a day', rules: [{ field: 'lastSeen', op: 'older_than_days', value: '1' }] },
  { id: 'nogroup', label: 'In no group', rules: [{ field: 'groups', op: 'is_empty', value: '' }] },
  { id: 'noplace', label: 'No location', rules: [{ field: 'location', op: 'is_empty', value: '' }] },
];

const fields: Field<Device>[] = [
  { key: 'device', label: 'Device', type: 'text', value: (d) => d.hostname, fixed: true },
  { key: 'agentId', label: 'Agent ID', type: 'text', value: (d) => d.agentId },
  { key: 'ip', label: 'IP address', type: 'text', value: (d) => d.ipAddress, initial: true },
  { key: 'os', label: 'Operating system', type: 'choice', value: (d) => d.os, text: (d) => `${d.os ?? ''}${d.osVersion ? ' ' + d.osVersion : ''}`.trim(), initial: true, groupable: true },
  { key: 'osVersion', label: 'OS version', type: 'text', value: (d) => d.osVersion },
  { key: 'location', label: 'Location', type: 'text', value: (d) => d.location, initial: true, groupable: true },
  { key: 'region', label: 'Region', type: 'text', value: (d) => d.region, initial: true, groupable: true },
  { key: 'groups', label: 'Groups', type: 'list', value: (d) => d.groups ?? [], groupable: true },
  { key: 'agentVersion', label: 'Agent version', type: 'choice', value: (d) => d.agentVersion, groupable: true },
  { key: 'enrolled', label: 'Enrolled', type: 'date', value: (d) => ms(d.createdAt), text: (d) => (d.createdAt ? formatDate(d.createdAt) : '') },
  { key: 'cpu', label: 'CPU', type: 'text', value: (d) => d.cpuModel },
  { key: 'ram', label: 'Memory (GB)', type: 'number', value: (d) => (d.ramGb ? Math.round(d.ramGb) : null), text: (d) => (d.ramGb ? `${Math.round(d.ramGb)} GB` : '') },
  { key: 'disk', label: 'Disk (GB)', type: 'number', value: (d) => (d.diskGb ? Math.round(d.diskGb) : null), text: (d) => (d.diskGb ? `${Math.round(d.diskGb)} GB` : '') },
  {
    key: 'status', label: 'Status', type: 'choice', value: (d) => d.status, initial: true, groupable: true,
    options: (): ChoiceOption[] => STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })),
  },
  { key: 'lastSeen', label: 'Last seen', type: 'date', value: (d) => ms(d.lastHeartbeat), text: (d) => (d.lastHeartbeat ? formatRelativeTime(d.lastHeartbeat) : ''), initial: true },
  { key: 'issues', label: 'Issues', type: 'number', value: (d) => d.openIssueCount ?? 0, initial: true },
];

/** Every machine running the agent, as an advanced list: filter builder, quick filters, sort, fields, grouping and saved views. */
export default function DevicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [devices, setDevices] = useState<Device[]>([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [onlineCount, setOnlineCount] = useState(0);
  const [problemCount, setProblemCount] = useState(0);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const list = useListView<Device>({ storageKey: 'dex.devices.list', fields, rows: devices, quick: QUICK, defaultSort: { field: 'device', dir: 'asc' } });
  const { view, setView } = list;

  // Links from elsewhere: /devices?status=ONLINE (dashboard) and /devices?agent=... (search)
  const statusParam = (searchParams.get('status') ?? '').toUpperCase();
  const agentParam = searchParams.get('agent') ?? '';
  useEffect(() => {
    if (!statusParam && !agentParam) return;
    setView((v) => ({
      ...v,
      search: agentParam || v.search,
      rules: STATUSES.includes(statusParam) ? [{ id: newRuleId(), field: 'status', op: 'is_any_of', value: '', values: [statusParam] }] : v.rules,
    }));
    setSearchParams({}, { replace: true });
    // only when a link brings a filter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusParam, agentParam]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setDevices(await getAllDevicesDetailed());
    } catch (err) {
      if (!quiet) setError(getErrorMessage(err));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const refreshHealth = useCallback(() => {
    getHealthSummary()
      .then((s) => {
        setOnlineCount(s.onlineAgents);
        setProblemCount(s.totalAgents - s.onlineAgents);
      })
      .catch(() => {
        /* badges are optional */
      });
  }, []);

  useEffect(() => {
    void load();
    refreshHealth();
  }, [load, refreshHealth]);

  // Real-time: when a device changes status the list and badges refresh quietly.
  const handleStatusChange = useCallback(() => {
    refreshHealth();
    void load(true);
  }, [load, refreshHealth]);
  const { isConnected: wsConnected } = useDeviceStatusUpdates(handleStatusChange);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const grouped = view.groupBy !== null;
  const rows = list.processed;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages - 1);
  const sections = useMemo(
    () => (grouped ? list.groups : [{ key: '', label: '', rows: rows.slice(current * size, (current + 1) * size) }]),
    [grouped, list.groups, rows, current, size],
  );

  const sortBy = (key: string, additive: boolean) =>
    setView((v) => {
      const at = v.sorts.findIndex((s) => s.field === key);
      if (!additive) return { ...v, sorts: [{ field: key, dir: at === 0 && v.sorts[0].dir === 'asc' ? 'desc' : 'asc' }] };
      if (at === -1) return { ...v, sorts: [...v.sorts, { field: key, dir: 'asc' }] };
      return { ...v, sorts: v.sorts.map((s) => (s.field === key ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s)) };
    });

  const toggleSelect = (id: number) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAll = (checked: boolean) => setSelectedIds(checked ? sections.flatMap((s) => s.rows).map((d) => d.id) : []);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const n = selectedIds.length;
    if (!window.confirm(`Delete ${n} device${n === 1 ? '' : 's'}? It will be removed from the list (its history is kept).`)) return;
    setDeleting(true);
    try {
      await deleteDevices(selectedIds);
      setSelectedIds([]);
      refreshHealth();
      void load(true);
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

  const selectClass =
    'h-8 rounded-lg border border-line bg-white px-2 text-xs text-slate-700 transition-colors hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-600">Fleet inventory</p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">Devices</h1>
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
          <span
            title={wsConnected ? 'Live — listening for device changes' : 'Disconnected — click Refresh to update'}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] font-medium ${
              wsConnected ? 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-500/20' : 'bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-300/40'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            {wsConnected ? 'Live' : 'Offline'}
          </span>
          {selectedIds.length > 0 && (
            <Button variant="danger" size="sm" loading={deleting} onClick={() => void handleBulkDelete()}>
              Delete {selectedIds.length}
            </Button>
          )}
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
              Export all
            </Button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
                <button onClick={() => void handleExport('csv')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 hover:text-slate-900">
                  CSV file
                </button>
                <button onClick={() => void handleExport('json')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 hover:text-slate-900">
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
            onClick={() => {
              void load();
              refreshHealth();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <ListToolbar
        fields={fields}
        rows={devices}
        shown={rows}
        view={view}
        setView={(next) => {
          setPage(0);
          setSelectedIds([]);
          setView(next);
        }}
        saved={list.saved}
        onSaveView={list.saveCurrent}
        onDeleteView={list.deleteSaved}
        onApplyView={list.applySaved}
        onReset={list.reset}
        quick={QUICK}
        searchPlaceholder="Search hostname, agent ID, IP, place…"
        exportName="devices-view"
      >
        {!grouped && (
          <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} className={selectClass} aria-label="Rows per page">
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        )}
      </ListToolbar>

      {error ? (
        <div className="flex flex-col items-center rounded-xl border border-red-500/25 bg-red-500/[0.06] px-6 py-12 text-center">
          <p className="text-sm font-medium text-red-200">Couldn’t load devices</p>
          <p className="mt-1 text-xs text-red-300/70">{error}</p>
          <Button size="sm" variant="danger" className="mt-5" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <DeviceTable
            columns={list.shown}
            sections={sections}
            grouped={grouped}
            loading={loading}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            sorts={view.sorts}
            onSort={sortBy}
            emptyMessage={devices.length === 0 ? 'Install the DEX agent on a machine and it appears here.' : 'No device matches. Change or clear the filters.'}
          />
          {!loading && !grouped && rows.length > size && (
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] text-slate-600">
                {current * size + 1}–{Math.min((current + 1) * size, rows.length)} of {rows.length} devices
              </p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-[11px] text-slate-600">
                  Page {current + 1} of {pages}
                </p>
                <Button variant="secondary" size="sm" disabled={current <= 0} onClick={() => setPage(current - 1)}>
                  ← Prev
                </Button>
                <Button variant="secondary" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                  Next →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
