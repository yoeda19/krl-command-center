import { useState, useEffect } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import { getAuditLogs } from '../services/supabaseService';
import { formatDateTime } from '../utils/calculations';
import type { AuditLog } from '../types';

const exportCols = [
  { key: 'id',              header: 'ID Log' },
  { key: 'nomor_material',  header: 'Kode Material' },
  { key: 'parameter_name',  header: 'Nama Parameter' },
  { key: 'original_value',  header: 'Nilai Sebelumnya' },
  { key: 'new_value',       header: 'Nilai Baru' },
  { key: 'admin_name',      header: 'Nama Admin' },
  { key: 'admin_email',     header: 'Email Admin' },
  { key: 'changed_at',      header: 'Waktu Perubahan' },
  { key: 'modul',           header: 'Modul' },
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error('Error loading audit logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = logs.filter(row => {
    const q = search.toLowerCase();
    return (
      (row.admin_name ?? '').toLowerCase().includes(q) ||
      (row.admin_email ?? '').toLowerCase().includes(q) ||
      (row.nomor_material ?? '').toLowerCase().includes(q) ||
      (row.parameter_name ?? '').toLowerCase().includes(q) ||
      (row.modul ?? '').toLowerCase().includes(q)
    );
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const stats = [
    { label: 'Total Log',      value: logs.length,                                          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
    { label: 'Hari Ini',       value: logs.filter(l => (l.changed_at ?? '').startsWith(todayStr)).length, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { label: 'Admin Aktif',    value: new Set(logs.map(l => l.admin_email)).size,            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { label: 'Modul Tercatat', value: new Set(logs.map(l => l.modul)).size,                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
  ];

  if (loading) {
    return (
      <PageWrapper fullWidth>
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
          <div className="w-16 h-16 animate-pulse">
            <img src="/logo.svg" alt="PRISMA Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-sm font-medium animate-pulse" style={{ color: 'var(--color-on-surface-variant)' }}>
            Memuat data...
          </span>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper fullWidth>
      {/* Header */}
      <div className="h-4" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="tactile-card rounded-lg p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-surface-container-high)', border: '1px solid var(--color-steel-border)' }}>
              {s.icon}
            </div>
            <div>
              <p className="text-3xl font-black" style={{ color: 'var(--color-on-surface)' }}>{s.value}</p>
              <p className="text-[10px] font-black tracking-wider uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="tactile-card rounded-lg p-5">
        <h3 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>Timeline Aktivitas Terbaru</h3>
        <div className="space-y-0">
          {logs.slice(0, 5).map((log, i) => (
            <div key={log.id} className="flex gap-4 relative">
              {i < 4 && <div className="absolute left-[15px] top-8 bottom-0 w-0.5" style={{ backgroundColor: 'var(--color-steel-border)' }} />}
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 mt-1"
                style={{ backgroundColor: 'var(--color-surface-container-high)', border: '1px solid var(--color-steel-border)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div className="pb-5 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{log.parameter_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                      oleh <strong style={{ color: 'var(--color-on-surface)' }}>{log.admin_name}</strong>
                      {log.nomor_material && <> — Material: <span style={{ color: 'var(--color-on-surface)' }}>{log.nomor_material}</span></>}
                    </p>
                    {log.original_value !== null && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded border" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>
                          {log.original_value || '(kosong)'}
                        </span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)' }}>
                          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                        </svg>
                        <span className="text-[10px] px-2 py-0.5 rounded border" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                          {log.new_value}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-steel-border)' }}>
                      {log.modul}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{formatDateTime(log.changed_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search + Export */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 rounded px-3 py-2 border flex-1 min-w-[220px]"
          style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Cari admin, material, parameter, atau modul..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none text-sm flex-1 focus:outline-none" style={{ color: 'var(--color-on-surface)' }} />
        </div>
        <ExportButton data={filtered as unknown as Record<string, unknown>[]} filename="log_audit_perubahan" columns={exportCols} />
      </div>

      {/* Full Table */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['#','Waktu Perubahan','Admin','Kode Material','Parameter','Nilai Sebelumnya','Nilai Baru','Modul'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>#{row.id}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{formatDateTime(row.changed_at)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <p className="font-bold" style={{ color: 'var(--color-secondary)' }}>{row.admin_name}</p>
                    <p style={{ color: 'var(--color-on-surface-variant)' }}>{row.admin_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material ?? '—'}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.parameter_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[10px] px-2 py-0.5 rounded border font-mono whitespace-nowrap" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>
                      {row.original_value || '(kosong)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[10px] px-2 py-0.5 rounded border font-mono whitespace-nowrap" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                      {row.new_value}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-steel-border)' }}>
                      {row.modul}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Tidak ada log yang sesuai dengan pencarian.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
      </div>
    </PageWrapper>
  );
}
