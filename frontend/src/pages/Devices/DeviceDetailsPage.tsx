import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchDeviceById } from '../../features/devices/devicesSlice';
import { fetchTelemetry } from '../../features/telemetry/telemetrySlice';
import { useDeviceTelemetry } from '../../hooks/useWebSocket';
import DeviceStatusBadge from '../../components/devices/DeviceStatusBadge';
import CommandDialog from '../../components/devices/CommandDialog';
import ProcessList from '../../components/devices/ProcessList';
import ServiceList, { type ServiceAction, type ServiceActionState, type ServiceRow } from '../../components/devices/ServiceList';
import EventLogTab from '../../components/devices/EventLogTab';
import DeviceFixesTab from '../../components/devices/DeviceFixesTab';
import RemoteTerminal, { type TerminalEntry, type TerminalRunUpdate } from '../../components/devices/RemoteTerminal';
import { deleteDevice, getDeviceEvents, getDeviceServices } from '../../api/deviceApi';
import { getDeviceCommands, queueDeviceCommand, waitForCommandResult, isFinished } from '../../api/commandApi';
import { AGENT_ACTIONS, formatOutput, toTerminalEntries } from '../../utils/agentCommands';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import type { SystemEvent } from '../../types/device';
import type { ProcessInfo, TelemetryData } from '../../types/telemetry';

type TabId = 'overview' | 'metrics' | 'processes' | 'services' | 'events' | 'fixes' | 'terminal';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'processes', label: 'Processes' },
  { id: 'services', label: 'Services' },
  { id: 'events', label: 'Events' },
  { id: 'fixes', label: 'Fixes' },
  { id: 'terminal', label: 'Terminal' },
];

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #dfe8f2',
  borderRadius: '10px',
  fontSize: '12px',
  color: '#0f172a',
  boxShadow: '0 16px 40px -12px rgb(15 23 42 / 0.2)',
};

