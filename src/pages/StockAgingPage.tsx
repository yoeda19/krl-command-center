import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import { getSlowMovingData, getRestockData, getCriticalStockData } from '../services/supabaseService';
import { formatRupiah, formatTanggal } from '../utils/calculations';
import type { AgingKategori, SlowMovingItem, RestockItem, CriticalStockItem } from '../types';
import { useAppStore } from '../store/useAppStore';

const agingParameters = [
  { category_name: 'Fresh' as AgingKategori,       max_hari: 30,  color: '#16a34a' },
  { category_name: 'Slow-Moving' as AgingKategori, max_hari: 90,  color: '#d97706' },
  { category_name: 'At Risk' as AgingKategori,     max_hari: 180, color: '#f97316' },
  { category_name: 'Dead Stock' as AgingKategori,  max_hari: 9999,color: '#dc2626' },
  { category_name: 'Stock Out' as AgingKategori,   max_hari: 0,   color: '#ef4444' },
];

const catCfg: Record<AgingKategori, { text: string; bg: string; border: string }> = {
  'Fresh':       { text: 'var(--color-led-green)', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.28)' },
  'Slow-Moving': { text: 'var(--color-led-amber)', bg: 'rgba(217,119,6,0.10)', border: 'rgba(217,119,6,0.28)' },
  'At Risk':     { text: '#f97316',                bg: 'rgba(249,115,22,0.10)',border: 'rgba(249,115,22,0.28)' },
  'Dead Stock':  { text: '#b91c1c',                bg: 'rgba(185,28,28,0.10)', border: 'rgba(185,28,28,0.28)' },
  'Stock Out':   { text: 'var(--color-led-red)',   bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)' },
};

const exportCols = [
  { key: 'nomor_material', header: 'Kode Material' },
  { key: 'nama_material', header: 'Nama Material' },
  { key: 'satuan', header: 'Satuan' },
  { key: 'current_stock', header: 'Stok Saat Ini' },
  { key: 'nilai_aset', header: 'Nilai Aset (Rp)' },
  { key: 'holding_cost', header: 'Est. Holding Cost (Rp)' },
  { key: 'last_movement', header: 'Pergerakan Terakhir' },
  { key: 'usia_pengendapan_hari', header: 'Usia Pengendapan (Hari)' },
  { key: 'kategori', header: 'Kategori' },
  { key: 'rekomendasi', header: 'Rekomendasi' },
];

const restockExportCols = [
  { key: 'tanggal', header: 'Tanggal' },
  { key: 'nomor_material', header: 'Kode Material' },
  { key: 'nama_material', header: 'Nama Material' },
  { key: 'qty', header: 'Quantity' },
  { key: 'satuan', header: 'Satuan' },
  { key: 'amount', header: 'Total Nilai (Rp)' },
  { key: 'gudang', header: 'Gudang' },
];

