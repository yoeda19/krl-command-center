import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import PageWrapper from '../components/layout/PageWrapper';
import StatusBadge from '../components/ui/StatusBadge';
import ExportButton from '../components/ui/ExportButton';
import { getSafetyStockData, getCriticalStockData } from '../services/supabaseService';
import type { AlertStatus, SafetyStockItem } from '../types';

const exportCols = [
  { key: 'nomor_material', header: 'Kode Material' },
  { key: 'nama_material', header: 'Nama Material' },
  { key: 'satuan', header: 'Satuan' },
  { key: 'current_stock', header: 'Stok Saat Ini' },
  { key: 'safety_stock_level', header: 'Level Safety Stock' },
  { key: 'reorder_point', header: 'Reorder Point' },
  { key: 'gap_bulan', header: 'Gap Defisit (Bulan)' },
  { key: 'status', header: 'Status Alert' },
  { key: 'silenced', header: 'Alarm Dimatikan' },
];

interface AlertCardProps { label: string; count: number; status: AlertStatus; }

const alertIcons: Record<AlertStatus, React.ReactNode> = {
  KRITIS: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-red)' }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  WASPADA: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-amber)' }}>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  AMAN: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-green)' }}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
};

function AlertCard({ label, count, status }: AlertCardProps) {
  const ledMap: Record<AlertStatus, string> = {
    KRITIS: 'led-red', WASPADA: 'led-amber', AMAN: 'led-green',
  };
  return (
    <div className="tactile-card rounded-xl p-5 flex items-center gap-4">
      <div className="flex items-center justify-center rounded-lg border"
        style={{ width: 44, height: 44, flexShrink: 0, borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container-high)' }}>
        {alertIcons[status]}
      </div>
      <div>
        <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
        <p className="text-4xl font-black" style={{ color: 'var(--color-on-surface)' }}>{count}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={`led-indicator ${ledMap[status]}`} style={{ width: 7, height: 7 }} />
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>material</p>
        </div>
      </div>
    </div>
  );
}

export default function SafetyStockPage() {
  const [searchParams] = useSearchParams();
  const materialParam = searchParams.get('material');

  const [safetyData, setSafetyData] = useState<SafetyStockItem[]>([]);
  const [criticalData, setCriticalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(materialParam || '');
  const [filterStatus, setFilterStatus] = useState<AlertStatus | 'Semua'>('Semua');

  useEffect(() => {
    async function loadData() {
      try {
        const [sData, cData] = await Promise.all([
          getSafetyStockData(),
          getCriticalStockData()
        ]);
        setSafetyData(sData);
        setCriticalData(cData);
      } catch (err) {
        console.error('Error loading safety stock data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const kritisCount = safetyData.filter(d => d.status === 'KRITIS').length;
  const waspadaCount = safetyData.filter(d => d.status === 'WASPADA').length;
  const amanCount = safetyData.filter(d => d.status === 'AMAN').length;

  // Heatmap per lokasi calculation
  const allDepos = [...new Set(criticalData.map(d => d.gudang_label).filter(Boolean))];
  const heatmapDepo = allDepos.length > 0 ? allDepos : ['Gudang Tidak Diketahui'];
  
  const categorize = (nama: string): string => {
    const n = nama.toLowerCase();
    if (n.includes('rem') || n.includes('brake') || n.includes('blok')) return 'Rem/Blok';
    if (n.includes('kontak') || n.includes('strip') || n.includes('pantograph')) return 'Kontak Strip';
    if (n.includes('wiper') || n.includes('kaca') || n.includes('glass')) return 'Wiper/Kaca';
    if (n.includes('motor') || n.includes('traction') || n.includes('inverter')) return 'Motor/Elektrik';
    return 'Lainnya';
  };
  
  const heatmapKategori = [...new Set(criticalData.map(d => categorize(d.nama_material)))];
  const heatmapData: number[][] = heatmapDepo.map(depo => {
    const depoMats = criticalData.filter(d => d.gudang_label === depo);
    return heatmapKategori.map(kat => {
      const katMats = depoMats.filter(d => categorize(d.nama_material) === kat);
      if (katMats.length === 0) return 0;
      return Math.round(katMats.reduce((s, d) => s + d.pct_ketersediaan, 0) / katMats.length);
    });
  });

  function heatmapColor(pct: number): { bg: string; text: string; label: string } {
    if (pct >= 80) return { bg: 'rgba(22,163,74,0.15)',  text: 'var(--color-led-green)', label: 'AMAN' };
    if (pct >= 51) return { bg: 'rgba(217,119,6,0.15)',  text: 'var(--color-led-amber)', label: 'WASPADA' };
    return            { bg: 'rgba(220,38,38,0.15)',  text: 'var(--color-led-red)',   label: 'KRITIS' };
  }

  const filtered: SafetyStockItem[] = safetyData.filter(row => {
    const matchSearch = row.nama_material.toLowerCase().includes(search.toLowerCase()) ||
                        row.nomor_material.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Semua' || row.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <PageWrapper fullWidth>
        <div className="flex items-center justify-center h-96">
          <span className="text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>Memuat data...</span>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper fullWidth>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-amber)' }}>
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
          </svg>
          Safety Stock Alert
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          Monitoring level stok dibandingkan batas safety stock dan reorder point
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertCard label="High Alert — Kritis" count={kritisCount} status="KRITIS" />
        <AlertCard label="Medium Alert — Waspada" count={waspadaCount} status="WASPADA" />
        <AlertCard label="Aman" count={amanCount} status="AMAN" />
      </div>

      {/* ECharts — Radar + Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RadarChart Ketersediaan */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Radar Ketersediaan Stok</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>% stok aktual vs safety stock level per material</p>
          </div>
          <ReactECharts
            option={{
              backgroundColor: 'transparent',
              tooltip: { trigger: 'item' },
              radar: {
                indicator: filtered.slice(0, 8).map(d => ({
                  name: `${d.nama_material.slice(0, 12)} (${d.nomor_material})`,
                  max: 100,
                })),
                shape: 'polygon',
                splitLine: { lineStyle: { color: '#e5e7eb' } },
                splitArea: { show: false },
                axisLine: { lineStyle: { color: '#e5e7eb' } },
                axisName: { color: '#6b7280', fontSize: 8 },
              },
              series: [{
                type: 'radar',
                data: [{
                  value: filtered.slice(0, 8).map(d =>
                    d.safety_stock_level > 0 ? Math.min(100, Math.round((d.current_stock / d.safety_stock_level) * 100)) : 0
                  ),
                  name: '% Ketersediaan',
                  areaStyle: { color: 'rgba(37,99,235,0.15)' },
                  lineStyle: { color: '#2563eb', width: 2 },
                  itemStyle: { color: '#2563eb' },
                  symbol: 'circle',
                  symbolSize: 5,
                }],
              }],
            }}
            style={{ height: 260 }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* BarChart Horizontal: Stok vs Safety Stock Level */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Stok Aktual vs Safety Stock Level</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Seberapa jauh stok dari batas aman dan reorder point</p>
          </div>
          <ReactECharts
            option={{
              backgroundColor: 'transparent',
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              legend: {
                data: ['Stok Saat Ini', 'Reorder Point', 'Safety Stock'],
                bottom: 4, textStyle: { color: '#9ca3af', fontSize: 10 },
              },
              grid: { left: 80, right: 16, top: 20, bottom: 48, containLabel: false },
              yAxis: {
                type: 'category',
                data: filtered.slice(0, 8).map(d => `${d.nama_material.slice(0, 10)} (${d.nomor_material})`),
                axisLabel: { color: '#6b7280', fontSize: 9 },
                axisLine: { lineStyle: { color: '#e5e7eb' } },
              },
              xAxis: {
                type: 'value',
                axisLabel: { color: '#9ca3af', fontSize: 9 },
                splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
              },
              series: [
                {
                  name: 'Stok Saat Ini',
                  type: 'bar',
                  barMaxWidth: 14,
                  itemStyle: { borderRadius: [0, 4, 4, 0] },
                  data: filtered.slice(0, 8).map(d => ({
                    value: d.current_stock,
                    itemStyle: {
                      color: d.status === 'KRITIS' ? '#dc2626'
                        : d.status === 'WASPADA' ? '#d97706' : '#16a34a',
                    },
                  })),
                },
                {
                  name: 'Reorder Point',
                  type: 'scatter',
                  symbolSize: 10,
                  symbol: 'diamond',
                  itemStyle: { color: '#d97706' },
                  data: filtered.slice(0, 8).map(d => d.reorder_point),
                },
                {
                  name: 'Safety Stock',
                  type: 'scatter',
                  symbolSize: 10,
                  symbol: 'triangle',
                  itemStyle: { color: '#dc2626' },
                  data: filtered.slice(0, 8).map(d => d.safety_stock_level),
                },
              ],
            }}
            style={{ height: 260 }}
            opts={{ renderer: 'svg' }}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 rounded px-3 py-2 border flex-1 min-w-[200px]"
          style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Cari nomor atau nama suku cadang..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none text-sm flex-1 focus:outline-none" style={{ color: 'var(--color-on-surface)' }} />
        </div>
        <div className="flex items-center gap-2">
          {(['Semua', 'KRITIS', 'WASPADA', 'AMAN'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-full text-[11px] font-black tracking-wider uppercase border transition-all"
              style={{
                backgroundColor: filterStatus === s ? 'var(--color-on-surface)' : 'var(--color-surface-container-high)',
                color: filterStatus === s ? 'var(--color-background)' : 'var(--color-on-surface-variant)',
                borderColor: filterStatus === s ? 'var(--color-on-surface)' : 'var(--color-steel-border)',
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)' }}>
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
            Tabel Status Safety Stock Alert
          </h3>
          <ExportButton data={filtered as unknown as Record<string, unknown>[]} filename="safety_stock_alert" columns={exportCols} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['Kode Material','Nama Material','Stok Saat Ini','Safety Stock Level','Reorder Point','Gap Defisit','Status','Keterangan','Aksi'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.nomor_material} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                  <td className="px-4 py-3 font-bold text-xs" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-on-surface)' }}>{row.current_stock} {row.satuan}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.safety_stock_level} {row.satuan}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.reorder_point} {row.satuan}</td>
                  <td className="px-4 py-3 text-xs font-bold" style={{ color: row.gap_bulan < 0 ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>
                    {row.gap_bulan > 0 ? '+' : ''}{row.gap_bulan} bln
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {row.silenced ? <span className="font-bold">🔕 Dimatikan Sementara</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex gap-2">
                      <Link to={`/progress-po?material=${row.nomor_material}`} className="px-2 py-1 rounded border text-[10px] font-bold bg-steel-button hover:opacity-85 text-on-surface" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                        PO
                      </Link>
                      <Link to={`/admin-panel?material=${row.nomor_material}`} className="px-2 py-1 rounded border text-[10px] font-bold bg-steel-button hover:opacity-85 text-on-surface" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                        Kelola
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap per Lokasi */}
      <div className="tactile-card rounded-lg overflow-hidden mt-6">
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Heatmap Stok per Lokasi</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              Akurasi stok aman (100% = aman)
            </p>
          </div>
          <div className="flex items-center gap-3 text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {[['var(--color-led-green)','Hijau ≥80%'],['var(--color-led-amber)','Kuning 51–79%'],['var(--color-led-red)','Merah ≤50%']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1">
                <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, backgroundColor: c as string }} />
                {l}
              </span>
            ))}
          </div>
        </div>
        <div className="p-5 overflow-x-auto">
          <table className="w-full min-w-[320px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-black tracking-wider uppercase pb-3 pr-4" style={{ color: 'var(--color-on-surface-variant)', width: 140 }}>Gudang</th>
                {heatmapKategori.map(k => (
                  <th key={k} className="text-center text-[10px] font-black tracking-wider uppercase pb-3 px-2" style={{ color: 'var(--color-on-surface-variant)' }}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapDepo.map((depo, di) => (
                <tr key={depo}>
                  <td className="pr-4 pb-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>{depo.replace('Gudang ', '')}</span>
                  </td>
                  {heatmapData[di].map((pct, ki) => {
                    const c = heatmapColor(pct);
                    return (
                      <td key={ki} className="px-2 pb-2">
                        <div
                           className="rounded text-center py-1.5 px-0.5 transition-all hover:scale-105 cursor-default"
                           style={{ backgroundColor: c.bg, border: `1px solid ${c.text}`, minWidth: 54 }}
                           title={`${depo} — ${heatmapKategori[ki]}: ${pct}% (${c.label})`}
                        >
                          <span className="text-xs font-black" style={{ color: c.text }}>{pct}%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </PageWrapper>
  );
}
