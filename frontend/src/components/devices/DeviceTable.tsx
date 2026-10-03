import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ColumnChooser from '../common/ColumnChooser';
import DeviceStatusBadge from './DeviceStatusBadge';
import { Skeleton } from '../ui/Skeleton';
import { useColumnChoice, type ChoosableColumn } from '../../hooks/useColumnChoice';
import { formatDate, formatRelativeTime } from '../../utils/formatDate';
import type { Device } from '../../types';

interface DeviceTableProps {
  devices: Device[];
  loading: boolean;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  onToggleSelectAll?: (checked: boolean) => void;
}

const dash = (v?: string | number | null) => (v === undefined || v === null || v === '' ? '—' : v);

interface DeviceColumn extends ChoosableColumn {
  /** Width and when it shows, as classes (the first column stretches). */
  cls: string;
  render: (d: Device, navigate: (to: string) => void) => ReactNode;
}

const text = 'block truncate text-xs text-slate-500';

/** Every cell the devices list can show. The first is always there; the rest can be added or removed from the gear. */
const COLUMNS: DeviceColumn[] = [
  { key: 'device', label: 'Device', fixed: true, cls: 'min-w-[220px] flex-1', render: () => null },
  { key: 'ip', label: 'IP address', initial: true, cls: 'hidden w-36 md:block', render: (d) => <span className={`${text} font-mono`}>{dash(d.ipAddress)}</span> },
  { key: 'os', label: 'Operating system', initial: true, cls: 'hidden w-44 lg:block', render: (d) => <span className={text}>{dash(d.os)}{d.osVersion ? ` ${d.osVersion}` : ''}</span> },
  { key: 'location', label: 'Location', initial: true, cls: 'hidden w-36 md:block', render: (d) => <span className={text}>{dash(d.location)}</span> },
  { key: 'region', label: 'Region', initial: true, cls: 'hidden w-28 md:block', render: (d) => <span className={text}>{dash(d.region)}</span> },
  { key: 'groups', label: 'Groups', cls: 'hidden w-48 md:block', render: (d) => <span className={text} title={(d.groups ?? []).join(', ')}>{d.groups && d.groups.length > 0 ? d.groups.join(', ') : '—'}</span> },
  { key: 'agentVersion', label: 'Agent version', cls: 'hidden w-28 lg:block', render: (d) => <span className={`${text} font-mono`}>{dash(d.agentVersion)}</span> },
  { key: 'enrolled', label: 'Enrolled', cls: 'hidden w-28 lg:block', render: (d) => <span className={text}>{d.createdAt ? formatDate(d.createdAt) : '—'}</span> },
  { key: 'cpu', label: 'CPU', cls: 'hidden w-56 xl:block', render: (d) => <span className={text} title={d.cpuModel ?? ''}>{dash(d.cpuModel)}</span> },
  { key: 'ram', label: 'Memory', cls: 'hidden w-20 xl:block', render: (d) => <span className={text}>{d.ramGb ? `${Math.round(d.ramGb)} GB` : '—'}</span> },
  { key: 'disk', label: 'Disk', cls: 'hidden w-20 xl:block', render: (d) => <span className={text}>{d.diskGb ? `${Math.round(d.diskGb)} GB` : '—'}</span> },
  { key: 'status', label: 'Status', initial: true, cls: 'w-28 shrink-0', render: (d) => <DeviceStatusBadge status={d.status} /> },
  { key: 'lastSeen', label: 'Last seen', initial: true, cls: 'hidden w-32 xl:block', render: (d) => <span className="font-mono text-[11px] text-slate-600">{formatRelativeTime(d.lastHeartbeat)}</span> },
  {
    key: 'issues',
    label: 'Issues',
    initial: true,
    cls: 'w-28 shrink-0',
    render: (d, navigate) => (
      <span onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => navigate(`/issues?device=${d.id}`)}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
            d.openIssueCount
              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-line text-slate-600 hover:border-line-strong hover:bg-slate-50 hover:text-slate-900'
          }`}
          title={`View issues for ${d.hostname}`}
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          Issues{d.openIssueCount ? ` (${d.openIssueCount})` : ''}
        </button>
      </span>
    ),
  },
];

const headerText = 'font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500';

export default function DeviceTable({ devices, loading, selectedIds = [], onToggleSelect, onToggleSelectAll }: DeviceTableProps) {
  const navigate = useNavigate();
  const choice = useColumnChoice('dex.devices.columns', COLUMNS);
  const shown = COLUMNS.filter((c) => choice.isOn(c.key));

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-panel">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line/60 px-5 py-4 last:border-b-0">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-5 w-24 md:block" />
            <Skeleton className="hidden h-5 w-20 lg:block" />
          </div>
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-line bg-panel px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel-2">
          <svg className="h-6 w-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-300">No devices found</p>
        <p className="mt-1 text-xs text-slate-600">Install the DEX agent on a machine and it appears here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <div className="min-w-max">
        {/* column headers */}
        <div className="hidden items-center gap-3 border-b border-line bg-white/[0.015] px-5 py-2.5 lg:flex">
          {onToggleSelect && (
            <label className="flex w-6 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                checked={devices.length > 0 && devices.every((d) => selectedIds.includes(d.id))}
                onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600"
                aria-label="Select all devices"
              />
            </label>
          )}
          {shown.map((c) => (
            <p key={c.key} className={`${c.cls} ${headerText}`}>
              {c.label}
            </p>
          ))}
          <span className="flex w-8 shrink-0 justify-end">
            <ColumnChooser columns={COLUMNS} isOn={choice.isOn} onToggle={choice.toggle} onReset={choice.reset} />
          </span>
        </div>

        {devices.map((device) => (
          <div
            key={device.id}
            onClick={() => navigate(`/devices/${device.id}`)}
            className={`group flex cursor-pointer items-center gap-3 border-b border-line/60 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-slate-50 ${
              selectedIds.includes(device.id) ? 'bg-primary-500/[0.06]' : ''
            }`}
          >
            {onToggleSelect && (
              <label className="flex w-6 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(device.id)}
                  onChange={() => onToggleSelect(device.id)}
                  className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600"
                  aria-label={`Select ${device.hostname}`}
                />
              </label>
            )}

            {shown.map((c) =>
              c.key === 'device' ? (
                <div key={c.key} className={`${c.cls} flex items-center gap-3`}>
                  {/* status icon tile */}
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                      device.status === 'ONLINE'
                        ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                        : device.status === 'ERROR'
                          ? 'bg-red-400/10 text-red-300 ring-red-400/25'
                          : device.status === 'ENROLLING'
                            ? 'bg-sky-400/10 text-sky-300 ring-sky-400/25'
                            : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                    }`}
                  >
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800 transition-colors group-hover:text-slate-900">{device.hostname}</p>
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-600">
                      {device.agentId}
                      {device.agentVersion ? ` · v${device.agentVersion}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={c.key} className={c.cls}>
                  {c.render(device, navigate)}
                </div>
              ),
            )}

            <span className="flex w-8 shrink-0 justify-end text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
