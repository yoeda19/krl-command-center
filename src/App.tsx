import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import LoginPage from './pages/LoginPage';
import CriticalStockPage from './pages/CriticalStockPage';
import AnomalyStockPage from './pages/AnomalyStockPage';
import ProgressPOPage from './pages/ProgressPOPage';
import StockAgingPage from './pages/StockAgingPage';
import WorkOrderPage from './pages/WorkOrderPage';
import TrainCompositionPage from './pages/TrainCompositionPage';
import AdminPanelPage from './pages/AdminPanelPage';
import AuditLogPage from './pages/AuditLogPage';
import type { ThemeMode } from './types';

// ── Protected Layout ────────────────────────────────────────────
interface ProtectedLayoutProps {
  theme: ThemeMode;
  onThemeToggle: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

function ProtectedLayout({ theme, onThemeToggle, collapsed, onToggle }: ProtectedLayoutProps) {
  const location = useLocation();
  const isAuth = !!localStorage.getItem('krl_auth');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarWidth = isMobile ? 0 : (collapsed ? 64 : 260);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!isAuth) return <Navigate to="/login" replace />;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        backgroundColor: 'var(--color-background)',
        // @ts-ignore
        '--sidebar-width': `${sidebarWidth}px`,
      }}
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={onToggle}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        className="flex flex-col flex-1 content-transition min-w-0"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        <TopBar
          collapsed={collapsed}
          theme={theme}
          onThemeToggle={onThemeToggle}
          currentPath={location.pathname}
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
        />
        <Routes>
          <Route path="/"              element={<Navigate to="/critical-stock" replace />} />
          <Route path="/critical-stock" element={<CriticalStockPage />} />
          <Route path="/anomaly-stock" element={<AnomalyStockPage />} />
          <Route path="/progress-po"   element={<ProgressPOPage />} />
          <Route path="/slow-moving"   element={<StockAgingPage />} />
          <Route path="/work-order"    element={<WorkOrderPage />} />
          <Route path="/composition"   element={<TrainCompositionPage />} />
          <Route path="/admin-panel"   element={<AdminPanelPage />} />
          <Route path="/audit-log"     element={<AuditLogPage />} />
          <Route path="*"              element={<Navigate to="/critical-stock" replace />} />
        </Routes>
      </div>
    </div>
  );
}

// ── Root App ────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem('krl_theme') as ThemeMode) ?? 'light'
  );
  const [collapsed, setCollapsed] = useState(false);

  // Apply theme class to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'light');
    html.classList.add(theme);
    localStorage.setItem('krl_theme', theme);
  }, [theme]);

  const handleThemeToggle = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            localStorage.getItem('krl_auth')
              ? <Navigate to="/critical-stock" replace />
              : <LoginPage onLogin={() => {}} />
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedLayout
              theme={theme}
              onThemeToggle={handleThemeToggle}
              collapsed={collapsed}
              onToggle={() => setCollapsed(p => !p)}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
