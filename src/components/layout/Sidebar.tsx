import { NavLink } from 'react-router-dom';

// SVG icon components — bersih, tidak ada AI-generated icon
const Icons = {
  criticalStock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  progressPO: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  slowMoving: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  workOrder: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  adminPanel: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  auditLog: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  train: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="13" rx="2"/><path d="M4 11h16"/>
      <path d="M12 3v8"/><path d="M8 19l-2 3"/><path d="M18 22l-2-3"/>
      <path d="M8 16h8"/>
    </svg>
  ),
  anomalyStock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  chevronLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  chevronRight: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

const navItems = [
  { path: '/critical-stock', icon: Icons.criticalStock, label: 'Availability Stok', alertColor: 'red' },
  { path: '/anomaly-stock', icon: Icons.anomalyStock,  label: 'Anomali Stok' },
  { path: '/slow-moving',   icon: Icons.slowMoving,    label: 'Analisa Usia Stok' },
  { path: '/progress-po',   icon: Icons.progressPO,    label: 'Progres PO & Transit' },
  { path: '/work-order',    icon: Icons.workOrder,     label: 'Perawatan KRL' },
  { path: '/composition',   icon: Icons.train,         label: 'Komposisi Rangkaian' },
  { path: '/admin-panel',   icon: Icons.adminPanel,    label: 'Panel Admin' },
  { path: '/audit-log',     icon: Icons.auditLog,      label: 'Log Audit' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <nav
      className="fixed left-0 top-0 h-full z-40 flex flex-col sidebar-transition border-r overflow-hidden"
      style={{
        width: collapsed ? 64 : 260,
        backgroundColor: 'var(--color-background-metallic)',
        borderColor: 'var(--color-steel-border)',
        boxShadow: '2px 0 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── Brand ── */}
      <div
        className="h-16 flex items-center border-b shrink-0 gap-3"
        style={{ borderColor: 'var(--color-steel-border)', padding: collapsed ? '0 16px' : '0 20px' }}
      >
        <div
          className="flex items-center justify-center rounded-lg shrink-0 overflow-hidden"
          style={{
            width: 34,
            height: 34,
            border: '1px solid var(--color-steel-border)',
          }}
        >
          <img src="/logo.svg" alt="PRISMA Logo" className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <p className="font-bold text-sm leading-tight" style={{ color: 'var(--color-on-surface)' }}>
              PRISMA
            </p>
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>
              Material Analysis
            </p>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <div className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded px-3 py-2.5 transition-all duration-150 relative group
                   ${isActive ? 'nav-active' : 'nav-inactive'}`
                }
                title={collapsed ? item.label : undefined}
              >
                {() => (
                  <>
                    <span className="shrink-0" style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className="text-[13px] whitespace-nowrap overflow-hidden leading-tight">
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.alertColor && (
                      <div
                        className={`absolute right-3 led-indicator led-${item.alertColor}`}
                        style={{ width: 7, height: 7 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Toggle ── */}
      <div className="p-2.5 border-t shrink-0" style={{ borderColor: 'var(--color-steel-border)' }}>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 py-2 rounded border text-xs font-bold tracking-wider uppercase transition-all hover:opacity-75"
          style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container)' }}
          title={collapsed ? 'Buka Sidebar' : 'Ciutkan'}
        >
          {collapsed ? Icons.chevronRight : Icons.chevronLeft}
        </button>
      </div>
    </nav>
  );
}
