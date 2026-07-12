import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import { getSlowMovingData } from '../services/supabaseService';
import { formatRupiah, formatTanggal } from '../utils/calculations';
import type { AgingKategori, SlowMovingItem } from '../types';

const agingParameters = [
  { category_name: 'Fresh' as AgingKategori,       max_hari: 30,  color: '#16a34a' },
  { category_name: 'Slow-Moving' as AgingKategori, max_hari: 90,  color: '#d97706' },
  { category_name: 'At Risk' as AgingKategori,     max_hari: 180, color: '#f97316' },
  { category_name: 'Dead Stock' as AgingKategori,  max_hari: 9999,color: '#dc2626' },
];

const catCfg: Record<AgingKategori, { text: string; bg: string; border: string }> = {
  'Fresh':       { text: 'var(--color-led-green)', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.28)' },
  'Slow-Moving': { text: 'var(--color-led-amber)', bg: 'rgba(217,119,6,0.10)', border: 'rgba(217,119,6,0.28)' },
  'At Risk':     { text: '#f97316',                bg: 'rgba(249,115,22,0.10)',border: 'rgba(249,115,22,0.28)' },
  'Dead Stock':  { text: 'var(--color-led-red)',   bg: 'rgba(220,38,38,0.10)', border: 'rgba(220,38,38,0.28)' },
};

const exportCols = [
  { key: 'nomor_material', header: 'Kode Material' },
  { key: 'nama_material', header: 'Nama Material' },
  { key: 'satuan', header: 'Satuan' },
  { key: 'current_stock', header: 'Stok Saat Ini' },
  { key: 'nilai_aset', header: 'Nilai Aset (Rp)' },
  { key: 'last_movement', header: 'Pergerakan Terakhir' },
  { key: 'usia_pengendapan_hari', header: 'Usia Pengendapan (Hari)' },
  { key: 'kategori', header: 'Kategori' },
  { key: 'rekomendasi', header: 'Rekomendasi' },
];

