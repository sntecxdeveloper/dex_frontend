import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion';
import { useAppSelector } from '../hooks/useAppSelector';
import ErrorBoundary from '../components/common/ErrorBoundary';
import Loading from '../components/common/Loading';
import { hydrateSetupSettings } from '../utils/setupSync';
import { AccessContext } from '../utils/access';
import { getMyAccess, type MyAccess } from '../api/accessApi';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout() {
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);
  const location = useLocation();
  const role = useAppSelector((state) => state.auth.user?.role);

  // The Setup settings come from the server: load them before the pages read them (the browser's copy is used if the server is unreachable).
  const [setupReady, setSetupReady] = useState(false);
  const [access, setAccess] = useState<MyAccess | null>(null);
  useEffect(() => {
    let live = true;
    setSetupReady(false);
    // What this person may open in Setup comes from the server too (their role, set by an administrator).
    getMyAccess()
      .catch(() => null)
      .then((a) => {
        if (!live) return undefined;
        setAccess(a);
        // Someone whose role may edit a Setup section also saves their changes to the server (the server checks each one).
        const canEdit = role === 'ROLE_ADMIN' || Object.entries(a?.actions ?? {}).some(([k, v]) => k.startsWith('setup-') && v);
        return hydrateSetupSettings(role === 'ROLE_ADMIN', canEdit);
      })
      .finally(() => live && setSetupReady(true));
    return () => {
      live = false;
    };
  }, [role]);

  return (
    <AccessContext.Provider value={access}>
    <div className="min-h-dvh bg-canvas">
      <Sidebar />
      <div
        className={`flex min-h-dvh flex-col transition-[margin] duration-200 ease-out ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        }`}
      >
        <Header />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
            {/* Page-level boundary: a crash in one page keeps the sidebar usable and clears on navigation. */}
            <ErrorBoundary resetKey={location.pathname}>
              {/* Enter-only: the new page rises in at once; nothing waits for the old one to leave. */}
              {setupReady ? (
                <motion.div key={location.pathname} variants={fadeUp} initial="hidden" animate="show">
                  <Outlet />
                </motion.div>
              ) : (
                <Loading />
              )}
            </ErrorBoundary>
          </div>
        </main>
        <Footer />
      </div>
    </div>
    </AccessContext.Provider>
  );
}
