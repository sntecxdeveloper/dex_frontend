import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchDeviceById } from '../../features/devices/devicesSlice';
import { fetchTelemetry } from '../../features/telemetry/telemetrySlice';
import DeviceStatusBadge from '../../components/devices/DeviceStatusBadge';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDate';

export default function DeviceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selected: device, loading, error } = useAppSelector((state) => state.devices);
  const { data: telemetry, loading: telemetryLoading } = useAppSelector((state) => state.telemetry);

  useEffect(() => {
    if (id) {
      dispatch(fetchDeviceById(Number(id)));
      dispatch(fetchTelemetry(Number(id)));
    }
  }, [dispatch, id]);

  if (loading) return <Loading size="lg" text="Loading device details..." />;
  if (error) return <ErrorMessage message={error} onRetry={() => id && dispatch(fetchDeviceById(Number(id)))} />;
  if (!device) return <ErrorMessage message="Device not found" />;

  const chartData = telemetry.map((t) => ({
    time: formatDateTime(t.timestamp),
    CPU: t.cpuUsage,
    Memory: t.memoryUsage,
    Disk: t.diskUsage,
    'Net In': t.networkIn,
    'Net Out': t.networkOut,
  }));

  return (
    <div className="space-y-6">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/devices')}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 btn-press transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Devices
      </motion.button>

      {/* Device info card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{device.hostname}</h1>
              <DeviceStatusBadge status={device.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Agent ID</p>
                <p className="text-sm font-mono text-slate-700 mt-0.5">{device.agentId}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">IP Address</p>
                <p className="text-sm font-mono text-slate-700 mt-0.5">{device.ipAddress || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">OS</p>
                <p className="text-sm text-slate-700 mt-0.5">{device.os || '—'} {device.osVersion || ''}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Agent Version</p>
                <p className="text-sm text-slate-700 mt-0.5">{device.agentVersion || '—'}</p>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-1">
            <p>Enrolled: {formatDateTime(device.enrolledAt)}</p>
            <p>Last Heartbeat: {formatRelativeTime(device.lastHeartbeat)}</p>
          </div>
        </div>
      </motion.div>

      {/* Telemetry charts */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Telemetry</h2>
        {telemetryLoading ? (
          <Loading text="Loading telemetry..." />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            No telemetry data available
          </div>
        ) : (
          <div className="space-y-6">
            {/* CPU & Memory */}
            <div className="h-56">
              <p className="text-xs font-medium text-slate-500 mb-2">CPU & Memory Usage (%)</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '13px',
                    }}
                  />
                  <Line type="monotone" dataKey="CPU" stroke="#3b82f6" strokeWidth={2} dot={false} animationDuration={800} />
                  <Line type="monotone" dataKey="Memory" stroke="#8b5cf6" strokeWidth={2} dot={false} animationDuration={800} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Disk & Network */}
            <div className="h-56">
              <p className="text-xs font-medium text-slate-500 mb-2">Disk Usage (%) & Network I/O</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '13px',
                    }}
                  />
                  <Line type="monotone" dataKey="Disk" stroke="#f59e0b" strokeWidth={2} dot={false} animationDuration={800} />
                  <Line type="monotone" dataKey="Net In" stroke="#10b981" strokeWidth={2} dot={false} animationDuration={800} />
                  <Line type="monotone" dataKey="Net Out" stroke="#ef4444" strokeWidth={2} dot={false} animationDuration={800} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
