import { useState, useEffect, useMemo } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import ReactECharts from 'echarts-for-react';
import { getCriticalStockData, getMaintenanceBomConfig } from '../services/supabaseService';
import { supabase } from '../lib/supabaseClient';
import type { CriticalStockItem, MaintenanceBomConfig } from '../types';

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

interface MonthRangeItem {
  year: number;
  month: number;
  label: string;
}

const exportCols = [
  { key: 'nomor_material', header: 'Kode Material' },
  { key: 'nama_material', header: 'Deskripsi Material' },
  { key: 'plan_bulanan', header: 'Plan Bulanan' },
  { key: 'actual_monthly_avg', header: 'Aktual Rata-rata' },
  { key: 'deviasi_qty', header: 'Gap Deviasi (Qty)' },
  { key: 'deviasi_pct', header: 'Persentase Deviasi' },
  { key: 'status', header: 'Status' }
];

const detailedExportCols = [
  { key: 'bulan_label', header: 'Bulan' },
  { key: 'plan_qty', header: 'Target Rencana (Unit)' },
  { key: 'actual_qty', header: 'Realisasi Aktual (Unit)' },
  { key: 'deviasi_qty', header: 'Deviasi Qty' },
  { key: 'deviasi_pct', header: 'Deviasi %' },
  { key: 'status', header: 'Status' }
];

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


