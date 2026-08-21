import { motion } from 'framer-motion';
import { Outlet } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout() {
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header />
      <main
        className={`sidebar-transition ${sidebarCollapsed ? 'ml-[72px]' : 'ml-64'}`}
      >
        <div className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Outlet />
          </motion.div>
        </div>
        <Footer />
      </main>
    </div>
  );
}
