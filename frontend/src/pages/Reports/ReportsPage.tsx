import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../../api/axios';
import Loading from '../../components/common/Loading';

interface HealthReport {
  type: string;
  generatedAt: string;
  summary: {
    healthScore: number;
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    errorDevices: number;
    totalIssues: number;
    criticalIssues: number;
    openIssues: number;
  };
  recommendations: string[];
}

interface UptimeReport {
  type: string;
  period: string;
  summary: { totalDevices: number; averageUptime: number };
  devices: { agentId: string; hostname: string; status: string; uptimePercent: number; lastHeartbeat: string }[];
}

export default function ReportsPage() {
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [uptimeReport, setUptimeReport] = useState<UptimeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [uptimeDays, setUptimeDays] = useState('7');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/reports/health').then((r) => setHealthReport(r.data.data)),
      api.get(`/reports/uptime?days=${uptimeDays}`).then((r) => setUptimeReport(r.data.data)),
    ]).finally(() => setLoading(false));
  }, [uptimeDays]);

  const downloadCsv = async (endpoint: string, filename: string) => {
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { alert('Export failed'); }
  };

  if (loading) return <Loading text="Generating reports..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">System health, uptime, and export tools</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadCsv('/reports/export/devices', 'devices.csv')}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
            Export Devices CSV
          </button>
          <button onClick={() => downloadCsv('/reports/export/issues', 'issues.csv')}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
            Export Issues CSV
          </button>
        </div>
      </div>

      {/* Health Report */}
      {healthReport && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">System Health Report</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Health Score" value={`${healthReport.summary.healthScore}%`} color={healthReport.summary.healthScore >= 80 ? 'green' : healthReport.summary.healthScore >= 60 ? 'yellow' : 'red'} />
            <StatCard label="Total Devices" value={`${healthReport.summary.totalDevices}`} color="blue" />
            <StatCard label="Open Issues" value={`${healthReport.summary.openIssues}`} color="amber" />
            <StatCard label="Critical Issues" value={`${healthReport.summary.criticalIssues}`} color="red" />
          </div>
          {healthReport.recommendations.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Recommendations</p>
              {healthReport.recommendations.map((rec, i) => (
                <p key={i} className="text-sm text-slate-700">• {rec}</p>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Uptime Report */}
      {uptimeReport && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Uptime Report — {uptimeReport.period}</h2>
            <select value={uptimeDays} onChange={(e) => setUptimeDays(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">
              <option value="1">Last 1 day</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
          <div className="mb-4">
            <p className="text-xs text-slate-500">Average Uptime</p>
            <p className="text-2xl font-bold text-slate-900">{uptimeReport.summary.averageUptime}%</p>
          </div>
          <div className="space-y-2">
            {uptimeReport.devices.map((d) => (
              <div key={d.agentId} className="flex items-center gap-3">
                <span className="text-sm font-mono text-slate-700 w-40 truncate">{d.hostname}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3">
                  <div className={`h-3 rounded-full ${d.uptimePercent >= 99 ? 'bg-green-500' : d.uptimePercent >= 90 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${d.uptimePercent}%` }} />
                </div>
                <span className="text-xs text-slate-500 w-12 text-right">{d.uptimePercent}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-700', yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`rounded-xl p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
