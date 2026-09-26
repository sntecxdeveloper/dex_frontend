import { Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import ErrorBoundary from '../components/common/ErrorBoundary';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout() {
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);
  const location = useLocation();

  return (
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
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