export default function StockAgingPage() {
  const [searchParams] = useSearchParams();
  const materialParam = searchParams.get('material');

  const { slowMovingData, setSlowMovingData, isDataLoaded, setIsDataLoaded } = useAppStore();
  const [slowList, setSlowList] = useState<SlowMovingItem[]>(slowMovingData);
  const [restockList, setRestockList] = useState<RestockItem[]>([]);
  const [criticalList, setCriticalList] = useState<CriticalStockItem[]>([]);
  const [loading, setLoading] = useState(!isDataLoaded);
  const [filterKategori, setFilterKategori] = useState<AgingKategori | 'Semua'>('Semua');
  const [searchText, setSearchText] = useState(materialParam || '');
  const [restockSearchText, setRestockSearchText] = useState(materialParam || '');
  const [selectedRestockMaterial, setSelectedRestockMaterial] = useState<string>('');
  const [isHeatmapFullScreen, setIsHeatmapFullScreen] = useState(false);
  const [heatmapCellHeight, setHeatmapCellHeight] = useState<number>(36);
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (isDataLoaded && slowMovingData.length > 0) {
        setSlowList(slowMovingData);
        setLoading(false);
        try {
          const [restockData, criticalData] = await Promise.all([
            getRestockData(),
            getCriticalStockData()
          ]);
          setRestockList(restockData);
          setCriticalList(criticalData);
        } catch (e) {
          console.error('Background loading error:', e);
        }
        return;
      }

      try {
        setLoading(true);
        const [slowData, restockData, criticalData] = await Promise.all([
          getSlowMovingData(),
          getRestockData(),
          getCriticalStockData()
        ]);
        setSlowList(slowData);
        setSlowMovingData(slowData); // Simpan ke Zustand
        setIsDataLoaded(true);
        setRestockList(restockData);
        setCriticalList(criticalData);
      } catch (err) {
        console.error('Error loading slow moving / restock / critical data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isDataLoaded]);

  const filtered = slowList.filter(row => {
    const matchCat = filterKategori === 'Semua' || row.kategori === filterKategori;
    const matchSearch = row.nama_material.toLowerCase().includes(searchText.toLowerCase()) ||
                        row.nomor_material.toLowerCase().includes(searchText.toLowerCase());
    return matchCat && matchSearch;
  });
  const totalNilai = slowList.reduce((sum, r) => sum + r.nilai_aset, 0);
  const totalHoldingCost = slowList.reduce((sum, r) => {
    if (r.kategori === 'Fresh' || r.kategori === 'Stock Out') return sum;
    return sum + (r.nilai_aset * 0.10 * (r.usia_pengendapan_hari / 365));
  }, 0);

  const validMatIds = new Set(slowList.map(m => m.nomor_material));
  const filteredRestockList = restockList.filter(r => r.nomor_material && validMatIds.has(r.nomor_material));

  const activeRestockMat = selectedRestockMaterial || slowList[0]?.nomor_material || '';

  const filteredRestock = filteredRestockList.filter(row => {
    const term = restockSearchText.toLowerCase();
    return row.nama_material.toLowerCase().includes(term) ||
           row.nomor_material.toLowerCase().includes(term) ||
           row.gudang.toLowerCase().includes(term) ||
           row.tanggal.includes(term);
  });

  const restockGaps = (() => {
    const materialRestocks = filteredRestockList
      .filter(r => r.nomor_material === activeRestockMat)
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    return materialRestocks.map((r, idx) => {
      let gapDays = 0;
      if (idx > 0) {
        const prevDate = new Date(materialRestocks[idx - 1].tanggal);
        const curDate = new Date(r.tanggal);
        const diffTime = curDate.getTime() - prevDate.getTime();
        gapDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }
      return {
        tanggal: r.tanggal,
        qty: Number(r.qty) || 0,
        amount: Number(r.amount) || 0,
        gap: gapDays
      };
    });
  })();

  const warehousesList = ['Gudang Pusat', 'Depo Depok', 'Depo Bukit Duri', 'Overhaul Manggarai', 'Depo Bogor', 'Depo Manggarai', 'TOTAL'];

  const textStyleColor = isDark ? '#ffffff' : '#000000';

  const displayHeatmapList = isHeatmapFullScreen ? filtered : filtered.slice(0, 10);

  const heatmapData = (() => {
    const data: any[] = [];
    displayHeatmapList.forEach((material, yIndex) => {
      warehousesList.forEach((wh, xIndex) => {
        let stockVal = 0;
        let planVal = 0;
        let cellColor = '';

        if (wh === 'TOTAL') {
          stockVal = material.current_stock;
          planVal = criticalList
            .filter(c => c.nomor_material === material.nomor_material)
            .reduce((sum, c) => sum + c.plan_bulanan, 0);
          
          cellColor = isDark ? 'rgba(79, 156, 249, 0.95)' : 'rgba(29, 78, 216, 0.95)'; // Primary Blue
        } else {
          stockVal = material.stocks?.[wh] || 0;
          
          // Find corresponding critical item to get plan_bulanan
          const mappedGudangCode = (() => {
            if (wh === 'Gudang Pusat') return 'C013';
            if (wh === 'Depo Depok') return 'C007';
            if (wh === 'Depo Bukit Duri') return 'C006';
            if (wh === 'Overhaul Manggarai') return 'C009';
            if (wh === 'Depo Bogor') return 'C008';
            if (wh === 'Depo Manggarai') return 'C020';
            return '';
          })();
          
          const critItem = criticalList.find(c => c.nomor_material === material.nomor_material && c.gudang === mappedGudangCode);
          planVal = critItem ? critItem.plan_bulanan : 0;
          
          if (stockVal === 0) {
            cellColor = 'rgba(239, 68, 68, 0.95)'; // Merah
          } else if (stockVal >= planVal) {
            cellColor = 'rgba(22, 163, 74, 0.95)'; // Hijau
          } else {
            cellColor = 'rgba(245, 158, 11, 0.8)'; // Orange
          }
        }

        data.push({
          value: [xIndex, yIndex, stockVal, planVal],
          itemStyle: {
            color: cellColor
          }
        });
      });
    });
    return data;
  })();



  const funnelData = agingParameters.map(p => ({
    ...p,
    count: slowList.filter(d => d.kategori === p.category_name).length,
    nilai: slowList.filter(d => d.kategori === p.category_name).reduce((s, d) => s + d.nilai_aset, 0),
  }));

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
        <div className="tactile-card rounded-lg p-5" style={{ borderLeft: '4px solid #ef4444' }}>
          <p className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: '#ef4444' }}>Est. Holding Cost</p>
          <p className="text-2xl font-black" style={{ color: '#ef4444' }}>{formatRupiah(totalHoldingCost)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>beban modal pengendapan</p>
          <p className="text-[10px] font-bold mt-2 text-red-500">Rate 10% p.a.</p>
        </div>
      </div>

      {/* ECharts — Funnel + Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart Aging */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Kategori Aging</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Proporsi kategori aging</p>
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
                name: 'Kategori Aging',
                type: 'pie',
                radius: ['50%', '70%'],
                avoidLabelOverlap: true,
                itemStyle: {
                  borderRadius: 6,
                  borderColor: isDark ? '#1f2937' : '#ffffff',
                  borderWidth: 2
                },
                label: {
                  show: true,
                  position: 'outside',
                  formatter: '{b}\n{c} item ({d}%)',
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: isDark ? '#ffffff' : '#000000'
                },
                labelLine: {
                  show: true,
                  length: 8,
                  length2: 8
                },
                data: funnelData.filter(f => f.count > 0).map(f => ({
                  name: f.category_name,
                  value: f.count,
                  itemStyle: { color: f.color },
                })),
              }],
            }}
            notMerge={true}
            style={{ height: '28vh', minHeight: '260px', maxHeight: '550px' }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* Bar Chart Nilai Aset */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Nilai Aset</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Total: <strong>{formatRupiah(totalNilai)}</strong></p>
          </div>
          <ReactECharts
            option={{
              backgroundColor: 'transparent',
              tooltip: {
                show: true,
                trigger: 'axis',
                confine: true,
                formatter: (params: any[]) =>
                  params.map(p => `${p.name}: <b>${formatRupiah(p.value)}</b>`).join('<br/>'),
              },
              grid: { left: 10, right: 20, top: 15, bottom: 15, containLabel: true },
              xAxis: {
                type: 'value',
                axisLabel: {
                  color: textStyleColor, fontSize: 9,
                  formatter: (v: number) => {
                    if (v >= 1e9) return `${(v / 1e9).toFixed(v % 1e9 === 0 ? 0 : 1)} M`;
                    if (v >= 1e6) return `${(v / 1e6).toFixed(0)} Jt`;
                    if (v >= 1e3) return `${(v / 1e3).toFixed(0)} Rb`;
                    return String(v);
                  },
                },
                splitLine: { lineStyle: { color: isDark ? '#374151' : '#e2e8f0', type: 'dashed' } },
              },
              yAxis: {
                type: 'category',
                data: filtered.map(d => d.nama_material),
                axisLabel: { 
                  color: textStyleColor, 
                  fontSize: 8, 
                  interval: 0,
                  formatter: (v: string) => {
                    const max = window.innerWidth <= 768 ? 14 : 24;
                    return v.length > max ? v.slice(0, max) + '...' : v;
                  }
                },
                axisLine: { lineStyle: { color: '#374151' } },
              },
              series: [{
                type: 'bar',
                barMaxHeight: 20,
                data: filtered.map(d => ({
                  value: d.nilai_aset,
                  itemStyle: {
                    color: catCfg[d.kategori].text,
                    borderRadius: [0, 4, 4, 0],
                  },
                  emphasis: {
                    itemStyle: {
                      color: catCfg[d.kategori].text
                    }
                  }
                })),
              }],
            }}
            style={{ height: '28vh', minHeight: '260px', maxHeight: '550px' }}
            opts={{ renderer: 'svg' }}
          />
        </div>
      </div>

      {/* Heatmap Section */}
      <div
        className={`tactile-card rounded-lg overflow-hidden mt-4 ${isHeatmapFullScreen ? 'fixed inset-0 z-50 p-6 flex flex-col justify-between' : ''}`}
        style={isHeatmapFullScreen ? {
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-steel-border)',
          width: '100vw',
          height: '100vh',
          overflowY: 'auto'
        } : {}}
      >
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Sebaran Stok</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              Tingkat stok material di seluruh gudang{!isHeatmapFullScreen && filtered.length > 10 && ' (Menampilkan 10 teratas, klik Layar Penuh untuk semua)'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isHeatmapFullScreen && (
              <div className="flex items-center gap-2 border rounded p-1" style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
                <span className="text-[10px] font-bold px-1.5" style={{ color: 'var(--color-on-surface)' }}>Ukuran Sel:</span>
                <button
                  onClick={() => setHeatmapCellHeight(prev => Math.max(20, prev - 4))}
                  className="px-2 py-0.5 rounded text-[10px] font-black hover:opacity-85 border"
                  style={{ backgroundColor: 'var(--color-surface-container)', color: 'var(--color-on-surface)', borderColor: 'var(--color-steel-border)' }}
                  title="Kecilkan Sel"
                >
                  A-
                </button>
                <span className="text-[10px] font-bold w-7 text-center" style={{ color: 'var(--color-on-surface)' }}>{heatmapCellHeight}px</span>
                <button
                  onClick={() => setHeatmapCellHeight(prev => Math.min(60, prev + 4))}
                  className="px-2 py-0.5 rounded text-[10px] font-black hover:opacity-85 border"
                  style={{ backgroundColor: 'var(--color-surface-container)', color: 'var(--color-on-surface)', borderColor: 'var(--color-steel-border)' }}
                  title="Besarkan Sel"
                >
                  A+
                </button>
              </div>
            )}
            <button
              onClick={() => {
                if (isHeatmapFullScreen) {
                  setHeatmapCellHeight(36);
                }
                setIsHeatmapFullScreen(!isHeatmapFullScreen);
              }}
              className="p-1.5 rounded border transition-all flex items-center justify-center hover:opacity-80"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
              title={isHeatmapFullScreen ? "Kecilkan Tampilan" : "Perbesar Tampilan (Full Screen)"}
            >
              {isHeatmapFullScreen ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6m0 0V3m0 6l-6-6m6 18v-6m0 0H9m6 0l-6 6" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6m0 0v6m0-6L14 10M9 21H3m0 0v-6m0 6l7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-background)' }}>
          {displayHeatmapList.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">Tidak ada data untuk heatmap.</div>
          ) : (
            <div className="overflow-x-auto w-full">
              <ReactECharts
                option={{
                  backgroundColor: 'transparent',
                  tooltip: {
                    show: window.innerWidth > 768,
                    confine: true,
                    formatter: (p: any) => {
                      const xName = warehousesList[p.data.value[0]];
                      const materialItem = displayHeatmapList[p.data.value[1]];
                      const yName = materialItem ? `${materialItem.nomor_material} - ${materialItem.nama_material}` : '';
                      const stock = p.data.value[2];
                      const plan = p.data.value[3];
                      return `<b>${yName}</b><br/>Gudang: ${xName}<br/>Stok: <b>${stock}</b><br/>Plan Target: <b>${plan}</b>`;
                    }
                  },
                  grid: {
                    top: 30,
                    bottom: 30,
                    left: 160,
                    right: 20,
                    containLabel: true
                  },
                  xAxis: {
                    type: 'category',
                    data: warehousesList,
                    splitArea: { show: true },
                    axisLabel: {
                      color: textStyleColor,
                      fontSize: window.innerWidth <= 768 ? 6.5 : 10,
                      fontWeight: 'bold',
                      rotate: 0,
                      interval: 0,
                      formatter: (val: string) => val === 'Overhaul Manggarai' ? 'OHM' : val
                    },
                    axisLine: { lineStyle: { color: '#374151' } }
                  },
                  yAxis: {
                    type: 'category',
                    data: displayHeatmapList.map(d => d.nama_material),
                    splitArea: { show: true },
                    axisLabel: {
                      color: textStyleColor,
                      fontSize: 9,
                      fontWeight: 'bold'
                    },
                    axisLine: { lineStyle: { color: '#374151' } }
                  },
                  visualMap: {
                    show: false
                  },
                  series: [{
                    name: 'Stok',
                    type: 'heatmap',
                    data: heatmapData,
                    itemStyle: {
                      borderColor: isDark ? '#374151' : '#cbd5e1',
                      borderWidth: 2
                    },
                    label: {
                      show: true,
                      formatter: (p: any) => {
                        const val = p.data.value[2];
                        return val !== undefined && val !== null ? String(val) : '0';
                      },
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 'bold',
                      textBorderColor: '#000',
                      textBorderWidth: 2
                    },
                    emphasis: {
                      itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                      }
                    }
                  }]
                }}
                notMerge={true}
                style={{
                  height: Math.max(300, displayHeatmapList.length * heatmapCellHeight + 80),
                  minWidth: window.innerWidth <= 768 ? '850px' : '100%'
                }}
                opts={{ renderer: 'svg' }}
              />
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-gray-800 border-dashed text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-red-800" style={{ backgroundColor: 'rgba(239, 68, 68, 0.95)' }}></span>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Kosong (0)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-amber-800" style={{ backgroundColor: 'rgba(245, 158, 11, 0.8)' }}></span>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Kurang dari Plan Target Gudang</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-green-800" style={{ backgroundColor: 'rgba(22, 163, 74, 0.95)' }}></span>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Sesuai / Melebihi Plan Target Gudang</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-blue-800" style={{ backgroundColor: isDark ? 'rgba(79, 156, 249, 0.95)' : 'rgba(29, 78, 216, 0.95)' }}></span>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Total Stok per Material (Kolom TOTAL)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-3 items-center mt-4">
        <div className="flex items-center gap-2 bg-black bg-opacity-20 px-3 py-1.5 rounded-lg border border-gray-800 w-full sm:w-64">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-on-surface-variant)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Cari material..."
            className="bg-transparent border-none text-xs focus:outline-none w-full text-white"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        {searchText && (
          <button
            onClick={() => setSearchText('')}
            className="text-xs hover:text-white transition"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            Clear
          </button>
        )}
        <span className="text-[11px] font-black tracking-wider uppercase ml-2" style={{ color: 'var(--color-on-surface-variant)' }}>Kategori:</span>
        {(['Semua', 'Fresh', 'Slow-Moving', 'At Risk', 'Dead Stock', 'Stock Out'] as const).map(k => {
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
          <ExportButton
            data={filtered.map(row => {
              const hc = (row.kategori === 'Fresh' || row.kategori === 'Stock Out') ? 0 : Math.round(row.nilai_aset * 0.10 * (row.usia_pengendapan_hari / 365));
              return { ...row, holding_cost: hc };
            }) as unknown as Record<string, unknown>[]}
            filename="slow_moving_dead_stock"
            columns={exportCols}
          />
        </div>
      </div>

      {/* Table */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['Kode Material','Nama Material','Stok','Nilai Aset','Holding Cost (10%/th)','Pergerakan Terakhir','Usia Pengendapan','Kategori','Rekomendasi'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const c = catCfg[row.kategori];
                const hc = (row.kategori === 'Fresh' || row.kategori === 'Stock Out') ? 0 : Math.round(row.nilai_aset * 0.10 * (row.usia_pengendapan_hari / 365));
                return (
                  <tr key={row.nomor_material} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                    <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap min-w-[200px]" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.current_stock} {row.satuan}</td>
                    <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-secondary)' }}>{formatRupiah(row.nilai_aset)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-red-500 whitespace-nowrap">{hc > 0 ? formatRupiah(hc) : '-'}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatTanggal(row.last_movement)}</td>
                    <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ color: c.text }}>{row.usia_pengendapan_hari} hari</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{row.kategori}</span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap min-w-[220px]" style={{ color: 'var(--color-on-surface-variant)' }}>{row.rekomendasi}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Section Header */}
      <div className="mt-10 border-t pt-8" style={{ borderColor: 'var(--color-steel-border)' }}>
        <h2 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-secondary)' }}>
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          Riwayat &amp; Analisis Restock
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          Pemantauan data pengisian ulang material
        </p>
      </div>

      {/* Restock Charts */}
      <div className="grid grid-cols-1 gap-4">
        {/* Jeda Pengadaan & Volume Restock */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b flex flex-wrap gap-2 items-center justify-between" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <div>
              <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Volume Restock</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Interval pemesanan dan kuantitas</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black tracking-wider uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>Material:</span>
              <select 
                value={activeRestockMat} 
                onChange={(e) => setSelectedRestockMaterial(e.target.value)}
                className="bg-black bg-opacity-40 text-xs text-white border border-gray-800 rounded px-2.5 py-1.5 focus:outline-none cursor-pointer max-w-[280px]"
              >
                {slowList.map(m => (
                  <option key={m.nomor_material} value={m.nomor_material} className="bg-gray-900">
                    {m.nomor_material} - {m.nama_material}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-4" style={{ backgroundColor: 'var(--color-background)' }}>
            {restockGaps.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-500">Tidak ada data restock untuk material ini.</div>
            ) : (
              <ReactECharts
                option={{
                  backgroundColor: 'transparent',
                  tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'cross' }
                  },
                  legend: {
                    textStyle: { color: textStyleColor, fontSize: 10 },
                    top: '0%'
                  },
                  grid: { left: 16, right: 16, top: 45, bottom: 25, containLabel: true },
                  xAxis: {
                    type: 'category',
                    data: restockGaps.map(d => formatTanggal(d.tanggal)),
                    axisLabel: { color: textStyleColor, fontSize: 9, fontWeight: 'bold' },
                    axisLine: { lineStyle: { color: '#374151' } }
                  },
                  yAxis: [
                    {
                      type: 'value',
                      name: 'Jeda (Hari)',
                      nameTextStyle: { color: textStyleColor, fontSize: 9, fontWeight: 'bold' },
                      axisLabel: { color: textStyleColor, fontSize: 9, fontWeight: 'bold' },
                      splitLine: { lineStyle: { color: isDark ? '#374151' : '#e2e8f0', type: 'dashed' } }
                    },
                    {
                      type: 'value',
                      name: 'Qty Restock',
                      nameTextStyle: { color: textStyleColor, fontSize: 9, fontWeight: 'bold' },
                      axisLabel: { color: textStyleColor, fontSize: 9, fontWeight: 'bold' },
                      splitLine: { show: false }
                    }
                  ],
                  series: [
                    {
                      name: 'Jeda Pengadaan (Hari)',
                      type: 'line',
                      data: restockGaps.map(d => d.gap),
                      itemStyle: { color: 'var(--color-led-amber)' },
                      lineStyle: { width: 3 },
                      smooth: true,
                      emphasis: { disabled: true }
                    },
                    {
                      name: 'Qty Restock',
                      type: 'bar',
                      yAxisIndex: 1,
                      barMaxWidth: 30,
                      data: restockGaps.map(d => d.qty),
                      itemStyle: { color: 'var(--color-secondary)', borderRadius: [4, 4, 0, 0] },
                      emphasis: { disabled: true }
                    }
                  ]
                }}
                notMerge={true}
                style={{ height: 280 }}
                opts={{ renderer: 'svg' }}
              />
            )}

            {restockGaps.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-dashed" style={{ borderColor: 'var(--color-steel-border)' }}>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-dim)', borderColor: 'var(--color-steel-border)' }}>
                  <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Total Pengadaan</span>
                  <p className="text-lg font-black mt-1" style={{ color: 'var(--color-on-surface)' }}>{restockGaps.length} Kali</p>
                </div>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-dim)', borderColor: 'var(--color-steel-border)' }}>
                  <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Rata-rata Jeda</span>
                  <p className="text-lg font-black mt-1 text-amber-600 dark:text-amber-500">
                    {restockGaps.filter(d => d.gap !== null && d.gap > 0).length > 0
                      ? Math.round(restockGaps.filter(d => d.gap !== null && d.gap > 0).reduce((sum, d) => sum + (d.gap || 0), 0) / restockGaps.filter(d => d.gap !== null && d.gap > 0).length)
                      : 0} Hari
                  </p>
                </div>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-dim)', borderColor: 'var(--color-steel-border)' }}>
                  <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Jeda Terlama</span>
                  <p className="text-lg font-black mt-1 text-red-600 dark:text-red-500">
                    {restockGaps.filter(d => d.gap !== null && d.gap > 0).length > 0
                      ? Math.max(...restockGaps.filter(d => d.gap !== null && d.gap > 0).map(d => d.gap || 0))
                      : 0} Hari
                  </p>
                </div>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-dim)', borderColor: 'var(--color-steel-border)' }}>
                  <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Jeda Terakhir</span>
                  <p className="text-lg font-black mt-1 text-blue-600 dark:text-blue-400">
                    {restockGaps.length > 1 && restockGaps[restockGaps.length - 1].gap !== null
                      ? `${restockGaps[restockGaps.length - 1].gap} Hari`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restock Filter & Search */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-black bg-opacity-20 px-3 py-1.5 rounded-lg border border-gray-800 w-full sm:w-80">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-on-surface-variant)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Cari restock material / gudang..."
            className="bg-transparent border-none text-xs focus:outline-none w-full text-white"
            value={restockSearchText}
            onChange={(e) => setRestockSearchText(e.target.value)}
          />
        </div>
        {restockSearchText && (
          <button
            onClick={() => setRestockSearchText('')}
            className="text-xs hover:text-white transition"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            Clear Filter
          </button>
        )}
        <div className="ml-auto">
          <ExportButton data={filteredRestock as unknown as Record<string, unknown>[]} filename="riwayat_restock_material" columns={restockExportCols} />
        </div>
      </div>

      {/* Restock Table */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '430px', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse min-w-[900px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['Tanggal','Kode Material','Nama Material','Jumlah','Total Nilai'].map(h => (
                  <th 
                    key={h} 
                    className="px-4 py-3 text-[11px] font-black tracking-widest uppercase whitespace-nowrap" 
                    style={{ 
                      color: 'var(--color-on-primary-container)',
                      backgroundColor: 'var(--color-primary-container)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRestock.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Tidak ada data restock yang cocok.
                  </td>
                </tr>
              ) : (
                filteredRestock.map((row, i) => (
                  <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatTanggal(row.tanggal)}</td>
                    <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap min-w-[200px]" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.qty} {row.satuan}</td>
                    <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-secondary)' }}>{formatRupiah(row.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
      </div>
    </PageWrapper>
  );
}
