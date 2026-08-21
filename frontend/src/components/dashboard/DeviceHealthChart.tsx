import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DeviceHealthChartProps {
  online: number;
  offline: number;
  error: number;
}

const COLORS = {
  Online: '#10b981',
  Offline: '#f59e0b',
  Error: '#ef4444',
};

export default function DeviceHealthChart({ online, offline, error }: DeviceHealthChartProps) {
  const data = [
    { name: 'Online', value: online },
    { name: 'Offline', value: offline },
    { name: 'Error', value: error },
  ].filter((item) => item.value > 0);

  const total = online + offline + error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="card-hover rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Device Health</h3>

      {total === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-slate-400">
          No device data
        </div>
      ) : (
        <>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '13px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 mt-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[item.name as keyof typeof COLORS] }}
                />
                <span className="text-xs text-slate-600">
                  {item.name} ({item.value})
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
