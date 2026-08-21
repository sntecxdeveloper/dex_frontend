import { motion } from 'framer-motion';
import type { Remediation } from '../../types';

interface RemediationSummaryProps {
  remediations: Remediation[];
}

export default function RemediationSummary({ remediations }: RemediationSummaryProps) {
  const recentCount = remediations.length;
  const completedCount = remediations.filter((r) => r.status === 'COMPLETED').length;
  const failedCount = remediations.filter((r) => r.status === 'FAILED').length;
  const successRate = recentCount > 0 ? Math.round((completedCount / recentCount) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="card-hover rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Remediation Summary</h3>

      <div className="space-y-4">
        {/* Success rate bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Success Rate</span>
            <span className="text-sm font-bold text-slate-900">{successRate}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${successRate}%` }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">{recentCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Failed</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
