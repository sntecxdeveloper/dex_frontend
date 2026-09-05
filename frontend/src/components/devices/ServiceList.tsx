interface ServiceInfo {
  name: string;
  displayName: string;
  status: 'Running' | 'Stopped' | 'Paused' | 'Unknown';
  startType: string;
}

interface ServiceListProps {
  services: ServiceInfo[];
  onRestart?: (serviceName: string) => void;
}

const statusTone: Record<ServiceInfo['status'], { chip: string; dot: string; label: string }> = {
  Running: { chip: 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20', dot: 'bg-emerald-400', label: 'Running' },
  Stopped: { chip: 'bg-red-500/10 text-red-300 ring-red-400/20', dot: 'bg-red-400', label: 'Stopped' },
  Paused: { chip: 'bg-amber-500/10 text-amber-300 ring-amber-400/20', dot: 'bg-amber-400', label: 'Paused' },
  Unknown: { chip: 'bg-white/[0.04] text-slate-400 ring-line-strong', dot: 'bg-slate-500', label: 'Unknown' },
};

export const ServiceList: React.FC<ServiceListProps> = ({ services, onRestart }) => {
  if (!services || services.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <p className="text-sm text-slate-500">No service data reported yet</p>
        <p className="mt-1 text-xs text-slate-600">Service telemetry arrives on the next agent heartbeat.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              Service
            </th>
            <th className="px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              Display name
            </th>
            <th className="px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              Status
            </th>
            <th className="px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              Start type
            </th>
            {onRestart && <th className="px-5 py-2.5 text-right" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {services.map((service) => {
            const tone = statusTone[service.status] || statusTone.Unknown;
            return (
              <tr key={service.name} className="group transition-colors hover:bg-white/[0.02]">
                <td className="px-5 py-3 font-mono text-[13px] text-slate-200">{service.name}</td>
                <td className="px-5 py-3 text-[13px] text-slate-400">{service.displayName}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone.chip}`}>
                    <span className={`h-1 w-1 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{service.startType}</td>
                {onRestart && (
                  <td className="px-5 py-3 text-right">
                    {service.status === 'Running' ? (
                      <button
                        onClick={() => onRestart(service.name)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 opacity-0 transition-all hover:bg-primary-500/10 hover:text-primary-300 group-hover:opacity-100"
                      >
                        Restart
                      </button>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ServiceList;
