import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchDevices } from '../../features/devices/devicesSlice';
import DeviceTable from '../../components/devices/DeviceTable';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';

const STATUS_FILTERS = ['ALL', 'ONLINE', 'OFFLINE', 'ERROR', 'ENROLLING'];

export default function DevicesPage() {
  const dispatch = useAppDispatch();
  const { items, loading, error } = useAppSelector((state) => state.devices);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchDevices());
  }, [dispatch]);

  const filtered = items.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (search && !d.hostname.toLowerCase().includes(search.toLowerCase()) &&
        !(d.ipAddress && d.ipAddress.toLowerCase().includes(search.toLowerCase()))) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-slate-900">Devices</h1>
        <p className="text-sm text-slate-500 mt-1">Manage and monitor your connected devices</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
      >
        <div className="relative w-full sm:w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg btn-press transition-all duration-200 ${
                statusFilter === f
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      {error ? (
        <ErrorMessage message={error} onRetry={() => dispatch(fetchDevices())} />
      ) : loading ? (
        <Loading text="Loading devices..." />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <DeviceTable devices={filtered} loading={false} />
        </motion.div>
      )}
    </div>
  );
}
