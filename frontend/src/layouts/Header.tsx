import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { setSidebarOpen } from '../store/uiSlice';
import { logout } from '../store/authSlice';
import { ROLE_LABELS } from '../utils/constants';
import NotificationCenter from '../components/common/NotificationCenter';
import { Kbd } from '../components/ui/Kbd';
import { Badge } from '../components/ui/Badge';

export default function Header() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { devices, issues } = useAppSelector((state) => state.dashboard);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : '';
  const onlineCount = devices.filter((d) => d.status === 'ONLINE').length;
  const criticalIssues = issues.filter((i) => i.severity === 'CRITICAL' && i.status === 'OPEN').length;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Left — mobile menu + search */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={() => dispatch(setSidebarOpen(true))}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-700 lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <button
          title="Global command palette — arriving in a later milestone"
          className="hidden h-9 w-full max-w-sm cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-500 transition-colors hover:border-line-strong hover:text-slate-700 md:flex"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <span className="truncate">Search devices, issues, articles…</span>
          <span className="ml-auto">
            <Kbd>/</Kbd>
          </span>
        </button>
      </div>

      {/* Right — status, notifications, user */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Fleet pulse */}
        <div className="mr-1 hidden items-center gap-2 lg:flex">
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-xs text-slate-700">{onlineCount}</span>
            <span className="text-xs text-slate-500">online</span>
          </div>
          {criticalIssues > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-50" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-red-400" />
              </span>
              <span className="font-mono text-xs text-red-600">{criticalIssues}</span>
              <span className="text-xs text-red-500">critical</span>
            </div>
          )}
        </div>

        <NotificationCenter />

        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100/70"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-800 font-display text-sm font-semibold text-white shadow-cta">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-[13px] font-medium leading-tight text-slate-800">{user?.username || 'User'}</p>
              <p className="text-[10px] leading-tight text-slate-500">{roleLabel}</p>
            </div>
            <svg
              className={`hidden h-3.5 w-3.5 text-slate-500 transition-transform duration-200 sm:block ${menuOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-raised shadow-pop"
              >
                <div className="border-b border-line px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-800 font-display text-sm font-semibold text-white">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{user?.username}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <Badge tone="primary" dot>
                      {roleLabel}
                    </Badge>
                  </div>
                </div>

                <div className="p-1.5">
                  <Link
                    to="/security"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 hover:text-slate-900"
                  >
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    Security settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-red-600 transition-colors hover:bg-red-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