export default function AnomalyStockPage() {
  const [criticalData, setCriticalData] = useState<CriticalStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'SEMUA' | 'ANOMALI' | 'NORMAL'>('SEMUA');

  // Projection Chart states
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [startMonth, setStartMonth] = useState<number>(1);
  const [startYear, setStartYear] = useState<number>(currentYear);
  const [endMonth, setEndMonth] = useState<number>(12);
  const [endYear, setEndYear] = useState<number>(currentYear);
  const [showDeviation, setShowDeviation] = useState(false);
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('SEMUA');
  const [isChartFullScreen, setIsChartFullScreen] = useState(false);
  const [tolerancePlus, setTolerancePlus] = useState<number>(15);
  const [toleranceMinus, setToleranceMinus] = useState<number>(15);

  // Transaction history modal states
  const [selectedTxMonth, setSelectedTxMonth] = useState<MonthRangeItem | null>(null);
  const [txModalData, setTxModalData] = useState<{ tanggal: string; qty: number; gudang: string; order_no: string; description: string; status: 'AMAN' | 'ANOMALI'; statusReason?: string }[]>([]);
  const [loadingTxModal, setLoadingTxModal] = useState(false);
  const [modalFilter, setModalFilter] = useState<'SEMUA' | 'ANOMALI' | 'AMAN'>('SEMUA');
  const [bomList, setBomList] = useState<MaintenanceBomConfig[]>([]);

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
    async function load() {
      try {
        const [cData, bData] = await Promise.all([
          getCriticalStockData(),
          getMaintenanceBomConfig()
        ]);
        setCriticalData(cData);
        setBomList(bData);
        if (cData.length > 0 && !selectedMaterial) {
          setSelectedMaterial(cData[0].nomor_material);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Generate list of months in the selected range
  const rangeMonths = useMemo<MonthRangeItem[]>(() => {
    const months: MonthRangeItem[] = [];
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
  }, [startMonth, startYear, endMonth, endYear]);

  const isRangeInvalid = rangeMonths.length === 0 || rangeMonths.length > 36 || (startYear * 12 + startMonth > endYear * 12 + endMonth);

  const referenceItem = (() => {
    const items = criticalData.filter(d => d.nomor_material === selectedMaterial);
    if (items.length === 0) return criticalData[0];

    if (selectedWarehouse !== 'SEMUA') {
      const match = items.find(d => d.gudang === selectedWarehouse);
      return match || items[0];
    }

    // Aggregate all active warehouses for the selected material
    const first = items[0];
    const totalStock = items.reduce((sum, item) => sum + item.current_stock, 0);

    const plansMap = new Map<string, number>();
    items.forEach(item => {
      if (item.gudang === 'C013') return; // Abaikan Gudang Pusat (hanya distribusi)
      item.all_plans?.forEach(p => {
        const key = `${p.tahun}-${p.bulan}`;
        plansMap.set(key, (plansMap.get(key) || 0) + p.plan_qty);
      });
    });
    const all_plans = Array.from(plansMap.entries()).map(([key, val]) => {
      const [tahun, bulan] = key.split('-').map(Number);
      return { tahun, bulan, plan_qty: val };
    });

    const all_history: { qty: number; tanggal: string | null; gudang?: string; order_no?: string | null }[] = [];
    items.forEach(item => {
      if (item.gudang === 'C013') return; // Abaikan Gudang Pusat (hanya distribusi)
      if (item.all_history) {
        all_history.push(...item.all_history);
      }
    });

    return {
      ...first,
      gudang: 'SEMUA',
      gudang_label: 'Semua Gudang',
      current_stock: totalStock,
      all_plans,
      all_history
    } as CriticalStockItem;
  })();

  const uniqueMaterials = useMemo(() => {
    return Array.from(new Map(criticalData.map(m => [m.nomor_material, m])).values());
  }, [criticalData]);

  // Calculate dynamic table summary based on selected warehouse and rangeMonths
  const summaryData = useMemo(() => {
    if (criticalData.length === 0) return [];

    return uniqueMaterials.map(mat => {
      const items = criticalData.filter(d => d.nomor_material === mat.nomor_material);
      let refItem: CriticalStockItem;

      if (selectedWarehouse !== 'SEMUA') {
        refItem = items.find(d => d.gudang === selectedWarehouse) || items[0];
      } else {
        // Aggregate active warehouses
        const first = items[0];
        const totalStock = items.reduce((sum, item) => sum + item.current_stock, 0);

        const plansMap = new Map<string, number>();
        items.forEach(item => {
          if (item.gudang === 'C013') return; // Abaikan Gudang Pusat
          item.all_plans?.forEach(p => {
            const key = `${p.tahun}-${p.bulan}`;
            plansMap.set(key, (plansMap.get(key) || 0) + p.plan_qty);
          });
        });
        const all_plans = Array.from(plansMap.entries()).map(([key, val]) => {
          const [tahun, bulan] = key.split('-').map(Number);
          return { tahun, bulan, plan_qty: val };
        });

        const all_history: { qty: number; tanggal: string | null }[] = [];
        items.forEach(item => {
          if (item.gudang === 'C013') return;
          if (item.all_history) {
            all_history.push(...item.all_history);
          }
        });

        refItem = {
          ...first,
          gudang: 'SEMUA',
          gudang_label: 'Semua Gudang',
          current_stock: totalStock,
          all_plans,
          all_history
        };
      }

      // Calculate averages over the selected rangeMonths
      let totalPlan = 0;
      let totalActual = 0;
      let actualMonthsCount = 0;

      rangeMonths.forEach(m => {
        // Plan
        let pQty = 0;
        if (refItem.gudang !== 'C013') {
          const p = refItem.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
          pQty = p ? p.plan_qty : 0;
        }
        totalPlan += pQty;

        // Actual (up to July 2026)
        const isFuture = m.year > 2026 || (m.year === 2026 && m.month > 7);
        if (!isFuture) {
          const hist = refItem.all_history?.filter(h => {
            if (!h.tanggal) return false;
            const d = new Date(h.tanggal);
            return d.getFullYear() === m.year && (d.getMonth() + 1) === m.month;
          }) || [];
          const sumQty = hist.reduce((sum, h) => sum + (h.qty || 0), 0);
          totalActual += sumQty;
          actualMonthsCount++;
        }
      });

      const plan_bulanan = rangeMonths.length > 0 ? Math.round((totalPlan / rangeMonths.length) * 10) / 10 : 0;
      const actual_monthly_avg = actualMonthsCount > 0 ? Math.round((totalActual / actualMonthsCount) * 10) / 10 : 0;
      const deviasi_qty = Math.round((actual_monthly_avg - plan_bulanan) * 10) / 10;
      const deviasi_pct = plan_bulanan > 0 ? Math.round((deviasi_qty / plan_bulanan) * 100) : 0;
      const status = (deviasi_pct > tolerancePlus || deviasi_pct < -toleranceMinus) ? 'ANOMALI' : 'NORMAL';

      return {
        nomor_material: mat.nomor_material,
        nama_material: mat.nama_material,
        satuan: mat.satuan,
        plan_bulanan,
        actual_monthly_avg,
        deviasi_qty,
        deviasi_pct,
        status
      } as AnomalyItem;
    });
  }, [criticalData, selectedWarehouse, rangeMonths, uniqueMaterials, tolerancePlus, toleranceMinus]);

  const filteredData = useMemo(() => {
    return summaryData.filter(row => {
      const q = searchText.toLowerCase();
      const matchSearch = row.nama_material.toLowerCase().includes(q) || row.nomor_material.includes(q);
      const matchStatus = filterStatus === 'SEMUA' || row.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [summaryData, searchText, filterStatus]);

  const totalAnomalies = useMemo(() => {
    return summaryData.filter(d => d.status === 'ANOMALI').length;
  }, [summaryData]);

  // Hitung jumlah anomali per gudang/depo aktif untuk perbandingan
  const warehouseAnomalyCounts = useMemo(() => {
    const warehouses = [
      { code: 'C006', label: 'Depo Bukit Duri (C006)' },
      { code: 'C007', label: 'Depo Depok (C007)' },
      { code: 'C008', label: 'Depo Bogor (C008)' },
      { code: 'C009', label: 'OH Manggarai (C009)' },
      { code: 'C020', label: 'Depo Manggarai (C020)' }
    ];

    if (criticalData.length === 0) {
      return warehouses.map(w => ({ name: w.label, value: 0 }));
    }

    return warehouses.map(wh => {
      let anomalyCount = 0;

      uniqueMaterials.forEach(mat => {
        const items = criticalData.filter(d => d.nomor_material === mat.nomor_material);
        const refItem = items.find(d => d.gudang === wh.code);
        if (!refItem) return;

        // Calculate averages over the selected rangeMonths
        let totalPlan = 0;
        let totalActual = 0;
        let actualMonthsCount = 0;

        rangeMonths.forEach(m => {
          // Plan
          const p = refItem.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
          const pQty = p ? p.plan_qty : 0;
          totalPlan += pQty;

          // Actual (up to July 2026)
          const isFuture = m.year > 2026 || (m.year === 2026 && m.month > 7);
          if (!isFuture) {
            const hist = refItem.all_history?.filter(h => {
              if (!h.tanggal) return false;
              const d = new Date(h.tanggal);
              return d.getFullYear() === m.year && (d.getMonth() + 1) === m.month;
            }) || [];
            const sumQty = hist.reduce((sum, h) => sum + (h.qty || 0), 0);
            totalActual += sumQty;
            actualMonthsCount++;
          }
        });

        const plan_bulanan = rangeMonths.length > 0 ? Math.round((totalPlan / rangeMonths.length) * 10) / 10 : 0;
        const actual_monthly_avg = actualMonthsCount > 0 ? Math.round((totalActual / actualMonthsCount) * 10) / 10 : 0;
        const deviasi_qty = Math.round((actual_monthly_avg - plan_bulanan) * 10) / 10;
        const deviasi_pct = plan_bulanan > 0 ? Math.round((deviasi_qty / plan_bulanan) * 100) : 0;
        const isAnomaly = (deviasi_pct > tolerancePlus || deviasi_pct < -toleranceMinus);

        if (isAnomaly) {
          anomalyCount++;
        }
      });

      return {
        name: wh.label,
        value: anomalyCount
      };
    });
  }, [criticalData, uniqueMaterials, rangeMonths, tolerancePlus, toleranceMinus]);

  // Detailed monthly breakdown data for the currently selected material
  const monthlyBreakdownData = useMemo(() => {
    if (!referenceItem || isRangeInvalid) return [];

    return rangeMonths.map(m => {
      // Plan
      let plan_qty = 0;
      if (selectedWarehouse !== 'C013') {
        const p = referenceItem.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
        plan_qty = p ? p.plan_qty : 0;
      }

      // Actual (null for future months)
      const isFuture = m.year > 2026 || (m.year === 2026 && m.month > 7);
      let actual_qty: number | null = null;
      if (!isFuture) {
        const hist = referenceItem.all_history?.filter(h => {
          if (!h.tanggal) return false;
          const d = new Date(h.tanggal);
          return d.getFullYear() === m.year && (d.getMonth() + 1) === m.month;
        }) || [];
        actual_qty = hist.reduce((sum, h) => sum + (h.qty || 0), 0);
      }

      const deviasi_qty = actual_qty !== null ? actual_qty - plan_qty : null;
      const deviasi_pct = (actual_qty !== null && plan_qty > 0) ? Math.round((deviasi_qty! / plan_qty) * 100) : null;
      const status = deviasi_pct !== null ? ((deviasi_pct > tolerancePlus || deviasi_pct < -toleranceMinus) ? 'ANOMALI' : 'NORMAL') : '—';

      return {
        bulan_label: m.label,
        plan_qty,
        actual_qty,
        deviasi_qty,
        deviasi_pct,
        status
      };
    });
  }, [referenceItem, rangeMonths, selectedWarehouse, isRangeInvalid, tolerancePlus, toleranceMinus]);
  const mainExportData = useMemo(() => {
    return filteredData.map(d => ({
      ...d,
      status: d.status === 'ANOMALI' ? 'Anomali' : 'Dalam Toleransi'
    }));
  }, [filteredData]);

  const detailedExportData = useMemo(() => {
    return monthlyBreakdownData.map(d => ({
      ...d,
      status: d.status === 'ANOMALI' ? 'Anomali' : (d.status === '—' ? '—' : 'Dalam Toleransi')
    }));
  }, [monthlyBreakdownData]);
  const chartData = (() => {
    if (isRangeInvalid || !referenceItem) {
      return { labels: [] as string[], plans: [] as (number | null)[], actuals: [] as (number | null)[] };
    }

    const labels = rangeMonths.map(m => m.label);
    
    const plans = rangeMonths.map(m => {
      // Jika Gudang Pusat dipilih, plan adalah 0
      if (selectedWarehouse === 'C013') return 0;
      const p = referenceItem.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
      return p ? p.plan_qty : 0;
    });

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

    return { labels, plans, actuals };
  })();

  const handleOpenTxModal = async (m: MonthRangeItem) => {
    if (!referenceItem) return;
    setSelectedTxMonth(m);
    setLoadingTxModal(true);
    setTxModalData([]);
    
    // 1. Filter history records for this month
    const hist = referenceItem.all_history?.filter(h => {
      if (!h.tanggal) return false;
      const d = new Date(h.tanggal);
      return d.getFullYear() === m.year && (d.getMonth() + 1) === m.month;
    }) || [];
    
    // 2. Fetch order descriptions and equipment relations from orders table
    const uniqueOrderNos = Array.from(new Set(hist.map(h => h.order_no).filter(Boolean))) as string[];
    
    const ordersMap = new Map<string, { description: string; seri?: string; propulsi?: string }>();
    if (uniqueOrderNos.length > 0) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            order_no, 
            description,
            equipment_id,
            equipment_master (
              id,
              name,
              level,
              model_no,
              parent_id
            )
          ` as any)
          .in('order_no', uniqueOrderNos);
          
        if (error) throw error;
        
        if (data) {
          // Find parents in memory if needed
          const parentIds = Array.from(new Set(data
            .map((o: any) => o.equipment_master?.parent_id)
            .filter((pid: any) => pid !== null && pid !== undefined)
          )) as string[];
          
          const parentMap = new Map<string, { name: string; model_no?: string }>();
          if (parentIds.length > 0) {
            const { data: parents, error: pErr } = await supabase
              .from('equipment_master')
              .select('id, name, model_no')
              .in('id', parentIds);
            if (parents && !pErr) {
              parents.forEach((p: any) => {
                parentMap.set(p.id, { name: p.name || '', model_no: p.model_no || '' });
              });
            }
          }

          data.forEach((o: any) => {
            let eqName = '';
            let modelNo = '';
            const eq = o.equipment_master;
            if (eq) {
              if (eq.level === 2 && eq.parent_id) {
                const parentInfo = parentMap.get(eq.parent_id);
                eqName = parentInfo?.name || '';
                modelNo = parentInfo?.model_no || '';
              } else {
                eqName = eq.name || '';
                modelNo = eq.model_no || '';
              }
            }

            // Resolve series from rangkaian name
            let resolvedSeri = '';
            const upperName = eqName.toUpperCase();
            if (upperName.includes('205') || upperName.includes('JR')) resolvedSeri = 'JR205';
            else if (upperName.includes('125') || upperName.includes('CLI125')) resolvedSeri = 'CLI125';
            else if (upperName.includes('225') || upperName.includes('CLI225')) resolvedSeri = 'CLI225';
            else if (upperName.includes('METRO')) resolvedSeri = 'Metro';
            else if (upperName.includes('KFW')) resolvedSeri = 'KFW';
            else if (upperName.includes('EA')) resolvedSeri = 'EA203';

            // Resolve propulsion
            let resolvedPropulsi = '';
            const upperModel = modelNo.toUpperCase();
            if (upperModel.includes('VVVF')) resolvedPropulsi = 'VVVF';
            else if (upperModel.includes('RHEOSTATIC') || upperModel.includes('RHEO')) resolvedPropulsi = 'Rheostatic';

            ordersMap.set(o.order_no, {
              description: o.description || '',
              seri: resolvedSeri || undefined,
              propulsi: resolvedPropulsi || undefined
            });
          });
        }
      } catch (err) {
        console.error('Error fetching order descriptions:', err);
      }
    }
    
    // 3. Map with BOM verification rules
    const materialBoms = bomList.filter(b => b.nomor_material === referenceItem.nomor_material);

    const mapped = hist.map(h => {
      const GUDANG_LABEL_MAP: Record<string, string> = {
        'C009': 'OH Manggarai (C009)',
        'C007': 'Depo Depok (C007)',
        'C006': 'Depo Bukit Duri (C006)',
        'C020': 'Depo Manggarai (C020)',
        'C008': 'Depo Bogor (C008)',
        'C013': 'Gudang Pusat (C013)',
      };
      
      const orderInfo = h.order_no ? ordersMap.get(h.order_no) : null;
      const description = orderInfo?.description || (h.order_no ? `Pemeliharaan ${referenceItem.nama_material}` : '—');
      const resolvedSeri = orderInfo?.seri;
      const resolvedPropulsi = orderInfo?.propulsi;
      
      // Determine status from BOM configuration
      let status: 'AMAN' | 'ANOMALI' = 'AMAN';
      let statusReason = '';

      // Detect car type: TC, M1, M2, T6, T
      let detectedCarType: 'TC' | 'M1' | 'M2' | 'T6' | 'T' | null = null;
      if (/\bM1\b/i.test(description)) detectedCarType = 'M1';
      else if (/\bM2\b/i.test(description)) detectedCarType = 'M2';
      else if (/\bTC\b/i.test(description)) detectedCarType = 'TC';
      else if (/\bT6\b/i.test(description)) detectedCarType = 'T6';
      else if (/\bT\b/i.test(description)) detectedCarType = 'T';

      // Detect maintenance type from description
      let detectedType = null;
      const typeMatch = description.match(/\b(P1|P3|P6|P12|P24|P48)\b/i);
      if (typeMatch) detectedType = typeMatch[1].toUpperCase();

      let activeBom = null;
      if (detectedType) {
        // Filter by tipe_perawatan first
        const typeBoms = materialBoms.filter(b => b.tipe_perawatan.toUpperCase() === detectedType);
        
        if (typeBoms.length > 0) {
          // 1. Try matching both resolvedSeri and resolvedPropulsi
          if (resolvedSeri && resolvedPropulsi) {
            activeBom = typeBoms.find(b => 
              b.compat_seri_kereta?.split(',').map(s => s.trim()).includes(resolvedSeri) &&
              b.compat_propulsi?.split(',').map(p => p.trim()).includes(resolvedPropulsi)
            );
          }
          // 2. Try matching resolvedSeri only
          if (!activeBom && resolvedSeri) {
            activeBom = typeBoms.find(b => 
              b.compat_seri_kereta?.split(',').map(s => s.trim()).includes(resolvedSeri)
            );
          }
          // 3. Try matching resolvedPropulsi only
          if (!activeBom && resolvedPropulsi) {
            activeBom = typeBoms.find(b => 
              b.compat_propulsi?.split(',').map(p => p.trim()).includes(resolvedPropulsi)
            );
          }
          // 4. Fallback to universal/default rule (no compatibility restrictions)
          if (!activeBom) {
            activeBom = typeBoms.find(b => !b.compat_seri_kereta && !b.compat_propulsi);
          }
          // 5. Fallback to the first one available
          if (!activeBom) {
            activeBom = typeBoms[0];
          }
        }
      }
      
      if (!activeBom && materialBoms.length > 0) {
        if (resolvedSeri) {
          activeBom = materialBoms.find(b => b.compat_seri_kereta?.split(',').map(s => s.trim()).includes(resolvedSeri));
        }
        if (!activeBom) {
          activeBom = materialBoms[0];
        }
      }

      if (detectedCarType) {
        if (activeBom) {
          let limit = 0;
          if (detectedCarType === 'M1') limit = activeBom.qty_m1 ?? 0;
          else if (detectedCarType === 'M2') limit = activeBom.qty_m2 ?? 0;
          else if (detectedCarType === 'TC') limit = activeBom.qty_tc ?? 0;
          else if (detectedCarType === 'T6') limit = activeBom.qty_t6 ?? 0;
          else if (detectedCarType === 'T') limit = activeBom.qty_t ?? 0;

          if (limit > 0) {
            if (h.qty > limit) {
              status = 'ANOMALI';
              statusReason = `Qty penyerapan (${h.qty}) melebihi standar BOM ${detectedCarType} (${limit} unit)`;
            } else {
              status = 'AMAN';
            }
          } else {
            status = 'ANOMALI';
            statusReason = `Jenis kereta ${detectedCarType} tidak dialokasikan di BOM`;
          }
        } else {
          // No BOM configuration found for this material
          if (h.qty > 32) {
            status = 'ANOMALI';
            statusReason = `Qty penyerapan (${h.qty}) melebihi default standar (32 unit)`;
          } else {
            status = 'AMAN';
          }
        }
      } else {
        // No car type detected in description.
        // Compare against maximum configured qty of any car type in BOM, fallback to 32.
        let limit = 32;
        if (activeBom) {
          limit = Math.max(
            activeBom.qty_standar ?? 0,
            activeBom.qty_m1 ?? 0,
            activeBom.qty_m2 ?? 0,
            activeBom.qty_tc ?? 0,
            activeBom.qty_t6 ?? 0,
            activeBom.qty_t ?? 0
          );
          if (limit === 0) limit = 32;
        }
        if (h.qty > limit) {
          status = 'ANOMALI';
          statusReason = `Qty penyerapan (${h.qty}) melebihi batas maksimum BOM (${limit} unit)`;
        } else {
          status = 'AMAN';
        }
      }

      return {
        tanggal: h.tanggal || '—',
        qty: h.qty,
        gudang: GUDANG_LABEL_MAP[h.gudang || ''] || h.gudang || '—',
        order_no: h.order_no || '—',
        description,
        status,
        statusReason
      };
    });
    
    setTxModalData(mapped);
    setModalFilter('SEMUA');
    setLoadingTxModal(false);
  };

  const filteredTxData = useMemo(() => {
    if (modalFilter === 'AMAN') return txModalData.filter(d => d.status === 'AMAN');
    if (modalFilter === 'ANOMALI') return txModalData.filter(d => d.status === 'ANOMALI');
    return txModalData;
  }, [txModalData, modalFilter]);

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
      <style>{`
        @media (max-width: 768px) and (orientation: portrait) {
          .mobile-landscape-fullscreen {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            width: 100vh !important;
            height: 100vw !important;
            transform: translate(-50%, -50%) rotate(90deg) !important;
            transform-origin: center !important;
            z-index: 9999 !important;
            padding: 0.5rem !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
          }
          .mobile-landscape-fullscreen .fullscreen-hide {
            display: none !important;
          }
          .mobile-landscape-fullscreen .p-5 {
            padding: 0.5rem !important;
            gap: 0.25rem !important;
          }
          .mobile-landscape-fullscreen .chart-wrapper-el,
          .mobile-landscape-fullscreen .echarts-for-react {
            height: calc(100vw - 80px) !important;
            width: 100% !important;
          }
        }
      `}</style>
      <div className="h-4" />

      {/* Grid Layout for Charts on Large Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        
        {/* CHART 1: Grafik Penyerapan Stok Anomali */}
        <div
          className={`lg:col-span-2 tactile-card rounded-lg overflow-hidden flex flex-col ${isChartFullScreen ? 'fixed inset-0 z-50 p-6 flex flex-col justify-between mobile-landscape-fullscreen' : ''}`}
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
                <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Penyerapan Stok Anomali</h3>
                <p className="fullscreen-hide text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Komparasi Rencana vs Aktual — <b>{referenceItem?.nama_material || 'Brake Pad Assy'} ({referenceItem?.nomor_material || '6005530'})</b>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* 1. Filter Material */}
                <select
                  value={selectedMaterial || ''}
                  onChange={e => {
                    setSelectedMaterial(e.target.value);
                    setSelectedWarehouse('SEMUA');
                  }}
                  className="rounded px-3 py-1.5 border text-xs font-bold w-full max-w-[150px] sm:max-w-xs"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                >
                  {uniqueMaterials.map(m => (
                    <option key={m.nomor_material} value={m.nomor_material}>
                      {m.nomor_material} — {m.nama_material.slice(0, 25)}
                    </option>
                  ))}
                </select>

                {/* 2. Filter Gudang */}
                <select
                  value={selectedWarehouse}
                  onChange={e => setSelectedWarehouse(e.target.value)}
                  className="rounded px-3 py-1.5 border text-xs font-bold w-full max-w-[110px] sm:max-w-xs"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                >
                  <option value="SEMUA">Semua Gudang</option>
                  {criticalData
                    .filter(item => item.nomor_material === selectedMaterial && item.gudang !== 'C013')
                    .map(item => (
                      <option key={item.gudang} value={item.gudang}>
                        {item.gudang_label}
                      </option>
                    ))
                  }
                </select>

                {/* 3. Selektor Line/Bar */}
                <div className="flex rounded p-0.5 border" style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
                  <button
                    onClick={() => setChartMode('line')}
                    className="px-3 py-1 rounded text-[11px] font-extrabold transition-all"
                    style={chartMode === 'line' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-on-surface-variant)' }}
                  >
                    LINE
                  </button>
                  <button
                    onClick={() => setChartMode('bar')}
                    className="px-3 py-1 rounded text-[11px] font-extrabold transition-all"
                    style={chartMode === 'bar' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-on-surface-variant)' }}
                  >
                    BAR
                  </button>
                </div>

                {/* 4. Button Tampilkan/Sembunyikan Deviasi */}
                <button
                  onClick={() => setShowDeviation(prev => !prev)}
                  className={`px-3 py-1.5 rounded text-xs font-extrabold transition-all ${
                    showDeviation ? 'skeuomorphic-btn' : 'border'
                  }`}
                  style={
                    !showDeviation
                      ? { borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container-high)' }
                      : {}
                  }
                >
                  {showDeviation ? 'SEMBUNYIKAN DEVIASI' : 'TAMPILKAN DEVIASI'}
                </button>

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

            <div className="fullscreen-hide flex flex-wrap items-center gap-3 text-xs border-t pt-3" style={{ borderColor: 'var(--color-steel-border)' }}>
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

              {isRangeInvalid && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded ml-auto flex items-center gap-1" style={{ backgroundColor: 'rgba(220,38,38,0.12)', color: 'var(--color-led-red)' }}>
                  <span className="led-indicator led-red" style={{ width: 6, height: 6 }} />
                  Rentang tidak valid.
                </span>
              )}
            </div>
          </div>

          <div className="chart-wrapper-el" style={{ height: isChartFullScreen ? 'calc(100vh - 180px)' : 480 }}>
            <ReactECharts
              className="chart-wrapper-el"
              option={{
                backgroundColor: 'transparent',
                animation: true,
                animationDuration: 900,
                tooltip: {
                  show: window.innerWidth > 768,
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
                  formatter: (params: any[]) => {
                    const label = params[0]?.axisValue || '';
                    const rows = params
                      .filter((p: any) => p.value !== null && p.value !== undefined)
                      .map((p: any) => {
                        const val = typeof p.value === 'number' ? p.value.toLocaleString('id-ID') + ' unit' : '—';
                        const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.color};margin-right:8px"></span>`;
                        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;padding:3px 0">${dot}<span style="color:${ct.tooltipSub};font-size:11px">${p.seriesName}</span><b style="color:${ct.tooltipText};font-size:12px">${val}</b></div>`;
                      }).join('');
                    return `<div style="font-size:10px;font-weight:800;color:${ct.tooltipSub};margin-bottom:8px;border-bottom:1px solid ${ct.tooltipBorder};padding-bottom:6px">${label}</div>${rows}`;
                  },
                },
                legend: {
                  data: ['Rencana Awal', 'Realisasi Aktual'],
                  bottom: 6,
                  itemWidth: 38,
                  itemHeight: 5,
                  textStyle: { color: ct.legendText, fontSize: 11, fontWeight: '700' },
                },
                grid: { left: 14, right: 18, top: 18, bottom: window.innerWidth <= 768 ? 68 : 48, containLabel: true },
                xAxis: {
                  type: 'category',
                  data: chartData.labels,
                  boundaryGap: chartMode === 'bar',
                  axisLabel: {
                    color: ct.axisLabel,
                    fontSize: 10,
                    interval: Math.max(0, Math.floor(chartData.labels.length / 10) - 1),
                    rotate: window.innerWidth <= 768 ? 30 : 0
                  },
                  axisLine: { lineStyle: { color: ct.axisLine } },
                  splitLine: { show: true, lineStyle: { color: ct.gridLine, type: 'dashed' } },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { color: ct.axisLabel, fontSize: 10 },
                  splitLine: { lineStyle: { color: ct.gridLine, type: 'dashed' } },
                },
                series: [
                  {
                    name: 'Rencana Awal',
                    type: chartMode,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { color: '#8b5cf6', width: 2, type: 'dashed' },
                    itemStyle: { color: '#8b5cf6' },
                    data: chartData.plans,
                  },
                  {
                    name: 'Realisasi Aktual',
                    type: chartMode,
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 6,
                    lineStyle: { color: '#3b82f6', width: 2.5 },
                    itemStyle: {
                      color: '#3b82f6',
                      borderColor: chartMode === 'line' ? '#fff' : 'transparent',
                      borderWidth: chartMode === 'line' ? 2 : 0
                    },
                    data: chartData.actuals,
                    ...(() => {
                      const markLineData: any[] = [];
                      const currentMonthLabel = "Jul '26";
                      if (chartData.labels.includes(currentMonthLabel)) {
                        markLineData.push({
                          xAxis: currentMonthLabel,
                          lineStyle: { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', width: 1, type: 'dashed' },
                          label: {
                            show: true,
                            position: 'end',
                            formatter: 'Bulan Ini',
                            color: isDark ? '#cbd5e1' : '#475569',
                            fontSize: 10,
                            fontWeight: 'bold',
                            backgroundColor: isDark ? 'rgba(30,41,59,0.85)' : 'rgba(241,245,249,0.85)',
                            padding: [2, 4],
                            borderRadius: 2
                          }
                        });
                      }

                      // Jika Tampilkan Deviasi aktif, gambar garis vertikal plan vs realisasi
                      if (showDeviation) {
                        chartData.labels.forEach((label: string, idx: number) => {
                          const planVal = chartData.plans[idx] ?? 0;
                          const actualVal = chartData.actuals[idx] ?? 0;
                          const diff = actualVal - planVal;
                          const isOver = diff > 0;

                          // Theme-dynamic styling
                          const lineColor = isOver 
                            ? '#ef4444' 
                            : (isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.4)');

                          const textColor = isOver
                            ? (isDark ? '#fca5a5' : '#b91c1c')
                            : (isDark ? '#cbd5e1' : '#334155');

                          const bgColor = isOver
                            ? (isDark ? 'rgba(220, 38, 38, 0.2)' : 'rgba(254, 226, 226, 0.95)')
                            : (isDark ? 'rgba(51, 65, 85, 0.95)' : 'rgba(241, 245, 249, 0.95)');

                          const borderColor = isOver
                            ? 'rgba(239, 68, 68, 0.5)'
                            : (isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.3)');

                          markLineData.push([
                            {
                              coord: [label, planVal],
                              lineStyle: {
                                color: lineColor,
                                type: 'dotted',
                                width: 1.5,
                              },
                              label: {
                                 show: true,
                                 position: 'middle',
                                 align: 'left',
                                 verticalAlign: 'middle',
                                 offset: [10, 0], // Shift text to the right side of the vertical line
                                 rotate: 0,
                                 formatter: `${diff > 0 ? '+' : ''}${diff}`,
                                 color: textColor,
                                 fontSize: 11,
                                 fontWeight: 'bold',
                                 backgroundColor: bgColor,
                                 padding: [3, 6],
                                 borderRadius: 3,
                                 borderWidth: 1,
                                 borderColor: borderColor,
                               }
                            },
                            {
                              coord: [label, actualVal]
                            }
                          ]);
                        });
                      }

                      return {
                        markLine: {
                          silent: true,
                          symbol: ['none', 'none'],
                          data: markLineData,
                        }
                      };
                    })()
                  }
                ]
              }}
              style={{ height: '100%' }}
              notMerge={true}
            />
          </div>
        </div>

        {/* CHART 2: Radial Bar Chart (Nested Ring Chart) Perbandingan Anomali Gudang */}
        <div className="lg:col-span-1 tactile-card rounded-lg overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--color-background-metallic)', borderColor: 'var(--color-steel-border)' }}>
          <div className="p-5 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Perbandingan Anomali</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              Jumlah material terdeteksi anomali pada masing-masing Depo/Gudang
            </p>
          </div>
          <div className="p-4 flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--color-background-metallic)' }}>
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
                    `<span style="color:${ct.tooltipSub}">Jumlah Anomali</span>: <b style="color:${ct.tooltipText}">${params.value} Material</b>`,
                },
                angleAxis: {
                  max: Math.max(...warehouseAnomalyCounts.map(x => x.value), 3) * 1.25, // Berikan sedikit sisa lingkaran agar tidak mentok
                  startAngle: 90,
                  clockwise: true,
                  axisLine: { show: false },
                  axisTick: { show: false },
                  axisLabel: { show: false },
                  splitLine: { show: false },
                },
                radiusAxis: {
                  type: 'category',
                  data: warehouseAnomalyCounts.map(w => w.name.replace(' (C006)', '').replace(' (C007)', '').replace(' (C008)', '').replace(' (C009)', '').replace(' (C020)', '')),
                  inverse: true,
                  axisLine: { show: false },
                  axisTick: { show: false },
                  axisLabel: {
                    show: true,
                    color: ct.axisLabel,
                    fontSize: 10,
                    fontWeight: '700',
                    fontFamily: 'inherit',
                    interval: 0,
                  },
                },
                polar: {
                  center: ['50%', '50%'],
                  radius: ['30%', '82%'],
                },
                series: [
                  {
                    type: 'bar',
                    data: warehouseAnomalyCounts.map((w, idx) => {
                      // Warna premium untuk masing-masing ring
                      const colors = [
                        { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#38bdf8' }, { offset: 1, color: '#0284c7' }] }, // Biru
                        { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#4ade80' }, { offset: 1, color: '#22c55e' }] }, // Hijau
                        { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#fbbf24' }, { offset: 1, color: '#d97706' }] }, // Kuning
                        { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#f87171' }, { offset: 1, color: '#dc2626' }] }, // Merah
                        { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#c084fc' }, { offset: 1, color: '#9333ea' }] }  // Ungu
                      ];
                      return {
                        value: w.value,
                        name: w.name,
                        itemStyle: {
                          color: colors[idx % colors.length],
                          shadowBlur: 6,
                          shadowOffsetY: 2,
                          shadowColor: 'rgba(0,0,0,0.15)',
                        },
                      };
                    }),
                    coordinateSystem: 'polar',
                    barWidth: 10, // Tebal cincin lingkaran
                    roundCap: true,
                    showBackground: true,
                    backgroundStyle: {
                      color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    },
                  },
                ],
              }}
              style={{ height: 480, width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge={true}
            />
          </div>
        </div>

      </div>

      {/* Grid Layout for Tables on Large Screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        
        {/* Column 1: Status & Toleransi Filter + Detailed Breakdown Table */}
        <div className="flex flex-col gap-4">
          {/* Status & Tolerance Filter Panel */}
          <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-4 items-center">
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
                    {s === 'NORMAL' ? 'DALAM TOLERANSI' : s}
                  </button>
                );
              })}
            </div>

            {/* Toleransi Setting */}
            <div className="flex items-center gap-2 border-l pl-4" style={{ borderColor: 'var(--color-steel-border)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Batas Toleransi:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Bawah (-)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={toleranceMinus}
                  onChange={e => setToleranceMinus(Math.max(0, parseInt(e.target.value) || 0))}
                  className="rounded px-2 py-1 border text-xs font-bold text-center w-14"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                />
                <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>%</span>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Atas (+)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tolerancePlus}
                  onChange={e => setTolerancePlus(Math.max(0, parseInt(e.target.value) || 0))}
                  className="rounded px-2 py-1 border text-xs font-bold text-center w-14"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                />
                <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>%</span>
              </div>
            </div>
          </div>

          {/* Detailed Monthly Breakdown Table */}
          {referenceItem ? (
            <div className="tactile-card rounded-lg overflow-hidden flex flex-col flex-1">
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
                <div>
                  <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Rincian Deviasi</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Material: <b>{referenceItem.nomor_material} — {referenceItem.nama_material}</b> ({selectedWarehouse === 'SEMUA' ? 'Semua Gudang' : referenceItem.gudang_label})
                  </p>
                </div>
                <ExportButton data={detailedExportData as any} filename={`monthly_breakdown_${referenceItem.nomor_material}`} columns={detailedExportCols} />
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                <table className="w-full text-left border-collapse min-w-[650px] data-table">
                  <thead className="sticky top-0 z-10 shadow-sm">
                    <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                      {['Bulan', 'Target Rencana', 'Realisasi Aktual', 'Deviasi Qty', 'Deviasi Persentase', 'Status', 'Aksi'].map(h => (
                        <th key={h} className="px-3 py-2 text-[10px] font-black tracking-widest uppercase whitespace-nowrap first:text-left text-right last:text-center"
                          style={{ color: 'var(--color-on-primary-container)', backgroundColor: 'var(--color-primary-container)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyBreakdownData.map((row: {
                      bulan_label: string;
                      plan_qty: number;
                      actual_qty: number | null;
                      deviasi_qty: number | null;
                      deviasi_pct: number | null;
                      status: string;
                    }, i: number) => {
                      const isAnomaly = row.status === 'ANOMALI';
                      const nil = <span style={{ color: 'var(--color-on-surface-variant)', opacity: 0.35 }}>—</span>;
                      return (
                        <tr key={row.bulan_label} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                          <td className="px-3 py-2.5 font-bold text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.bulan_label}</td>
                          <td className="px-3 py-2.5 text-xs text-right whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{row.plan_qty} {referenceItem.satuan}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-medium whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>
                            {row.actual_qty !== null ? `${row.actual_qty} ${referenceItem.satuan}` : nil}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold whitespace-nowrap" style={{ color: row.deviasi_qty !== null ? (row.deviasi_qty > 0 ? 'var(--color-led-red)' : 'var(--color-led-green)') : 'inherit' }}>
                            {row.deviasi_qty !== null ? `${row.deviasi_qty > 0 ? '+' : ''}${row.deviasi_qty} ${referenceItem.satuan}` : nil}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold whitespace-nowrap" style={{ color: row.deviasi_pct !== null ? ((row.deviasi_pct > tolerancePlus || row.deviasi_pct < -toleranceMinus) ? 'var(--color-led-red)' : 'var(--color-led-green)') : 'inherit' }}>
                            {row.deviasi_pct !== null ? `${row.deviasi_pct > 0 ? '+' : ''}${row.deviasi_pct}%` : nil}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {row.actual_qty !== null ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                isAnomaly ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                              }`}>
                                {row.status === 'ANOMALI' ? 'ANOMALI' : 'DALAM TOLERANSI'}
                              </span>
                            ) : nil}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {row.actual_qty !== null && row.actual_qty > 0 ? (
                              <button
                                onClick={() => {
                                  const mItem = rangeMonths.find(rm => rm.label === row.bulan_label);
                                  if (mItem) handleOpenTxModal(mItem);
                                }}
                                className="px-2.5 py-1 rounded text-[10px] font-extrabold skeuomorphic-btn transition-all"
                              >
                                DETAIL
                              </button>
                            ) : nil}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
            </div>
          ) : (
            <div className="tactile-card rounded-lg p-6 text-center text-xs flex-1 flex items-center justify-center" style={{ color: 'var(--color-on-surface-variant)' }}>
              Silakan klik salah satu material pada tabel di sebelah kanan untuk memproyeksikan rincian deviasi bulanan.
            </div>
          )}
        </div>

        {/* Column 2: Search Input Panel + Overview Summary Table */}
        <div className="flex flex-col gap-4">
          {/* Search Filter Panel */}
          <div className="tactile-card rounded-lg p-4 flex items-center gap-4">
            <div className="flex items-center gap-2 rounded px-3 py-2 border flex-1"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Cari kode atau nama material..." value={searchText} onChange={e => setSearchText(e.target.value)}
                className="bg-transparent border-none text-sm flex-1 focus:outline-none" style={{ color: 'var(--color-on-surface)' }} />
            </div>
          </div>

          {/* Tabel Anomali (Daftar Analisis Deviasi) */}
          <div className="tactile-card rounded-lg overflow-hidden flex flex-col flex-1">
            <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Analisis Deviasi</h3>
              </div>
              <ExportButton data={mainExportData as any} filename="anomaly_stock_analysis" columns={exportCols} />
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
              <table className="w-full text-left border-collapse min-w-[900px] data-table">
                <thead className="sticky top-0 z-10 shadow-sm">
                  <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                    {['Kode Material','Deskripsi Material','Target (Rerata)','Aktual Rata-rata','Gap (Qty)','Deviasi','Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-[10px] font-black tracking-widest uppercase whitespace-nowrap first:text-left text-right last:text-center"
                        style={{ color: 'var(--color-on-primary-container)', backgroundColor: 'var(--color-primary-container)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, i) => {
                    const isAnomaly = row.status === 'ANOMALI';
                    return (
                      <tr
                        key={row.nomor_material}
                        onClick={() => setSelectedMaterial(row.nomor_material)}
                        className="cursor-pointer transition-colors"
                        style={{
                          backgroundColor: row.nomor_material === selectedMaterial
                            ? 'var(--color-surface-container-highest)'
                            : (i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)')
                        }}
                      >
                        <td className="px-3 py-2.5 font-bold text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap min-w-[200px]" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                        <td className="px-3 py-2.5 text-xs text-right whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{row.plan_bulanan} {row.satuan}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-medium whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.actual_monthly_avg} {row.satuan}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-bold whitespace-nowrap" style={{ color: row.deviasi_qty > 0 ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>
                          {row.deviasi_qty > 0 ? '+' : ''}{row.deviasi_qty}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right font-bold whitespace-nowrap" style={{ color: (row.deviasi_pct > tolerancePlus || row.deviasi_pct < -toleranceMinus) ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>
                          {row.deviasi_pct > 0 ? '+' : ''}{row.deviasi_pct}%
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            isAnomaly ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                          }`}>
                            {row.status === 'ANOMALI' ? 'ANOMALI' : 'DALAM TOLERANSI'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
          </div>
        </div>
      </div>
      {/* Modal Riwayat Transaksi */}
      {selectedTxMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="tactile-card rounded-lg overflow-hidden w-full max-w-4xl shadow-2xl flex flex-col animate-scale-up"
               style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
            
            {/* Modal Header */}
            <div className="p-4 border-b flex justify-between items-center" 
                 style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
               <div>
                <h3 className="font-extrabold text-lg" style={{ color: 'var(--color-on-surface)' }}>
                  Riwayat Transaksi Penyerapan
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Material: <b>{referenceItem?.nomor_material} — {referenceItem?.nama_material}</b> <br />
                  Periode: <b>{selectedTxMonth.label}</b> {selectedWarehouse !== 'SEMUA' ? `| Gudang: ${referenceItem?.gudang_label}` : ''}
                </p>
              </div>
              <button 
                onClick={() => setSelectedTxMonth(null)}
                className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
                style={{ color: 'var(--color-on-surface)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4">
              {/* Filter Tabs in Modal */}
              {!loadingTxModal && txModalData.length > 0 && (
                <div className="flex gap-2 border-b pb-3" style={{ borderColor: 'var(--color-steel-border)' }}>
                  {[
                    { key: 'SEMUA', label: `Semua (${txModalData.length})` },
                    { key: 'AMAN', label: `Aman (${txModalData.filter(d => d.status === 'AMAN').length})` },
                    { key: 'ANOMALI', label: `Anomali (${txModalData.filter(d => d.status === 'ANOMALI').length})` }
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setModalFilter(f.key as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        modalFilter === f.key
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'hover:bg-black/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {loadingTxModal ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-14 h-14 animate-pulse">
                    <img src="/logo.svg" alt="PRISMA Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-xs font-bold animate-pulse" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Memuat data...
                  </span>
                </div>
              ) : filteredTxData.length === 0 ? (
                <div className="text-center py-12 text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Tidak ada data transaksi penyerapan pada kategori ini.
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[380px] border rounded" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <table className="w-full text-left border-collapse data-table">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                        {['Tanggal', 'Nomor Order', 'Deskripsi Order', 'Qty', ...(selectedWarehouse === 'SEMUA' ? ['Gudang'] : []), 'Status'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-[10px] font-black tracking-widest uppercase whitespace-nowrap first:text-left text-right last:text-center"
                            style={{ color: 'var(--color-on-primary-container)', backgroundColor: 'var(--color-primary-container)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTxData.map((row, i) => {
                        const isAnomaly = row.status === 'ANOMALI';
                        return (
                          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                            <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.tanggal}</td>
                            <td className="px-3 py-2.5 text-xs font-mono font-bold whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{row.order_no}</td>
                            <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap min-w-[180px]" style={{ color: 'var(--color-on-surface)' }}>{row.description}</td>
                            <td className="px-3 py-2.5 text-xs text-right font-bold whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{row.qty} {referenceItem?.satuan}</td>
                            {selectedWarehouse === 'SEMUA' && (
                              <td className="px-3 py-2.5 text-xs text-center font-bold whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{row.gudang}</td>
                            )}
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <div className="relative group inline-block">
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap cursor-help ${
                                  isAnomaly ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'
                                }`}>
                                  {row.status}
                                </span>
                                {isAnomaly && row.statusReason && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover:block z-50 p-2 text-[10px] leading-relaxed rounded-lg border shadow-xl bg-slate-900 border-slate-700 text-white font-medium text-center">
                                    {row.statusReason}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container-high)' }}>
              <button 
                onClick={() => setSelectedTxMonth(null)}
                className="px-4 py-1.5 rounded text-xs font-extrabold skeuomorphic-btn transition-all"
              >
                TUTUP
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
