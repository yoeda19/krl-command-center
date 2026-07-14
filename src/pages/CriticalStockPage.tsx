import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import PageWrapper from '../components/layout/PageWrapper';
import KpiCard from '../components/ui/KpiCard';
import StatusBadge from '../components/ui/StatusBadge';
import ExportButton from '../components/ui/ExportButton';
import { getCriticalStockData, getFleetMetrics, getRealSAPTrains, getMaintenanceSchedule, getProcurementData } from '../services/supabaseService';
import type { CriticalStockItem, FleetMetrics, MaintenanceSchedule, ProcurementItem } from '../types';

const getStatusPlanColor = (status: string) => {
  return 'var(--color-on-surface-variant)';
};

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

  // Helper to project future exhaustion if not depleted within filter range
  const projectExhaustion = (remainingStock: number, lastMonth: { year: number; month: number }) => {
    // Cari rata-rata konsumsi rencana bulanan
    const avgConsumption = plans.length > 0 ? (plans.reduce((s, p) => s + p, 0) / plans.length) : 0;
    if (avgConsumption <= 0 || remainingStock <= 0) {
      return '-'; // Tidak ada konsumsi rencana atau stok kosong
    }
    const remainingMonths = Math.ceil(remainingStock / avgConsumption);
    const targetDate = new Date(lastMonth.year, lastMonth.month - 1 + remainingMonths, 1);
    const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    return `${BULAN_NAMES[targetDate.getMonth()]} '${String(targetDate.getFullYear()).slice(2)}`;
  };

  const lastM = rangeMonths[rangeMonths.length - 1];

  // 1. Find Plan Exhaustion
  let planStock = initialStock;
  let planExhaustionIndex = 99;
  let planExhaustionLabel = '-';
  
  for (let i = 0; i < rangeMonths.length; i++) {
    const m = rangeMonths[i];
    planStock -= plans[i];
    if (planStock <= 0) {
      planExhaustionIndex = i;
      planExhaustionLabel = rangeMonths[i].label;
      break;
    }
  }
  if (planExhaustionIndex === 99 && planStock > 0) {
    planExhaustionLabel = projectExhaustion(planStock, lastM);
  }

  // 2. Find Corrected Plan Exhaustion WITHOUT PO
  let correctedStockNoPO = initialStock;
  let correctedExhaustionIndexNoPO = 99;
  let correctedExhaustionLabelNoPO = '-';

  for (let i = 0; i < rangeMonths.length; i++) {
    const m = rangeMonths[i];
    // Bulan lalu dikurangi realisasi aktual
    if (m.year < 2026 || (m.year === 2026 && m.month < 7)) {
      correctedStockNoPO -= (actuals[i] ?? 0);
    } else {
      // Bulan berjalan (Juli 2026) dan masa depan dikurangi rencana
      correctedStockNoPO -= plans[i];
    }
    if (correctedStockNoPO <= 0) {
      correctedExhaustionIndexNoPO = i;
      correctedExhaustionLabelNoPO = m.label;
      break;
    }
  }
  if (correctedExhaustionIndexNoPO === 99 && correctedStockNoPO > 0) {
    correctedExhaustionLabelNoPO = projectExhaustion(correctedStockNoPO, lastM);
  }

  // 3. Find Corrected Plan Exhaustion WITH PO
  let correctedStockWithPO = initialStock;
  let correctedExhaustionIndexWithPO = 99;
  let correctedExhaustionLabelWithPO = '-';

  for (let i = 0; i < rangeMonths.length; i++) {
    const m = rangeMonths[i];
    if (m.year === poYear && m.month === poMonth) {
      correctedStockWithPO += (item.jumlah_dipesan || 0);
    }
    // Bulan lalu dikurangi realisasi aktual
    if (m.year < 2026 || (m.year === 2026 && m.month < 7)) {
      correctedStockWithPO -= (actuals[i] ?? 0);
    } else {
      // Bulan berjalan dan masa depan dikurangi rencana
      correctedStockWithPO -= plans[i];
    }
    if (correctedStockWithPO <= 0) {
      correctedExhaustionIndexWithPO = i;
      correctedExhaustionLabelWithPO = m.label;
      break;
    }
  }
  if (correctedExhaustionIndexWithPO === 99 && correctedStockWithPO > 0) {
    correctedExhaustionLabelWithPO = projectExhaustion(correctedStockWithPO, lastM);
  }

  // 4. Calculate Gap No PO (difference in months, using WITHOUT PO as the raw deficit)
  let gapNoPO = 0;
  if (correctedExhaustionIndexNoPO !== 99 || planExhaustionIndex !== 99) {
    const cIdx = correctedExhaustionIndexNoPO === 99 ? rangeMonths.length : correctedExhaustionIndexNoPO;
    const pIdx = planExhaustionIndex === 99 ? rangeMonths.length : planExhaustionIndex;
    gapNoPO = cIdx - pIdx;
  }

  // Calculate Gap With PO
  let gapWithPO = 0;
  if (correctedExhaustionIndexWithPO !== 99 || planExhaustionIndex !== 99) {
    const cIdx = correctedExhaustionIndexWithPO === 99 ? rangeMonths.length : correctedExhaustionIndexWithPO;
    const pIdx = planExhaustionIndex === 99 ? rangeMonths.length : planExhaustionIndex;
    gapWithPO = cIdx - pIdx;
  }

  // 5. Calculate Status Plan (for both Tanpa PO and Dengan PO columns based on Gap Plan)
  // gapNoPO & gapWithPO are Gap Plan (deviation from plan)
  const getStatusPlan = (gap: number, stock: number): 'AMAN' | 'SLOW MOVING' | 'FAST MOVING' | 'DEAD STOCK' => {
    if (stock <= 0) return 'FAST MOVING';
    if (gap === 0) return 'AMAN';
    if (gap >= 6) return 'DEAD STOCK';
    return gap > 0 ? 'SLOW MOVING' : 'FAST MOVING';
  };

  const statusPlanNoPO = getStatusPlan(gapNoPO, item.current_stock);
  const statusPlanWithPO = getStatusPlan(gapWithPO, item.current_stock);

  // 6. Calculate Gap to PO (Bulan Habis Tanpa PO - Bulan Kedatangan PO)
  let gapToPO: number | null = null;
  if (item.tanggal_rencana_pengiriman) {
    let rawExhaustDate = new Date();
    if (correctedExhaustionLabelNoPO && correctedExhaustionLabelNoPO !== '-') {
      // Format: "Feb '27" -> parse "Feb" dan "2027"
      const parts = correctedExhaustionLabelNoPO.split(' ');
      if (parts.length === 2) {
        const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
        const mIdx = BULAN_NAMES.indexOf(parts[0]);
        const fullYear = 2000 + parseInt(parts[1].replace("'", ""), 10);
        if (mIdx !== -1) {
          rawExhaustDate = new Date(fullYear, mIdx, 1);
        }
      }
    }

    const poDateObj = new Date(item.tanggal_rencana_pengiriman);
    
    // Hitung selisih bulan absolut: (Tahun Habis - Tahun PO) * 12 + (Bulan Habis - Bulan PO)
    const diffMonths = (rawExhaustDate.getFullYear() - poDateObj.getFullYear()) * 12 + (rawExhaustDate.getMonth() - poDateObj.getMonth());
    gapToPO = diffMonths;
  }

  // 7. Calculate Status PO (Mitigation / Availability status based on gapToPO)
  let statusPO: 'AMAN' | 'WASPADA' | 'KRITIS' | 'BELUM PO' = 'BELUM PO';
  if (!item.tanggal_rencana_pengiriman) {
    statusPO = 'BELUM PO';
  } else if (item.current_stock <= 0) {
    statusPO = 'KRITIS';
  } else if (gapToPO !== null) {
    if (gapToPO >= 0) {
      statusPO = 'AMAN';
    } else {
      const absGap = Math.abs(gapToPO);
      if (absGap <= 2) {
        statusPO = 'WASPADA';
      } else {
        statusPO = 'KRITIS';
      }
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
      gapToPO,
      statusPlanNoPO,
      statusPlanWithPO,
      statusPO
    });
  }

  return {
    planExhaustionLabel,
    correctedExhaustionLabelNoPO,
    correctedExhaustionLabelWithPO,
    gapNoPO,
    gapWithPO,
    gapToPO,
    statusPlanNoPO,
    statusPlanWithPO,
    statusPO
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
  const [calcMode, setCalcMode] = useState<'STANDAR' | 'RIWAYAT'>('STANDAR');
  const [isChartFullScreen, setIsChartFullScreen] = useState(false);
  const [showInsight, setShowInsight] = useState(true);
  const [runRateLookback, setRunRateLookback] = useState<number>(6);

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

  // Range absolut (Jan 2026 s/d Des 2028) khusus untuk tabel & KPI agar datanya statis tidak terpengaruh filter layar
  const absoluteRangeMonths = (() => {
    const months: { year: number; month: number; label: string }[] = [];
    const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    let curYear = 2026;
    let curMonth = 1;
    for (let i = 0; i < 36; i++) {
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
          cr_actual: 0,
          plan_bulanan: 0,
          all_history: [],
          all_plans: []
        };
      }
      groups[row.nomor_material].current_stock += row.current_stock;
      groups[row.nomor_material].cr_actual += (row.cr_actual || 0);
      groups[row.nomor_material].plan_bulanan += (row.plan_bulanan || 0);
      
      if (row.all_history && Array.isArray(row.all_history)) {
        groups[row.nomor_material].all_history!.push(...row.all_history);
      }
      
      if (row.all_plans && Array.isArray(row.all_plans)) {
        row.all_plans.forEach(p => {
          const existing = groups[row.nomor_material].all_plans?.find(
            ep => ep.tahun === p.tahun && ep.bulan === p.bulan
          );
          if (existing) {
            existing.plan_qty += p.plan_qty;
          } else {
            groups[row.nomor_material].all_plans?.push({ ...p });
          }
        });
      }
    });

    return Object.values(groups).map(item => {
      // Hitung stok ideal dari sum plan_qty pada rangeMonths terpilih (Dipengaruhi Filter Periode Layar)
      const dynamicPlans = rangeMonths.map(m => {
        const p = item.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
        return p ? p.plan_qty : 0;
      });
      const dynamicStokIdeal = dynamicPlans.reduce((sum, p) => sum + p, 0);
      const finalStokIdeal = dynamicStokIdeal > 0 ? dynamicStokIdeal : item.stok_ideal;

      const pct_ketersediaan = finalStokIdeal > 0 ? Math.round((item.current_stock / finalStokIdeal) * 100) : 0;
      const t_exhaustion = item.cr_actual > 0 ? Math.round((item.current_stock / item.cr_actual) * 10) / 10 : 99;
      
      // 1. Hitung Plan Exhaustion (Dipengaruhi Filter Periode Layar)
      const { planExhaustionLabel } = calculateDynamicMetrics(item, rangeMonths, endYear, endMonth);

      // 2. Hitung Penyerapan Riil, Gap, dan Status PO (Absolut / Tidak Terpengaruh Filter)
      const { 
        correctedExhaustionLabelNoPO, 
        correctedExhaustionLabelWithPO, 
        gapNoPO, 
        gapWithPO, 
        gapToPO, 
        statusPlanNoPO, 
        statusPlanWithPO, 
        statusPO 
      } = calculateDynamicMetrics(item, absoluteRangeMonths, 2028, 12);

      // Tanggal Rencana Kirim PO dari database (jika ada)
      const poDate = (item as any).tanggal_rencana_pengiriman;
      let poKirimLabel = '-';
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
        gap_to_po: gapToPO,
        status_no_po: statusPlanNoPO,
        status_with_po: statusPlanWithPO,
        status_po: statusPO,
        po_kirim_label: poKirimLabel,
        jumlah_dipesan_label: item.jumlah_dipesan > 0 ? item.jumlah_dipesan.toLocaleString('id-ID') : '-',
        status: statusPO === 'BELUM PO' ? 'KRITIS' : statusPO, // Acuan KPI Card menganggap Belum PO sebagai KRITIS
      };
    });
  })();

  const filteredData: CriticalStockItem[] = aggregatedData.filter(row => {
    const sPo = (row as any).status_po;
    const matchStatus = filterStatus.length === 0 || filterStatus.includes(sPo);
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
    const correctedNonSaldo: (number | null)[] = [];
    let remainingStock = initialStock;

    let poYear = 0;
    let poMonth = 0;
    if (referenceItem.tanggal_rencana_pengiriman) {
      const d = new Date(referenceItem.tanggal_rencana_pengiriman);
      poYear = d.getFullYear();
      poMonth = d.getMonth() + 1;
    }

    let runRateMultiplier = 1;
    if (calcMode === 'RIWAYAT') {
      let sumActualsForRate = 0;
      let sumPlansForRate = 0;
      
      const lookbackMonthsList: { year: number; month: number }[] = [];
      for (let i = 0; i < runRateLookback; i++) {
        const d = new Date(2026, 6 - i, 1);
        lookbackMonthsList.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
      }

      lookbackMonthsList.forEach(m => {
        const hist = referenceItem.all_history?.filter(h => {
          if (!h.tanggal) return false;
          const dateObj = new Date(h.tanggal);
          return dateObj.getFullYear() === m.year && (dateObj.getMonth() + 1) === m.month;
        }) || [];
        const sumQty = hist.reduce((sum, item) => sum + (item.qty || 0), 0);
        sumActualsForRate += sumQty;

        const p = referenceItem.all_plans?.find(pl => pl.tahun === m.year && pl.bulan === m.month);
        sumPlansForRate += (p ? p.plan_qty : 0);
      });

      if (sumPlansForRate > 0) {
        runRateMultiplier = sumActualsForRate / sumPlansForRate;
      }
    }

    rangeMonths.forEach((m, idx) => {
      // Tambahkan kuantiti PO jika opsi Dengan PO diaktifkan
      if (showChartWithPO && m.year === poYear && m.month === poMonth) {
        remainingStock += (referenceItem.jumlah_dipesan || 0);
      }

      // Past month (< July 2026)
      if (m.year < 2026 || (m.year === 2026 && m.month < 7)) {
        const actVal = actuals[idx] ?? 0;
        remainingStock -= actVal;
        corrected.push(actVal);
        correctedNonSaldo.push(null);
      } else if (m.year === 2026 && m.month === 7) {
        // Current month (July 2026): deduct plan - actuals (e.g. 200 - 8 = 192)
        const actVal = actuals[idx] ?? 0;
        const adjustedPlan = Math.round(plans[idx] * runRateMultiplier);
        const correctedPlanVal = Math.max(0, adjustedPlan - actVal);
        
        correctedNonSaldo.push(calcMode === 'RIWAYAT' ? correctedPlanVal : null);

        if (remainingStock <= 0) {
          corrected.push(0);
        } else if (remainingStock < correctedPlanVal) {
          corrected.push(remainingStock);
          remainingStock = 0;
        } else {
          corrected.push(correctedPlanVal);
          remainingStock -= correctedPlanVal;
        }
      } else {
        // Future month (> July 2026)
        const adjustedPlan = Math.round(plans[idx] * runRateMultiplier);
        
        correctedNonSaldo.push(calcMode === 'RIWAYAT' ? adjustedPlan : null);

        if (remainingStock <= 0) {
          corrected.push(0);
        } else if (remainingStock < adjustedPlan) {
          corrected.push(remainingStock);
          remainingStock = 0;
        } else {
          corrected.push(adjustedPlan);
          remainingStock -= adjustedPlan;
        }
      }
    });

    // Cari index kedatangan PO di rangeMonths
    let poIdx = -1;
    if (referenceItem.tanggal_rencana_pengiriman) {
      poIdx = rangeMonths.findIndex(m => m.year === poYear && m.month === poMonth);
    }

    return { labels, plans, actuals, corrected, correctedNonSaldo, poIdx };
  })();

  // Ambil data dinamis hasil kalkulasi frontend
  const planExhaustLabel = referenceItem ? (() => {
    const { planExhaustionLabel } = calculateDynamicMetrics(referenceItem, rangeMonths, endYear, endMonth);
    return planExhaustionLabel !== 'Aman' ? planExhaustionLabel : null;
  })() : null;

  const poLabel = chartData.poIdx >= 0 ? chartData.labels[chartData.poIdx] : null;

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

  // Insight data untuk kartu info mode Riwayat
  const riwayatInsight = (() => {
    if (!referenceItem || calcMode !== 'RIWAYAT') return null;
    let sumAct = 0, sumPlan = 0;
    
    const lookbackMonthsList: { year: number; month: number }[] = [];
    for (let i = 0; i < runRateLookback; i++) {
      const d = new Date(2026, 6 - i, 1);
      lookbackMonthsList.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    lookbackMonthsList.forEach(m => {
      const hist = referenceItem.all_history?.filter(h => {
        if (!h.tanggal) return false;
        const d = new Date(h.tanggal);
        return d.getFullYear() === m.year && (dateObj => dateObj.getMonth() + 1)(new Date(h.tanggal)) === m.month;
      }) || [];
      sumAct += hist.reduce((s, h) => s + (h.qty || 0), 0);
      const p = referenceItem.all_plans?.find(pl => pl.tahun === m.year && pl.bulan === m.month);
      sumPlan += p ? p.plan_qty : 0;
    });

    const multiplier = sumPlan > 0 ? sumAct / sumPlan : 1;
    // Rata-rata plan terkoreksi per bulan masa depan (Ags dst)
    const futureMonths = rangeMonths.filter(m => m.year > 2026 || (m.year === 2026 && m.month > 7));
    const avgCorrected = futureMonths.length > 0
      ? futureMonths.reduce((s, m) => {
          const p = referenceItem.all_plans?.find(pl => pl.tahun === m.year && pl.bulan === m.month);
          return s + Math.round((p ? p.plan_qty : 0) * multiplier);
        }, 0) / futureMonths.length
      : 0;
    const nonSaldoMax = Math.max(...(chartData.correctedNonSaldo.filter((v): v is number => v !== null)));
    
    // Generate label range bulan dynamic (misalnya "Feb-Jul '26" atau "Nov '25 - Jul '26")
    const startMObj = lookbackMonthsList[lookbackMonthsList.length - 1];
    const endMObj = lookbackMonthsList[0];
    const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    
    let rangeLabel = "";
    if (startMObj.year === endMObj.year) {
      rangeLabel = `${BULAN_SHORT[startMObj.month - 1]}-${BULAN_SHORT[endMObj.month - 1]} '${String(startMObj.year).slice(2)}`;
    } else {
      rangeLabel = `${BULAN_SHORT[startMObj.month - 1]} '${String(startMObj.year).slice(2)} - ${BULAN_SHORT[endMObj.month - 1]} '${String(endMObj.year).slice(2)}`;
    }

    return { sumAct, sumPlan, multiplier, avgCorrected, nonSaldoMax, exhaustLabel, rangeLabel };
  })();

  const gapMonths = referenceItem ? ((referenceItem as any).gap_to_po ?? 0) : 0;

  const dynamicStatus = (() => {
    if (isRangeInvalid || !referenceItem) return { label: 'TIDAK VALID', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' };
    const s = (referenceItem as any).status_po ?? 'BELUM PO';
    return {
      label: s,
      color: s === 'KRITIS' || s === 'BELUM PO' ? 'var(--color-led-red)'
        : s === 'WASPADA' ? 'var(--color-led-amber)'
        : 'var(--color-led-green)',
      bg: s === 'KRITIS' || s === 'BELUM PO' ? 'rgba(220,38,38,0.12)'
        : s === 'WASPADA' ? 'rgba(217,119,6,0.12)'
        : 'rgba(22,163,74,0.12)'
    };
  })();

  // Dynamic status-based KPI calculations based on active scenario (with/without PO) and selected period/depo
  const countKritis = aggregatedData.filter(d => (d as any).status_po === 'KRITIS' || (d as any).status_po === 'BELUM PO').length;
  const countWaspada = aggregatedData.filter(d => (d as any).status_po === 'WASPADA').length;
  const countAman = aggregatedData.filter(d => (d as any).status_po === 'AMAN').length;
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
      <div className="h-4" />

      {/* Main Dashboard Layout: 2-column grid for large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start mt-4">
        
        {/* LEFT COLUMN: Absorption Chart & Critical Stock Table (Spans 2 columns) */}
        <div className="xl:col-span-2 space-y-6">
          {/* ECharts — Area Chart Proyeksi Penyerapan */}
          <div
            className={`tactile-card rounded-lg overflow-hidden ${isChartFullScreen ? 'fixed inset-0 z-50 p-6 flex flex-col justify-between' : ''}`}
            style={isChartFullScreen ? {
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-steel-border)',
              width: '100vw',
              height: '100vh',
              overflowY: 'auto'
            } : {
              backgroundColor: 'var(--color-background-metallic)',
              borderColor: 'var(--color-steel-border)'
            }}
          >
            <div className="p-5 border-b flex flex-col gap-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Penyerapan Stok Kritis</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Komparasi Rencana vs Aktual — <b>{referenceItem?.nama_material || 'Brake Pad Assy'} ({referenceItem?.nomor_material || '6005530'})</b>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Toggle Buttons: Kalkulasi Standar vs Riwayat */}
                  <div className="flex rounded p-0.5 border" style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
                    <button
                      onClick={() => setCalcMode('STANDAR')}
                      className="px-3 py-1 rounded text-[11px] font-extrabold transition-all"
                      style={calcMode === 'STANDAR' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-on-surface-variant)' }}
                    >
                      STANDAR
                    </button>
                    <button
                      onClick={() => setCalcMode('RIWAYAT')}
                      className="px-3 py-1 rounded text-[11px] font-extrabold transition-all"
                      style={calcMode === 'RIWAYAT' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-on-surface-variant)' }}
                    >
                      RIWAYAT
                    </button>
                  </div>

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

                  <button
                    onClick={() => setIsChartFullScreen(!isChartFullScreen)}
                    className="p-1.5 rounded border transition-all flex items-center justify-center hover:opacity-80"
                    style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                    title={isChartFullScreen ? "Kecilkan Tampilan" : "Perbesar Tampilan (Full Screen)"}
                  >
                    {isChartFullScreen ? (
                      /* Minimize icon */
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6m0 0V3m0 6l-6-6m6 18v-6m0 0H9m6 0l-6 6" />
                      </svg>
                    ) : (
                      /* Maximize icon */
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6m0 0v6m0-6L14 10M9 21H3m0 0v-6m0 6l7-7" />
                      </svg>
                    )}
                  </button>
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

                {calcMode === 'RIWAYAT' && (
                  <>
                    <span className="font-bold text-xs ml-2" style={{ color: 'var(--color-on-surface-variant)' }}>Analisis:</span>
                    <select
                      value={runRateLookback}
                      onChange={e => setRunRateLookback(Number(e.target.value))}
                      className="rounded px-2 py-1 border font-medium text-xs"
                      style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <option key={n} value={n}>{n} Bulan Terakhir</option>
                      ))}
                    </select>
                  </>
                )}

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

            {/* Insight Cards — hanya muncul saat fullscreen + mode Riwayat */}
            {isChartFullScreen && calcMode === 'RIWAYAT' && riwayatInsight && (
              <div className="flex flex-wrap gap-3 px-5 pb-3">
                {/* Toggle show/hide */}
                <div className="w-full flex items-center justify-between mb-0">
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Insight Riwayat</span>
                  <button
                    onClick={() => setShowInsight(v => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold transition-all hover:opacity-80"
                    style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container-high)' }}
                  >
                    {showInsight ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        Sembunyikan
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Tampilkan
                      </>
                    )}
                  </button>
                </div>

                {showInsight && (
                  <>
                    {/* Card 1: Rumus Run Rate */}
                    <div className="flex-1 min-w-[180px] rounded-lg border px-4 py-3" style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>Run Rate Historis ({riwayatInsight.rangeLabel})</p>
                      <p className="text-xs" style={{ color: 'var(--color-on-surface)' }}>
                        Aktual: <b>{riwayatInsight.sumAct.toLocaleString('id-ID')}</b>
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-on-surface)' }}>
                        Rencana: <b>{riwayatInsight.sumPlan.toLocaleString('id-ID')}</b>
                      </p>
                      <p className="text-xs mt-1 font-bold" style={{ color: '#f59e0b' }}>
                        Rasio: {riwayatInsight.multiplier.toFixed(2)}× lebih boros dari plan
                      </p>
                    </div>

                    {/* Card 2: Plan Terkoreksi */}
                    <div className="flex-1 min-w-[180px] rounded-lg border px-4 py-3" style={{ backgroundColor: 'var(--color-surface-container)', borderColor: '#f59e0b' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ display: 'inline-block', width: 24, height: 4, background: '#f59e0b', borderRadius: 2 }} />
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f59e0b' }}>Plan Terkoreksi</p>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--color-on-surface)' }}>
                        Rata-rata konsumsi: <b>~{Math.round(riwayatInsight.avgCorrected).toLocaleString('id-ID')} unit/bln</b>
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface)' }}>
                        Estimasi stok habis: <b style={{ color: riwayatInsight.exhaustLabel ? '#ef4444' : 'var(--color-led-green)' }}>{riwayatInsight.exhaustLabel ?? 'Aman dalam periode'}</b>
                      </p>
                    </div>

                    {/* Card 3: Plan Terkoreksi Non-Saldo */}
                    <div className="flex-1 min-w-[180px] rounded-lg border px-4 py-3" style={{ backgroundColor: 'var(--color-surface-container)', borderColor: '#ef4444' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ display: 'inline-block', width: 24, height: 4, background: '#ef4444', borderRadius: 2 }} />
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#ef4444' }}>Proyeksi Kebutuhan</p>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--color-on-surface)' }}>
                        Kebutuhan tertinggi: <b>~{riwayatInsight.nonSaldoMax.toLocaleString('id-ID')} unit/bln</b>
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                        Tanpa mempertimbangkan saldo saat ini
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

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
                  data: ['Rencana Awal', 'Realisasi Aktual', 'Plan Terkoreksi', 'Plan Terkoreksi (Non-Saldo)'],
                  bottom: 6,
                  itemWidth: 32,
                  itemHeight: 6,
                  itemGap: 32,
                  icon: 'roundRect',
                  textStyle: { color: ct.legendText, fontSize: 13, fontWeight: '700', fontFamily: 'inherit' },
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
                    itemStyle: {
                      color: '#8b5cf6',
                    },
                    z: 1,
                    data: chartData.plans,
                    // Garis vertikal ungu + popup card permanen di titik habis plan awal
                    ...(planExhaustLabel ? (() => {
                      const allVals = [
                        ...chartData.plans,
                        ...chartData.actuals.filter((v): v is number => v !== null),
                        ...chartData.corrected,
                      ].filter((v): v is number => typeof v === 'number' && v > 0);
                      const yMax = allVals.length > 0 ? Math.max(...allVals) : 100;
                      const yPopup = yMax * 0.90; // posisi popup tinggi di atas

                      return {
                        markLine: {
                          silent: true,
                          animation: false,
                          symbol: ['none', 'none'],
                          lineStyle: {
                            color: '#8b5cf6',
                            width: 2,
                            type: 'solid',
                            shadowColor: 'rgba(139,92,246,0.45)',
                            shadowBlur: 8,
                          },
                          label: { show: false },
                          data: [{ xAxis: planExhaustLabel }],
                        },
                        markPoint: {
                          data: [
                            {
                              name: 'Plan Habis Label',
                              coord: [planExhaustLabel, yPopup],
                              symbol: 'roundRect',
                              symbolSize: [90, 36],
                              symbolOffset: [0, 0], 
                              itemStyle: {
                                color: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.99)',
                                borderColor: '#8b5cf6',
                                borderWidth: 1.5,
                                shadowColor: 'rgba(139,92,246,0.3)',
                                shadowBlur: 10,
                              },
                              label: {
                                show: true,
                                position: 'inside',
                                formatter: [
                                  `{title|PLAN HABIS}`,
                                  `{date|${planExhaustLabel}}`,
                                ].join('\n'),
                                rich: {
                                  title: {
                                    color: '#8b5cf6',
                                    fontSize: 9,
                                    fontWeight: '800',
                                    fontFamily: 'inherit',
                                    lineHeight: 14,
                                    align: 'center',
                                  },
                                  date: {
                                    color: isDark ? '#c084fc' : '#6b21a8',
                                    fontSize: 10,
                                    fontWeight: '800',
                                    fontFamily: 'inherit',
                                    lineHeight: 14,
                                    align: 'center',
                                  },
                                },
                                align: 'center',
                              },
                            },
                            {
                              name: 'Plan Habis Dot',
                              coord: [planExhaustLabel, 0],
                              symbol: 'circle',
                              symbolSize: 14,
                              itemStyle: {
                                color: '#8b5cf6',
                                borderColor: '#fff',
                                borderWidth: 2.5,
                                shadowColor: 'rgba(139,92,246,0.7)',
                                shadowBlur: 10,
                              },
                              label: { show: false },
                            },
                          ],
                        },
                      };
                    })() : {}),
                  },
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
                    ...(() => {
                      const allVals = [
                        ...chartData.plans,
                        ...chartData.actuals.filter((v): v is number => v !== null),
                        ...chartData.corrected,
                      ].filter((v): v is number => typeof v === 'number' && v > 0);
                      const yMax = allVals.length > 0 ? Math.max(...allVals) : 100;

                      const markLineData: any[] = [];
                      const markPointData: any[] = [];

                      if (poLabel && showChartWithPO) {
                        const yPopupPO = yMax * 0.76;
                        markLineData.push({
                          xAxis: poLabel,
                          lineStyle: {
                            color: '#10b981',
                            width: 2,
                            type: 'solid',
                            shadowColor: 'rgba(16,185,129,0.45)',
                            shadowBlur: 8,
                          },
                          label: { show: false }
                        });
                        markPointData.push(
                          {
                            name: 'PO Masuk Label',
                            coord: [poLabel, yPopupPO],
                            symbol: 'roundRect',
                            symbolSize: [90, 36],
                            symbolOffset: [0, 0],
                            itemStyle: {
                              color: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.99)',
                              borderColor: '#10b981',
                              borderWidth: 1.5,
                              shadowColor: 'rgba(16,185,129,0.3)',
                              shadowBlur: 10,
                            },
                            label: {
                              show: true,
                              position: 'inside',
                              formatter: [
                                `{title|RENCANA GR}`,
                                `{date|${poLabel}}`,
                              ].join('\n'),
                              rich: {
                                title: { color: '#10b981', fontSize: 9, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' },
                                date: { color: isDark ? '#a7f3d0' : '#047857', fontSize: 10, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                              },
                              align: 'center',
                            }
                          },
                          {
                            name: 'PO Masuk Dot',
                            coord: [poLabel, 0],
                            symbol: 'circle',
                            symbolSize: 14,
                            itemStyle: {
                              color: '#10b981',
                              borderColor: '#fff',
                              borderWidth: 2.5,
                              shadowColor: 'rgba(16,185,129,0.7)',
                              shadowBlur: 10,
                            },
                            label: { show: false }
                          }
                        );
                      }

                      // Garis Vertikal Hari Ini (Bulan Berjalan - Juli '26)
                      const currentMonthLabel = "Jul '26";
                      if (chartData.labels.includes(currentMonthLabel)) {
                        markLineData.push({
                          xAxis: currentMonthLabel,
                          lineStyle: {
                            color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
                            width: 1.5,
                            type: 'dashed'
                          },
                          label: {
                            show: true,
                            position: 'end',
                            formatter: 'Hari Ini',
                            color: isDark ? '#cbd5e1' : '#475569',
                            fontSize: 8,
                            fontWeight: 'bold',
                            backgroundColor: isDark ? 'rgba(30,41,59,0.85)' : 'rgba(241,245,249,0.85)',
                            padding: [2, 4],
                            borderRadius: 2
                          }
                        });
                      }

                      if (exhaustLabel) {
                        const yPopupEx = yMax * 0.62;
                        markLineData.push({
                          xAxis: exhaustLabel,
                          lineStyle: {
                            color: '#ef4444',
                            width: 2,
                            type: 'solid',
                            shadowColor: 'rgba(239,68,68,0.45)',
                            shadowBlur: 8,
                          },
                          label: { show: false }
                        });
                        markPointData.push(
                          {
                            name: 'Stok Habis Label',
                            coord: [exhaustLabel, yPopupEx],
                            symbol: 'roundRect',
                            symbolSize: [90, 36],
                            symbolOffset: [0, 0],
                            itemStyle: {
                              color: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.99)',
                              borderColor: '#ef4444',
                              borderWidth: 1.5,
                              shadowColor: 'rgba(239,68,68,0.3)',
                              shadowBlur: 10,
                            },
                            label: {
                              show: true,
                              position: 'inside',
                              formatter: [
                                `{title|STOK HABIS}`,
                                `{date|${exhaustLabel}}`,
                              ].join('\n'),
                              rich: {
                                title: { color: '#ef4444', fontSize: 9, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' },
                                date: { color: isDark ? '#fca5a5' : '#dc2626', fontSize: 10, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                              },
                              align: 'center',
                            }
                          },
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
                            label: { show: false }
                          }
                        );
                      }

                      if (markLineData.length === 0) return {};

                      return {
                        markLine: {
                          silent: true,
                          animation: false,
                          symbol: ['none', 'none'],
                          data: markLineData,
                        },
                        markPoint: {
                          data: markPointData,
                        }
                      };
                    })(),
                  },
                  {
                    name: 'Plan Terkoreksi (Non-Saldo)',
                    type: 'line',
                    smooth: true,
                    smoothMonotone: 'x',
                    symbol: 'none',
                    lineStyle: {
                      color: '#ef4444',
                      width: 2,
                      type: 'dashed',
                      shadowColor: 'rgba(239,68,68,0.3)',
                      shadowBlur: 4,
                      shadowOffsetY: 2,
                    },
                    itemStyle: { color: '#ef4444' },
                    emphasis: { disabled: true },
                    z: 1,
                    data: chartData.correctedNonSaldo,
                  },
                ],
              }}
              style={{ height: isChartFullScreen ? 'calc(100vh - 180px)' : 570, backgroundColor: 'var(--color-background-metallic)' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: KPIs & Bar Chart (Spans 1 column) */}
        <div className="space-y-6">
          {/* KPI Cards (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Status Kritis" value={countKritis} borderColor="#ef4444" ledStatus={countKritis > 0 ? "red" : "green"} sparkData={[3, 2, 2, 3, 3, 3]} />
            <KpiCard label="Status Waspada" value={countWaspada} borderColor="var(--color-led-amber)" ledStatus={countWaspada > 0 ? "amber" : "green"} sparkData={[5, 4, 3, 3, 4, 3]} />
            <KpiCard label="Status Aman" value={countAman} borderColor="var(--color-led-green)" ledStatus="green" sparkData={[10, 11, 12, 13, 14, 15]} />
            <KpiCard label="Dead Stock" value={countDeadStock} borderColor="#9ca3af" sparkData={[2, 2, 1, 1, 1, 1]} />
          </div>

          {/* ECharts — Pie Chart Status Distribusi */}
          <div className="tactile-card rounded-lg overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Status Distribusi</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Persentase status material aman, waspada, dan kritis</p>
              </div>
            </div>
            <div className="p-4" style={{ backgroundColor: 'var(--color-background-metallic)' }}>
              <ReactECharts
                option={{
                  backgroundColor: 'transparent',
                  tooltip: {
                    trigger: 'item',
                    backgroundColor: ct.tooltipBg,
                    borderColor: ct.tooltipBorder,
                    borderWidth: 1,
                    textStyle: { color: ct.tooltipText, fontSize: 12 },
                    formatter: (params: any) =>
                      `<b style="color:${ct.tooltipText}">${params.name}</b><br/>` +
                      `<span style="color:${ct.tooltipSub}">Jumlah</span>: <b style="color:${ct.tooltipText}">${params.value} Material</b><br/>` +
                      `<span style="color:${ct.tooltipSub}">Persentase</span>: <b style="color:${ct.tooltipText}">${params.percent}%</b>`,
                  },
                  legend: {
                    orient: 'horizontal',
                    bottom: 0,
                    left: 'center',
                    textStyle: { color: ct.legendText, fontSize: 11, fontWeight: '600' },
                    itemGap: 16,
                  },
                  series: [
                    {
                      name: 'Status Distribusi',
                      type: 'pie',
                      radius: ['45%', '72%'],
                      center: ['50%', '42%'],
                      avoidLabelOverlap: false,
                      itemStyle: {
                        borderRadius: 6,
                        borderColor: 'transparent',
                        borderWidth: 0,
                      },
                      label: {
                        show: true,
                        position: 'outside',
                        formatter: '{b}\n{d}%',
                        color: ct.axisLabel,
                        fontSize: 10,
                        fontWeight: '700',
                        lineHeight: 12,
                      },
                      emphasis: {
                        label: {
                          show: true,
                          fontSize: 11,
                          fontWeight: '800',
                        },
                      },
                      data: [
                        {
                          value: filteredData.filter(d => (d as any).status_po === 'KRITIS' || (d as any).status_po === 'BELUM PO').length,
                          name: 'Kritis',
                          itemStyle: {
                            color: {
                              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                              colorStops: [
                                { offset: 0, color: '#ff6b6b' },
                                { offset: 1, color: '#c92a2a' }
                              ]
                            },
                            shadowBlur: 10,
                            shadowOffsetX: 2,
                            shadowOffsetY: 6,
                            shadowColor: 'rgba(197, 27, 27, 0.4)'
                          },
                        },
                        {
                          value: filteredData.filter(d => (d as any).status_po === 'WASPADA').length,
                          name: 'Waspada',
                          itemStyle: {
                            color: {
                              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                              colorStops: [
                                { offset: 0, color: '#ffc048' },
                                { offset: 1, color: '#d35400' }
                              ]
                            },
                            shadowBlur: 10,
                            shadowOffsetX: 2,
                            shadowOffsetY: 6,
                            shadowColor: 'rgba(211, 84, 0, 0.4)'
                          },
                        },
                        {
                          value: filteredData.filter(d => (d as any).status_po === 'AMAN').length,
                          name: 'Aman',
                          itemStyle: {
                            color: {
                              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                              colorStops: [
                                { offset: 0, color: '#2ecc71' },
                                { offset: 1, color: '#27ae60' }
                              ]
                            },
                            shadowBlur: 10,
                            shadowOffsetX: 2,
                            shadowOffsetY: 6,
                            shadowColor: 'rgba(39, 174, 96, 0.4)'
                          },
                        },
                      ],
                    },
                  ],
                }}
                style={{ height: 260 }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
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
          {(['KRITIS', 'WASPADA', 'AMAN', 'BELUM PO'] as const).map(s => (
            <label key={s} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={filterStatus.includes(s)} onChange={() => toggleStatus(s)} className="rounded" />
              <span style={{ color: s === 'KRITIS' || s === 'BELUM PO' ? 'var(--color-led-red)' : s === 'WASPADA' ? 'var(--color-led-amber)' : 'var(--color-led-green)' }}>{s === 'BELUM PO' ? 'NO PO' : s}</span>
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
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Analisis Stok</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              {filteredData.length} material
            </span>
          </div>
          <ExportButton data={filteredData as unknown as Record<string, unknown>[]} filename="critical_stock_analysis" columns={exportCols} />
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left border-collapse min-w-[1100px] data-table">
            <thead>
              {/* Row 1: Groups */}
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-left whitespace-nowrap align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>Nomor Material</th>
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-left whitespace-normal align-middle border-b border-r max-w-[220px]" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>Deskripsi Material</th>
                
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-right align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>
                  Stok Saat Ini<br/><span className="text-[8px] font-normal lowercase opacity-75">(pc/set/l)</span>
                </th>
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-right align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>
                  Stok Ideal<br/><span className="text-[8px] font-normal lowercase opacity-75">(pc/set/l)</span>
                </th>
                {['% Ketersediaan','Habis (Plan)'].map(h => (
                  <th key={h} rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-right whitespace-nowrap align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>{h}</th>
                ))}
                {/* Tanpa PO Group */}
                <th colSpan={5} className="px-2 py-1.5 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap border-b border-r" style={{ color: 'var(--color-led-amber)', backgroundColor: 'rgba(217,119,6,0.08)', borderColor: 'var(--color-steel-border)' }}>
                  TANPA PO
                </th>
                {/* Dengan PO Group */}
                <th colSpan={5} className="px-2 py-1.5 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap border-b border-r" style={{ color: 'var(--color-led-green)', backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'var(--color-steel-border)' }}>
                  DENGAN PO
                </th>
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap align-middle border-b" style={{ color: 'var(--color-on-primary-container)' }}>Aksi</th>
              </tr>
              {/* Row 2: Sub-columns */}
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {/* Sub Tanpa PO */}
                {['Habis', 'Gap Plan', 'Status Plan', 'Gap Ke PO', 'Status PO'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-bold tracking-wider uppercase text-center whitespace-nowrap border-b border-r" style={{ color: 'var(--color-led-amber)', backgroundColor: 'rgba(217,119,6,0.04)', borderColor: 'var(--color-steel-border)' }}>{h}</th>
                ))}
                {/* Sub Dengan PO */}
                <th className="px-2 py-1.5 text-[9px] font-bold tracking-wider uppercase text-center whitespace-nowrap border-b border-r" style={{ color: 'var(--color-led-green)', backgroundColor: 'rgba(16,185,129,0.04)', borderColor: 'var(--color-steel-border)' }}>Rencana Kirim</th>
                <th className="px-2 py-1.5 text-[9px] font-bold tracking-wider uppercase text-center border-b border-r" style={{ color: 'var(--color-led-green)', backgroundColor: 'rgba(16,185,129,0.04)', borderColor: 'var(--color-steel-border)' }}>
                  Qty PO<br/><span className="text-[7.5px] font-normal lowercase opacity-75">(pc/set/l)</span>
                </th>
                {['Habis', 'Gap Plan', 'Status Plan'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-bold tracking-wider uppercase text-center whitespace-nowrap border-b border-r" style={{ color: 'var(--color-led-green)', backgroundColor: 'rgba(16,185,129,0.04)', borderColor: 'var(--color-steel-border)' }}>{h}</th>
                ))}
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
                    <td className="px-2 py-2 text-[11px] max-w-[220px] whitespace-normal font-medium leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }} title={row.nama_material}>{row.nama_material}</td>
                    <td className="px-2 py-2 text-[11px] text-right font-medium" style={{ color: 'var(--color-on-surface)' }}>{row.current_stock.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-2 text-[11px] text-right" style={{ color: 'var(--color-on-surface-variant)' }}>{row.stok_ideal.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-2 text-[11px] text-right">
                      {/* % Ketersediaan bar */}
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-container-highest)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.pct_ketersediaan)}%`, backgroundColor: pctColor }} />
                        </div>
                        <span className="font-bold text-[11px] w-8 text-right" style={{ color: 'var(--color-on-surface)' }}>{row.pct_ketersediaan}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-right font-medium" style={{ color: 'var(--color-on-surface)' }}>{(row as any).plan_habis_label}</td>
                    
                    {/* Skenario Tanpa PO (Orange Tint) */}
                    <td className="px-2 py-2 text-[11px] text-center font-medium" style={{ color: 'var(--color-on-surface)', backgroundColor: 'rgba(217,119,6,0.02)' }}>{(row as any).koreksi_habis_no_po_label}</td>
                    <td className="px-2 py-2 text-[11px] text-center font-bold" style={{ backgroundColor: 'rgba(217,119,6,0.02)', color: 'var(--color-on-surface)' }}>
                      {(row as any).gap_no_po > 0 ? '+' : ''}{(row as any).gap_no_po}
                    </td>
                    <td className="px-2 py-2 text-center" style={{ backgroundColor: 'rgba(217,119,6,0.02)' }}>
                      <span className="text-[8.5px] font-black tracking-normal uppercase whitespace-nowrap" style={{ color: getStatusPlanColor((row as any).status_no_po) }}>
                        {(row as any).status_no_po}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center font-bold" style={{ backgroundColor: 'rgba(217,119,6,0.02)', color: (row as any).gap_to_po === null ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)' }}>
                      {(row as any).gap_to_po === null ? '-' : `${(row as any).gap_to_po > 0 ? '+' : ''}${(row as any).gap_to_po}`}
                    </td>
                    <td className="px-2 py-2 text-center" style={{ backgroundColor: 'rgba(217,119,6,0.02)' }}>
                      <StatusBadge status={(row as any).status_po} />
                    </td>

                    {/* Skenario Dengan PO (Green Tint) */}
                    <td className="px-2 py-2 text-[11px] text-center font-semibold" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: (row as any).po_kirim_label === '-' ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)' }}>
                      {(row as any).po_kirim_label}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center font-medium" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: 'var(--color-on-surface-variant)' }}>
                      {(row as any).jumlah_dipesan_label}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center font-medium" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: (row as any).koreksi_habis_with_po_label === '-' ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)' }}>{(row as any).koreksi_habis_with_po_label}</td>
                    <td className="px-2 py-2 text-[11px] text-center font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: 'var(--color-on-surface)' }}>
                      {(row as any).gap_with_po > 0 ? '+' : ''}{(row as any).gap_with_po}
                    </td>
                    <td className="px-2 py-2 text-center" style={{ backgroundColor: 'rgba(16,185,129,0.02)' }}>
                      <span className="text-[8.5px] font-black tracking-normal uppercase whitespace-nowrap" style={{ color: getStatusPlanColor((row as any).status_with_po) }}>
                        {(row as any).status_with_po}
                      </span>
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
                <tr><td colSpan={16} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Tidak ada data yang sesuai filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
      </div>
    </PageWrapper>
  );
}
