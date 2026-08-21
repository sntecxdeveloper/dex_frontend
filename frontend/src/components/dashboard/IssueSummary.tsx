import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface IssueSummaryProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6'];

export default function IssueSummary({ critical, high, medium, low }: IssueSummaryProps) {
  const data = [
    { name: 'Critical', value: critical },
    { name: 'High', value: high },
    { name: 'Medium', value: medium },
    { name: 'Low', value: low },
  ];

  const total = critical + high + medium + low;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="card-hover rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Issues by Severity</h3>

      {total === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-slate-400">
          No issues
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={28} barGap={8}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '13px',
                }}
              />
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
