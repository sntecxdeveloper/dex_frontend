import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  trend?: { value: number; isUp: boolean };
  delay?: number;
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      setCount(current);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

export default function MetricCard({ title, value, icon, color = 'primary', trend, delay = 0 }: MetricCardProps) {
  const animatedValue = useCountUp(value);

  const colorMap: Record<string, { bg: string; iconBg: string; iconText: string }> = {
    primary: { bg: 'from-primary-50 to-primary-100/50', iconBg: 'bg-primary-100', iconText: 'text-primary-600' },
    emerald: { bg: 'from-emerald-50 to-emerald-100/50', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    amber: { bg: 'from-amber-50 to-amber-100/50', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
    red: { bg: 'from-red-50 to-red-100/50', iconBg: 'bg-red-100', iconText: 'text-red-600' },
    purple: { bg: 'from-purple-50 to-purple-100/50', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
    cyan: { bg: 'from-cyan-50 to-cyan-100/50', iconBg: 'bg-cyan-100', iconText: 'text-cyan-600' },
  };

  const c = colorMap[color] || colorMap.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="card-hover rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">
            {animatedValue.toLocaleString()}
          </p>
          {trend && (
            <div className={`inline-flex items-center gap-1 text-xs font-medium ${trend.isUp ? 'text-emerald-600' : 'text-red-600'}`}>
              <svg
                className={`h-3 w-3 ${trend.isUp ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className={`h-11 w-11 rounded-xl ${c.iconBg} flex items-center justify-center ${c.iconText}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
