import { useNavigate } from 'react-router-dom';
import DataTable, { type Column } from '../common/DataTable';
import DeviceStatusBadge from './DeviceStatusBadge';
import { formatRelativeTime } from '../../utils/formatDate';
import type { Device } from '../../types';

interface DeviceTableProps {
  devices: Device[];
  loading: boolean;
}

const columns: Column<Device>[] = [
  {
    key: 'hostname',
    label: 'Hostname',
    sortable: true,
    render: (device) => (
      <span className="font-medium text-slate-900">{device.hostname}</span>
    ),
  },
  {
    key: 'ipAddress',
    label: 'IP Address',
    sortable: true,
    render: (device) => (
      <span className="font-mono text-xs text-slate-600">{device.ipAddress || '—'}</span>
    ),
  },
  {
    key: 'os',
    label: 'OS',
    sortable: true,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (device) => <DeviceStatusBadge status={device.status} />,
  },
  {
    key: 'lastHeartbeat',
    label: 'Last Seen',
    sortable: true,
    render: (device) => (
      <span className="text-slate-500">{formatRelativeTime(device.lastHeartbeat)}</span>
    ),
  },
];

export default function DeviceTable({ devices, loading }: DeviceTableProps) {
  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={devices}
      loading={loading}
      keyExtractor={(d) => d.id}
      onRowClick={(d) => navigate(`/devices/${d.id}`)}
      emptyMessage="No devices found"
    />
  );
}
