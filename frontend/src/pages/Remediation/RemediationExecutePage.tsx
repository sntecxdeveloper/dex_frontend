import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getRemediations, executeRemediation, type Remediation } from '../../api/remediationApi';
import { getDevices } from '../../api/deviceApi';
import type { Device } from '../../types/device';
import Loading from '../../components/common/Loading';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  SUCCESS: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

export default function RemediationExecutePage() {
  const [searchParams] = useSearchParams();
  const issueId = searchParams.get('issueId');
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string>(searchParams.get('device') ?? '');
  const [executing, setExecuting] = useState<number | null>(null);
  // Render the list in chunks to keep the page responsive with many runs
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    Promise.all([getRemediations(), getDevices()])
      .then(([r, d]) => { setRemediations(r); setDevices(d); })
      .finally(() => setLoading(false));
  }, []);

  const handleExecute = async (id: number) => {
    setExecuting(id);
    try {
      // If an operator picked a device, run the steps on that machine instead of
      // the issue's original agent (run-on-this-device flow).
      const updated = await executeRemediation(id, selectedDevice || undefined);
      setRemediations((prev) => prev.map((r) => r.id === id ? updated : r));
    } catch { alert('Failed to execute remediation'); }
    finally { setExecuting(null); }
  };

  if (loading) return <Loading text="Loading remediations..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Remediation</h1>
        <p className="text-sm text-slate-500 mt-1">Execute and track remediation actions</p>
      </div>

      {issueId && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          Launched from issue <span className="font-semibold">#{issueId}</span> — pick the run below to start fixing that machine.
        </div>
      )}

      {/* Device selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Target Device</label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">Select a device...</option>
          {devices.map((d) => (
            <option key={d.agentId} value={d.agentId}>{d.hostname} ({d.status})</option>
          ))}
        </select>
      </div>

      {/* Remediations list */}
      <div className="space-y-3">
        {remediations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-500">No remediation actions yet.</p>
          </div>
        ) : (
          remediations.slice(0, visibleCount).map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">{r.remediationCode}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] || statusColors.PENDING}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{r.action}</p>
                  {r.details && (
                    <pre className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {r.details}
                    </pre>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span>Created: {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</span>
                    {r.executedBy && <span>By: {r.executedBy}</span>}
                    {r.durationMs && <span>Duration: {r.durationMs}ms</span>}
                  </div>
                </div>
                {r.status === 'PENDING' && (
                  <button
                    onClick={() => handleExecute(r.id)}
                    disabled={executing === r.id || !selectedDevice}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {executing === r.id ? 'Executing...' : 'Execute'}
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
        {remediations.length > visibleCount && (
          <div className="flex justify-center">
            <button
              onClick={() => setVisibleCount((c) => c + 30)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Show more ({remediations.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
