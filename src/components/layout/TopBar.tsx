import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ThemeMode } from '../../types';

const pageLabels: Record<string, string> = {
  '/critical-stock': 'Availability Stok',
  '/progress-po': 'Progres PO & Transit',
  '/slow-moving': 'Analisa Usia Stok',
  '/work-order': 'Perawatan KRL',
  '/admin-panel': 'Panel Admin',
  '/audit-log': 'Log Audit',
};

interface TopBarProps {
  collapsed: boolean;
  theme: ThemeMode;
  onThemeToggle: () => void;
  currentPath: string;
}

export default function TopBar({ collapsed, theme, onThemeToggle, currentPath }: TopBarProps) {
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();
  const sidebarWidth = collapsed ? 64 : 260;
  const pageTitle = pageLabels[currentPath] ?? '';

  return (
    <header
      className="fixed top-0 right-0 z-30 flex justify-between items-center h-16 px-4 border-b"
      style={{
        left: sidebarWidth,
        backgroundColor: 'var(--color-background-metallic)',
        borderColor: 'var(--color-steel-border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold tracking-[0.12em] uppercase" style={{ color: 'var(--color-on-surface)' }}>
          PRISMA
        </h2>
        {pageTitle && (
          <span
            className="hidden md:inline text-[11px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-steel-border)' }}
          >
            {pageTitle}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          className="p-2 rounded-full transition-all hover:scale-105 border"
          style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-steel-border)' }}
          title={theme === 'dark' ? 'Tema Terang' : 'Tema Gelap'}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Notification */}
        <button className="p-2 rounded-full relative" style={{ color: 'var(--color-on-surface-variant)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="absolute top-1.5 right-1.5 led-indicator led-red rounded-full" style={{ width: 7, height: 7 }} />
        </button>

        <div className="w-px h-8" style={{ backgroundColor: 'var(--color-steel-border)' }} />

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
            >
              YM
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold leading-tight" style={{ color: 'var(--color-on-surface)' }}>Yuda Maulana</p>
              <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Admin</p>
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="hidden md:block" style={{ color: 'var(--color-on-surface-variant)' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showProfile && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
              <div
                className="absolute right-0 top-12 w-60 rounded-xl shadow-2xl border z-50 overflow-hidden"
                style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-steel-border)' }}
              >
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-black border"
                      style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                    >
                      YM
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>Yuda Maulana</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>yuda.maulana@krl.co.id</p>
                      <span
                        className="inline-block text-[9px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full mt-1 border"
                        style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        Administrator
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      localStorage.removeItem('krl_auth');
                      setShowProfile(false);
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-bold text-left transition-colors"
                    style={{ color: 'var(--color-led-red)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Keluar dari Sistem
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
