import { STATUS_COLORS, STATUS_DOT_COLORS } from '../../utils/constants';

interface DeviceStatusBadgeProps {
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'ENROLLING';
  showDot?: boolean;
}

export default function DeviceStatusBadge({ status, showDot = true }: DeviceStatusBadgeProps) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.OFFLINE;
  const dotColor = STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.OFFLINE;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {showDot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${status === 'ONLINE' ? 'pulse-badge' : ''}`} />
      )}
      {status}
    </span>
  );
}
