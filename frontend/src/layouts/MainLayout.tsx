import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion';
import { useAppSelector } from '../hooks/useAppSelector';
import ErrorBoundary from '../components/common/ErrorBoundary';
import Loading from '../components/common/Loading';
import { hydrateSetupSettings } from '../utils/setupSync';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { UiLayoutProvider } from '../context/UiLayoutContext';
import { AccessProvider, pageOfPath, useAccess } from '../context/AccessContext';
import NoAccess from '../components/access/NoAccess';

/** The page itself, or "not part of your role" when the person's role hides it. */
function GuardedOutlet({ pathname }: { pathname: string }) {
  const { page } = useAccess();
  const key = pageOfPath(pathname);
  if (key && page(key) === 'HIDDEN') return <NoAccess />;
  return <Outlet />;
}

export default function MainLayout() {
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);
  const location = useLocation();
  const role = useAppSelector((state) => state.auth.user?.role);

  // The Setup settings come from the server: load them before the pages read them (the browser's copy is used if the server is unreachable).
  const [setupReady, setSetupReady] = useState(false);
  useEffect(() => {
    let live = true;
    setSetupReady(false);
    hydrateSetupSettings(role === 'ROLE_ADMIN').finally(() => live && setSetupReady(true));
    return () => {
      live = false;
    };
  }, [role]);

  return (
    <AccessProvider>
    <UiLayoutProvider>
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
                  <GuardedOutlet pathname={location.pathname} />
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
    </UiLayoutProvider>
    </AccessProvider>
  );
}