export default function DeviceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selected: device, loading, error } = useAppSelector((state) => state.devices);
  const { data: telemetry, loading: telemetryLoading } = useAppSelector((state) => state.telemetry);
  const { user } = useAppSelector((state) => state.auth);
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceActions, setServiceActions] = useState<Record<string, ServiceActionState>>({});
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([]);
  const [listError, setListError] = useState('');
  const [liveSnapshot, setLiveSnapshot] = useState<TelemetryData | null>(null);
  const seenLiveIds = useRef<Set<number>>(new Set());

  const canDelete = !!user?.role && ACTION_PERMISSIONS.DELETE_DEVICE.includes(user.role);
  const canSendCommand = ['ROLE_ADMIN', 'ROLE_OPERATOR'].includes(user?.role ?? '');
  const numericId = Number(id);

  useEffect(() => {
    if (id) dispatch(fetchDeviceById(numericId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  useEffect(() => {
    if (device?.agentId) {
      dispatch(fetchTelemetry(device.agentId));
      seenLiveIds.current.clear();
      setLiveSnapshot(null);
    }
  }, [dispatch, device?.agentId]);

  // Live per-agent telemetry stream (backend pushes /topic/telemetry/{agentId}
  // on every telemetry report, ~every 30s) — refreshes the Processes tab and
  // stat tiles without polling.
  useDeviceTelemetry(device?.agentId ?? null, (raw) => {
    const point = raw as TelemetryData;
    if (!point || point.agentId !== device?.agentId) return;
    if (point.id != null) {
      if (seenLiveIds.current.has(point.id)) return;
      seenLiveIds.current.add(point.id);
    }
    setLiveSnapshot(point);
  });

  // Follow-up fetch while the Processes tab is open, so CPU% keeps advancing
  // even if the socket hiccups.
  useEffect(() => {
    if (activeTab !== 'processes' || !device?.agentId) return;
    const timer = setInterval(() => {
      dispatch(fetchTelemetry(device.agentId));
    }, 15_000);
    return () => clearInterval(timer);
  }, [activeTab, device?.agentId, dispatch]);

  const removeDevice = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setTimeout(() => setDeleteArmed(false), 4000);
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteDevice(device!.id);
      navigate('/devices');
    } catch {
      setDeleteError('Failed to delete device. Try again.');
      setDeleting(false);
      setDeleteArmed(false);
    }
  };

  // The agent reports every service it sees each cycle; keep the newest row per name.
  const loadServices = async () => {
    if (!numericId) return;
    setServicesLoading(true);
    setListError('');
    try {
      const rows = await getDeviceServices(numericId);
      const latest = new Map<string, ServiceRow>();
      rows.forEach((s) => {
        if (!latest.has(s.name)) latest.set(s.name, s);
      });
      setServices([...latest.values()].sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setListError('Could not load services from the backend.');
    } finally {
      setServicesLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!numericId) return;
    setEventsLoading(true);
    setListError('');
    try {
      setEvents(await getDeviceEvents(numericId));
    } catch {
      setListError('Could not load events from the backend.');
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'services' || showCommandDialog) void loadServices();
    if (activeTab === 'events') void loadEvents();
    if (activeTab === 'terminal' && numericId) {
      getDeviceCommands(numericId, 50)
        .then((cmds) => setTerminalHistory(toTerminalEntries(cmds)))
        .catch(() => setTerminalHistory([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, showCommandDialog, numericId]);

  const runServiceAction = async (serviceName: string, actionType: ServiceAction) => {
    const def = AGENT_ACTIONS.find((a) => a.id === actionType);
    if (!def) return;
    setServiceActions((prev) => ({ ...prev, [serviceName]: { state: 'running', message: 'Waiting for the user to approve' } }));
    try {
      const queued = await queueDeviceCommand(numericId, def.build(serviceName));
      const final = await waitForCommandResult(numericId, queued.commandId, { agentId: device?.agentId });
      const ok = final?.status === 'COMPLETED';
      setServiceActions((prev) => ({
        ...prev,
        [serviceName]: {
          state: final && isFinished(final.status) ? (ok ? 'done' : 'failed') : 'failed',
          message: final && isFinished(final.status) ? formatOutput(final.result) : 'No result yet - check the Terminal tab later',
        },
      }));
      if (ok) void loadServices();
    } catch {
      setServiceActions((prev) => ({ ...prev, [serviceName]: { state: 'failed', message: 'Could not queue the command' } }));
    }
    setTimeout(
      () => setServiceActions((prev) => Object.fromEntries(Object.entries(prev).filter(([name]) => name !== serviceName))),
      8000,
    );
  };

  const handleRemoteCommand = async (command: string, update: (u: TerminalRunUpdate) => void) => {
    const queued = await queueDeviceCommand(numericId, { type: 'SCRIPT', action: command });
    update({ state: 'running', note: `#${queued.commandId.slice(0, 8)}` });
    const final = await waitForCommandResult(numericId, queued.commandId, { agentId: device?.agentId });
    if (final && isFinished(final.status)) {
      update({ state: final.status === 'COMPLETED' ? 'done' : 'failed', output: formatOutput(final.result) });
    } else {
      update({
        state: 'failed',
        output: 'No result after 5 minutes. It may still be waiting for the user to approve - reopen this tab later to see it.',
      });
    }
  };

  // Live snapshot (WebSocket telemetry) falls back to the newest fetched point.
  const live = liveSnapshot ?? telemetry[0];

  // Processes tab: newest process list, sorted by CPU% descending so the most
  // active processes surface first (the agent reports top-by-memory, so sort here).
  const processesByCpu = useMemo<ProcessInfo[]>(() => {
    const list = live?.topProcesses ?? [];
    return [...list].sort((a, b) => (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0));
  }, [live?.topProcesses]);
  const processesFetchedAt = live?.recordedAt;

  // Metrics tab: "which app is using how much" alongside the usage-over-time
  // charts, not buried in the separate Processes tab - same live data, just
  // the top 5 by each metric for an at-a-glance graph.
  const topProcessesByCpu5 = useMemo(() => processesByCpu.slice(0, 5), [processesByCpu]);
  const topProcessesByMemory5 = useMemo<ProcessInfo[]>(() => {
    const list = live?.topProcesses ?? [];
    return [...list].sort((a, b) => (b.memoryBytes ?? 0) - (a.memoryBytes ?? 0)).slice(0, 5);
  }, [live?.topProcesses]);

  /* ---- loading / error ---- */
  if (loading && !device) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-xl border border-line bg-panel p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (error && !device) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-red-500/25 bg-red-500/[0.06] px-6 py-16 text-center">
        <p className="text-sm font-medium text-red-600">Couldn’t load this device</p>
        <p className="mt-1 text-xs text-red-500">{error}</p>
        <Button size="sm" variant="danger" className="mt-5" onClick={() => dispatch(fetchDeviceById(numericId))}>
          Retry
        </Button>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-line bg-panel px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-300">Device not found</p>
        <Button size="sm" variant="secondary" className="mt-5" onClick={() => navigate('/devices')}>
          Back to devices
        </Button>
      </div>
    );
  }

  const latest = live;
  const chartData = telemetry.map((t) => ({
    time: formatDateTime(t.recordedAt),
    CPU: t.cpuUsage,
    Memory: t.memoryUsage,
    Disk: t.diskUsage,
    'Net In': t.networkIn,
    'Net Out': t.networkOut,
  }));
  const hardware = device.hardware;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={() => navigate('/devices')}
        className="group inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line transition-colors group-hover:border-line-strong">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </span>
        Back to devices
      </button>

      {/* Header */}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-slate-900">
                {device.hostname}
              </h1>
              <DeviceStatusBadge status={device.status} />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetaItem label="Agent ID" value={device.agentId} mono />
              <MetaItem label="IP address" value={device.ipAddress || '—'} mono />
              <MetaItem label="OS" value={`${device.os || '—'}${device.osVersion ? ` ${device.osVersion}` : ''}`} />
              <MetaItem label="Agent version" value={device.agentVersion || '—'} mono />
              <MetaItem label="Enrolled" value={device.createdAt ? formatDateTime(device.createdAt) : '—'} />
              <MetaItem label="Last heartbeat" value={device.lastHeartbeat ? formatRelativeTime(device.lastHeartbeat) : '—'} />
            </dl>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canSendCommand && (
              <Button
                size="sm"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" />
                  </svg>
                }
                onClick={() => setShowCommandDialog(true)}
              >
                Send command
              </Button>
            )}
            {canDelete && (
              <Button
                variant={deleteArmed ? 'danger' : 'ghost'}
                size="sm"
                loading={deleting}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                }
                onClick={() => void removeDevice()}
                title={deleteArmed ? 'Click again to confirm' : 'Delete device'}
              >
                {deleteArmed ? 'Confirm delete' : 'Delete'}
              </Button>
            )}
          </div>
        </div>
        {deleteError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {deleteError}
          </p>
        )}
      </Panel>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative shrink-0 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                active ? 'text-primary-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {active && (
                <motion.span
                  layoutId="device-tab"
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-primary-500"
                  style={{ boxShadow: '0 0 8px rgba(2,132,199,0.45)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatTile label="CPU" value={latest ? `${latest.cpuUsage}%` : '—'} tone="text-primary-300" />
              <StatTile label="Memory" value={latest ? `${latest.memoryUsage}%` : '—'} tone="text-emerald-300" />
              <StatTile label="Disk" value={latest ? `${latest.diskUsage}%` : '—'} tone="text-amber-300" />
              <StatTile label="Processes" value={latest ? String(latest.processCount ?? '—') : '—'} tone="text-sky-300" />
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatTile
                label="CPU temp"
                value={latest?.cpuTemperature ? `${latest.cpuTemperature}°C` : '—'}
                tone={latest?.cpuTemperature && latest.cpuTemperature > 80 ? 'text-red-300' : 'text-orange-300'}
              />
              {hardware?.batteryChargePercent != null && hardware.batteryChargePercent > 0 ? (
                <StatTile
                  label="Battery"
                  value={`${hardware.batteryChargePercent}% ${hardware.batteryStatus === 2 ? '⚡' : '🔋'}`}
                  tone="text-emerald-300"
                />
              ) : (
                <StatTile label="Battery" value="—" tone="text-slate-500" />
              )}
            </div>

            {hardware ? (
              <Panel>
                <div className="mb-4">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">Inventory</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-100">Hardware</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm md:grid-cols-3">
                  <InfoItem label="CPU" value={hardware.cpuModel} />
                  <InfoItem label="Cores" value={`${hardware.cpuCores}C / ${hardware.cpuLogicalProcessors}T`} />
                  <InfoItem label="RAM" value={`${hardware.ramTotalGB} GB`} />
                  {hardware.gpus.length > 0 && (
                    <InfoItem label="GPU" value={`${hardware.gpus[0].name} (${hardware.gpus[0].vramGB} GB)`} />
                  )}
                  <InfoItem label="Motherboard" value={hardware.motherboardModel} />
                  <InfoItem label="BIOS" value={hardware.biosVersion} />
                  <InfoItem label="Uptime" value={`${hardware.uptimeHours}h`} />
                  <InfoItem
                    label="Disks"
                    value={hardware.disks.map((d) => `${d.label || d.name} ${d.totalGB}GB`).join(' · ')}
                  />
                  {hardware.batteryChargePercent != null && hardware.batteryChargePercent > 0 && (
                    <InfoItem
                      label="Battery"
                      value={`${hardware.batteryChargePercent}% ${hardware.batteryStatus === 2 ? '(on AC)' : '(on battery)'}`}
                    />
                  )}
                </div>

                {hardware.networkAdapters && hardware.networkAdapters.length > 0 && (
                  <div className="mt-5 border-t border-line pt-4">
                    <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
                      Network adapters
                    </p>
                    <div className="space-y-2">
                      {hardware.networkAdapters.map((nic) => (
                        <div key={`${nic.name}-${nic.macAddress}`} className="rounded-lg border border-line/70 bg-slate-50 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-mono text-xs font-medium text-slate-700">{nic.name}</span>
                            {nic.description && (
                              <span className="truncate text-[11px] text-slate-500">{nic.description}</span>
                            )}
                            {nic.macAddress && (
                              <span className="ml-auto font-mono text-[11px] text-slate-500">{nic.macAddress}</span>
                            )}
                          </div>
                          {nic.ipAddresses && nic.ipAddresses.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {nic.ipAddresses.map((ip) => (
                                <span key={ip} className="rounded bg-sky-50 px-1.5 py-0.5 font-mono text-[11px] text-sky-700">
                                  {ip}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            ) : (
              <Panel className="border-dashed">
                <p className="py-2 text-center text-xs text-slate-600">
                  Hardware inventory hasn’t been reported by this agent yet.
                </p>
              </Panel>
            )}

            {latest?.driveMetrics && latest.driveMetrics.length > 0 && (
              <Panel>
                <div className="mb-4">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">Storage</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-100">Disk usage</h3>
                </div>
                <div className="space-y-3.5">
                  {latest.driveMetrics.map((drive) => {
                    const danger = drive.usedPercent > 90;
                    const warn = drive.usedPercent > 70;
                    return (
                      <div key={drive.name} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 truncate font-mono text-xs text-slate-300">{drive.name}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${danger ? 'bg-red-400' : warn ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(drive.usedPercent, 100)}%`, boxShadow: danger ? '0 0 8px rgba(248,113,113,0.5)' : undefined }}
                          />
                        </div>
                        <span className="w-36 shrink-0 text-right font-mono text-[11px] text-slate-500">
                          {drive.usedGB} / {drive.totalGB} GB · {drive.usedPercent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* ── METRICS ── */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">Telemetry</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-100">Live metrics</h3>
              </div>
              <Badge tone={device.status === 'ONLINE' ? 'success' : 'warning'} dot pulse>
                {device.status === 'ONLINE' ? 'streaming' : 'no live stream'}
              </Badge>
            </div>

            {telemetryLoading ? (
              <Panel>
                <Skeleton className="h-56 w-full" />
              </Panel>
            ) : chartData.length === 0 ? (
              <Panel className="flex h-52 flex-col items-center justify-center border-dashed">
                <p className="text-sm text-slate-500">No telemetry reported yet</p>
                <p className="mt-1 text-xs text-slate-600">Telemetry arrives on the next agent heartbeat.</p>
              </Panel>
            ) : (
              <>
                <ChartPanel
                  title="CPU & memory"
                  subtitle="Usage (%) over time"
                  lines={[
                    { key: 'CPU', color: '#0ea5e9' },
                    { key: 'Memory', color: '#34d399' },
                  ]}
                  data={chartData}
                />
                <ChartPanel
                  title="Disk & network"
                  subtitle="Disk (%) · network I/O"
                  lines={[
                    { key: 'Disk', color: '#fbbf24' },
                    { key: 'Net In', color: '#38bdf8' },
                    { key: 'Net Out', color: '#f87171' },
                  ]}
                  data={chartData}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TopProcessesChart
                    title="Top processes by CPU"
                    processes={topProcessesByCpu5}
                    color="#0ea5e9"
                    valueOf={(p) => p.cpuPercent}
                    formatValue={(v) => `${v.toFixed(1)}%`}
                  />
                  <TopProcessesChart
                    title="Top processes by memory"
                    processes={topProcessesByMemory5}
                    color="#34d399"
                    valueOf={(p) => p.memoryBytes}
                    formatValue={formatBytes}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PROCESSES ── */}
        {activeTab === 'processes' && (
          <Panel padded={false} className="overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-2 px-5 pb-3 pt-5">
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">Processes</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-100">Top by CPU</h3>
              </div>
              <div className="flex items-center gap-3">
                {processesFetchedAt && (
                  <span className="text-[11px] text-slate-500">
                    Updated {formatRelativeTime(processesFetchedAt)}
                  </span>
                )}
                <Badge tone={device.status === 'ONLINE' ? 'success' : 'warning'} dot pulse>
                  {device.status === 'ONLINE' ? 'live' : 'no live stream'}
                </Badge>
              </div>
            </div>
            <div className="border-t border-line">
              {/* No Kill action: the agent has no stop-process task, and Stop-Process/taskkill
                  aren't on its allow-list, so a kill button would always be refused. */}
              <ProcessList processes={processesByCpu} />
            </div>
          </Panel>
        )}

        {/* ── SERVICES ── */}
        {activeTab === 'services' && (
          <Panel padded={false} className="overflow-hidden">
            <ListHeader
              eyebrow="Services"
              title="Windows services"
              loading={servicesLoading}
              onRefresh={() => void loadServices()}
              error={listError}
            />
            <div className="border-t border-line">
              <ServiceList
                services={services}
                onAction={canSendCommand ? (name, action) => void runServiceAction(name, action) : undefined}
                actionStates={serviceActions}
              />
            </div>
          </Panel>
        )}

        {/* ── EVENTS ── */}
        {activeTab === 'events' && (
          <Panel padded={false} className="overflow-hidden">
            <ListHeader
              eyebrow="Event log"
              title="Recent Windows events"
              loading={eventsLoading}
              onRefresh={() => void loadEvents()}
              error={listError}
            />
            <div className="border-t border-line">
              <EventLogTab events={events} loading={eventsLoading} />
            </div>
          </Panel>
        )}

        {/* ── FIXES ── */}
        {activeTab === 'fixes' && (
          <DeviceFixesTab deviceId={device.id} agentId={device.agentId} onRunFix={canSendCommand ? () => setShowCommandDialog(true) : undefined} />
        )}

        {/* ── TERMINAL ── */}
        {activeTab === 'terminal' && (
          <Panel padded={false} className="overflow-hidden" style={{ height: '520px' }}>
            {canSendCommand ? (
              <RemoteTerminal
                agentId={device.agentId}
                online={device.status === 'ONLINE'}
                initialEntries={terminalHistory}
                onExecute={handleRemoteCommand}
              />
            ) : (
              <p className="p-6 text-sm text-slate-500">Only admins and operators can run commands on devices.</p>
            )}
          </Panel>
        )}
      </motion.div>

      {showCommandDialog && device && (
        <CommandDialog
          deviceId={device.id}
          agentId={device.agentId}
          agentHostname={device.hostname}
          online={device.status === 'ONLINE'}
          serviceNames={services.map((s) => s.name)}
          isOpen={showCommandDialog}
          onClose={() => setShowCommandDialog(false)}
          onSuccess={() => {
            if (device.agentId) dispatch(fetchTelemetry(device.agentId));
          }}
        />
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function ListHeader({
  eyebrow,
  title,
  loading,
  onRefresh,
  error,
}: {
  eyebrow: string;
  title: string;
  loading: boolean;
  onRefresh: () => void;
  error?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 px-5 pb-3 pt-5">
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">{eyebrow}</p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">{title}</h3>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900 disabled:opacity-50"
      >
        <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Refresh
      </button>
    </div>
  );
}

function MetaItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-600">{label}</dt>
      <dd className={`mt-1 truncate text-xs text-slate-300 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-[26px] font-semibold leading-none tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-1 truncate text-[13px] text-slate-300" title={value}>
        {value}
      </p>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  lines,
  data,
}: {
  title: string;
  subtitle: string;
  lines: { key: string; color: string }[];
  data: Record<string, unknown>[];
}) {
  return (
    <Panel>
      <div className="mb-4">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">{title}</p>
        <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#94a3b8' }} />
            {lines.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {lines.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: l.color }} />
            {l.key}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * "Which app is using how much" as a graph, living next to the usage-over-
 * time charts on the Metrics tab - same live process data already shown in
 * the separate Processes tab, just the top 5 rendered as a horizontal bar
 * chart so a CPU/memory spike on the line charts above can be immediately
 * cross-referenced with what's actually causing it, without switching tabs.
 */
function TopProcessesChart({
  title,
  processes,
  color,
  valueOf,
  formatValue,
}: {
  title: string;
  processes: ProcessInfo[];
  color: string;
  valueOf: (p: ProcessInfo) => number;
  formatValue: (value: number) => string;
}) {
  const data = processes.map((p) => ({
    name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name,
    fullName: p.name,
    pid: p.pid,
    value: valueOf(p),
  }));

  return (
    <Panel>
      <div className="mb-4">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">{title}</p>
        <p className="mt-0.5 text-xs text-slate-600">Live snapshot, top 5</p>
      </div>
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-xs text-slate-600">No process data yet</p>
        </div>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value) => formatValue(typeof value === 'number' ? value : Number(value) || 0)}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { fullName?: string; pid?: number } | undefined;
                  return p ? `${p.fullName} (PID ${p.pid})` : '';
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={16}>
                {data.map((_, i) => (
                  <Cell key={i} fill={color} fillOpacity={1 - i * 0.13} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
