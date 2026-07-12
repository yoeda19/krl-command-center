import { useState, useEffect } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import ReactECharts from 'echarts-for-react';
import { supabase } from '../lib/supabaseClient';

interface AnomalyItem {
  nomor_material: string;
  nama_material: string;
  satuan: string;
  plan_bulanan: number;
  actual_monthly_avg: number;
  deviasi_qty: number;
  deviasi_pct: number;
  status: 'NORMAL' | 'ANOMALI';
}

const exportCols = [
  { key: 'nomor_material',      header: 'Kode Material' },
  { key: 'nama_material',       header: 'Nama Material' },
  { key: 'plan_bulanan',        header: 'Rencana Bulanan' },
  { key: 'actual_monthly_avg',  header: 'Aktual Rata-rata' },
  { key: 'deviasi_qty',         header: 'Deviasi (Qty)' },
  { key: 'deviasi_pct',         header: 'Deviasi (%)' },
  { key: 'status',              header: 'Status' },
];

export default function AnomalyStockPage() {
  const [dataList, setDataList] = useState<AnomalyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodeBulan, setPeriodeBulan] = useState<number>(12); // default 12 bulan (maksimal 12 bulan, Poin 4)
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'SEMUA' | 'ANOMALI' | 'NORMAL'>('SEMUA');

  useEffect(() => {
    async function loadAnomalyData() {
      setLoading(true);
      try {
        const { data: materials } = await supabase.from('master_materials').select('*');
        
        // Calculate date limit based on selected period
        const dateLimit = new Date('2026-07-11');
        dateLimit.setMonth(dateLimit.getMonth() - periodeBulan);
        const dateLimitStr = dateLimit.toISOString().split('T')[0];

        const { data: history } = await supabase
          .from('recent_history')
          .select('nomor_material, qty, tanggal')
          .gte('tanggal', dateLimitStr);

        const { data: monthlyPlans } = await supabase
          .from('monthly_absorption_plans')
          .select('nomor_material, tahun, bulan, plan_qty');

        if (!materials) return;

        const items: AnomalyItem[] = materials.map(mat => {
          const matPlans = monthlyPlans?.filter(p => p.nomor_material === mat.nomor_material) || [];
          
          // Calculate average plan target for the selected period
          const now = new Date('2026-07-11');
          let totalPlanQty = 0;
          for (let i = 0; i < periodeBulan; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const pRecord = matPlans.find(p => p.tahun === d.getFullYear() && p.bulan === (d.getMonth() + 1));
            totalPlanQty += pRecord ? pRecord.plan_qty : 0;
          }
          const plan_bulanan = Math.round((totalPlanQty / periodeBulan) * 10) / 10;
          
          const matHistory = history?.filter(h => h.nomor_material === mat.nomor_material) || [];
          const totalQty = matHistory.reduce((sum, h) => sum + (h.qty || 0), 0);
          
          // Compute average based on selected months
          const actual_monthly_avg = Math.round((totalQty / periodeBulan) * 10) / 10;
          
          const deviasi_qty = Math.round((actual_monthly_avg - plan_bulanan) * 10) / 10;
          const deviasi_pct = plan_bulanan > 0 ? Math.round((deviasi_qty / plan_bulanan) * 100) : 0;
          
          // Anomaly triggers if actual consumption exceeds plan by > 15%
          const status = deviasi_pct > 15 ? 'ANOMALI' : 'NORMAL';

          return {
            nomor_material: mat.nomor_material,
            nama_material: mat.nama_material,
            satuan: mat.satuan,
            plan_bulanan,
            actual_monthly_avg,
            deviasi_qty,
            deviasi_pct,
            status,
          };
        });

        setDataList(items);
      } catch (err) {
        console.error('Error loading anomaly data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnomalyData();
  }, [periodeBulan]);

  const filteredData = dataList.filter(row => {
    const q = searchText.toLowerCase();
    const matchSearch = row.nama_material.toLowerCase().includes(q) || row.nomor_material.includes(q);
    const matchStatus = filterStatus === 'SEMUA' || row.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalAnomalies = dataList.filter(d => d.status === 'ANOMALI').length;

  if (loading) {
    return (
      <PageWrapper fullWidth>
        <div className="flex items-center justify-center h-96">
          <span className="text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>Menganalisis anomali stok...</span>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper fullWidth>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-red)' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Deteksi Anomali Stok
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
            Mengidentifikasi deviasi penyerapan aktual realisasi terhadap target perencanaan bulanan (maks. 12 bulan)
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold self-start md:self-center"
          style={{
            backgroundColor: totalAnomalies > 0 ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)',
            color: totalAnomalies > 0 ? 'var(--color-led-red)' : 'var(--color-led-green)',
            border: totalAnomalies > 0 ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(22,163,74,0.3)'
          }}
        >
          <span className={`led-indicator ${totalAnomalies > 0 ? 'led-red' : 'led-green'}`} style={{ width: 8, height: 8 }} />
          {totalAnomalies} Material Terdeteksi Anomali
        </div>
      </div>

      {/* Chart Komparasi Plan vs Aktual */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="p-5 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Grafik Komparasi Deviasi Penyerapan</h3>
        </div>
        <ReactECharts
          option={{
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['Target Plan', 'Aktual Rata-rata'], bottom: 8, textStyle: { color: '#9ca3af', fontSize: 11 } },
            grid: { left: 16, right: 16, top: 24, bottom: 48, containLabel: true },
            xAxis: {
              type: 'category',
              data: filteredData.map(d => d.nomor_material),
              axisLabel: { color: '#9ca3af', fontSize: 10 }
            },
            yAxis: {
              type: 'value',
              name: 'Unit/Bulan',
              nameTextStyle: { color: '#9ca3af', fontSize: 10 },
              axisLabel: { color: '#9ca3af', fontSize: 10 }
            },
            series: [
              {
                name: 'Target Plan',
                type: 'bar',
                barMaxWidth: 24,
                itemStyle: { color: 'rgba(37,99,235,0.4)', borderRadius: [4, 4, 0, 0] },
                data: filteredData.map(d => d.plan_bulanan)
              },
              {
                name: 'Aktual Rata-rata',
                type: 'bar',
                barMaxWidth: 24,
                itemStyle: {
                  borderRadius: [4, 4, 0, 0],
                  color: (params: any) => {
                    const row = filteredData[params.dataIndex];
                    return row.status === 'ANOMALI' ? '#dc2626' : '#16a34a';
                  }
                },
                data: filteredData.map(d => d.actual_monthly_avg)
              }
            ]
          }}
          style={{ height: 260 }}
          opts={{ renderer: 'svg' }}
        />
      </div>

      {/* Control Panel Filter & Periode */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="flex items-center gap-2 rounded px-3 py-2 border flex-1 min-w-[200px]"
          style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Cari kode atau nama material..." value={searchText} onChange={e => setSearchText(e.target.value)}
            className="bg-transparent border-none text-sm flex-1 focus:outline-none" style={{ color: 'var(--color-on-surface)' }} />
        </div>

        {/* Periode Bulan Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Periode:</span>
          <select
            value={periodeBulan}
            onChange={e => setPeriodeBulan(parseInt(e.target.value))}
            className="rounded px-3 py-2 border text-sm"
            style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
          >
            <option value={1}>1 Bulan Terakhir</option>
            <option value={3}>3 Bulan Terakhir</option>
            <option value={6}>6 Bulan Terakhir</option>
            <option value={12}>12 Bulan Terakhir (Maks)</option>
          </select>
        </div>

        {/* Status Filter buttons */}
        <div className="flex gap-2">
          {(['SEMUA', 'ANOMALI', 'NORMAL'] as const).map(s => {
            const active = filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                  active ? 'skeuomorphic-btn' : 'border'
                }`}
                style={
                  !active
                    ? { borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container-high)' }
                    : {}
                }
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabel Anomali */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Daftar Analisis Deviasi Penyerapan</h3>
          </div>
          <ExportButton data={filteredData as any} filename="anomaly_stock_analysis" columns={exportCols} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['Kode Material','Deskripsi Material','Plan Bulanan','Aktual Rata-rata','Deviasi (Qty)','Persentase Deviasi','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase first:text-left text-right last:text-center"
                    style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => {
                const isAnomaly = row.status === 'ANOMALI';
                return (
                  <tr key={row.nomor_material} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                    <td className="px-4 py-3 font-bold text-xs" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                    <td className="px-4 py-3 text-xs text-right" style={{ color: 'var(--color-on-surface-variant)' }}>{row.plan_bulanan} {row.satuan}/bln</td>
                    <td className="px-4 py-3 text-xs text-right font-medium" style={{ color: 'var(--color-on-surface)' }}>{row.actual_monthly_avg} {row.satuan}/bln</td>
                    <td className="px-4 py-3 text-xs text-right font-bold" style={{ color: row.deviasi_qty > 0 ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>
                      {row.deviasi_qty > 0 ? '+' : ''}{row.deviasi_qty}
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-bold" style={{ color: row.deviasi_pct > 15 ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>
                      {row.deviasi_pct > 0 ? '+' : ''}{row.deviasi_pct}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isAnomaly ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                      }`}>
                        {row.status}
                      </span>
                    </td>
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