export default function SlowMovingPage() {
  const [searchParams] = useSearchParams();
  const materialParam = searchParams.get('material');

  const [slowList, setSlowList] = useState<SlowMovingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKategori, setFilterKategori] = useState<AgingKategori | 'Semua'>('Semua');
  const [searchText, setSearchText] = useState(materialParam || '');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getSlowMovingData();
        setSlowList(data);
      } catch (err) {
        console.error('Error loading slow moving data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = slowList.filter(row => {
    const matchCat = filterKategori === 'Semua' || row.kategori === filterKategori;
    const matchSearch = row.nama_material.toLowerCase().includes(searchText.toLowerCase()) ||
                        row.nomor_material.toLowerCase().includes(searchText.toLowerCase());
    return matchCat && matchSearch;
  });
  const totalNilai = slowList.reduce((sum, r) => sum + r.nilai_aset, 0);

  const funnelData = agingParameters.map(p => ({
    ...p,
    count: slowList.filter(d => d.kategori === p.category_name).length,
    nilai: slowList.filter(d => d.kategori === p.category_name).reduce((s, d) => s + d.nilai_aset, 0),
  }));

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
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          Slow-Moving &amp; Dead Stock
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          Analisis usia pengendapan stok dan rekomendasi disposisi material tidak bergerak
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {funnelData.map(cat => {
          const c = catCfg[cat.category_name];
          return (
            <div key={cat.category_name} className="tactile-card rounded-lg p-5" style={{ borderLeft: `4px solid ${c.text}` }}>
              <p className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: c.text }}>{cat.category_name}</p>
              <p className="text-4xl font-black" style={{ color: 'var(--color-on-surface)' }}>{cat.count}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>material</p>
              <p className="text-xs font-bold mt-2" style={{ color: c.text }}>{formatRupiah(cat.nilai)}</p>
            </div>
          );
        })}
      </div>

      {/* ECharts — Funnel + Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel Chart Aging */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Funnel Usia Pengendapan Stok</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Distribusi material berdasarkan kategori aging</p>
          </div>
          <ReactECharts
            option={{
              backgroundColor: 'transparent',
              tooltip: {
                trigger: 'item',
                formatter: (p: { name: string; value: number; percent: number }) =>
                  `<b>${p.name}</b><br/>Jumlah: ${p.value} material<br/>Proporsi: ${p.percent}%`,
              },
              series: [{
                type: 'funnel',
                left: '10%', width: '80%',
                top: 20, bottom: 20,
                min: 0, max: slowList.length,
                minSize: '10%', maxSize: '100%',
                sort: 'none',
                gap: 6,
                label: { show: true, position: 'inside', formatter: '{b}\n{c} item', color: '#fff', fontWeight: 'bold', fontSize: 11 },
                labelLine: { show: false },
                itemStyle: { borderWidth: 0 },
                data: funnelData.map(f => ({
                  name: f.category_name,
                  value: f.count,
                  itemStyle: { color: f.color },
                })),
              }],
            }}
            style={{ height: 260 }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* Bar Chart Nilai Aset */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Nilai Aset Tertahan per Material</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Total: <strong>{formatRupiah(totalNilai)}</strong></p>
          </div>
          <ReactECharts
            option={{
              backgroundColor: 'transparent',
              tooltip: {
                trigger: 'axis',
                formatter: (params: { name: string; value: number }[]) =>
                  params.map(p => `${p.name}: <b>${formatRupiah(p.value)}</b>`).join('<br/>'),
              },
              grid: { left: 16, right: 16, top: 20, bottom: 60, containLabel: true },
              xAxis: {
                type: 'category',
                data: filtered.map(d => d.nomor_material),
                axisLabel: { color: '#9ca3af', fontSize: 9, rotate: 20, interval: 0 },
                axisLine: { lineStyle: { color: '#374151' } },
              },
              yAxis: {
                type: 'value',
                axisLabel: {
                  color: '#9ca3af', fontSize: 9,
                  formatter: (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : `${(v/1e3).toFixed(0)}K`,
                },
                splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
              },
              series: [{
                type: 'bar',
                barMaxWidth: 36,
                data: filtered.map(d => ({
                  value: d.nilai_aset,
                  itemStyle: {
                    color: catCfg[d.kategori].text,
                    borderRadius: [4, 4, 0, 0],
                  },
                })),
              }],
            }}
            style={{ height: 260 }}
            opts={{ renderer: 'svg' }}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <span className="text-[11px] font-black tracking-wider uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>Kategori:</span>
        {(['Semua', 'Fresh', 'Slow-Moving', 'At Risk', 'Dead Stock'] as const).map(k => {
          const isSemua = k === 'Semua';
          const c = isSemua ? null : catCfg[k as AgingKategori];
          return (
            <button key={k} onClick={() => setFilterKategori(k as AgingKategori | 'Semua')}
              className="px-3 py-1.5 rounded-full text-[11px] font-black tracking-wider uppercase border transition-all"
              style={{
                backgroundColor: filterKategori === k ? (c?.text ?? 'var(--color-secondary)') : 'var(--color-surface-container-high)',
                color: filterKategori === k ? '#000' : (c?.text ?? 'var(--color-on-surface-variant)'),
                borderColor: c?.border ?? 'var(--color-steel-border)',
              }}>
              {k}
            </button>
          );
        })}
        <div className="ml-auto">
          <ExportButton data={filtered as unknown as Record<string, unknown>[]} filename="slow_moving_dead_stock" columns={exportCols} />
        </div>
      </div>

      {/* Table */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['Kode Material','Nama Material','Stok','Nilai Aset','Pergerakan Terakhir','Usia Pengendapan','Kategori','Rekomendasi'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const c = catCfg[row.kategori];
                return (
                  <tr key={row.nomor_material} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface)' }}>{row.current_stock} {row.satuan}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-secondary)' }}>{formatRupiah(row.nilai_aset)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{formatTanggal(row.last_movement)}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: c.text }}>{row.usia_pengendapan_hari} hari</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{row.kategori}</span>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px]" style={{ color: 'var(--color-on-surface-variant)' }}>{row.rekomendasi}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
