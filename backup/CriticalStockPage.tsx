import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import PageWrapper from '../components/layout/PageWrapper';
import KpiCard from '../components/ui/KpiCard';
import StatusBadge from '../components/ui/StatusBadge';
import ExportButton from '../components/ui/ExportButton';
import { getCriticalStockData, getFleetMetrics, getRealSAPTrains, getMaintenanceSchedule, getProcurementData } from '../services/supabaseService';
import type { CriticalStockItem, FleetMetrics, MaintenanceSchedule, ProcurementItem } from '../types';

// Label 12 bulan terakhir relatif
function buildBulanLabels(): string[] {
  const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const labels: string[] = [];
  const now = new Date('2026-07-11');
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${BULAN_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`);
  }
  return labels;
}
const bulanLabels = buildBulanLabels();

const depoOptions = ['Semua Depo', 'Gudang Depo Depok', 'Gudang Depo Bukit Duri', 'Gudang Overhaul Manggarai', 'Gudang Pusat', 'Gudang Depo Bogor'];

const exportCols = [
  { key: 'nomor_material', header: 'Kode Material' },
  { key: 'nama_material', header: 'Deskripsi Material' },
  { key: 'satuan', header: 'Satuan' },
  { key: 'current_stock', header: 'Stok Saat Ini' },
  { key: 'stok_ideal', header: 'Stok Ideal' },
  { key: 'pct_ketersediaan', header: '% Ketersediaan' },
  { key: 'plan_habis_label', header: 'Habis (Plan)' },
  // Tanpa PO
  { key: 'koreksi_habis_no_po_label', header: 'Habis (Tanpa PO)' },
  { key: 'gap_no_po', header: 'Gap Tanpa PO (Bulan)' },
  { key: 'status_no_po', header: 'Status Tanpa PO' },
  // Dengan PO
  { key: 'po_kirim_label', header: 'Rencana Kirim PO' },
  { key: 'jumlah_dipesan_label', header: 'Qty PO' },
  { key: 'koreksi_habis_with_po_label', header: 'Habis (Dengan PO)' },
  { key: 'gap_with_po', header: 'Gap Dengan PO (Bulan)' },
  { key: 'status_with_po', header: 'Status Dengan PO' },
  { key: 'gudang_label', header: 'Gudang/Depo' },
];

function heatmapColor(pct: number): { bg: string; text: string; label: string } {
  if (pct >= 80) return { bg: 'rgba(22,163,74,0.15)',  text: 'var(--color-led-green)', label: 'AMAN' };
  if (pct >= 51) return { bg: 'rgba(217,119,6,0.15)',  text: 'var(--color-led-amber)', label: 'WASPADA' };
  return            { bg: 'rgba(220,38,38,0.15)',  text: 'var(--color-led-red)',   label: 'KRITIS' };
}

const MONTHS_OPTIONS = [
  { value: 1, name: 'Januari' },
  { value: 2, name: 'Februari' },
  { value: 3, name: 'Maret' },
  { value: 4, name: 'April' },
  { value: 5, name: 'Mei' },
  { value: 6, name: 'Juni' },
  { value: 7, name: 'Juli' },
  { value: 8, name: 'Agustus' },
  { value: 9, name: 'September' },
  { value: 10, name: 'Oktober' },
  { value: 11, name: 'November' },
  { value: 12, name: 'Desember' }
];
const YEARS_OPTIONS = [2025, 2026, 2027, 2028, 2029, 2030];

function calculateDynamicMetrics(
  item: CriticalStockItem,
  rangeMonths: { year: number; month: number; label: string }[],
  endYear: number,
  endMonth: number
) {
  const plans = rangeMonths.map(m => {
    const p = item.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
    return p ? p.plan_qty : 0;
  });

  const actuals = rangeMonths.map(m => {
    if (m.year > 2026 || (m.year === 2026 && m.month > 7)) {
      return null;
    }
    const hist = item.all_history?.filter(h => {
      if (!h.tanggal) return false;
      const d = new Date(h.tanggal);
      return d.getFullYear() === m.year && (d.getMonth() + 1) === m.month;
    }) || [];
    return hist.reduce((sum, h) => sum + (h.qty || 0), 0);
  });

  // Calculate starting stock at the beginning of the range
  const actualsBeforeToday = rangeMonths.map((m, idx) => {
    if (m.year < 2026 || (m.year === 2026 && m.month <= 7)) {
      return actuals[idx] ?? 0;
    }
    return 0;
  });
  const sumActuals = actualsBeforeToday.reduce((sum, val) => sum + val, 0);
  const initialStock = item.current_stock + sumActuals;

  // Extract PO arrival month
  let poYear = 0;
  let poMonth = 0;
  if (item.tanggal_rencana_pengiriman) {
    const d = new Date(item.tanggal_rencana_pengiriman);
    poYear = d.getFullYear();
    poMonth = d.getMonth() + 1;
  }

  // 1. Find Plan Exhaustion
  let planStock = initialStock;
  let planExhaustionIndex = 99;
  let planExhaustionLabel = 'Aman';
  
  for (let i = 0; i < rangeMonths.length; i++) {
    const m = rangeMonths[i];
    planStock -= plans[i];
    if (planStock <= 0) {
      planExhaustionIndex = i;
      planExhaustionLabel = rangeMonths[i].label;
      break;
    }
  }

  // 2. Find Corrected Plan Exhaustion WITHOUT PO
  let correctedStockNoPO = initialStock;
  let correctedExhaustionIndexNoPO = 99;
  let correctedExhaustionLabelNoPO = 'Aman';

  for (let i = 0; i < rangeMonths.length; i++) {
    const m = rangeMonths[i];
    if (m.year < 2026 || (m.year === 2026 && m.month <= 7)) {
      correctedStockNoPO -= (actuals[i] ?? 0);
    } else {
      correctedStockNoPO -= plans[i];
    }
    if (correctedStockNoPO <= 0) {
      correctedExhaustionIndexNoPO = i;
      correctedExhaustionLabelNoPO = m.label;
      break;
    }
  }

  // 3. Find Corrected Plan Exhaustion WITH PO
  let correctedStockWithPO = initialStock;
  let correctedExhaustionIndexWithPO = 99;
  let correctedExhaustionLabelWithPO = 'Aman';

  for (let i = 0; i < rangeMonths.length; i++) {
    const m = rangeMonths[i];
    if (m.year === poYear && m.month === poMonth) {
      correctedStockWithPO += (item.jumlah_dipesan || 0);
    }
    if (m.year < 2026 || (m.year === 2026 && m.month <= 7)) {
      correctedStockWithPO -= (actuals[i] ?? 0);
    } else {
      correctedStockWithPO -= plans[i];
    }
    if (correctedStockWithPO <= 0) {
      correctedExhaustionIndexWithPO = i;
      correctedExhaustionLabelWithPO = m.label;
      break;
    }
  }

  // 4. Calculate Gap No PO (difference in months, using WITHOUT PO as the raw deficit)
  let gapNoPO = 0;
  if (correctedExhaustionIndexNoPO !== 99 || planExhaustionIndex !== 99) {
    const cIdx = correctedExhaustionIndexNoPO === 99 ? rangeMonths.length : correctedExhaustionIndexNoPO;
    const pIdx = planExhaustionIndex === 99 ? rangeMonths.length : planExhaustionIndex;
    gapNoPO = cIdx - pIdx;
  }

  // 5. Calculate Status No PO
  let statusNoPO: 'AMAN' | 'WASPADA' | 'KRITIS' = 'AMAN';
  if (item.current_stock <= 0) {
    statusNoPO = 'KRITIS';
  } else if (gapNoPO < 0) {
    const absGap = Math.abs(gapNoPO);
    if (absGap <= 2) {
      statusNoPO = 'KRITIS';
    } else if (absGap <= 8) {
      statusNoPO = 'WASPADA';
    } else {
      statusNoPO = 'KRITIS';
    }
  }

  // 6. Calculate Gap With PO
  let gapWithPO = 0;
  if (correctedExhaustionIndexWithPO !== 99 || planExhaustionIndex !== 99) {
    const cIdx = correctedExhaustionIndexWithPO === 99 ? rangeMonths.length : correctedExhaustionIndexWithPO;
    const pIdx = planExhaustionIndex === 99 ? rangeMonths.length : planExhaustionIndex;
    gapWithPO = cIdx - pIdx;
  }

  // 7. Calculate Status With PO (Mitigated)
  let statusWithPO: 'AMAN' | 'WASPADA' | 'KRITIS' = 'AMAN';
  if (item.current_stock <= 0) {
    statusWithPO = 'KRITIS';
  } else if (gapWithPO < 0) {
    const absGap = Math.abs(gapWithPO);
    if (absGap <= 2) {
      statusWithPO = 'KRITIS';
    } else if (absGap <= 8) {
      statusWithPO = 'WASPADA';
    } else {
      statusWithPO = 'KRITIS';
    }
  } else {
    statusWithPO = 'AMAN';
  }

  // Override to AMAN if PO arrives on time (meaning corrected with PO is safe)
  if (item.current_stock > 0 && gapNoPO < 0) {
    if (item.t_arrival <= 2 || correctedExhaustionIndexWithPO === 99 || correctedExhaustionIndexWithPO >= planExhaustionIndex) {
      statusWithPO = 'AMAN';
    }
  }

  if (item.nomor_material === '6005530') {
    console.log('TRACE 6005530:', {
      initialStock,
      poYear,
      poMonth,
      jumlah_dipesan: item.jumlah_dipesan,
      planExhaustionLabel,
      correctedExhaustionLabelNoPO,
      correctedExhaustionLabelWithPO,
      gapNoPO,
      gapWithPO,
      statusNoPO,
      statusWithPO
    });
  }

  return {
    planExhaustionLabel,
    correctedExhaustionLabelNoPO,
    correctedExhaustionLabelWithPO,
    gapNoPO,
    gapWithPO,
    statusNoPO,
    statusWithPO
  };
}

export default function CriticalStockPage() {
  const [searchParams] = useSearchParams();
  const materialParam = searchParams.get('material');

  const [criticalData, setCriticalData] = useState<CriticalStockItem[]>([]);
  const [metrics, setMetrics] = useState<FleetMetrics | null>(null);
  const [procurements, setProcurements] = useState<ProcurementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDepo, setFilterDepo] = useState('Semua Depo');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [searchText, setSearchText] = useState(materialParam || '');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(materialParam);
  const [showChartWithPO, setShowChartWithPO] = useState(false);

  const [totalTrains, setTotalTrains] = useState(0);
  const [inMaintenanceCount, setInMaintenanceCount] = useState(0);

  // Period filter states
  const currentYear = new Date().getFullYear();
  const [startMonth, setStartMonth] = useState<number>(1); // Januari
  const [startYear, setStartYear] = useState<number>(currentYear);
  const [endMonth, setEndMonth] = useState<number>(12); // Desember
  const [endYear, setEndYear] = useState<number>(currentYear);

  // Deteksi tema light/dark secara reaktif
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Palet warna chart adaptif tema
  const ct = {
    axisLabel:    isDark ? '#94a3b8' : '#475569',
    axisLine:     isDark ? '#334155' : '#d1d5db',
    gridLine:     isDark ? 'rgba(51,65,85,0.5)'  : 'rgba(209,213,219,0.7)',
    legendText:   isDark ? '#94a3b8' : '#374151',
    tooltipBg:    isDark ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.98)',
    tooltipBorder:isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)',
    tooltipText:  isDark ? '#f1f5f9' : '#111827',
    tooltipSub:   isDark ? '#94a3b8' : '#6b7280',
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [cData, fMetrics, trainData, schedData, pData] = await Promise.all([
          getCriticalStockData(),
          getFleetMetrics(),
          getRealSAPTrains(),
          getMaintenanceSchedule(),
          getProcurementData()
        ]);
        setCriticalData(cData);
        setMetrics(fMetrics);
        setTotalTrains(trainData.length);
        setInMaintenanceCount(schedData.filter(s => s.status_pelaksanaan === 'Sedang Dirawat').length);
        setProcurements(pData);
      } catch (err) {
        console.error('Error loading critical stock data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Generate list of months in the selected range
  const rangeMonths = (() => {
    const months: { year: number; month: number; label: string }[] = [];
    const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    
    let curYear = startYear;
    let curMonth = startMonth;
    
    const endTotal = endYear * 12 + endMonth;
    
    while (curYear * 12 + curMonth <= endTotal) {
      months.push({
        year: curYear,
        month: curMonth,
        label: `${BULAN_SHORT[curMonth - 1]} '${String(curYear).slice(2)}`
      });
      
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
      if (months.length > 50) break;
    }
    return months;
  })();

  const isRangeInvalid = rangeMonths.length === 0 || rangeMonths.length > 36 || (startYear * 12 + startMonth > endYear * 12 + endMonth);

  const aggregatedData = (() => {
    const rawFiltered = filterDepo !== 'Semua Depo'
      ? criticalData.filter(row => row.gudang_label === filterDepo)
      : criticalData;

    const groups: Record<string, CriticalStockItem> = {};
    rawFiltered.forEach(row => {
      if (!groups[row.nomor_material]) {
        groups[row.nomor_material] = {
          ...row,
          gudang_label: filterDepo,
          current_stock: 0,
        };
      }
      groups[row.nomor_material].current_stock += row.current_stock;
    });

    return Object.values(groups).map(item => {
      // Hitung stok ideal dari sum plan_qty pada rangeMonths terpilih
      const dynamicPlans = rangeMonths.map(m => {
        const p = item.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
        return p ? p.plan_qty : 0;
      });
      const dynamicStokIdeal = dynamicPlans.reduce((sum, p) => sum + p, 0);
      const finalStokIdeal = dynamicStokIdeal > 0 ? dynamicStokIdeal : item.stok_ideal;

      const pct_ketersediaan = finalStokIdeal > 0 ? Math.round((item.current_stock / finalStokIdeal) * 100) : 0;
      const t_exhaustion = item.cr_actual > 0 ? Math.round((item.current_stock / item.cr_actual) * 10) / 10 : 99;
      
      // Hitung Gap Defisit dan Status secara dinamis berdasarkan filter periode terpilih
      const { planExhaustionLabel, correctedExhaustionLabelNoPO, correctedExhaustionLabelWithPO, gapNoPO, gapWithPO, statusNoPO, statusWithPO } = calculateDynamicMetrics(item, rangeMonths, endYear, endMonth);

      // Tanggal Rencana Kirim PO dari database (jika ada)
      const poDate = (item as any).tanggal_rencana_pengiriman;
      let poKirimLabel = 'Belum ada PO';
      if (poDate) {
        const d = new Date(poDate);
        const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
        poKirimLabel = `${d.getDate()} ${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
      }

      return {
        ...item,
        stok_ideal: finalStokIdeal,
        pct_ketersediaan,
        t_exhaustion,
        plan_habis_label: planExhaustionLabel,
        koreksi_habis_no_po_label: correctedExhaustionLabelNoPO,
        koreksi_habis_with_po_label: correctedExhaustionLabelWithPO,
        gap_defisit: gapNoPO,
        gap_no_po: gapNoPO,
        gap_with_po: gapWithPO,
        status_no_po: statusNoPO,
        status_with_po: statusWithPO,
        po_kirim_label: poKirimLabel,
        jumlah_dipesan_label: item.jumlah_dipesan > 0 ? `${item.jumlah_dipesan} ${item.satuan}` : '-',
        status: statusWithPO,
      };
    });
  })();

  const filteredData: CriticalStockItem[] = aggregatedData.filter(row => {
    const matchStatus = filterStatus.length === 0 || filterStatus.includes(row.status);
    const matchSearch = row.nama_material.toLowerCase().includes(searchText.toLowerCase()) ||
                        row.nomor_material.toLowerCase().includes(searchText.toLowerCase());
    return matchStatus && matchSearch;
  });

  const toggleStatus = (s: string) => {
    setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const sparkData = criticalData.length > 0
    ? criticalData.map(d => Math.min(100, d.pct_ketersediaan))
    : [];

  // Ambil material yang sedang terpilih/aktif dicari untuk grafik proyeksi penyerapan (cari dari aggregatedData agar nilai current_stock sesuai dengan depo terpilih / gabungan semua depo)
  const referenceItem = aggregatedData.find(d => 
    (selectedMaterial && d.nomor_material === selectedMaterial) ||
    (!selectedMaterial && searchText && (d.nomor_material === searchText || d.nama_material.toLowerCase().includes(searchText.toLowerCase())))
  ) || aggregatedData.find(d => d.nomor_material === '6005530') || aggregatedData[0];



  const chartData = (() => {
    if (isRangeInvalid || !referenceItem) {
      return { labels: [], plans: [], actuals: [], corrected: [] };
    }

    const labels = rangeMonths.map(m => m.label);
    
    // 1. Rencana Awal: lookup in all_plans
    const plans = rangeMonths.map(m => {
      const p = referenceItem.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
      return p ? p.plan_qty : 0;
    });

    // 2. Realisasi Aktual: lookup in all_history (sum qty for that month/year)
    const actuals = rangeMonths.map(m => {
      // Future month (after July 2026)
      if (m.year > 2026 || (m.year === 2026 && m.month > 7)) {
        return null;
      }
      
      const hist = referenceItem.all_history?.filter(h => {
        if (!h.tanggal) return false;
        const d = new Date(h.tanggal);
        return d.getFullYear() === m.year && (d.getMonth() + 1) === m.month;
      }) || [];
      const sumQty = hist.reduce((sum, item) => sum + (item.qty || 0), 0);
      return sumQty > 0 ? sumQty : 0;
    });

    // Calculate starting stock at the beginning of the range
    const actualsBeforeToday = rangeMonths.map((m, idx) => {
      if (m.year < 2026 || (m.year === 2026 && m.month <= 7)) {
        return actuals[idx] ?? 0;
      }
      return 0;
    });
    const sumActuals = actualsBeforeToday.reduce((sum, val) => sum + val, 0);
    const initialStock = referenceItem.current_stock + sumActuals;

    // 3. Plan Terkoreksi (Depletion simulation based on spreadsheet logic):
    const corrected: number[] = [];
    let remainingStock = initialStock;

    let poYear = 0;
    let poMonth = 0;
    if (referenceItem.tanggal_rencana_pengiriman) {
      const d = new Date(referenceItem.tanggal_rencana_pengiriman);
      poYear = d.getFullYear();
      poMonth = d.getMonth() + 1;
    }

    rangeMonths.forEach((m, idx) => {
      // Tambahkan kuantiti PO jika opsi Dengan PO diaktifkan
      if (showChartWithPO && m.year === poYear && m.month === poMonth) {
        remainingStock += (referenceItem.jumlah_dipesan || 0);
      }

      // Past/present month (<= July 2026)
      if (m.year < 2026 || (m.year === 2026 && m.month <= 7)) {
        const actVal = actuals[idx] ?? 0;
        remainingStock -= actVal;
        corrected.push(actVal);
      } else {
        // Future month (> July 2026)
        const planVal = plans[idx];
        if (remainingStock <= 0) {
          corrected.push(0);
        } else if (remainingStock < planVal) {
          corrected.push(remainingStock);
          remainingStock = 0;
        } else {
          corrected.push(planVal);
          remainingStock -= planVal;
        }
      }
    });

    return { labels, plans, actuals, corrected };
  })();

  // Cari titik habis stok dari Plan Terkoreksi (corrected)
  const correctedExhaustIdx = (() => {
    // Cari index pertama di mana nilai corrected menjadi 0 setelah sebelumnya > 0
    for (let i = 1; i < chartData.corrected.length; i++) {
      const prev = chartData.corrected[i - 1];
      const curr = chartData.corrected[i];
      if ((prev ?? 0) > 0 && (curr ?? 0) === 0) return i;
    }
    // Jika tidak ada titik 0, lihat apakah nilai terakhir = 0
    const lastIdx = chartData.corrected.length - 1;
    if (lastIdx >= 0 && (chartData.corrected[lastIdx] ?? 0) === 0) return lastIdx;
    return -1;
  })();
  const exhaustLabel = correctedExhaustIdx >= 0 ? chartData.labels[correctedExhaustIdx] : null;

  const gapMonths = referenceItem ? (showChartWithPO ? ((referenceItem as any).gap_with_po ?? 0) : ((referenceItem as any).gap_no_po ?? 0)) : 0;

  const dynamicStatus = (() => {
    if (isRangeInvalid || !referenceItem) return { label: 'TIDAK VALID', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' };
    const s = showChartWithPO ? ((referenceItem as any).status_with_po ?? 'AMAN') : ((referenceItem as any).status_no_po ?? 'AMAN');
    return {
      label: s,
      color: s === 'KRITIS' ? 'var(--color-led-red)'
        : s === 'WASPADA' ? 'var(--color-led-amber)'
        : 'var(--color-led-green)',
      bg: s === 'KRITIS' ? 'rgba(220,38,38,0.12)'
        : s === 'WASPADA' ? 'rgba(217,119,6,0.12)'
        : 'rgba(22,163,74,0.12)'
    };
  })();

  // Dynamic status-based KPI calculations based on active scenario (with/without PO) and selected period/depo
  const activeStatusField = showChartWithPO ? 'status_with_po' : 'status_no_po';
  const countKritis = aggregatedData.filter(d => (d as any)[activeStatusField] === 'KRITIS').length;
  const countWaspada = aggregatedData.filter(d => (d as any)[activeStatusField] === 'WASPADA').length;
  const countAman = aggregatedData.filter(d => (d as any)[activeStatusField] === 'AMAN').length;
  const countDeadStock = aggregatedData.filter(d => {
    const plansInRange = d.all_plans?.filter(p => 
      rangeMonths.some(m => m.year === p.tahun && m.month === p.bulan)
    ) || [];
    const totalPlan = plansInRange.reduce((sum, p) => sum + p.plan_qty, 0);
    return totalPlan === 0;
  }).length;

  // Heatmap dinamis: hitung avg pct_ketersediaan per depo dari criticalData
  const allDepos = [...new Set(criticalData.map(d => d.gudang_label).filter(Boolean))];
  const heatmapDepo = allDepos.length > 0 ? allDepos : ['Gudang Tidak Diketahui'];
  // Kelompokkan material ke kategori berdasarkan nama
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-red)' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Stok Availability
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
            Visibilitas status stok secara real-time dan analisis gap pengadaan baru
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: 'rgba(220,38,38,0.12)', color: 'var(--color-led-red)', border: '1px solid rgba(220,38,38,0.3)' }}
        >
          <span className="led-indicator led-red" style={{ width: 8, height: 8 }} />
          {filteredData.filter(d => d.status === 'KRITIS').length} Material Kritis
        </div>
      </div>

      {/* Main Dashboard Layout: 2-column grid for large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start mt-4">
        
        {/* LEFT COLUMN: Absorption Chart & Critical Stock Table (Spans 2 columns) */}
        <div className="xl:col-span-2 space-y-6">
          {/* ECharts — Area Chart Proyeksi Penyerapan */}
          <div className="tactile-card rounded-lg overflow-hidden">
            <div className="p-5 border-b flex flex-col gap-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Proyeksi Penyerapan Material Kritis</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Komparasi Rencana vs Aktual — <b>{referenceItem?.nama_material || 'Brake Pad Assy'} ({referenceItem?.nomor_material || '6005530'})</b>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Toggle Buttons: Tanpa PO vs Dengan PO */}
                  <div className="flex rounded p-0.5 border" style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
                    <button
                      onClick={() => setShowChartWithPO(false)}
                      className="px-3 py-1 rounded text-[11px] font-extrabold transition-all"
                      style={!showChartWithPO ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-on-surface-variant)' }}
                    >
                      TANPA PO
                    </button>
                    <button
                      onClick={() => setShowChartWithPO(true)}
                      className="px-3 py-1 rounded text-[11px] font-extrabold transition-all"
                      style={showChartWithPO ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-on-surface-variant)' }}
                    >
                      DENGAN PO
                    </button>
                  </div>

                  <select
                    value={selectedMaterial || '6005530'}
                    onChange={e => setSelectedMaterial(e.target.value)}
                    className="rounded px-3 py-1.5 border text-xs font-bold"
                    style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)', minWidth: 240 }}
                  >
                    {aggregatedData.map(m => (
                      <option key={m.nomor_material} value={m.nomor_material}>
                        {m.nomor_material} — {m.nama_material.slice(0, 35)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selector Periode Awal & Akhir */}
              <div className="flex flex-wrap items-center gap-3 text-xs border-t pt-3" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="font-bold text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Mulai:</span>
                <select
                  value={startMonth}
                  onChange={e => setStartMonth(Number(e.target.value))}
                  className="rounded px-2 py-1 border font-medium text-xs"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                >
                  {MONTHS_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                </select>
                <select
                  value={startYear}
                  onChange={e => setStartYear(Number(e.target.value))}
                  className="rounded px-2 py-1 border font-medium text-xs"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                >
                  {YEARS_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <span className="font-bold text-xs ml-2" style={{ color: 'var(--color-on-surface-variant)' }}>Selesai:</span>
                <select
                  value={endMonth}
                  onChange={e => setEndMonth(Number(e.target.value))}
                  className="rounded px-2 py-1 border font-medium text-xs"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                >
                  {MONTHS_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                </select>
                <select
                  value={endYear}
                  onChange={e => setEndYear(Number(e.target.value))}
                  className="rounded px-2 py-1 border font-medium text-xs"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                >
                  {YEARS_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                {/* Error Range */}
                {isRangeInvalid && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded ml-auto flex items-center gap-1" style={{ backgroundColor: 'rgba(220,38,38,0.12)', color: 'var(--color-led-red)' }}>
                    <span className="led-indicator led-red" style={{ width: 6, height: 6 }} />
                    Rentang harus antara 1 s/d 36 bulan (3 tahun) & tanggal mulai sebelum selesai.
                  </span>
                )}

                {/* Gap & Status Alert */}
                {!isRangeInvalid && (
                  <div className="flex items-center gap-3 ml-auto text-xs font-bold">
                    <span style={{ color: 'var(--color-on-surface-variant)' }}>
                      Gap: <b className="text-sm" style={{ color: gapMonths < 0 ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>{Math.abs(gapMonths)} Bulan</b>
                    </span>
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all"
                      style={{
                        backgroundColor: dynamicStatus.bg,
                        borderColor: dynamicStatus.color,
                        color: dynamicStatus.color
                      }}
                    >
                      <span className="led-indicator" style={{ backgroundColor: dynamicStatus.color, width: 8, height: 8 }} />
                      {dynamicStatus.label}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <ReactECharts
              option={{
                backgroundColor: 'transparent',
                animation: true,
                animationDuration: 900,
                animationEasing: 'cubicInOut',
                animationDelay: 0,
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'cross',
                    crossStyle: { color: ct.axisLine },
                    lineStyle: { color: ct.axisLine, type: 'dashed', width: 1 },
                  },
                  backgroundColor: ct.tooltipBg,
                  borderColor: ct.tooltipBorder,
                  borderWidth: 1,
                  padding: [12, 16],
                  textStyle: { color: ct.tooltipText, fontSize: 12, fontFamily: 'inherit' },
                  extraCssText: 'box-shadow: 0 8px 32px rgba(0,0,0,0.18); border-radius: 10px;',
                  formatter: (params: any[]) => {
                    const label = params[0]?.axisValue || '';
                    const rows = params
                      .filter((p: any) => p.value !== null && p.value !== undefined)
                      .map((p: any) => {
                        const val = typeof p.value === 'number'
                          ? p.value.toLocaleString('id-ID') + ' unit'
                          : '—';
                        const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.color};margin-right:8px;flex-shrink:0;box-shadow:0 0 0 2px rgba(255,255,255,0.3)"></span>`;
                        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;padding:3px 0">${dot}<span style="color:${ct.tooltipSub};font-size:11px">${p.seriesName}</span><b style="color:${ct.tooltipText};font-size:12px;font-variant-numeric:tabular-nums">${val}</b></div>`;
                      }).join('');
                    return `<div style="font-size:10px;font-weight:800;color:${ct.tooltipSub};margin-bottom:8px;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid ${ct.tooltipBorder};padding-bottom:6px">${label}</div>${rows}`;
                  },
                },
                legend: {
                  data: ['Rencana Awal', 'Realisasi Aktual', 'Plan Terkoreksi'],
                  bottom: 6,
                  itemWidth: 24,
                  itemHeight: 4,
                  itemGap: 24,
                  icon: 'roundRect',
                  textStyle: { color: ct.legendText, fontSize: 11, fontWeight: '600', fontFamily: 'inherit' },
                  inactiveColor: isDark ? '#334155' : '#d1d5db',
                },
                grid: { left: 14, right: 18, top: 18, bottom: 48, containLabel: true },
                xAxis: {
                  type: 'category',
                  data: chartData.labels,
                  boundaryGap: false,
                  axisLabel: {
                    color: ct.axisLabel,
                    fontSize: 10,
                    fontWeight: '600',
                    fontFamily: 'inherit',
                    interval: Math.max(0, Math.floor(chartData.labels.length / 13) - 1),
                    margin: 10,
                  },
                  axisLine: { lineStyle: { color: ct.axisLine, width: 1 } },
                  axisTick: { show: false },
                  splitLine: { show: true, lineStyle: { color: ct.gridLine, type: 'dashed', width: 1 } },
                },
                yAxis: {
                  type: 'value',
                  name: 'Penyerapan (Unit)',
                  nameLocation: 'end',
                  nameTextStyle: { color: ct.axisLabel, fontSize: 9, fontWeight: '700', fontFamily: 'inherit', padding: [0, 0, 4, 0] },
                  axisLabel: {
                    color: ct.axisLabel,
                    fontSize: 10,
                    fontFamily: 'inherit',
                    formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v),
                  },
                  axisLine: { show: false },
                  axisTick: { show: false },
                  splitLine: { lineStyle: { color: ct.gridLine, type: 'dashed', width: 1 } },
                  min: 0,
                },
                series: [
                  // 1. Rencana Awal — violet dashed, referensi plan
                  {
                    name: 'Rencana Awal',
                    type: 'line',
                    smooth: true,
                    smoothMonotone: 'x',
                    symbol: 'none',
                    lineStyle: {
                      color: '#8b5cf6',
                      width: 2,
                      type: 'dashed',
                      shadowColor: 'rgba(139,92,246,0.2)',
                      shadowBlur: 6,
                      shadowOffsetY: 2,
                    },
                    areaStyle: {
                      color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                          { offset: 0, color: 'rgba(139,92,246,0.14)' },
                          { offset: 1, color: 'rgba(139,92,246,0.01)' },
                        ],
                      },
                    },
                    emphasis: { disabled: true },
                    z: 1,
                    data: chartData.plans,
                  },
                  // 2. Realisasi Aktual — biru solid tebal, garis utama historis
                  {
                    name: 'Realisasi Aktual',
                    type: 'line',
                    smooth: true,
                    smoothMonotone: 'x',
                    symbol: 'circle',
                    symbolSize: 7,
                    lineStyle: {
                      color: '#3b82f6',
                      width: 3,
                      shadowColor: 'rgba(59,130,246,0.35)',
                      shadowBlur: 10,
                      shadowOffsetY: 4,
                    },
                    areaStyle: {
                      color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                          { offset: 0, color: 'rgba(59,130,246,0.25)' },
                          { offset: 1, color: 'rgba(59,130,246,0.02)' },
                        ],
                      },
                    },
                    itemStyle: {
                      color: '#3b82f6',
                      borderColor: '#fff',
                      borderWidth: 2.5,
                      shadowColor: 'rgba(59,130,246,0.4)',
                      shadowBlur: 6,
                    },
                    emphasis: {
                      scale: 1.4,
                      itemStyle: {
                        shadowBlur: 16,
                        shadowColor: 'rgba(59,130,246,0.6)',
                      },
                    },
                    z: 3,
                    data: chartData.actuals,
                  },
                  // 3. Plan Terkoreksi — amber dashed, proyeksi ke depan
                  {
                    name: 'Plan Terkoreksi',
                    type: 'line',
                    smooth: true,
                    smoothMonotone: 'x',
                    symbol: 'circle',
                    symbolSize: 5,
                    lineStyle: {
                      color: '#f59e0b',
                      width: 2.5,
                      type: 'dashed',
                      shadowColor: 'rgba(245,158,11,0.3)',
                      shadowBlur: 8,
                      shadowOffsetY: 3,
                    },
                    areaStyle: {
                      color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                          { offset: 0, color: 'rgba(245,158,11,0.18)' },
                          { offset: 1, color: 'rgba(245,158,11,0.01)' },
                        ],
                      },
                    },
                    itemStyle: {
                      color: '#f59e0b',
                      borderColor: '#fff',
                      borderWidth: 2,
                      shadowColor: 'rgba(245,158,11,0.4)',
                      shadowBlur: 4,
                    },
                    emphasis: {
                      scale: 1.3,
                      itemStyle: {
                        shadowBlur: 12,
                        shadowColor: 'rgba(245,158,11,0.6)',
                      },
                    },
                    z: 2,
                    data: chartData.corrected,
                    // Garis vertikal merah + popup card permanen di titik habis stok
                    ...(exhaustLabel ? (() => {
                      // Cari nilai Y tertinggi untuk posisikan popup di atas
                      const allVals = [
                        ...chartData.plans,
                        ...chartData.actuals.filter((v): v is number => v !== null),
                        ...chartData.corrected,
                      ].filter((v): v is number => typeof v === 'number' && v > 0);
                      const yMax = allVals.length > 0 ? Math.max(...allVals) : 100;
                      const yPopup = yMax * 0.82; // posisi popup: 82% dari nilai tertinggi

                      return {
                        markLine: {
                          silent: true,
                          animation: false,
                          symbol: ['none', 'none'],
                          lineStyle: {
                            color: '#ef4444',
                            width: 2,
                            type: 'solid',
                            shadowColor: 'rgba(239,68,68,0.45)',
                            shadowBlur: 8,
                          },
                          label: { show: false }, // ← label dimatikan, popup pakai markPoint
                          data: [{ xAxis: exhaustLabel }],
                        },
                        markPoint: {
                          data: [
                            // 1. Popup card melayang (roundRect) di atas garis
                            {
                              name: 'Stok Habis Label',
                              coord: [exhaustLabel, yPopup],
                              symbol: 'roundRect',
                              symbolSize: [160, 76],
                              symbolOffset: [86, 0], // geser ke kanan agar tidak tutup garis
                              itemStyle: {
                                color: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.99)',
                                borderColor: '#ef4444',
                                borderWidth: 2,
                                shadowColor: 'rgba(239,68,68,0.4)',
                                shadowBlur: 14,
                              },
                              label: {
                                show: true,
                                position: 'inside',
                                formatter: [
                                  `{warn|⚠}`,
                                  `{title|STOK HABIS}`,
                                  `{date|${exhaustLabel}}`,
                                ].join('\n'),
                                rich: {
                                  warn: {
                                    color: '#ef4444',
                                    fontSize: 22,
                                    fontWeight: 'bold',
                                    fontFamily: 'sans-serif',
                                    lineHeight: 24,
                                    padding: [0, 0, 4, 0],
                                    align: 'center',
                                  },
                                  title: {
                                    color: '#ef4444',
                                    fontSize: 10,
                                    fontWeight: '900',
                                    fontFamily: 'inherit',
                                    lineHeight: 14,
                                    padding: [2, 0, 4, 0],
                                    align: 'center',
                                  },
                                  date: {
                                    color: isDark ? '#fca5a5' : '#dc2626',
                                    fontSize: 12,
                                    fontWeight: '800',
                                    fontFamily: 'inherit',
                                    lineHeight: 16,
                                    padding: [2, 0, 0, 0],
                                    align: 'center',
                                  },
                                },
                                align: 'center',
                              },
                            },
                            // 2. Titik lingkaran merah di y=0 (titik habis)
                            {
                              name: 'Stok Habis Dot',
                              coord: [exhaustLabel, 0],
                              symbol: 'circle',
                              symbolSize: 14,
                              itemStyle: {
                                color: '#ef4444',
                                borderColor: '#fff',
                                borderWidth: 2.5,
                                shadowColor: 'rgba(239,68,68,0.7)',
                                shadowBlur: 10,
                              },
                              label: { show: false },
                            },
                          ],
                        },
                      };
                    })() : {}),
                  },
                ],
              }}
              style={{ height: 570 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: KPIs & Bar Chart (Spans 1 column) */}
        <div className="space-y-6">
          {/* KPI Cards (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Status Kritis" value={countKritis} unit="Material" borderColor="#ef4444" ledStatus={countKritis > 0 ? "red" : "green"} sparkData={[3, 2, 2, 3, 3, 3]} />
            <KpiCard label="Status Waspada" value={countWaspada} unit="Material" borderColor="var(--color-led-amber)" ledStatus={countWaspada > 0 ? "amber" : "green"} sparkData={[5, 4, 3, 3, 4, 3]} />
            <KpiCard label="Status Aman" value={countAman} unit="Material" borderColor="var(--color-led-green)" ledStatus="green" sparkData={[10, 11, 12, 13, 14, 15]} />
            <KpiCard label="Dead Stock" value={countDeadStock} unit="Material" borderColor="#9ca3af" sparkData={[2, 2, 1, 1, 1, 1]} />
          </div>

          {/* ECharts — Bar Chart Stok Saat Ini vs Stok Ideal */}
          <div className="tactile-card rounded-lg overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Stok Saat Ini vs Stok Ideal</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Perbandingan ketersediaan aktual terhadap target level aman</p>
              </div>
            </div>
            <ReactECharts
              option={{
                backgroundColor: 'transparent',
                tooltip: {
                  trigger: 'axis',
                  backgroundColor: ct.tooltipBg,
                  borderColor: ct.tooltipBorder,
                  borderWidth: 1,
                  textStyle: { color: ct.tooltipText, fontSize: 12 },
                  formatter: (params: { seriesName: string; value: number; name: string }[]) =>
                    `<b style="color:${ct.tooltipText}">${params[0]?.name}</b><br/>` +
                    params.map(p => `<span style="color:${ct.tooltipSub}">${p.seriesName}</span>: <b style="color:${ct.tooltipText}">${p.value?.toLocaleString('id-ID')}</b>`).join('<br/>'),
                },
                legend: {
                  data: ['Stok Saat Ini', 'Stok Ideal'],
                  bottom: 6,
                  itemWidth: 20,
                  itemHeight: 4,
                  textStyle: { color: ct.legendText, fontSize: 11, fontWeight: '600' },
                },
                grid: { left: 14, right: 14, top: 18, bottom: 46, containLabel: true },
                xAxis: {
                  type: 'category',
                  data: filteredData.map(d => d.nomor_material),
                  axisLabel: { color: ct.axisLabel, fontSize: 9, rotate: 15, interval: 0 },
                  axisLine: { lineStyle: { color: ct.axisLine, width: 1 } },
                  axisTick: { show: false },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { color: ct.axisLabel, fontSize: 10 },
                  axisLine: { show: false },
                  axisTick: { show: false },
                  splitLine: { lineStyle: { color: ct.gridLine, type: 'dashed', width: 1 } },
                },
                series: [
                  {
                    name: 'Stok Saat Ini',
                    type: 'bar',
                    barGap: '5%',
                    barMaxWidth: 28,
                    itemStyle: { borderRadius: [4, 4, 0, 0] },
                    data: filteredData.map(d => ({
                      value: d.current_stock,
                      itemStyle: {
                        color: d.status === 'KRITIS' ? '#ef4444'
                          : d.status === 'WASPADA' ? '#f59e0b'
                          : '#22c55e',
                      },
                    })),
                  },
                  {
                    name: 'Stok Ideal',
                    type: 'bar',
                    barMaxWidth: 28,
                    itemStyle: {
                      borderRadius: [4, 4, 0, 0],
                      color: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.12)',
                      borderColor: '#3b82f6',
                      borderWidth: isDark ? 1.5 : 1,
                    },
                    data: filteredData.map(d => d.stok_ideal),
                  },
                ],
              }}
              style={{ height: 240 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>

      </div>

      {/* Filter */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-4 items-center mt-6">
        <div className="flex items-center gap-2 rounded px-3 py-2 border flex-1 min-w-[200px]"
          style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Cari kode atau nama material..." value={searchText} onChange={e => setSearchText(e.target.value)}
            className="bg-transparent border-none text-sm flex-1 focus:outline-none" style={{ color: 'var(--color-on-surface)' }} />
        </div>
        <select value={filterDepo} onChange={e => setFilterDepo(e.target.value)}
          className="rounded px-3 py-2 border text-sm"
          style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
          {depoOptions.map(d => <option key={d}>{d}</option>)}
        </select>
        <div className="flex items-center gap-3 text-[11px] font-bold tracking-wider uppercase">
          <span style={{ color: 'var(--color-on-surface-variant)' }}>Status:</span>
          {(['KRITIS', 'WASPADA', 'AMAN'] as const).map(s => (
            <label key={s} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={filterStatus.includes(s)} onChange={() => toggleStatus(s)} className="rounded" />
              <span style={{ color: s === 'KRITIS' ? 'var(--color-led-red)' : s === 'WASPADA' ? 'var(--color-led-amber)' : 'var(--color-led-green)' }}>{s}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tabel Analisis Stok Kritis */}
      <div className="tactile-card rounded-lg overflow-hidden flex flex-col mt-6">
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-red)' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Tabel Analisis Stok Kritis</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              {filteredData.length} material
            </span>
          </div>
          <ExportButton data={filteredData as unknown as Record<string, unknown>[]} filename="critical_stock_analysis" columns={exportCols} />
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left border-collapse min-w-[1100px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['Kode Material','Deskripsi Material'].map(h => (
                  <th key={h} className="px-2 py-2 text-[10px] font-black tracking-widest uppercase text-left whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
                {['Stok Saat Ini','Stok Ideal','% Ketersediaan','Habis (Plan)'].map(h => (
                  <th key={h} className="px-2 py-2 text-[10px] font-black tracking-widest uppercase text-right whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
                {/* Skenario Tanpa PO */}
                {['Habis (Tanpa PO)','Gap Tanpa PO','Status Tanpa PO'].map(h => (
                  <th key={h} className="px-2 py-2 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap" style={{ color: 'var(--color-led-amber)', backgroundColor: 'rgba(217,119,6,0.06)' }}>{h}</th>
                ))}
                {/* Skenario Dengan PO */}
                {['Rencana Kirim PO','Qty PO','Habis (Dengan PO)','Gap Dengan PO','Status Dengan PO'].map(h => (
                  <th key={h} className="px-2 py-2 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap" style={{ color: 'var(--color-led-green)', backgroundColor: 'rgba(16,185,129,0.06)' }}>{h}</th>
                ))}
                <th className="px-2 py-2 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => {
                const pctColor = row.pct_ketersediaan >= 80
                  ? 'var(--color-led-green)'
                  : row.pct_ketersediaan >= 51
                  ? 'var(--color-led-amber)'
                  : 'var(--color-led-red)';
                const isSelected = row.nomor_material === referenceItem?.nomor_material;
                return (
                  <tr
                    key={row.nomor_material}
                    onClick={() => setSelectedMaterial(row.nomor_material)}
                    className="cursor-pointer transition-all hover:bg-[rgba(37,99,235,0.06)]"
                    style={{
                      backgroundColor: isSelected 
                        ? 'rgba(37,99,235,0.12)' 
                        : i % 2 === 0 
                        ? 'var(--color-surface-dim)' 
                        : 'var(--color-background)'
                    }}
                  >
                    <td className="px-2 py-2 font-bold text-[11px]" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                    <td className="px-2 py-2 text-[11px] max-w-[140px] truncate font-medium" style={{ color: 'var(--color-on-surface-variant)' }} title={row.nama_material}>{row.nama_material}</td>
                    <td className="px-2 py-2 text-[11px] text-right font-medium" style={{ color: 'var(--color-on-surface)' }}>{row.current_stock} {row.satuan}</td>
                    <td className="px-2 py-2 text-[11px] text-right" style={{ color: 'var(--color-on-surface-variant)' }}>{row.stok_ideal} {row.satuan}</td>
                    <td className="px-2 py-2 text-[11px] text-right">
                      {/* % Ketersediaan bar */}
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-container-highest)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.pct_ketersediaan)}%`, backgroundColor: pctColor }} />
                        </div>
                        <span className="font-bold text-[11px] w-8 text-right" style={{ color: pctColor }}>{row.pct_ketersediaan}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-right font-medium" style={{ color: 'var(--color-on-surface)' }}>{(row as any).plan_habis_label}</td>
                    
                    {/* Skenario Tanpa PO (Orange Tint) */}
                    <td className="px-2 py-2 text-[11px] text-center font-medium animate-pulse-subtle" style={{ color: 'var(--color-on-surface)', backgroundColor: 'rgba(217,119,6,0.02)' }}>{(row as any).koreksi_habis_no_po_label}</td>
                    <td className="px-2 py-2 text-[11px] text-center font-bold" style={{ backgroundColor: 'rgba(217,119,6,0.02)', color: (row as any).gap_no_po < 0 ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>
                      {(row as any).gap_no_po > 0 ? '+' : ''}{(row as any).gap_no_po}
                    </td>
                    <td className="px-2 py-2 text-center" style={{ backgroundColor: 'rgba(217,119,6,0.02)' }}>
                      <StatusBadge status={(row as any).status_no_po} />
                    </td>

                    {/* Skenario Dengan PO (Green Tint) */}
                    <td className="px-2 py-2 text-[11px] text-center font-semibold" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: (row as any).po_kirim_label === 'Belum ada PO' ? 'var(--color-on-surface-variant)' : 'var(--color-primary)' }}>
                      {(row as any).po_kirim_label}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center font-medium" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: 'var(--color-on-surface-variant)' }}>
                      {(row as any).jumlah_dipesan_label}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center font-medium text-emerald-600 animate-pulse-subtle" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: (row as any).koreksi_habis_with_po_label === 'Aman' ? 'var(--color-led-green)' : 'var(--color-on-surface)' }}>{(row as any).koreksi_habis_with_po_label}</td>
                    <td className="px-2 py-2 text-[11px] text-center font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: (row as any).gap_with_po < 0 ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>
                      {(row as any).gap_with_po > 0 ? '+' : ''}{(row as any).gap_with_po}
                    </td>
                    <td className="px-2 py-2 text-center" style={{ backgroundColor: 'rgba(16,185,129,0.02)' }}>
                      <StatusBadge status={(row as any).status_with_po} />
                    </td>

                    <td className="px-2 py-2 text-center text-[11px]">
                      <div className="flex gap-1 justify-center">
                        <Link to={`/progress-po?material=${row.nomor_material}`} className="px-1.5 py-0.5 rounded border text-[9px] font-bold hover:opacity-85 text-on-surface" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                          PO
                        </Link>
                        <Link to={`/admin-panel?material=${row.nomor_material}`} className="px-1.5 py-0.5 rounded border text-[9px] font-bold hover:opacity-85 text-on-surface" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                          Kelola
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Tidak ada data yang sesuai filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
