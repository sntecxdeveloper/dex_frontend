import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  type AlertRule,
  METRICS,
  OPERATORS,
  SEVERITIES,
} from '../../api/alertApi';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
};

export default function AlertRulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await getAlertRules();
      setRules(data);
    } catch (err) {
      setError('Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleToggle = async (rule: AlertRule) => {
    try {
      await updateAlertRule(rule.id!, { ...rule, enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this alert rule?')) return;
    try {
      await deleteAlertRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch { /* ignore */ }
  };

  const handleSave = async (rule: AlertRule) => {
    try {
      if (editingRule?.id) {
        const updated = await updateAlertRule(editingRule.id, rule);
        setRules((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      } else {
        const created = await createAlertRule(rule);
        setRules((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditingRule(null);
    } catch (err) {
      alert('Failed to save alert rule');
    }
  };

  if (loading) return <Loading text="Loading alert rules..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchRules} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alert Rules</h1>
          <p className="text-sm text-slate-500 mt-1">Configure threshold-based alerts for your devices</p>
        </div>
        <button
          onClick={() => { setEditingRule(null); setShowForm(true); }}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
        >
          + New Rule
        </button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500">No alert rules configured yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            Create your first rule →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">{rule.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[rule.severity] || severityColors.MEDIUM}`}>
                      {rule.severity}
                    </span>
                    {!rule.enabled && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Disabled
                      </span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-slate-500 mt-1">{rule.description}</p>
                  )}
                  <p className="text-sm text-slate-700 mt-2 font-mono">
                    {METRICS.find((m) => m.value === rule.metric)?.label || rule.metric}
                    {' '}{OPERATORS.find((o) => o.value === rule.operator)?.label || rule.operator}
                    {' '}{rule.threshold}
                    {rule.cooldownMinutes ? ` (cooldown: ${rule.cooldownMinutes}min)` : ''}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>Triggered: {rule.triggerCount || 0} times</span>
                    {rule.lastTriggeredAt && <span>Last: {new Date(rule.lastTriggeredAt).toLocaleString()}</span>}
                    <span>Notify: {rule.notifyInApp ? 'In-App' : ''}{rule.notifyEmail ? ' + Email' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(rule)}
                    className={`w-10 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-teal-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <button
                    onClick={() => { setEditingRule(rule); setShowForm(true); }}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id!)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit form modal */}
      {showForm && (
        <AlertRuleForm
          rule={editingRule}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}
    </div>
  );
}

// ── Form Component ──

function AlertRuleForm({
  rule,
  onSave,
  onCancel,
}: {
  rule: AlertRule | null;
  onSave: (rule: AlertRule) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AlertRule>({
    name: rule?.name || '',
    description: rule?.description || '',
    metric: rule?.metric || 'cpuUsage',
    operator: rule?.operator || 'GT',
    threshold: rule?.threshold ?? 90,
    cooldownMinutes: rule?.cooldownMinutes ?? 5,
    severity: rule?.severity || 'HIGH',
    targetAgentIds: rule?.targetAgentIds || '',
    enabled: rule?.enabled ?? true,
    notifyEmail: rule?.notifyEmail ?? false,
    notifyInApp: rule?.notifyInApp ?? true,
    notifyEmails: rule?.notifyEmails || '',
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {rule ? 'Edit Alert Rule' : 'New Alert Rule'}
          </h2>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                placeholder="e.g., High CPU Alert"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                placeholder="Optional description"
              />
            </div>

            {/* Condition: Metric + Operator + Threshold */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Metric</label>
                <select
                  value={form.metric}
                  onChange={(e) => setForm({ ...form, metric: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                <select
                  value={form.operator}
                  onChange={(e) => setForm({ ...form, operator: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Threshold</label>
                <input
                  type="number"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Severity + Cooldown */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cooldown (min)</label>
                <input
                  type="number"
                  value={form.cooldownMinutes}
                  onChange={(e) => setForm({ ...form, cooldownMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  min={1}
                />
              </div>
            </div>

            {/* Target devices */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Devices</label>
              <input
                type="text"
                value={form.targetAgentIds || ''}
                onChange={(e) => setForm({ ...form, targetAgentIds: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Comma-separated agent IDs (empty = all devices)"
              />
            </div>

            {/* Notifications */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.notifyInApp}
                  onChange={(e) => setForm({ ...form, notifyInApp: e.target.checked })}
                  className="rounded border-slate-300"
                />
                In-App Notification
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.notifyEmail}
                  onChange={(e) => setForm({ ...form, notifyEmail: e.target.checked })}
                  className="rounded border-slate-300"
                />
                Email
              </label>
            </div>

            {form.notifyEmail && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Addresses</label>
                <input
                  type="text"
                  value={form.notifyEmails || ''}
                  onChange={(e) => setForm({ ...form, notifyEmails: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Comma-separated email addresses"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={!form.name}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
