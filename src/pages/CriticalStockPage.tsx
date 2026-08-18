import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import PageWrapper from '../components/layout/PageWrapper';
import KpiCard from '../components/ui/KpiCard';
import StatusBadge from '../components/ui/StatusBadge';
import ExportButton from '../components/ui/ExportButton';
import ThresholdModal from '../components/ui/ThresholdModal';
import TableScrollWrapper from '../components/ui/TableScrollWrapper';
import { getThresholdConfig } from '../utils/thresholdSettings';
import { getCriticalStockData, getFleetMetrics, getRealSAPTrains, getMaintenanceSchedule, getProcurementData, subscribeToRealtimeChanges } from '../services/supabaseService';
import type { CriticalStockItem, FleetMetrics, MaintenanceSchedule, ProcurementItem } from '../types';
import { useAppStore } from '../store/useAppStore';

const getStatusPlanColor = (status: string) => {
  return 'var(--color-on-surface-variant)';
};

// Label 12 bulan terakhir relatif
function buildBulanLabels(): string[] {
  const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const labels: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${BULAN_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`);
  }
  return labels;
}
const bulanLabels = buildBulanLabels();

const depoOptions = ['Semua Depo', 'Gudang Depo Depok', 'Gudang Depo Bukit Duri', 'Gudang Depo Manggarai', 'Gudang Overhaul Manggarai', 'Gudang Depo Bogor'];

const exportCols = [
  { key: 'nomor_material', header: 'Kode Material' },
  { key: 'nama_material', header: 'Deskripsi Material' },
  { key: 'satuan', header: 'Satuan' },
  { key: 'current_stock', header: 'Stok Saat Ini' },
  { key: 'stok_ideal', header: 'Stok Ideal' },
  { key: 'safety_stock', header: 'Safety Stock' },
  { key: 'rop', header: 'ROP' },
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
const YEARS_OPTIONS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

function calculateDynamicMetrics(
  item: CriticalStockItem,
  rangeMonths: { year: number; month: number; label: string }[],
  endYear: number,
  endMonth: number,
  calcMode?: 'STANDAR' | 'RIWAYAT',
  runRateLookback?: number
) {
  // Kelompokkan history berdasarkan "tahun-bulan" untuk akses cepat O(1)
  const historyByMonth = new Map<string, typeof item.all_history>();
  item.all_history?.forEach(h => {
    if (!h.tanggal) return;
    const d = new Date(h.tanggal);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!historyByMonth.has(key)) {
      historyByMonth.set(key, []);
    }
    historyByMonth.get(key)!.push(h);
  });

  // Kelompokkan plans berdasarkan "tahun-bulan" untuk akses cepat O(1)
  const plansByMonth = new Map<string, number>();
  item.all_plans?.forEach(p => {
    plansByMonth.set(`${p.tahun}-${p.bulan}`, p.plan_qty);
  });

  const TODAY = new Date();
  const todayYear = TODAY.getFullYear();
  const todayMonth = TODAY.getMonth() + 1; // 1-based

  let runRateMultiplier = 1;
  if (calcMode === 'RIWAYAT' && runRateLookback) {
    let sumActualsForRate = 0;
    let sumPlansForRate = 0;
    
    const lookbackMonthsList: { year: number; month: number }[] = [];
    for (let i = 0; i < runRateLookback; i++) {
      const d = new Date(todayYear, (todayMonth - 1) - i, 1);
      lookbackMonthsList.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    lookbackMonthsList.forEach(m => {
      const hist = historyByMonth.get(`${m.year}-${m.month}`) || [];
      const sumQty = hist.reduce((sum, it) => sum + (it.qty || 0), 0);
      sumActualsForRate += sumQty;

      const planQty = plansByMonth.get(`${m.year}-${m.month}`) || 0;
      sumPlansForRate += planQty;
    });

    if (sumPlansForRate > 0) {
      runRateMultiplier = sumActualsForRate / sumPlansForRate;
    }
  }

  const plans = rangeMonths.map(m => {
    return plansByMonth.get(`${m.year}-${m.month}`) || 0;
  });

  const actuals = rangeMonths.map(m => {
    if (m.year > todayYear || (m.year === todayYear && m.month > todayMonth)) {
      return null;
    }
    const hist = historyByMonth.get(`${m.year}-${m.month}`) || [];
    return hist.reduce((sum, h) => sum + (h.qty || 0), 0);
  });

  // Calculate starting stock at the beginning of the range
  const actualsBeforeToday = rangeMonths.map((m, idx) => {
    if (m.year < todayYear || (m.year === todayYear && m.month <= todayMonth)) {
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
  const projectExhaustion = (remainingStock: number, lastMonth: { year: number; month: number }, isCorrectedMode: boolean = false) => {
    const mult = isCorrectedMode ? (runRateMultiplier || 1) : 1;
    const sumP = plans.filter(p => p > 0).reduce((s, p) => s + p, 0);
    const countP = plans.filter(p => p > 0).length;
    let avgConsumption = countP > 0 ? (sumP / countP) * mult : (item.plan_bulanan || item.cr_actual || 0) * mult;
    if (avgConsumption <= 0) {
      avgConsumption = item.current_stock > 0 ? item.current_stock / 12 : 10;
    }
    if (avgConsumption <= 0 || remainingStock <= 0 || !isFinite(avgConsumption)) {
      return '-';
    }
    const remainingMonths = Math.ceil(remainingStock / avgConsumption);
    if (!isFinite(remainingMonths) || isNaN(remainingMonths)) {
      return '-';
    }
    const targetDate = new Date(lastMonth.year, lastMonth.month - 1 + remainingMonths, 1);
    if (isNaN(targetDate.getTime())) {
      return '-';
    }
    const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    return `${BULAN_NAMES[targetDate.getMonth()]} '${String(targetDate.getFullYear()).slice(2)}`;
  };

  const lastM = rangeMonths[rangeMonths.length - 1];

  // 1. Kelompokkan & jumlahkan seluruh riwayat GR per bulan agar kuantitas per bulan utuh (misal total Juli 2026 = 6.000)
  const monthNamesGR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  const grByMonthMap = new Map<string, { year: number; month: number; label: string; qty: number }>();
  
  if (item.gr_history && item.gr_history.length > 0) {
    item.gr_history.forEach(gr => {
      if (!gr.tanggal || !gr.qty) return;
      const d = new Date(gr.tanggal);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${m}`;
      const label = `${monthNamesGR[m - 1]} '${String(y).slice(2)}`;
      if (!grByMonthMap.has(key)) {
        grByMonthMap.set(key, { year: y, month: m, label, qty: 0 });
      }
      grByMonthMap.get(key)!.qty += Math.abs(Number(gr.qty) || 0);
    });
  }

  // Cari bulan GR terakhir berdasarkan urutan waktu
  const sortedGRMonths = Array.from(grByMonthMap.values())
    .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
  
  const lastGRMonth = sortedGRMonths.length > 0 ? sortedGRMonths[0] : null;

  // 1a. Find Plan Exhaustion WITHOUT PO (Berdasarkan Riwayat GR Terakhir dikurangi Plan Bulanan)
  let planStockNoPO = 0;
  let planExhaustionIndexNoPO = 99;
  let planExhaustionLabelNoPO = '-';

  if (lastGRMonth) {
    const grIdx = rangeMonths.findIndex(m => m.year === lastGRMonth.year && m.month === lastGRMonth.month);
    
    if (grIdx >= 0) {
      planStockNoPO = lastGRMonth.qty;
      for (let i = grIdx; i < rangeMonths.length; i++) {
        planStockNoPO -= plans[i];
        if (planStockNoPO <= 0) {
          planExhaustionIndexNoPO = i;
          planExhaustionLabelNoPO = rangeMonths[i].label;
          break;
        }
      }
    } else {
      const firstRangeDate = new Date(rangeMonths[0].year, rangeMonths[0].month - 1, 1);
      const grDate = new Date(lastGRMonth.year, lastGRMonth.month - 1, 1);
      if (grDate < firstRangeDate) {
        let carryStock = lastGRMonth.qty;
        let curY = lastGRMonth.year;
        let curM = lastGRMonth.month;
        while (curY < rangeMonths[0].year || (curY === rangeMonths[0].year && curM < rangeMonths[0].month)) {
          const p = plansByMonth.get(`${curY}-${curM}`) || 0;
          carryStock -= p;
          curM++;
          if (curM > 12) {
            curM = 1;
            curY++;
          }
        }
        planStockNoPO = carryStock;
        for (let i = 0; i < rangeMonths.length; i++) {
          planStockNoPO -= plans[i];
          if (planStockNoPO <= 0) {
            planExhaustionIndexNoPO = i;
            planExhaustionLabelNoPO = rangeMonths[i].label;
            break;
          }
        }
      } else {
        planStockNoPO = lastGRMonth.qty;
      }
    }
  } else {
    planStockNoPO = initialStock;
    for (let i = 0; i < rangeMonths.length; i++) {
      planStockNoPO -= plans[i];
      if (planStockNoPO <= 0) {
        planExhaustionIndexNoPO = i;
        planExhaustionLabelNoPO = rangeMonths[i].label;
        break;
      }
    }
  }

  if (planExhaustionIndexNoPO === 99 && planStockNoPO > 0) {
    planExhaustionLabelNoPO = projectExhaustion(planStockNoPO, lastM, false);
  }

  // 1b. Find Plan Exhaustion WITH PO (Berdasarkan Riwayat GR Terakhir + Kedatangan PO berikutnya)
  let planStockWithPO = 0;
  let planExhaustionIndexWithPO = 99;
  let planExhaustionLabelWithPO = '-';

  if (lastGRMonth) {
    const grIdx = rangeMonths.findIndex(m => m.year === lastGRMonth.year && m.month === lastGRMonth.month);
    
    if (grIdx >= 0) {
      planStockWithPO = lastGRMonth.qty;
      for (let i = grIdx; i < rangeMonths.length; i++) {
        const m = rangeMonths[i];
        if (item.active_pos && item.active_pos.length > 0) {
          item.active_pos.forEach(po => {
            if (po.tanggal_rencana_pengiriman) {
              const d = new Date(po.tanggal_rencana_pengiriman);
              const isFuturePO = d.getFullYear() > todayYear || (d.getFullYear() === todayYear && (d.getMonth() + 1) >= todayMonth);
              if (isFuturePO && d.getFullYear() === m.year && (d.getMonth() + 1) === m.month) {
                planStockWithPO += po.jumlah_dipesan;
              }
            }
          });
        } else if (m.year === poYear && m.month === poMonth) {
          const isFuturePO = poYear > todayYear || (poYear === todayYear && poMonth >= todayMonth);
          if (isFuturePO) planStockWithPO += (item.jumlah_dipesan || 0);
        }

        planStockWithPO -= plans[i];
        if (planStockWithPO <= 0) {
          planExhaustionIndexWithPO = i;
          planExhaustionLabelWithPO = rangeMonths[i].label;
          break;
        }
      }
    } else {
      const firstRangeDate = new Date(rangeMonths[0].year, rangeMonths[0].month - 1, 1);
      const grDate = new Date(lastGRMonth.year, lastGRMonth.month - 1, 1);
      if (grDate < firstRangeDate) {
        let carryStock = lastGRMonth.qty;
        let curY = lastGRMonth.year;
        let curM = lastGRMonth.month;
        while (curY < rangeMonths[0].year || (curY === rangeMonths[0].year && curM < rangeMonths[0].month)) {
          const p = plansByMonth.get(`${curY}-${curM}`) || 0;
          carryStock -= p;
          curM++;
          if (curM > 12) {
            curM = 1;
            curY++;
          }
        }
        planStockWithPO = carryStock;
        for (let i = 0; i < rangeMonths.length; i++) {
          const m = rangeMonths[i];
          if (item.active_pos && item.active_pos.length > 0) {
            item.active_pos.forEach(po => {
              if (po.tanggal_rencana_pengiriman) {
                const d = new Date(po.tanggal_rencana_pengiriman);
                const isFuturePO = d.getFullYear() > todayYear || (d.getFullYear() === todayYear && (d.getMonth() + 1) >= todayMonth);
                if (isFuturePO && d.getFullYear() === m.year && (d.getMonth() + 1) === m.month) {
                  planStockWithPO += po.jumlah_dipesan;
                }
              }
            });
          } else if (m.year === poYear && m.month === poMonth) {
            const isFuturePO = poYear > todayYear || (poYear === todayYear && poMonth >= todayMonth);
            if (isFuturePO) planStockWithPO += (item.jumlah_dipesan || 0);
          }

          planStockWithPO -= plans[i];
          if (planStockWithPO <= 0) {
            planExhaustionIndexWithPO = i;
            planExhaustionLabelWithPO = rangeMonths[i].label;
            break;
          }
        }
      } else {
        planStockWithPO = lastGRMonth.qty;
      }
    }
  } else {
    planStockWithPO = initialStock;
    for (let i = 0; i < rangeMonths.length; i++) {
      const m = rangeMonths[i];
      if (item.active_pos && item.active_pos.length > 0) {
        item.active_pos.forEach(po => {
          if (po.tanggal_rencana_pengiriman) {
            const d = new Date(po.tanggal_rencana_pengiriman);
            const isFuturePO = d.getFullYear() > todayYear || (d.getFullYear() === todayYear && (d.getMonth() + 1) >= todayMonth);
            if (isFuturePO && d.getFullYear() === m.year && (d.getMonth() + 1) === m.month) {
              planStockWithPO += po.jumlah_dipesan;
            }
          }
        });
      } else if (m.year === poYear && m.month === poMonth) {
        const isFuturePO = poYear > todayYear || (poYear === todayYear && poMonth >= todayMonth);
        if (isFuturePO) planStockWithPO += (item.jumlah_dipesan || 0);
      }

      planStockWithPO -= plans[i];
      if (planStockWithPO <= 0) {
        planExhaustionIndexWithPO = i;
        planExhaustionLabelWithPO = rangeMonths[i].label;
        break;
      }
    }
  }

  if (planExhaustionIndexWithPO === 99 && planStockWithPO > 0) {
    planExhaustionLabelWithPO = projectExhaustion(planStockWithPO, lastM, false);
  }

  const planExhaustionIndex = planExhaustionIndexNoPO;
  const planExhaustionLabel = planExhaustionLabelNoPO;

  // 2. Find Corrected Plan Exhaustion WITHOUT PO
  let correctedStockNoPO = initialStock;
  let correctedExhaustionIndexNoPO = 99;
  let correctedExhaustionLabelNoPO = '-';

  for (let i = 0; i < rangeMonths.length; i++) {
    const m = rangeMonths[i];
    // Bulan lalu dikurangi realisasi aktual
    if (m.year < todayYear || (m.year === todayYear && m.month < todayMonth)) {
      correctedStockNoPO -= (actuals[i] ?? 0);
    } else if (m.year === todayYear && m.month === todayMonth) {
      const actVal = actuals[i] ?? 0;
      const adjustedPlan = Math.round(plans[i] * runRateMultiplier);
      if (actVal > 0) {
        correctedStockNoPO -= actVal;
      } else if (correctedStockNoPO > 0) {
        correctedStockNoPO -= Math.min(correctedStockNoPO, adjustedPlan);
      }
    } else {
      // Bulan masa depan dikurangi rencana terkoreksi
      correctedStockNoPO -= Math.round(plans[i] * runRateMultiplier);
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
    if (item.active_pos && item.active_pos.length > 0) {
      item.active_pos.forEach(po => {
        if (po.tanggal_rencana_pengiriman) {
          const d = new Date(po.tanggal_rencana_pengiriman);
          const isFuturePO = d.getFullYear() > todayYear || (d.getFullYear() === todayYear && (d.getMonth() + 1) >= todayMonth);
          if (isFuturePO && d.getFullYear() === m.year && (d.getMonth() + 1) === m.month) {
            correctedStockWithPO += po.jumlah_dipesan;
          }
        }
      });
    } else if (m.year === poYear && m.month === poMonth) {
      const isFuturePO = poYear > todayYear || (poYear === todayYear && poMonth >= todayMonth);
      if (isFuturePO) correctedStockWithPO += (item.jumlah_dipesan || 0);
    }
    // Bulan lalu dikurangi realisasi aktual
    if (m.year < todayYear || (m.year === todayYear && m.month < todayMonth)) {
      correctedStockWithPO -= (actuals[i] ?? 0);
    } else if (m.year === todayYear && m.month === todayMonth) {
      const actVal = actuals[i] ?? 0;
      const adjustedPlan = Math.round(plans[i] * runRateMultiplier);
      if (actVal > 0) {
        correctedStockWithPO -= actVal;
      } else if (correctedStockWithPO > 0) {
        correctedStockWithPO -= Math.min(correctedStockWithPO, adjustedPlan);
      }
    } else {
      // Bulan masa depan dikurangi rencana terkoreksi
      correctedStockWithPO -= Math.round(plans[i] * runRateMultiplier);
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

  // 6. Calculate Gap to PO (Hanya membandingkan terhadap PO Masa Depan yang Aktif >= Hari Ini)
  let gapToPO: number | null = null;
  let activeFuturePO: Date | null = null;

  if (item.active_pos && item.active_pos.length > 0) {
    const todayDate = new Date(todayYear, todayMonth - 1, 1);
    const futurePOs = item.active_pos
      .filter(p => p.tanggal_rencana_pengiriman && new Date(p.tanggal_rencana_pengiriman) >= todayDate)
      .sort((a, b) => new Date(a.tanggal_rencana_pengiriman!).getTime() - new Date(b.tanggal_rencana_pengiriman!).getTime());
    if (futurePOs.length > 0) {
      activeFuturePO = new Date(futurePOs[0].tanggal_rencana_pengiriman!);
    }
  } else if (item.tanggal_rencana_pengiriman) {
    const d = new Date(item.tanggal_rencana_pengiriman);
    if (d.getFullYear() > todayYear || (d.getFullYear() === todayYear && (d.getMonth() + 1) >= todayMonth)) {
      activeFuturePO = d;
    }
  }

  if (activeFuturePO) {
    let rawExhaustDate = new Date(todayYear, todayMonth - 1, 1);
    if (correctedExhaustionLabelNoPO && correctedExhaustionLabelNoPO !== '-') {
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
    gapToPO = (rawExhaustDate.getFullYear() - activeFuturePO.getFullYear()) * 12 + (rawExhaustDate.getMonth() - activeFuturePO.getMonth());
  }

  // 7. Calculate Status PO (Mitigation / Availability status based on gapToPO)
  let statusPO: 'AMAN' | 'WASPADA' | 'KRITIS' | 'BELUM PO' = 'BELUM PO';
  if (!activeFuturePO) {
    statusPO = 'BELUM PO';
  } else if (gapToPO !== null) {
    if (gapToPO <= 2) {
      statusPO = 'KRITIS'; // Alert High (<= +2 bulan dan semua nilai minus)
    } else if (gapToPO === 3) {
      statusPO = 'WASPADA'; // Alert Med (+3 bulan)
    } else {
      statusPO = 'AMAN'; // Alert Low (>= +4 bulan)
    }
  }



  return {
    planExhaustionLabel,
    planExhaustionLabelNoPO,
    planExhaustionLabelWithPO,
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

  const { criticalStockData, isDataLoaded, setCriticalStockData, setIsDataLoaded } = useAppStore();
  const [criticalData, setCriticalData] = useState<CriticalStockItem[]>(criticalStockData);
  const [metrics, setMetrics] = useState<FleetMetrics | null>(null);
  const [procurements, setProcurements] = useState<ProcurementItem[]>([]);
  const [loading, setLoading] = useState(!isDataLoaded);
  const [filterDepo, setFilterDepo] = useState('Semua Depo');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [searchText, setSearchText] = useState(materialParam || '');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(materialParam);
  const [showChartWithPO, setShowChartWithPO] = useState(true);
  const [calcMode, setCalcMode] = useState<'STANDAR' | 'RIWAYAT'>('RIWAYAT');
  const [isChartFullScreen, setIsChartFullScreen] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const [showCalculationHelp, setShowCalculationHelp] = useState(false);
  const [runRateLookback, setRunRateLookback] = useState<number>(12);
  const [chartViewMode, setChartViewMode] = useState<'KONSUMSI' | 'SALDO'>('KONSUMSI');
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [thresholdConfig, setThresholdConfig] = useState(() => getThresholdConfig());
  const [kpiPerspective, setKpiPerspective] = useState<'GAP' | 'FISIK'>('GAP');
  const [showLineMenu, setShowLineMenu] = useState(false);
  const [visibleLines, setVisibleLines] = useState({
    plan: true,
    actual: true,
    corrected: true,
    correctedNonSaldo: true,
    safetyStock: true,
    rop: true,
    breach: true,
    gr: true,
    today: true,
  });

  const toggleLineVisibility = (key: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [totalTrains, setTotalTrains] = useState(0);
  const [inMaintenanceCount, setInMaintenanceCount] = useState(0);

  // Period filter states
  const currentToday = new Date();
  const currentYear = currentToday.getFullYear();
  const currentTodayYear = currentToday.getFullYear();
  const currentTodayMonth = currentToday.getMonth() + 1;
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

  useEffect(() => {
    const unsub = subscribeToRealtimeChanges('global_thresholds', () => {
      setThresholdConfig(getThresholdConfig());
    });
    return () => unsub();
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
      if (isDataLoaded && criticalStockData.length > 0) {
        // Jika data utama sudah ada di cache, set state secara instan
        setCriticalData(criticalStockData);
        setLoading(false);
        
        // Tetap fetch metrik pendukung di background secara silent
        try {
          const [fMetrics, trainData, schedData, pData] = await Promise.all([
            getFleetMetrics(),
            getRealSAPTrains(),
            getMaintenanceSchedule(),
            getProcurementData()
          ]);
          setMetrics(fMetrics);
          setTotalTrains(trainData.length);
          setInMaintenanceCount(schedData.filter(s => s.status_pelaksanaan === 'Proses Perawatan' || s.status_pelaksanaan === 'Sedang Dirawat').length);
          setProcurements(pData);
        } catch (e) {
          console.error('Error background loading:', e);
        }
        return;
      }

      try {
        setLoading(true);
        const [cData, fMetrics, trainData, schedData, pData] = await Promise.all([
          getCriticalStockData(),
          getFleetMetrics(),
          getRealSAPTrains(),
          getMaintenanceSchedule(),
          getProcurementData()
        ]);
        setCriticalData(cData);
        setCriticalStockData(cData); // Simpan ke Zustand Cache
        setIsDataLoaded(true);
        setMetrics(fMetrics);
        setTotalTrains(trainData.length);
        setInMaintenanceCount(schedData.filter(s => s.status_pelaksanaan === 'Proses Perawatan' || s.status_pelaksanaan === 'Sedang Dirawat').length);
        setProcurements(pData);
      } catch (err) {
        console.error('Error loading critical stock data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isDataLoaded]);

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
      if (months.length > 120) break;
    }
    return months;
  })();

  // Range absolut (Jan 2026 s/d Des 2028) khusus untuk tabel & KPI agar datanya statis tidak terpengaruh filter layar
  const absoluteRangeMonths = (() => {
    const months: { year: number; month: number; label: string }[] = [];
    const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    let curYear = currentTodayYear;
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

  const isRangeInvalid = rangeMonths.length === 0 || (startYear * 12 + startMonth > endYear * 12 + endMonth);

  const aggregatedData = (() => {
    const rawFiltered = filterDepo !== 'Semua Depo'
      ? criticalData.filter(row => row.gudang_label === filterDepo)
      : criticalData.filter(row => row.gudang !== 'C013' && row.gudang_label !== 'Gudang Pusat');

    const groups: Record<string, CriticalStockItem> = {};
    rawFiltered.forEach(row => {
      if (!groups[row.nomor_material]) {
        groups[row.nomor_material] = {
          ...row,
          gudang_label: filterDepo,
          current_stock: 0,
          cr_actual: 0,
          plan_bulanan: 0,
          safety_stock: 0,
          rop: 0,
          all_history: [],
          all_plans: [],
          gr_history: []
        };
      }
      groups[row.nomor_material].current_stock += row.current_stock;
      groups[row.nomor_material].cr_actual += (row.cr_actual || 0);
      groups[row.nomor_material].plan_bulanan += (row.plan_bulanan || 0);
      groups[row.nomor_material].safety_stock = (groups[row.nomor_material].safety_stock || 0) + (row.safety_stock || 0);
      groups[row.nomor_material].rop = (groups[row.nomor_material].rop || 0) + (row.rop || 0);
      
      if (row.all_history && Array.isArray(row.all_history)) {
        groups[row.nomor_material].all_history!.push(...row.all_history);
      }
      
      if (row.gr_history && Array.isArray(row.gr_history)) {
        groups[row.nomor_material].gr_history!.push(...row.gr_history);
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
      const TODAY_AGG = new Date();
      const todayYearAgg = TODAY_AGG.getFullYear();
      const todayMonthAgg = TODAY_AGG.getMonth() + 1;
      const cutoff = new Date(todayYearAgg, (todayMonthAgg - 1) - runRateLookback, 1);
      const filteredHistory = item.all_history?.filter(h => {
        if (!h.tanggal) return false;
        const d = new Date(h.tanggal);
        return d >= cutoff && d <= TODAY_AGG;
      }) || [];
      const totalQty = filteredHistory.reduce((sum, h) => sum + (h.qty || 0), 0);
      const dynamicCrActual = totalQty > 0 ? Math.round((totalQty / runRateLookback) * 10) / 10 : 0;
      
      // Lead time: diambil dari database (dalam bulan). Default 1 jika tidak tersedia.
      // plan_lead_time di DB dalam hari, sudah dikonversi ke bulan di supabaseService
      const lead_time = (item.lead_time && item.lead_time > 0) ? item.lead_time : 1.0;
      const manualSS = item.safety_stock_manual;
      const ssDays = item.safety_stock_days && item.safety_stock_days > 0 ? item.safety_stock_days : 30;
      const ssMonths = ssDays / 30;
      const isManualMode = !item.use_formula;
      const safety_stock = (isManualMode && manualSS && manualSS > 0)
        ? manualSS
        : Math.round(dynamicCrActual * ssMonths);
      const rop = Math.round((dynamicCrActual * lead_time) + safety_stock);

      // Override values dynamically so the rest of the application uses the selected lookback
      item.cr_actual = dynamicCrActual;
      item.safety_stock = safety_stock;
      item.rop = rop;

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
      const { planExhaustionLabel } = calculateDynamicMetrics(item, rangeMonths, endYear, endMonth, calcMode, runRateLookback);

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
      } = calculateDynamicMetrics(item, absoluteRangeMonths, 2028, 12, calcMode, runRateLookback);

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

  const getFisikStatus = (d: CriticalStockItem): 'KRITIS' | 'WASPADA' | 'AMAN' => {
    const sPo = (d as any).status_po;
    if (sPo === 'BELUM PO') return 'KRITIS';

    const ssMo = thresholdConfig.safetyStockMonths ?? 1.0;
    const ropMo = thresholdConfig.ropMonths ?? 2.0;

    const ss = d.safety_stock_manual || (d.plan_bulanan > 0 ? Math.round(d.plan_bulanan * ssMo) : (d.safety_stock ?? 0));
    const rop = d.plan_bulanan > 0 ? Math.round(d.plan_bulanan * ropMo) : (d.rop ?? 0);

    if (d.current_stock <= ss) return 'KRITIS';
    if (d.current_stock <= rop) return 'WASPADA';
    return 'AMAN';
  };

  const getGapStatus = (d: CriticalStockItem): 'KRITIS' | 'WASPADA' | 'AMAN' => {
    const sPo = (d as any).status_po;
    if (sPo === 'BELUM PO') return 'KRITIS';

    const gapVal = typeof (d as any).gap_to_po === 'number' ? (d as any).gap_to_po : (typeof (d as any).gap_defisit === 'number' ? (d as any).gap_defisit : 0);

    if (gapVal <= thresholdConfig.limitKritis) return 'KRITIS'; // Alert High (<= 2 bulan, termasuk nilai minus)
    if (gapVal <= thresholdConfig.limitWaspada) return 'WASPADA'; // Alert Med (3 bulan)
    return 'AMAN'; // Alert Low (>= 4 bulan)
  };

  const getMaterialItemStatus = (d: CriticalStockItem): 'KRITIS' | 'WASPADA' | 'AMAN' => {
    return kpiPerspective === 'FISIK' ? getFisikStatus(d) : getGapStatus(d);
  };

  const filteredData: CriticalStockItem[] = aggregatedData.filter(row => {
    const itemStatus = getMaterialItemStatus(row);
    const isBelumPo = (row as any).status_po === 'BELUM PO';
    let matchStatus = true;
    if (filterStatus.length > 0) {
      matchStatus = filterStatus.some(s => {
        if (s === 'BELUM PO') return isBelumPo;
        return itemStatus === s;
      });
    }
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

  // Ambil PO masa depan yang aktif (>= Hari Ini)
  const activeFuturePOItem = (() => {
    if (!referenceItem) return null;
    const todayDate = new Date(currentTodayYear, currentTodayMonth - 1, 1);
    if (referenceItem.active_pos && referenceItem.active_pos.length > 0) {
      const futureList = referenceItem.active_pos
        .filter(p => p.tanggal_rencana_pengiriman && new Date(p.tanggal_rencana_pengiriman) >= todayDate)
        .sort((a, b) => new Date(a.tanggal_rencana_pengiriman!).getTime() - new Date(b.tanggal_rencana_pengiriman!).getTime());
      if (futureList.length > 0) return futureList[0];
    } else if (referenceItem.tanggal_rencana_pengiriman) {
      const d = new Date(referenceItem.tanggal_rencana_pengiriman);
      if (d.getFullYear() > currentTodayYear || (d.getFullYear() === currentTodayYear && (d.getMonth() + 1) >= currentTodayMonth)) {
        return {
          po_number: (referenceItem as any).po_number || null,
          jumlah_dipesan: referenceItem.jumlah_dipesan,
          tanggal_rencana_pengiriman: referenceItem.tanggal_rencana_pengiriman
        };
      }
    }
    return null;
  })();

  const chartData = (() => {
    if (isRangeInvalid || !referenceItem) {
      return { labels: [], plans: [], actuals: [], corrected: [], correctedNonSaldo: [], poIdx: -1, ropExhaustIdx: -1 };
    }

    if (chartViewMode === 'SALDO') {
      const labels = rangeMonths.map(m => m.label);

      let runRateMultiplier = 1;
      if (calcMode === 'RIWAYAT') {
        let sumActualsForRate = 0;
        let sumPlansForRate = 0;
        const lookbackMonthsList: { year: number; month: number }[] = [];
        for (let i = 0; i < runRateLookback; i++) {
          const d = new Date(currentTodayYear, (currentTodayMonth - 1) - i, 1);
          lookbackMonthsList.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
        }
        lookbackMonthsList.forEach(m => {
          const hist = referenceItem.all_history?.filter(h => {
            if (!h.tanggal) return false;
            const dateObj = new Date(h.tanggal);
            return dateObj.getFullYear() === m.year && (dateObj.getMonth() + 1) === m.month;
          }) || [];
          sumActualsForRate += hist.reduce((sum, item) => sum + (item.qty || 0), 0);

          const p = referenceItem.all_plans?.find(pl => pl.tahun === m.year && pl.bulan === m.month);
          sumPlansForRate += (p ? p.plan_qty : 0);
        });
        if (sumPlansForRate > 0) {
          runRateMultiplier = sumActualsForRate / sumPlansForRate;
        }
      }

      let poYear = 0;
      let poMonth = 0;
      if (activeFuturePOItem?.tanggal_rencana_pengiriman) {
        const d = new Date(activeFuturePOItem.tanggal_rencana_pengiriman);
        poYear = d.getFullYear();
        poMonth = d.getMonth() + 1;
      }
      const poQty = activeFuturePOItem?.jumlah_dipesan || 0;

      // Simulasi proyeksi saldo berkesinambungan dari hari ini (Juli 2026) hingga akhir rentang filter
      const lastMonth = rangeMonths[rangeMonths.length - 1];
      const startSimYear = rangeMonths[0].year;
      const startSimMonth = rangeMonths[0].month;

      const simMonths: { year: number; month: number; key: string }[] = [];
      let curY = startSimYear;
      let curM = startSimMonth;
      while (curY < lastMonth.year || (curY === lastMonth.year && curM <= lastMonth.month)) {
        simMonths.push({ year: curY, month: curM, key: `${curY}-${curM}` });
        curM++;
        if (curM > 12) {
          curM = 1;
          curY++;
        }
      }

      const simPlansBal = new Map<string, number>();
      const simCorrBal = new Map<string, number>();

      const todayIdx = simMonths.findIndex(sm => sm.year === currentTodayYear && sm.month === currentTodayMonth);

      if (todayIdx >= 0) {
        simPlansBal.set(simMonths[todayIdx].key, referenceItem.current_stock);
        simCorrBal.set(simMonths[todayIdx].key, referenceItem.current_stock);

        // Pas Lalu (Backward Pass dari Hari Ini ke Jan '26)
        let bPlan = referenceItem.current_stock;
        let bCorr = referenceItem.current_stock;
        for (let i = todayIdx - 1; i >= 0; i--) {
          const sm = simMonths[i];
          const hist = referenceItem.all_history?.filter(h => {
            if (!h.tanggal) return false;
            const d = new Date(h.tanggal);
            return d.getFullYear() === sm.year && (d.getMonth() + 1) === sm.month;
          }) || [];
          const actVal = hist.reduce((sum, item) => sum + (item.qty || 0), 0);
          bPlan += actVal;
          bCorr += actVal;
          simPlansBal.set(sm.key, Math.round(bPlan));
          simCorrBal.set(sm.key, Math.round(bCorr));
        }

        // Pas Masa Depan (Forward Pass dari Hari Ini ke Des '27)
        let fPlan = referenceItem.current_stock;
        let fCorr = referenceItem.current_stock;
        for (let i = todayIdx + 1; i < simMonths.length; i++) {
          const sm = simMonths[i];
          const p = referenceItem.all_plans?.find(pl => pl.tahun === sm.year && pl.bulan === sm.month);
          const pQty = p ? p.plan_qty : 0;
          const adjustedPlan = Math.round(pQty * runRateMultiplier);

          let poQtyToAdd = 0;
          if (showChartWithPO) {
            if (referenceItem.active_pos && referenceItem.active_pos.length > 0) {
              referenceItem.active_pos.forEach(po => {
                if (po.tanggal_rencana_pengiriman) {
                  const d = new Date(po.tanggal_rencana_pengiriman);
                  const isFuturePO = d.getFullYear() > currentTodayYear || (d.getFullYear() === currentTodayYear && (d.getMonth() + 1) >= currentTodayMonth);
                  if (isFuturePO && d.getFullYear() === sm.year && (d.getMonth() + 1) === sm.month) {
                    poQtyToAdd += po.jumlah_dipesan;
                  }
                }
              });
            } else if (sm.year === poYear && sm.month === poMonth) {
              const isFuturePO = poYear > currentTodayYear || (poYear === currentTodayYear && poMonth >= currentTodayMonth);
              if (isFuturePO) poQtyToAdd = poQty;
            }
          }

          // Tambahkan stok GR baru terlebih dahulu agar lompatan kedatangan barang terlihat jelas pada kurva saldo
          fPlan = Math.max(0, fPlan + poQtyToAdd);
          fCorr = Math.max(0, fCorr + poQtyToAdd);

          simPlansBal.set(sm.key, Math.round(fPlan));
          simCorrBal.set(sm.key, Math.round(fCorr));

          // Setelah dicatat titik puncak kedatangan GR, kurangi pemakaian konsumsi bulan tersebut untuk titik berikutnya
          fPlan = Math.max(0, fPlan - pQty);
          fCorr = Math.max(0, fCorr - adjustedPlan);
        }
      }

      const plansBalance = rangeMonths.map(m => {
        const k = `${m.year}-${m.month}`;
        return simPlansBal.has(k) ? simPlansBal.get(k)! : null;
      });

      const correctedBalance = rangeMonths.map(m => {
        const k = `${m.year}-${m.month}`;
        return simCorrBal.has(k) ? simCorrBal.get(k)! : null;
      });

      const actualsBalance = rangeMonths.map(m => {
        const k = `${m.year}-${m.month}`;
        if (m.year === currentTodayYear && m.month === currentTodayMonth) {
          return referenceItem.current_stock;
        }
        return null;
      });

      let poIdx = rangeMonths.findIndex(m => m.year === poYear && m.month === poMonth);
      let ropExhaustIdx = -1;
      const ssVal = referenceItem.safety_stock ?? 0;
      const leadTimeMonths = Math.round(referenceItem.lead_time ?? 2);

      for (let i = 0; i < rangeMonths.length; i++) {
        const val = correctedBalance[i];
        if (val !== null && val <= ssVal) {
          ropExhaustIdx = Math.max(0, i - leadTimeMonths);
          break;
        }
      }

      return {
        labels,
        plans: plansBalance,
        actuals: actualsBalance,
        corrected: correctedBalance,
        correctedNonSaldo: [],
        poIdx,
        ropExhaustIdx
      };
    }

    const labels = rangeMonths.map(m => m.label);
    
    // 1. Rencana Awal: lookup in all_plans
    const plans = rangeMonths.map(m => {
      const p = referenceItem.all_plans?.find(p => p.tahun === m.year && p.bulan === m.month);
      return p ? p.plan_qty : 0;
    });

    // 2. Realisasi Aktual: lookup in all_history (sum qty for that month/year)
    const actuals = rangeMonths.map(m => {
      // Future month (after current month)
      if (m.year > currentTodayYear || (m.year === currentTodayYear && m.month > currentTodayMonth)) {
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
      if (m.year < currentTodayYear || (m.year === currentTodayYear && m.month <= currentTodayMonth)) {
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
        const d = new Date(currentTodayYear, (currentTodayMonth - 1) - i, 1);
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
      // Jika opsi Dengan PO aktif, tambahkan kuantiti PO masa depan pada bulan kedatangannya
      if (showChartWithPO) {
        if (referenceItem.active_pos && referenceItem.active_pos.length > 0) {
          referenceItem.active_pos.forEach(po => {
            if (po.tanggal_rencana_pengiriman) {
              const d = new Date(po.tanggal_rencana_pengiriman);
              const isFuturePO = d.getFullYear() > currentTodayYear || (d.getFullYear() === currentTodayYear && (d.getMonth() + 1) >= currentTodayMonth);
              if (isFuturePO && d.getFullYear() === m.year && (d.getMonth() + 1) === m.month) {
                remainingStock += po.jumlah_dipesan;
              }
            }
          });
        } else if (m.year === poYear && m.month === poMonth) {
          const isFuturePO = poYear > currentTodayYear || (poYear === currentTodayYear && poMonth >= currentTodayMonth);
          if (isFuturePO) remainingStock += (referenceItem.jumlah_dipesan || 0);
        }
      }

      // Past month (< Hari Ini)
      if (m.year < currentTodayYear || (m.year === currentTodayYear && m.month < currentTodayMonth)) {
        const actVal = actuals[idx] ?? 0;
        remainingStock -= actVal;
        corrected.push(null);
        correctedNonSaldo.push(null);
      } else if (m.year === currentTodayYear && m.month === currentTodayMonth) {
        // Current month (Hari Ini): titik sambung mulus yang taat pada sisa saldo fisik
        const actVal = actuals[idx] ?? 0;
        const adjustedPlan = Math.round(plans[idx] * runRateMultiplier);
        
        let startVal = 0;
        if (actVal > 0) {
          startVal = actVal;
          remainingStock -= actVal;
        } else if (remainingStock <= 0) {
          startVal = 0;
        } else if (remainingStock < adjustedPlan) {
          startVal = remainingStock;
          remainingStock = 0;
        } else {
          startVal = adjustedPlan;
          remainingStock -= adjustedPlan;
        }
        
        corrected.push(startVal);
        correctedNonSaldo.push(calcMode === 'RIWAYAT' ? (actVal > 0 ? actVal : adjustedPlan) : null);
      } else {
        // Future month (> Hari Ini)
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

    // Cari index kedatangan PO masa depan di rangeMonths
    let poIdx = -1;
    if (activeFuturePOItem?.tanggal_rencana_pengiriman) {
      poIdx = rangeMonths.findIndex(m => m.year === poYear && m.month === poMonth);
    }

    return { labels, plans, actuals, corrected, correctedNonSaldo, poIdx };
  })();

  // Ambil data dinamis hasil kalkulasi frontend
  const planExhaustLabel = referenceItem ? (() => {
    const { planExhaustionLabelNoPO, planExhaustionLabelWithPO } = calculateDynamicMetrics(referenceItem, rangeMonths, endYear, endMonth, calcMode, runRateLookback);
    const targetLabel = showChartWithPO ? planExhaustionLabelWithPO : planExhaustionLabelNoPO;
    return targetLabel && targetLabel !== '-' && targetLabel !== 'Aman' ? targetLabel : null;
  })() : null;

  const poLabel = (showChartWithPO && chartData.poIdx >= 0) ? chartData.labels[chartData.poIdx] : null;

  const exhaustLabelNoPO = referenceItem ? (() => {
    const { correctedExhaustionLabelNoPO } = calculateDynamicMetrics(referenceItem, rangeMonths, endYear, endMonth, calcMode, runRateLookback);
    return correctedExhaustionLabelNoPO && correctedExhaustionLabelNoPO !== '-' && chartData.labels.includes(correctedExhaustionLabelNoPO) ? correctedExhaustionLabelNoPO : null;
  })() : null;

  const exhaustLabelWithPO = referenceItem ? (() => {
    const { correctedExhaustionLabelWithPO } = calculateDynamicMetrics(referenceItem, rangeMonths, endYear, endMonth, calcMode, runRateLookback);
    return correctedExhaustionLabelWithPO && correctedExhaustionLabelWithPO !== '-' && chartData.labels.includes(correctedExhaustionLabelWithPO) ? correctedExhaustionLabelWithPO : null;
  })() : null;

  const exhaustLabel = exhaustLabelNoPO;

  // Insight data untuk kartu info mode Riwayat
  const riwayatInsight = (() => {
    if (!referenceItem || calcMode !== 'RIWAYAT') return null;
    let sumAct = 0, sumPlan = 0;
    
    const lookbackMonthsList: { year: number; month: number }[] = [];
    for (let i = 0; i < runRateLookback; i++) {
      const d = new Date(currentTodayYear, (currentTodayMonth - 1) - i, 1);
      lookbackMonthsList.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    lookbackMonthsList.forEach(m => {
      const hist = referenceItem.all_history?.filter(h => {
        if (!h.tanggal) return false;
        const d = new Date(h.tanggal);
        return d.getFullYear() === m.year && (d.getMonth() + 1) === m.month;
      }) || [];
      sumAct += hist.reduce((s, h) => s + (h.qty || 0), 0);
      const p = referenceItem.all_plans?.find(pl => pl.tahun === m.year && pl.bulan === m.month);
      sumPlan += p ? p.plan_qty : 0;
    });

    const multiplier = sumPlan > 0 ? sumAct / sumPlan : 1;
    // Rata-rata plan terkoreksi per bulan masa depan
    const futureMonths = rangeMonths.filter(m => m.year > currentTodayYear || (m.year === currentTodayYear && m.month > currentTodayMonth));
    const avgCorrected = futureMonths.length > 0
      ? futureMonths.reduce((s, m) => {
          const p = referenceItem.all_plans?.find(pl => pl.tahun === m.year && pl.bulan === m.month);
          return s + Math.round((p ? p.plan_qty : 0) * multiplier);
        }, 0) / futureMonths.length
      : 0;
    const nonSaldoArr = chartData?.correctedNonSaldo || [];
    const nonSaldoFiltered = nonSaldoArr.filter((v): v is number => v !== null);
    const nonSaldoMax = nonSaldoFiltered.length > 0 ? Math.max(...nonSaldoFiltered) : 0;
    
    // Generate label range bulan dynamic (misalnya "Feb-Jul '26" atau "Nov '25 - Jul '26")
    const startMObj = lookbackMonthsList.length > 0 ? lookbackMonthsList[lookbackMonthsList.length - 1] : { year: currentTodayYear, month: currentTodayMonth };
    const endMObj = lookbackMonthsList.length > 0 ? lookbackMonthsList[0] : { year: currentTodayYear, month: currentTodayMonth };
    const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    
    let rangeLabel = "";
    if (startMObj && endMObj && startMObj.month && endMObj.month) {
      if (startMObj.year === endMObj.year) {
        rangeLabel = `${BULAN_SHORT[startMObj.month - 1] || ''}-${BULAN_SHORT[endMObj.month - 1] || ''} '${String(startMObj.year).slice(2)}`;
      } else {
        rangeLabel = `${BULAN_SHORT[startMObj.month - 1] || ''} '${String(startMObj.year).slice(2)} - ${BULAN_SHORT[endMObj.month - 1] || ''} '${String(endMObj.year).slice(2)}`;
      }
    }

    return { sumAct, sumPlan, multiplier, avgCorrected, nonSaldoMax, exhaustLabel, rangeLabel };
  })();

  const gapMonths = (() => {
    if (!referenceItem) return null;
    if (!showChartWithPO || !poLabel) {
      return null;
    }
    const ss = referenceItem.safety_stock ?? 0;
    const todayLabelIdx = chartData.labels.findIndex(l => l.includes(`${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][currentTodayMonth - 1]} '${String(currentTodayYear).slice(2)}`));
    const startSearchIdx = todayLabelIdx >= 0 ? todayLabelIdx : 0;
    let rawBreachIdx = chartData.corrected.findIndex((val, idx) => {
      return idx >= startSearchIdx && val !== null && val <= ss;
    });
    let safetyBreachIdx = rawBreachIdx;
    if (rawBreachIdx > startSearchIdx) {
      safetyBreachIdx = rawBreachIdx - 1;
    }
    const currentBreachLabel = safetyBreachIdx >= 0 ? chartData.labels[safetyBreachIdx] : null;
    const targetExhaustLabel = chartViewMode === 'SALDO' ? (currentBreachLabel ?? exhaustLabel) : exhaustLabel;
    if (!targetExhaustLabel) return (referenceItem as any).gap_to_po ?? null;
    
    const idxEx = chartData.labels.indexOf(targetExhaustLabel);
    const idxPo = chartData.labels.indexOf(poLabel);
    if (idxEx >= 0 && idxPo >= 0) {
      return idxEx - idxPo;
    }
    return (referenceItem as any).gap_to_po ?? null;
  })();

  const dynamicStatus = (() => {
    if (isRangeInvalid || !referenceItem) return { label: 'TIDAK VALID', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' };
    const s = showChartWithPO
      ? (referenceItem as any).status_po ?? 'BELUM PO'
      : (referenceItem as any).status_no_po ?? 'KRITIS';
    return {
      label: s,
      color: s === 'KRITIS' || s === 'BELUM PO' || s === 'FAST MOVING' ? 'var(--color-led-red)'
        : s === 'WASPADA' || s === 'SLOW MOVING' ? 'var(--color-led-amber)'
        : 'var(--color-led-green)',
      bg: s === 'KRITIS' || s === 'BELUM PO' || s === 'FAST MOVING' ? 'rgba(220,38,38,0.12)'
        : s === 'WASPADA' || s === 'SLOW MOVING' ? 'rgba(217,119,6,0.12)'
        : 'rgba(22,163,74,0.12)'
    };
  })();

  // Dynamic status-based KPI calculations based on Safety Stock, ROP, and PO Status
  const countKritis  = aggregatedData.filter(d => getMaterialItemStatus(d) === 'KRITIS').length;
  const countWaspada = aggregatedData.filter(d => getMaterialItemStatus(d) === 'WASPADA').length;
  const countReorder = aggregatedData.filter(d => (d as any).status_po === 'BELUM PO').length;
  const countAman    = aggregatedData.filter(d => getMaterialItemStatus(d) === 'AMAN').length;

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
      {/* Main Dashboard Layout: 2-column grid for large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch mt-1">
        
        {/* LEFT COLUMN: Absorption Chart & Critical Stock Table (Spans 2 columns) */}
        <div className="xl:col-span-2 space-y-6">
          {/* ECharts — Area Chart Proyeksi Penyerapan */}
          <div
            className={`tactile-card ${isChartFullScreen ? 'fixed inset-0 z-[999] p-3 flex flex-col justify-between mobile-landscape-fullscreen rounded-none' : 'rounded-lg relative overflow-hidden'}`}
            style={isChartFullScreen ? {
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-steel-border)',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              overflow: 'hidden',
              margin: 0
            } : {
              backgroundColor: 'var(--color-background-metallic)',
              borderColor: 'var(--color-steel-border)'
            }}
          >
            <div className={`p-3 px-4 gap-2 border-b flex flex-col relative z-30 ${isChartFullScreen ? '' : 'rounded-t-lg'}`} style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              {/* Row 1: Title, Subtitle, and Control Buttons */}
              <div className="flex flex-wrap justify-between items-center gap-2 pr-10">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>Availability Stok</h3>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 w-full pr-8">
                  {/* 1. Dropdown Kalkulasi: Standar vs Riwayat */}
                  <select
                    value={calcMode}
                    onChange={e => setCalcMode(e.target.value as any)}
                    className="rounded px-2 py-1 border text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                  >
                    <option value="STANDAR">Standar</option>
                    <option value="RIWAYAT">Riwayat</option>
                  </select>

                  {/* 2. Dropdown Mode Tampilan: Konsumsi vs Saldo Stok */}
                  <select
                    value={chartViewMode}
                    onChange={e => setChartViewMode(e.target.value as any)}
                    className="rounded px-2 py-1 border text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                  >
                    <option value="KONSUMSI">Konsumsi</option>
                    <option value="SALDO">Saldo Stok</option>
                  </select>

                  {/* 3. Dropdown Filter PO: Tanpa PO vs Dengan PO */}
                  <select
                    value={showChartWithPO ? 'DENGAN_PO' : 'TANPA_PO'}
                    onChange={e => setShowChartWithPO(e.target.value === 'DENGAN_PO')}
                    className="rounded px-2 py-1 border text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                  >
                    <option value="TANPA_PO">Tanpa PO</option>
                    <option value="DENGAN_PO">Dengan PO</option>
                  </select>

                  {/* 4. Dropdown Material (Fleksibel & Truncate Teks Panjang) */}
                  <select
                    value={selectedMaterial || '6005530'}
                    onChange={e => setSelectedMaterial(e.target.value)}
                    className="rounded px-2 py-1 border text-[11px] font-bold flex-1 min-w-0 truncate"
                    style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                  >
                    {aggregatedData.map(m => (
                      <option key={m.nomor_material} value={m.nomor_material}>
                        {m.nomor_material} — {m.nama_material}
                      </option>
                    ))}
                  </select>

                  {/* 5. Dropdown Pilihan Garis (Show/Hide Lines) */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowLineMenu(v => !v)}
                      className="flex items-center gap-1.5 rounded px-2 py-1 border text-[11px] font-bold transition-all hover:opacity-85 shadow-sm"
                      style={{
                        backgroundColor: showLineMenu ? 'var(--color-primary)' : 'var(--color-surface-container-high)',
                        borderColor: 'var(--color-steel-border)',
                        color: showLineMenu ? '#ffffff' : 'var(--color-on-surface)'
                      }}
                      title="Pilih Garis / Elemen Grafik yang Ingin Ditampilkan"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/>
                        <circle cx="4" cy="12" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="20" cy="14" r="2"/>
                      </svg>
                      <span className="hidden sm:inline">Garis</span>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-150 ${showLineMenu ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>

                    {showLineMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowLineMenu(false)} />
                        <div
                          className="absolute right-0 mt-1.5 w-56 rounded-xl p-3 z-50 shadow-2xl border flex flex-col gap-2 animate-fade-in"
                          style={{
                            backgroundColor: 'var(--color-surface-container)',
                            borderColor: 'var(--color-steel-border)',
                            boxShadow: '0 10px 28px rgba(0,0,0,0.22)'
                          }}
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: 'var(--color-steel-border)' }}>
                            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-surface)' }}>Tampilkan Garis</span>
                            <button
                              type="button"
                              onClick={() => setVisibleLines({ plan: true, actual: true, corrected: true, correctedNonSaldo: true, safetyStock: true, rop: true, breach: true, gr: true, today: true })}
                              className="text-[10px] font-bold text-blue-500 hover:underline"
                            >
                              Semua
                            </button>
                          </div>

                          <div className="space-y-1.5 text-[11px] font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                            <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                              <input type="checkbox" checked={visibleLines.plan} onChange={() => toggleLineVisibility('plan')} className="rounded accent-purple-600" />
                              <span className="w-2.5 h-0.5 bg-purple-500 rounded-full inline-block" />
                              <span>Plan Rencana</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                              <input type="checkbox" checked={visibleLines.actual} onChange={() => toggleLineVisibility('actual')} className="rounded accent-blue-600" />
                              <span className="w-2.5 h-0.5 bg-blue-500 rounded-full inline-block" />
                              <span>Saldo / Realisasi Aktual</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                              <input type="checkbox" checked={visibleLines.corrected} onChange={() => toggleLineVisibility('corrected')} className="rounded accent-amber-500" />
                              <span className="w-2.5 h-0.5 bg-amber-500 rounded-full inline-block" />
                              <span>Plan Terkoreksi</span>
                            </label>

                            {chartViewMode === 'KONSUMSI' && (
                              <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                                <input type="checkbox" checked={visibleLines.correctedNonSaldo} onChange={() => toggleLineVisibility('correctedNonSaldo')} className="rounded accent-rose-500" />
                                <span className="w-2.5 h-0.5 bg-rose-500 rounded-full inline-block" />
                                <span>Plan Terkoreksi (Non-Saldo)</span>
                              </label>
                            )}

                            {chartViewMode === 'SALDO' && (
                              <>
                                <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                                  <input type="checkbox" checked={visibleLines.safetyStock} onChange={() => toggleLineVisibility('safetyStock')} className="rounded accent-red-600" />
                                  <span className="w-2.5 h-0.5 bg-red-500 rounded-full inline-block" />
                                  <span>Safety Stock</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                                  <input type="checkbox" checked={visibleLines.rop} onChange={() => toggleLineVisibility('rop')} className="rounded accent-blue-600" />
                                  <span className="w-0.5 h-2.5 bg-blue-600 inline-block" />
                                  <span>Batas Order (ROP)</span>
                                </label>
                              </>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                              <input type="checkbox" checked={visibleLines.breach} onChange={() => toggleLineVisibility('breach')} className="rounded accent-rose-600" />
                              <span className="w-0.5 h-2.5 bg-rose-600 inline-block" />
                              <span>Stok Habis / Breach</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                              <input type="checkbox" checked={visibleLines.gr} onChange={() => toggleLineVisibility('gr')} className="rounded accent-emerald-600" />
                              <span className="w-0.5 h-2.5 bg-emerald-600 inline-block" />
                              <span>Kedatangan (GR / PO)</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                              <input type="checkbox" checked={visibleLines.today} onChange={() => toggleLineVisibility('today')} className="rounded accent-slate-500" />
                              <span className="w-0.5 h-2.5 bg-slate-400 inline-block" />
                              <span>Garis Hari Ini</span>
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 5. Date Picker & Analisis (Ditempatkan di Baris 1 HANYA Saat Fullscreen) */}
                  {isChartFullScreen && (
                    <div className="flex items-center gap-1 text-[11px] shrink-0 ml-1">
                      <span className="font-semibold text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Mulai:</span>
                      <select
                        value={startMonth}
                        onChange={e => setStartMonth(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {MONTHS_OPTIONS.map(m => (
                          <option key={m.value} value={m.value}>{m.name}</option>
                        ))}
                      </select>
                      <select
                        value={startYear}
                        onChange={e => setStartYear(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {YEARS_OPTIONS.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>

                      <span className="font-semibold text-[10px] ml-1" style={{ color: 'var(--color-on-surface-variant)' }}>Selesai:</span>
                      <select
                        value={endMonth}
                        onChange={e => setEndMonth(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {MONTHS_OPTIONS.map(m => (
                          <option key={m.value} value={m.value}>{m.name}</option>
                        ))}
                      </select>
                      <select
                        value={endYear}
                        onChange={e => setEndYear(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {YEARS_OPTIONS.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 border-l pl-2 ml-1" style={{ borderColor: 'var(--color-steel-border)' }}>
                        <span className="font-semibold text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Analisis:</span>
                        <select
                          value={runRateLookback}
                          onChange={e => setRunRateLookback(Number(e.target.value))}
                          className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                          style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n} Bln Terakhir</option>
                          ))}
                        </select>
                      </div>

                      {/* Info Gap & Fast Moving */}
                      {gapMonths !== null ? (
                        <span className="ml-1 font-bold text-[10px] px-1.5 py-0.5 rounded border" style={{
                          backgroundColor: gapMonths >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          borderColor: gapMonths >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                          color: gapMonths >= 0 ? '#10b981' : '#ef4444'
                        }}>
                          {gapMonths >= 0 ? `Gap: +${Math.abs(gapMonths)} Bln` : `Gap: -${Math.abs(gapMonths)} Bln`}
                        </span>
                      ) : (
                        <span className="ml-1 font-bold text-[10px] px-1.5 py-0.5 rounded border" style={{
                          backgroundColor: 'rgba(239,68,68,0.1)',
                          borderColor: 'rgba(239,68,68,0.3)',
                          color: '#ef4444'
                        }}>
                          Belum Ada PO
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tombol Full Screen */}
              <button
                onClick={() => setIsChartFullScreen(!isChartFullScreen)}
                className="absolute top-2.5 right-2.5 p-1.5 rounded border transition-all flex items-center justify-center hover:opacity-80 shadow-sm"
                style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                title={isChartFullScreen ? "Kecilkan Tampilan" : "Perbesar Tampilan (Full Screen)"}
              >
                {isChartFullScreen ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6m0 0V3m0 6l-6-6m6 18v-6m0 0H9m6 0l-6 6" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6m0 0v6m0-6L14 10M9 21H3m0 0v-6m0 6l7-7" />
                  </svg>
                )}
              </button>

              {/* Row 2: Date Picker Periode (Di Baris Ke-2 HANYA Saat Mode Normal) */}
              {!isChartFullScreen && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1.5 mt-1 border-t" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Mulai:</span>
                      <select
                        value={startMonth}
                        onChange={e => setStartMonth(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {MONTHS_OPTIONS.map(m => (
                          <option key={m.value} value={m.value}>{m.name}</option>
                        ))}
                      </select>
                      <select
                        value={startYear}
                        onChange={e => setStartYear(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {YEARS_OPTIONS.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Selesai:</span>
                      <select
                        value={endMonth}
                        onChange={e => setEndMonth(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {MONTHS_OPTIONS.map(m => (
                          <option key={m.value} value={m.value}>{m.name}</option>
                        ))}
                      </select>
                      <select
                        value={endYear}
                        onChange={e => setEndYear(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {YEARS_OPTIONS.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                      <span className="font-semibold text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Analisis:</span>
                      <select
                        value={runRateLookback}
                        onChange={e => setRunRateLookback(Number(e.target.value))}
                        className="rounded px-1.5 py-0.5 border font-semibold text-[11px]"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} Bln Terakhir</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {gapMonths !== null ? (
                      <span className="font-semibold text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                        Gap: <b style={{ color: gapMonths >= 0 ? '#10b981' : '#ef4444' }}>
                          {gapMonths >= 0 ? `+${gapMonths} Bulan` : `${gapMonths} Bulan`}
                        </b>
                      </span>
                    ) : (
                      <span className="font-semibold text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                        Status: <b style={{ color: '#ef4444' }}>Belum Ada PO</b>
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border flex items-center gap-1"
                      style={{ backgroundColor: 'rgba(225, 29, 72, 0.08)', borderColor: 'rgba(225, 29, 72, 0.25)', color: '#e11d48' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                      Fast Moving
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Insight Cards — hanya muncul saat fullscreen + mode Riwayat */}
            {isChartFullScreen && calcMode === 'RIWAYAT' && riwayatInsight && (
              <div className="flex flex-wrap gap-3 px-5 pb-3">
                {/* Toggle show/hide */}
                <div className="w-full flex items-center justify-between mb-0">
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Insight Riwayat</span>
                  <button
                    onClick={() => setShowInsight(v => !v)}
                    className="flex items-center justify-center p-1.5 rounded border transition-all hover:opacity-80"
                    style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container-high)' }}
                    title={showInsight ? "Sembunyikan Insight" : "Tampilkan Insight"}
                  >
                    {showInsight ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
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

            {(() => {
              const allVals = [
                ...chartData.plans,
                ...chartData.actuals.filter((v): v is number => v !== null),
                ...chartData.corrected,
              ].filter((v): v is number => typeof v === 'number' && v > 0);
              const rawDataPeak = allVals.length > 0 ? Math.max(...allVals) : 100;
              const planVal = chartData.plans.find(p => p > 0) || (rawDataPeak * 0.7);
              // Target: Plan line sits comfortably in the middle (~50% height), with balanced headroom for badges
              const yAxisMax = Math.ceil((Math.max(rawDataPeak * 1.35, planVal * 1.95)) / 100) * 100;

              return (
                <ReactECharts
                  option={{
                    backgroundColor: 'transparent',
                    animation: true,
                    animationDuration: 900,
                    animationEasing: 'cubicInOut',
                    animationDelay: 0,
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
                      data: chartViewMode === 'SALDO'
                        ? ['Proyeksi Saldo (Rencana)', 'Saldo Aktual', 'Proyeksi Saldo (Terkoreksi)']
                        : ['Rencana Awal', 'Realisasi Aktual', 'Plan Terkoreksi', 'Plan Terkoreksi (Non-Saldo)'],
                      bottom: 4,
                      itemWidth: 20,
                      itemHeight: 6,
                      itemGap: 12,
                      icon: 'roundRect',
                      textStyle: { color: ct.legendText, fontSize: 10.5, fontWeight: '700', fontFamily: 'inherit' },
                      inactiveColor: isDark ? '#334155' : '#d1d5db',
                    },
                    grid: { left: 14, right: 18, top: 18, bottom: window.innerWidth <= 768 ? 68 : 48, containLabel: true },
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
                        rotate: window.innerWidth <= 768 ? 30 : 0,
                      },
                      axisLine: { lineStyle: { color: ct.axisLine, width: 1 } },
                      axisTick: { show: false },
                      splitLine: { show: true, lineStyle: { color: ct.gridLine, type: 'dashed', width: 1 } },
                    },
                    yAxis: {
                      type: 'value',
                      name: chartViewMode === 'SALDO' ? 'Saldo (Unit)' : 'Penyerapan (Unit)',
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
                      max: yAxisMax,
                    },
                series: [
                  // 1. Rencana Awal — violet dashed, referensi plan
                  {
                    name: chartViewMode === 'SALDO' ? 'Proyeksi Saldo (Rencana)' : 'Rencana Awal',
                    type: 'line',
                    smooth: false,
                    showSymbol: visibleLines.plan,
                    symbol: 'circle',
                    symbolSize: 6,
                    lineStyle: {
                      color: '#8b5cf6',
                      width: 2.5,
                      type: 'dashed',
                      opacity: visibleLines.plan ? 1 : 0,
                    },
                    itemStyle: {
                      color: '#8b5cf6',
                      borderColor: '#ffffff',
                      borderWidth: 2,
                    },
                    emphasis: { disabled: true },
                    z: 4,
                    data: visibleLines.plan ? chartData.plans : [],
                  },
                  {
                    name: chartViewMode === 'SALDO' ? 'Saldo Aktual' : 'Realisasi Aktual',
                    type: 'line',
                    smooth: true,
                    smoothMonotone: 'x',
                    showSymbol: visibleLines.actual,
                    lineStyle: {
                      color: '#3b82f6',
                      width: 3,
                      opacity: visibleLines.actual ? 1 : 0,
                      shadowColor: 'rgba(59,130,246,0.35)',
                      shadowBlur: 10,
                      shadowOffsetY: 4,
                    },
                    areaStyle: visibleLines.actual ? {
                      color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                          { offset: 0, color: 'rgba(59,130,246,0.25)' },
                          { offset: 1, color: 'rgba(59,130,246,0.02)' },
                        ],
                      },
                    } : { opacity: 0 },
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
                    data: visibleLines.actual ? chartData.actuals : [],
                  },
                  {
                    name: chartViewMode === 'SALDO' ? 'Proyeksi Saldo (Terkoreksi)' : 'Plan Terkoreksi',
                    type: 'line',
                    smooth: false,
                    symbol: 'circle',
                    symbolSize: 4,
                    showSymbol: visibleLines.corrected,
                    lineStyle: {
                      color: '#f59e0b',
                      width: 2.5,
                      type: 'dashed',
                      opacity: visibleLines.corrected ? 1 : 0,
                    },
                    itemStyle: {
                      color: '#f59e0b',
                      borderColor: '#fff',
                      borderWidth: 1.5,
                    },
                    emphasis: { disabled: true },
                    z: 6,
                    data: visibleLines.corrected ? chartData.corrected : [],
                    ...(() => {
                      const yMax = yAxisMax;

                      const markLineData: any[] = [];
                      const markPointData: any[] = [];

                      if (chartViewMode === 'SALDO') {
                        // safety_stock sudah dihitung ulang di aggregatedData berdasarkan runRateLookback
                        const ss = referenceItem.safety_stock ?? 0;

                        if (visibleLines.safetyStock) {
                          markLineData.push([
                            {
                              coord: [chartData.labels[0], ss],
                              lineStyle: {
                                color: '#ef4444',
                                width: 1.5,
                                type: 'dashed'
                              },
                              label: {
                                show: true,
                                position: 'insideEndTop',
                                formatter: `Safety Stock: ${ss} Unit`,
                                color: '#ef4444',
                                fontWeight: 'bold',
                                fontSize: 9,
                                backgroundColor: isDark ? 'rgba(30,41,59,0.85)' : 'rgba(241,245,249,0.85)',
                                padding: [2, 4],
                                borderRadius: 2
                              }
                            },
                            { coord: [chartData.labels[chartData.labels.length - 1], ss] }
                          ]);
                        }

                        // 1. Garis Vertikal saat Proyeksi Saldo (Kuning) memotong garis Safety Stock (Merah)
                        const todayLabelIdx = chartData.labels.findIndex(l => l.includes("Jul '26"));
                        const startSearchIdx = todayLabelIdx >= 0 ? todayLabelIdx : 0;
                        let rawBreachIdx = chartData.corrected.findIndex((val, idx) => {
                          return idx >= startSearchIdx && val !== null && val <= ss;
                        });
                        let safetyBreachIdx = rawBreachIdx;
                        if (rawBreachIdx > startSearchIdx) {
                          // Jika perpotongan terjadi di antara bulan (Feb-Mar), tempatkan di bulan awal (Feb '27)
                          safetyBreachIdx = rawBreachIdx - 1;
                        }
                        const safetyBreachLabel = safetyBreachIdx >= 0 ? chartData.labels[safetyBreachIdx] : null;

                        // 2. ROP (Batas Order) mundur sesuai Lead Time material data dari bulan Safety Stock Breach
                        const rawLeadTime = referenceItem?.lead_time || 60;
                        const leadTimeMonths = rawLeadTime > 12 ? Math.max(1, Math.round(rawLeadTime / 30)) : Math.max(1, Math.round(rawLeadTime));
                        const ropIdx = safetyBreachIdx >= (startSearchIdx + leadTimeMonths) 
                          ? safetyBreachIdx - leadTimeMonths 
                          : (safetyBreachIdx > startSearchIdx ? safetyBreachIdx - 1 : -1);
                        const ropExhaustLabel = ropIdx >= 0 ? chartData.labels[ropIdx] : null;

                        if (ropExhaustLabel && visibleLines.rop) {
                          const yPopupRop = yMax * 0.92;
                          markLineData.push([
                            {
                              coord: [ropExhaustLabel, 0],
                              lineStyle: {
                                color: '#3b82f6',
                                width: 2,
                                type: 'solid'
                              },
                              label: { show: false }
                            },
                            { coord: [ropExhaustLabel, yMax] }
                          ]);
                          markPointData.push(
                            {
                              name: 'ROP Label',
                              coord: [ropExhaustLabel, yPopupRop],
                              symbol: 'rect',
                              symbolSize: [98, 32],
                              symbolOffset: [0, 0],
                              itemStyle: {
                                color: isDark ? '#0f172a' : '#ffffff',
                                borderColor: '#3b82f6',
                                borderWidth: 1.5,
                              },
                              label: {
                                show: true,
                                position: 'inside',
                                formatter: [
                                  `{title|Batas Order (ROP)}`,
                                  `{date|${ropExhaustLabel}}`,
                                ].join('\n'),
                                rich: {
                                  title: { color: isDark ? '#60a5fa' : '#1d4ed8', fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                  date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                },
                                align: 'center',
                              }
                            },
                            {
                              name: 'ROP Dot',
                              coord: [ropExhaustLabel, 0],
                              symbol: 'circle',
                              symbolSize: 12,
                              itemStyle: {
                                color: '#3b82f6',
                                borderColor: '#ffffff',
                                borderWidth: 2,
                              },
                              label: { show: false }
                            }
                          );
                        }

                        if (safetyBreachLabel && safetyBreachLabel !== ropExhaustLabel && visibleLines.breach) {
                          const yPopupSS = yMax * 0.58;
                          markLineData.push([
                            {
                              coord: [safetyBreachLabel, 0],
                              lineStyle: {
                                color: '#d97706',
                                width: 2,
                                type: 'solid'
                              },
                              label: { show: false }
                            },
                            { coord: [safetyBreachLabel, yMax] }
                          ]);
                          markPointData.push(
                            {
                              name: 'Safety Stock Breach Label',
                              coord: [safetyBreachLabel, yPopupSS],
                              symbol: 'rect',
                              symbolSize: [118, 34],
                              symbolOffset: [0, 0],
                              itemStyle: {
                                color: isDark ? '#0f172a' : '#ffffff',
                                borderColor: '#d97706',
                                borderWidth: 1.5,
                              },
                              label: {
                                show: true,
                                position: 'inside',
                                formatter: [
                                  `{title|Safety Stock Breach}`,
                                  `{date|${safetyBreachLabel}}`,
                                ].join('\n'),
                                rich: {
                                  title: { color: isDark ? '#fbbf24' : '#b45309', fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                  date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                },
                                align: 'center',
                              }
                            },
                            {
                              name: 'Safety Stock Breach Dot',
                              coord: [safetyBreachLabel, 0],
                              symbol: 'circle',
                              symbolSize: 12,
                              itemStyle: {
                                color: '#d97706',
                                borderColor: '#ffffff',
                                borderWidth: 2,
                              },
                              label: { show: false }
                            }
                          );
                        }

                        const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
                        const currentMonthLabel = `${BULAN_SHORT[currentTodayMonth - 1]} '${String(currentTodayYear).slice(2)}`;
                        if (visibleLines.today && chartData.labels.includes(currentMonthLabel)) {
                          markLineData.push([
                            {
                              coord: [currentMonthLabel, 0],
                              lineStyle: {
                                color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
                                width: 1.5,
                                type: 'solid'
                              },
                              label: {
                                show: true,
                                position: 'end',
                                rotate: 0,
                                formatter: 'Hari Ini',
                                color: isDark ? '#cbd5e1' : '#475569',
                                fontSize: 10,
                                fontWeight: 'bold',
                                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                borderColor: isDark ? '#334155' : '#cbd5e1',
                                borderWidth: 1,
                                padding: [3, 6],
                                borderRadius: 0
                              }
                            },
                            { coord: [currentMonthLabel, yMax] }
                          ]);
                        }

                        if (showChartWithPO && visibleLines.gr) {
                          const activePOsToRender = (referenceItem.active_pos && referenceItem.active_pos.length > 0)
                            ? referenceItem.active_pos
                            : (poLabel ? [{ po_number: null, jumlah_dipesan: referenceItem.jumlah_dipesan || 0, tanggal_rencana_pengiriman: referenceItem.tanggal_rencana_pengiriman || null }] : []);

                          const poByMonthMap = new Map<string, { label: string; qty: number; isFuture: boolean }>();
                          activePOsToRender.forEach(po => {
                            if (!po.tanggal_rencana_pengiriman) return;
                            const dPO = new Date(po.tanggal_rencana_pengiriman);
                            const isFuture = dPO.getFullYear() > currentTodayYear || (dPO.getFullYear() === currentTodayYear && (dPO.getMonth() + 1) >= currentTodayMonth);
                            const pLabel = `${BULAN_SHORT[dPO.getMonth()]} '${String(dPO.getFullYear()).slice(2)}`;
                            if (chartData.labels.includes(pLabel)) {
                              if (!poByMonthMap.has(pLabel)) {
                                poByMonthMap.set(pLabel, { label: pLabel, qty: 0, isFuture });
                              }
                              poByMonthMap.get(pLabel)!.qty += Number(po.jumlah_dipesan) || 0;
                            }
                          });

                          Array.from(poByMonthMap.values()).forEach((poGroup, poIdx) => {
                            const pLabel = poGroup.label;
                            const isFuturePO = poGroup.isFuture;
                            const poTitle = isFuturePO ? 'Rencana GR' : 'PO Terlambat';
                            const poBorderColor = isFuturePO ? '#10b981' : '#f59e0b';
                            const poTitleColor = isFuturePO ? (isDark ? '#34d399' : '#047857') : (isDark ? '#fbbf24' : '#d97706');
                            const yPopupPO = yMax * (poIdx % 2 === 0 ? 0.82 : 0.68);
                            markLineData.push([
                              {
                                coord: [pLabel, 0],
                                lineStyle: {
                                  color: poBorderColor,
                                  width: 2,
                                  type: isFuturePO ? 'solid' : 'dashed'
                                },
                                label: { show: false }
                              },
                              { coord: [pLabel, yMax] }
                            ]);
                            markPointData.push(
                              {
                                name: `PO Masuk Saldo Label ${poIdx}`,
                                coord: [pLabel, yPopupPO],
                                symbol: 'rect',
                                symbolSize: [96, 32],
                                symbolOffset: [0, 0],
                                itemStyle: {
                                  color: isDark ? '#0f172a' : '#ffffff',
                                  borderColor: poBorderColor,
                                  borderWidth: 1.5,
                                },
                                label: {
                                  show: true,
                                  position: 'inside',
                                  formatter: [
                                    `{title|${poTitle}}`,
                                    `{date|${pLabel} (+${poGroup.qty.toLocaleString('id-ID')})}`,
                                  ].join('\n'),
                                  rich: {
                                    title: { color: poTitleColor, fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                    date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                  },
                                  align: 'center',
                                }
                              },
                              {
                                name: `PO Masuk Saldo Dot ${poIdx}`,
                                coord: [pLabel, 0],
                                symbol: 'circle',
                                symbolSize: 12,
                                itemStyle: {
                                  color: poBorderColor,
                                  borderColor: '#ffffff',
                                  borderWidth: 2,
                                },
                                label: { show: false }
                              }
                            );
                          });
                        }

                        // 8. Riwayat Goods Receipt (Historis 101 ke C013) - Mode Saldo
                        if (visibleLines.gr && referenceItem.gr_history && referenceItem.gr_history.length > 0) {
                          const monthNamesGR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
                          const grByMonthMap = new Map<string, { label: string; qty: number }>();
                          referenceItem.gr_history.forEach(gr => {
                            if (!gr.tanggal) return;
                            const grDate = new Date(gr.tanggal);
                            const grMo = grDate.getMonth();
                            const grYr = grDate.getFullYear();
                            const grLabel = `${monthNamesGR[grMo]} '${String(grYr).slice(2)}`;
                            if (chartData.labels.includes(grLabel)) {
                              if (!grByMonthMap.has(grLabel)) {
                                grByMonthMap.set(grLabel, { label: grLabel, qty: 0 });
                              }
                              grByMonthMap.get(grLabel)!.qty += Math.abs(Number(gr.qty) || 0);
                            }
                          });

                          Array.from(grByMonthMap.values()).forEach((grGroup, grIdx) => {
                            const grLabel = grGroup.label;
                            const yPopupGR = yMax * (grIdx % 2 === 0 ? 0.84 : 0.70);
                            markLineData.push([
                              {
                                coord: [grLabel, 0],
                                lineStyle: {
                                  color: '#0284c7',
                                  width: 2,
                                  type: 'solid'
                                },
                                label: { show: false }
                              },
                              { coord: [grLabel, yMax] }
                            ]);
                            markPointData.push(
                              {
                                name: `Riwayat GR Saldo Label ${grIdx}`,
                                coord: [grLabel, yPopupGR],
                                symbol: 'rect',
                                symbolSize: [96, 32],
                                symbolOffset: [0, 0],
                                itemStyle: {
                                  color: isDark ? '#0f172a' : '#ffffff',
                                  borderColor: '#0284c7',
                                  borderWidth: 1.5,
                                },
                                label: {
                                  show: true,
                                  position: 'inside',
                                  formatter: [
                                    `{title|Riwayat GR}`,
                                    `{date|${grLabel} (+${grGroup.qty.toLocaleString('id-ID')})}`,
                                  ].join('\n'),
                                  rich: {
                                    title: { color: isDark ? '#38bdf8' : '#0369a1', fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                    date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                  },
                                  align: 'center',
                                }
                              },
                              {
                                name: `Riwayat GR Saldo Dot ${grIdx}`,
                                coord: [grLabel, 0],
                                symbol: 'circle',
                                symbolSize: 12,
                                itemStyle: {
                                  color: '#0284c7',
                                  borderColor: '#ffffff',
                                  borderWidth: 2,
                                },
                                label: { show: false }
                              }
                            );
                          });
                        }

                        if (visibleLines.gr && safetyBreachLabel && poLabel && showChartWithPO && chartData.labels.includes(safetyBreachLabel) && chartData.labels.includes(poLabel)) {
                          const yGap = yMax * 0.48;
                          const idxStart = chartData.labels.indexOf(safetyBreachLabel);
                          const idxEnd = chartData.labels.indexOf(poLabel);
                          const displayGap = (idxStart >= 0 && idxEnd >= 0) ? Math.abs(idxEnd - idxStart) : Math.abs(gapMonths ?? 2);
                          const isBufferSafe = (gapMonths !== null && gapMonths >= 0) || (idxStart > idxEnd);
                          const gapLabelText = isBufferSafe ? `Gap +${displayGap} Bln` : `Gap -${displayGap} Bln`;
                          const gapColor = isBufferSafe ? '#10b981' : '#ef4444';

                          markLineData.push([
                            {
                              coord: [safetyBreachLabel, yGap],
                              lineStyle: {
                                color: gapColor,
                                width: 2,
                                type: 'solid',
                              },
                              symbol: 'arrow',
                              symbolSize: 8,
                              label: {
                                show: true,
                                position: 'middle',
                                formatter: gapLabelText,
                                color: '#ffffff',
                                backgroundColor: gapColor,
                                fontWeight: 'bold',
                                fontSize: 8.5,
                                fontFamily: 'inherit',
                                padding: [1.5, 4],
                                borderRadius: 0,
                              }
                            },
                            {
                              coord: [poLabel, yGap],
                              symbol: 'arrow',
                              symbolSize: 8
                            }
                          ]);
                        }
                      } else {
                        if (showChartWithPO && visibleLines.gr) {
                          const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
                          const activePOsToRender = (referenceItem.active_pos && referenceItem.active_pos.length > 0)
                            ? referenceItem.active_pos
                            : (poLabel ? [{ po_number: null, jumlah_dipesan: referenceItem.jumlah_dipesan || 0, tanggal_rencana_pengiriman: referenceItem.tanggal_rencana_pengiriman || null }] : []);

                          const poByMonthMap = new Map<string, { label: string; qty: number; isFuture: boolean }>();
                          activePOsToRender.forEach(po => {
                            if (!po.tanggal_rencana_pengiriman) return;
                            const dPO = new Date(po.tanggal_rencana_pengiriman);
                            const isFuture = dPO.getFullYear() > currentTodayYear || (dPO.getFullYear() === currentTodayYear && (dPO.getMonth() + 1) >= currentTodayMonth);
                            const pLabel = `${BULAN_SHORT[dPO.getMonth()]} '${String(dPO.getFullYear()).slice(2)}`;
                            if (chartData.labels.includes(pLabel)) {
                              if (!poByMonthMap.has(pLabel)) {
                                poByMonthMap.set(pLabel, { label: pLabel, qty: 0, isFuture });
                              }
                              poByMonthMap.get(pLabel)!.qty += Number(po.jumlah_dipesan) || 0;
                            }
                          });

                          Array.from(poByMonthMap.values()).forEach((poGroup, poIdx) => {
                            const pLabel = poGroup.label;
                            const isFuturePO = poGroup.isFuture;
                            const poTitle = isFuturePO ? 'Rencana GR' : 'PO Terlambat';
                            const poBorderColor = isFuturePO ? '#10b981' : '#f59e0b';
                            const poTitleColor = isFuturePO ? (isDark ? '#34d399' : '#047857') : (isDark ? '#fbbf24' : '#d97706');
                            const yPopupPO = yMax * (poIdx % 2 === 0 ? 0.82 : 0.68);
                            markLineData.push([
                              {
                                coord: [pLabel, 0],
                                lineStyle: {
                                  color: poBorderColor,
                                  width: 2,
                                  type: isFuturePO ? 'solid' : 'dashed'
                                },
                                label: { show: false }
                              },
                              { coord: [pLabel, yMax] }
                            ]);
                            markPointData.push(
                              {
                                name: `PO Masuk Label ${poIdx}`,
                                coord: [pLabel, yPopupPO],
                                symbol: 'rect',
                                symbolSize: [96, 32],
                                symbolOffset: [0, 0],
                                itemStyle: {
                                  color: isDark ? '#0f172a' : '#ffffff',
                                  borderColor: poBorderColor,
                                  borderWidth: 1.5,
                                },
                                label: {
                                  show: true,
                                  position: 'inside',
                                  formatter: [
                                    `{title|${poTitle}}`,
                                    `{date|${pLabel} (+${poGroup.qty.toLocaleString('id-ID')})}`,
                                  ].join('\n'),
                                  rich: {
                                    title: { color: poTitleColor, fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                    date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                  },
                                  align: 'center',
                                }
                              },
                              {
                                name: `PO Masuk Dot ${poIdx}`,
                                coord: [pLabel, 0],
                                symbol: 'circle',
                                symbolSize: 12,
                                itemStyle: {
                                  color: poBorderColor,
                                  borderColor: '#ffffff',
                                  borderWidth: 2,
                                },
                                label: { show: false }
                              }
                            );
                          });
                        }

                        // 8. Riwayat Goods Receipt (Historis 101 ke C013)
                        if (visibleLines.gr && referenceItem.gr_history && referenceItem.gr_history.length > 0) {
                          const monthNamesGR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
                          const grByMonthMap = new Map<string, { label: string; qty: number }>();
                          referenceItem.gr_history.forEach(gr => {
                            if (!gr.tanggal) return;
                            const grDate = new Date(gr.tanggal);
                            const grMo = grDate.getMonth();
                            const grYr = grDate.getFullYear();
                            const grLabel = `${monthNamesGR[grMo]} '${String(grYr).slice(2)}`;
                            if (chartData.labels.includes(grLabel)) {
                              if (!grByMonthMap.has(grLabel)) {
                                grByMonthMap.set(grLabel, { label: grLabel, qty: 0 });
                              }
                              grByMonthMap.get(grLabel)!.qty += Math.abs(Number(gr.qty) || 0);
                            }
                          });

                          Array.from(grByMonthMap.values()).forEach((grGroup, grIdx) => {
                            const grLabel = grGroup.label;
                            const yPopupGR = yMax * (grIdx % 2 === 0 ? 0.84 : 0.70);
                            markLineData.push([
                              {
                                coord: [grLabel, 0],
                                lineStyle: {
                                  color: '#0284c7',
                                  width: 2,
                                  type: 'solid'
                                },
                                label: { show: false }
                              },
                              { coord: [grLabel, yMax] }
                            ]);
                            markPointData.push(
                              {
                                name: `Riwayat GR Label ${grIdx}`,
                                coord: [grLabel, yPopupGR],
                                symbol: 'rect',
                                symbolSize: [96, 32],
                                symbolOffset: [0, 0],
                                itemStyle: {
                                  color: isDark ? '#0f172a' : '#ffffff',
                                  borderColor: '#0284c7',
                                  borderWidth: 1.5,
                                },
                                label: {
                                  show: true,
                                  position: 'inside',
                                  formatter: [
                                    `{title|Riwayat GR}`,
                                    `{date|${grLabel} (+${grGroup.qty.toLocaleString('id-ID')})}`,
                                  ].join('\n'),
                                  rich: {
                                    title: { color: isDark ? '#38bdf8' : '#0369a1', fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                    date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                  },
                                  align: 'center',
                                }
                              },
                              {
                                name: `Riwayat GR Dot ${grIdx}`,
                                coord: [grLabel, 0],
                                symbol: 'circle',
                                symbolSize: 12,
                                itemStyle: {
                                  color: '#0284c7',
                                  borderColor: '#ffffff',
                                  borderWidth: 2,
                                },
                                label: { show: false }
                              }
                            );
                          });
                        }

                        const nowMonthDate = new Date();
                        const monthNamesToday = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
                        const currentMonthLabel = `${monthNamesToday[nowMonthDate.getMonth()]} '${String(nowMonthDate.getFullYear()).slice(2)}`;
                        if (visibleLines.today && chartData.labels.includes(currentMonthLabel)) {
                          markLineData.push([
                            {
                              coord: [currentMonthLabel, 0],
                              lineStyle: {
                                color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
                                width: 1.5,
                                type: 'solid'
                              },
                              label: {
                                show: true,
                                position: 'end',
                                rotate: 0,
                                formatter: 'Hari Ini',
                                color: isDark ? '#cbd5e1' : '#475569',
                                fontSize: 10,
                                fontWeight: 'bold',
                                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                borderColor: isDark ? '#334155' : '#cbd5e1',
                                borderWidth: 1,
                                padding: [3, 6],
                                borderRadius: 0
                              }
                            },
                            { coord: [currentMonthLabel, yMax] }
                          ]);
                        }

                        // 9. PLAN HABIS (Garis Vertikal Ungu + Label)
                        if (planExhaustLabel && visibleLines.plan && visibleLines.breach && chartData.labels.includes(planExhaustLabel)) {
                          const yPopupPlan = yMax * 0.94;
                          markLineData.push([
                            {
                              coord: [planExhaustLabel, 0],
                              lineStyle: {
                                color: '#8b5cf6',
                                width: 2,
                                type: 'solid',
                              },
                              label: { show: false }
                            },
                            { coord: [planExhaustLabel, yMax] }
                          ]);
                          markPointData.push(
                            {
                              name: 'Plan Habis Label',
                              coord: [planExhaustLabel, yPopupPlan],
                              symbol: 'rect',
                              symbolSize: [88, 32],
                              symbolOffset: [0, 0],
                              itemStyle: {
                                color: isDark ? '#0f172a' : '#ffffff',
                                borderColor: '#8b5cf6',
                                borderWidth: 1.5,
                              },
                              label: {
                                show: true,
                                position: 'inside',
                                formatter: [
                                  `{title|PLAN HABIS}`,
                                  `{date|${planExhaustLabel}}`,
                                ].join('\n'),
                                rich: {
                                  title: { color: isDark ? '#c084fc' : '#7e22ce', fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                  date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                },
                                align: 'center',
                              }
                            },
                            {
                              name: 'Plan Habis Dot',
                              coord: [planExhaustLabel, 0],
                              symbol: 'circle',
                              symbolSize: 12,
                              itemStyle: {
                                color: '#8b5cf6',
                                borderColor: '#ffffff',
                                borderWidth: 2,
                              },
                              label: { show: false }
                            }
                          );
                        }

                        // 10a. Stok Habis Sebelum GR (Fisik Saat Ini)
                        if (exhaustLabelNoPO && visibleLines.breach) {
                          const yPopupEx = yMax * 0.60;
                          markLineData.push([
                            {
                              coord: [exhaustLabelNoPO, 0],
                              lineStyle: {
                                color: '#e11d48',
                                width: 2,
                                type: 'solid'
                              },
                              label: { show: false }
                            },
                            { coord: [exhaustLabelNoPO, yMax] }
                          ]);
                          markPointData.push(
                            {
                              name: 'Stok Habis Fisik Label',
                              coord: [exhaustLabelNoPO, yPopupEx],
                              symbol: 'rect',
                              symbolSize: [94, 32],
                              symbolOffset: [0, 0],
                              itemStyle: {
                                color: isDark ? '#0f172a' : '#ffffff',
                                borderColor: '#e11d48',
                                borderWidth: 1.5,
                              },
                              label: {
                                show: true,
                                position: 'inside',
                                formatter: [
                                  `{title|Stok Habis (Fisik)}`,
                                  `{date|${exhaustLabelNoPO}}`,
                                ].join('\n'),
                                rich: {
                                  title: { color: isDark ? '#fb7185' : '#be123c', fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                  date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                },
                                align: 'center',
                              }
                            },
                            {
                              name: 'Stok Habis Fisik Dot',
                              coord: [exhaustLabelNoPO, 0],
                              symbol: 'circle',
                              symbolSize: 12,
                              itemStyle: {
                                color: '#e11d48',
                                borderColor: '#ffffff',
                                borderWidth: 2,
                              },
                              label: { show: false }
                            }
                          );
                        }

                        // 10b. Stok Habis Setelah GR (Dengan Tambahan PO)
                        if (showChartWithPO && visibleLines.gr && visibleLines.breach && exhaustLabelWithPO && exhaustLabelWithPO !== exhaustLabelNoPO) {
                          const yPopupExPO = yMax * 0.76;
                          markLineData.push([
                            {
                              coord: [exhaustLabelWithPO, 0],
                              lineStyle: {
                                color: '#f43f5e',
                                width: 2,
                                type: 'dashed'
                              },
                              label: { show: false }
                            },
                            { coord: [exhaustLabelWithPO, yMax] }
                          ]);
                          markPointData.push(
                            {
                              name: 'Stok Habis Setelah GR Label',
                              coord: [exhaustLabelWithPO, yPopupExPO],
                              symbol: 'rect',
                              symbolSize: [98, 32],
                              symbolOffset: [0, 0],
                              itemStyle: {
                                color: isDark ? '#0f172a' : '#ffffff',
                                borderColor: '#f43f5e',
                                borderWidth: 1.5,
                              },
                              label: {
                                show: true,
                                position: 'inside',
                                formatter: [
                                  `{title|Stok Habis (+PO)}`,
                                  `{date|${exhaustLabelWithPO}}`,
                                ].join('\n'),
                                rich: {
                                  title: { color: isDark ? '#fda4af' : '#e11d48', fontSize: 8.5, fontWeight: '700', fontFamily: 'inherit', lineHeight: 12, align: 'center' },
                                  date: { color: isDark ? '#ffffff' : '#0f172a', fontSize: 9.5, fontWeight: '800', fontFamily: 'inherit', lineHeight: 14, align: 'center' }
                                },
                                align: 'center',
                              }
                            },
                            {
                              name: 'Stok Habis Setelah GR Dot',
                              coord: [exhaustLabelWithPO, 0],
                              symbol: 'circle',
                              symbolSize: 12,
                              itemStyle: {
                                color: '#f43f5e',
                                borderColor: '#ffffff',
                                borderWidth: 2,
                              },
                              label: { show: false }
                            }
                          );
                        }

                        if (visibleLines.gr && exhaustLabelNoPO && poLabel && showChartWithPO && chartData.labels.includes(exhaustLabelNoPO) && chartData.labels.includes(poLabel)) {
                          const yGap = yMax * 0.44;
                          const idxStart = chartData.labels.indexOf(exhaustLabelNoPO);
                          const idxEnd = chartData.labels.indexOf(poLabel);
                          const displayGap = (idxStart >= 0 && idxEnd >= 0) ? Math.abs(idxEnd - idxStart) : Math.abs(gapMonths ?? 1);
                          const isBufferSafe = (gapMonths !== null && gapMonths >= 0) || (idxStart > idxEnd);
                          const gapLabelText = isBufferSafe ? `Gap +${displayGap} Bln` : `Gap -${displayGap} Bln`;
                          const gapColor = isBufferSafe ? '#10b981' : '#ef4444';

                          markLineData.push([
                            {
                              coord: [exhaustLabelNoPO, yGap],
                              lineStyle: {
                                color: gapColor,
                                width: 2,
                                type: 'solid',
                              },
                              symbol: 'arrow',
                              symbolSize: 8,
                              label: {
                                show: true,
                                position: 'middle',
                                formatter: gapLabelText,
                                color: '#ffffff',
                                backgroundColor: gapColor,
                                fontWeight: 'bold',
                                fontSize: 8.5,
                                fontFamily: 'inherit',
                                padding: [1.5, 4],
                                borderRadius: 0,
                              }
                            },
                            {
                              coord: [poLabel, yGap],
                              symbol: 'arrow',
                              symbolSize: 8
                            }
                          ]);
                        }
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
                    smooth: false,
                    showSymbol: visibleLines.correctedNonSaldo,
                    symbol: 'circle',
                    symbolSize: 4,
                    lineStyle: {
                      color: '#ef4444',
                      width: 2.5,
                      type: 'dashed',
                      opacity: visibleLines.correctedNonSaldo ? 1 : 0,
                    },
                    itemStyle: {
                      color: '#ef4444',
                      borderColor: '#ffffff',
                      borderWidth: 1.5,
                    },
                    emphasis: { disabled: true },
                    z: 4,
                    data: visibleLines.correctedNonSaldo ? chartData.correctedNonSaldo : [],
                  },
                ],
              }}
              style={{ height: isChartFullScreen ? 'calc(100vh - 75px)' : 570, backgroundColor: 'var(--color-background-metallic)' }}
              className="chart-wrapper-el"
              opts={{ renderer: 'svg' }}
            />
          );
        })()}
          </div>
        </div>

        {/* RIGHT COLUMN: KPIs & Bar Chart (Spans 1 column) */}
        <div className="flex flex-col justify-between h-full space-y-3">
          {/* KPI Cards (2x2 Grid) — Dynamic Labels based on kpiPerspective */}
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => setFilterStatus(prev => prev.length === 1 && prev[0] === 'KRITIS' ? [] : ['KRITIS'])}
              className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              title={`Klik untuk memfilter status ${kpiPerspective === 'GAP' ? 'Alert High' : 'Stok Kritis'}`}
            >
              <KpiCard label={kpiPerspective === 'GAP' ? "Alert High" : "Stok Kritis"} value={countKritis} borderColor="#ef4444" ledStatus={countKritis > 0 ? "red" : "green"} sparkData={[3, 2, 2, 3, 3, 3]} />
            </div>

            <div
              onClick={() => setFilterStatus(prev => prev.length === 1 && prev[0] === 'WASPADA' ? [] : ['WASPADA'])}
              className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              title={`Klik untuk memfilter status ${kpiPerspective === 'GAP' ? 'Alert Med' : 'Stok Waspada'}`}
            >
              <KpiCard label={kpiPerspective === 'GAP' ? "Alert Med" : "Stok Waspada"} value={countWaspada} borderColor="var(--color-led-amber)" ledStatus={countWaspada > 0 ? "amber" : "green"} sparkData={[5, 4, 3, 3, 4, 3]} />
            </div>

            <div
              onClick={() => setFilterStatus(prev => prev.length === 1 && prev[0] === 'AMAN' ? [] : ['AMAN'])}
              className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              title={`Klik untuk memfilter status ${kpiPerspective === 'GAP' ? 'Alert Low' : 'Stok Aman'}`}
            >
              <KpiCard label={kpiPerspective === 'GAP' ? "Alert Low" : "Stok Aman"} value={countAman} borderColor="var(--color-led-green)" ledStatus="green" sparkData={[10, 11, 12, 13, 14, 15]} />
            </div>

            <div
              onClick={() => setFilterStatus([])}
              className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              title="Klik untuk menampilkan seluruh material"
            >
              <KpiCard label="Total Material" value={aggregatedData.length} borderColor="var(--color-steel-border)" ledStatus="blue" sparkData={[10, 11, 12, 12, 13, 13]} />
            </div>
          </div>

          {/* Controls Bar: Perspective Selector & Threshold Settings */}
          <div className="flex gap-2 items-center">
            {/* Segmented Perspective Toggle Selector */}
            <div className="flex-1 flex rounded-lg p-0.5 border text-[10px] font-bold" style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
              <button
                onClick={() => setKpiPerspective('GAP')}
                className={`flex-1 py-1 px-1.5 rounded transition-all text-center ${kpiPerspective === 'GAP' ? 'shadow-sm font-black' : 'opacity-70 hover:opacity-100'}`}
                style={kpiPerspective === 'GAP' ? { backgroundColor: 'var(--color-primary)', color: '#ffffff' } : { color: 'var(--color-on-surface-variant)' }}
                title="Perspektif Waktu Gap Lead Time Pengadaan"
              >
                Gap (Lead Time)
              </button>
              <button
                onClick={() => setKpiPerspective('FISIK')}
                className={`flex-1 py-1 px-1.5 rounded transition-all text-center ${kpiPerspective === 'FISIK' ? 'shadow-sm font-black' : 'opacity-70 hover:opacity-100'}`}
                style={kpiPerspective === 'FISIK' ? { backgroundColor: 'var(--color-primary)', color: '#ffffff' } : { color: 'var(--color-on-surface-variant)' }}
                title="Perspektif Saldo Stok Fisik Rak Gudang (Safety Stock & ROP)"
              >
                Fisik (ROP)
              </button>
            </div>

            {/* Tombol Pengaturan Ambang Batas Ramping */}
            <button
              onClick={() => setIsThresholdModalOpen(true)}
              className="tactile-card rounded-lg px-2.5 py-1.5 flex items-center justify-center gap-1 text-xs font-bold transition-all hover:opacity-90 active:scale-[0.99]"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
              title="Pengaturan Ambang Batas"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>

          {/* ECharts — Pie Chart Status Distribusi */}
          <div className="tactile-card rounded-lg overflow-hidden flex-1 flex flex-col justify-between">
            <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>Status Distribusi</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Persentase status material aman, waspada, dan kritis</p>
              </div>
            </div>
            <div className="p-3 flex-1 flex flex-col justify-center items-center w-full min-h-[270px]" style={{ backgroundColor: 'var(--color-background-metallic)' }}>
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
                    bottom: 6,
                    left: 'center',
                    itemGap: 16,
                    itemWidth: 12,
                    itemHeight: 12,
                    textStyle: { color: ct.legendText, fontSize: 10.5, fontWeight: '700' },
                    formatter: (name: string) => {
                      if (name === 'Kritis') return `Kritis: ${countKritis}`;
                      if (name === 'Waspada') return `Waspada: ${countWaspada}`;
                      if (name === 'Aman') return `Aman: ${countAman}`;
                      return name;
                    }
                  },
                  series: [
                    {
                      name: 'Status Distribusi',
                      type: 'pie',
                      radius: ['48%', '75%'],
                      center: ['50%', '42%'],
                      avoidLabelOverlap: true,
                      minAngle: 8,
                      itemStyle: {
                        borderRadius: 6,
                        borderColor: isDark ? '#0f172a' : '#ffffff',
                        borderWidth: 2,
                      },
                      label: {
                        show: false
                      },
                      labelLine: {
                        show: false
                      },
                      emphasis: {
                        scale: true,
                        scaleSize: 6,
                        label: { show: false },
                        labelLine: { show: false }
                      },
                      data: [
                        {
                          value: countKritis,
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
                          value: countWaspada,
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
                          value: countAman,
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
                className="w-full h-full min-h-[250px]"
                style={{ width: '100%', height: '100%' }}
                opts={{ renderer: 'svg' }}
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
          className="rounded px-3 py-2 border text-sm w-full max-w-[160px] sm:max-w-xs"
          style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
          {depoOptions.map(d => <option key={d}>{d}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-bold tracking-wider">
          <span style={{ color: 'var(--color-on-surface-variant)' }}>Status:</span>
          {(['KRITIS', 'WASPADA', 'AMAN', 'BELUM PO'] as const).map(s => {
            let labelText = '';
            if (s === 'KRITIS') labelText = kpiPerspective === 'GAP' ? 'Alert High' : 'Stok Kritis';
            else if (s === 'WASPADA') labelText = kpiPerspective === 'GAP' ? 'Alert Med' : 'Stok Waspada';
            else if (s === 'AMAN') labelText = kpiPerspective === 'GAP' ? 'Alert Low' : 'Stok Aman';
            else if (s === 'BELUM PO') labelText = 'Belum PO';

            return (
              <label key={s} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={filterStatus.includes(s)} onChange={() => toggleStatus(s)} className="rounded w-3 h-3 sm:w-4 sm:h-4" />
                <span style={{ color: s === 'KRITIS' || s === 'BELUM PO' ? 'var(--color-led-red)' : s === 'WASPADA' ? 'var(--color-led-amber)' : 'var(--color-led-green)' }}>
                  {labelText}
                </span>
              </label>
            );
          })}
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
        <TableScrollWrapper maxHeight="500px">
          <table className="w-full text-left border-collapse min-w-[1100px] data-table">
            <thead>
              {/* Row 1: Groups */}
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                <th rowSpan={2} className="md:sticky left-0 z-20 px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-left whitespace-nowrap align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', backgroundColor: 'var(--color-primary-container)', borderColor: 'var(--color-steel-border)' }}>Nomor Material</th>
                <th rowSpan={2} className="md:sticky left-[105px] z-20 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.3)] px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-left whitespace-nowrap align-middle border-b border-r min-w-[200px]" style={{ color: 'var(--color-on-primary-container)', backgroundColor: 'var(--color-primary-container)', borderColor: 'var(--color-steel-border)' }}>Deskripsi Material</th>
                
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-center align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>
                  Stok Saat Ini<br/><span className="text-[8px] font-normal lowercase opacity-75">(pc/set/l)</span>
                </th>
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-center align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>
                  Stok Ideal<br/><span className="text-[8px] font-normal lowercase opacity-75">(pc/set/l)</span>
                </th>
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-center align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>
                  Safety Stock<br/><span className="text-[8px] font-normal lowercase opacity-75">(pc/set/l)</span>
                </th>
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-center align-middle border-b border-r whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>
                  ROP<br/><span className="text-[8px] font-normal lowercase opacity-75">(pc/set/l)</span>
                </th>
                <th rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-center align-middle border-b border-r whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>
                  Status ROP
                </th>
                {['% Ketersediaan','Habis (Plan)'].map(h => (
                  <th key={h} rowSpan={2} className="px-2 py-2.5 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap align-middle border-b border-r" style={{ color: 'var(--color-on-primary-container)', borderColor: 'var(--color-steel-border)' }}>{h}</th>
                ))}
                {/* Tanpa PO Group */}
                <th colSpan={5} className="px-2 py-1.5 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap border-b border-r" style={{ color: 'var(--color-led-amber)', backgroundColor: 'rgba(217,119,6,0.08)', borderColor: 'var(--color-steel-border)' }}>
                  TANPA PO ({calcMode})
                </th>
                {/* Dengan PO Group */}
                <th colSpan={5} className="px-2 py-1.5 text-[10px] font-black tracking-widest uppercase text-center whitespace-nowrap border-b border-r" style={{ color: 'var(--color-led-green)', backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'var(--color-steel-border)' }}>
                  DENGAN PO ({calcMode})
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
                const rowBg = isSelected 
                  ? 'var(--color-surface-container-high)' 
                  : i % 2 === 0 
                  ? 'var(--color-surface-dim)' 
                  : 'var(--color-background)';

                return (
                  <tr
                    key={row.nomor_material}
                    onClick={() => setSelectedMaterial(row.nomor_material)}
                    className="cursor-pointer transition-all hover:bg-[var(--color-surface-container-highest)]"
                    style={{ backgroundColor: rowBg }}
                  >
                    <td className="md:sticky left-0 z-10 px-2 py-2 font-bold text-[11px]" style={{ backgroundColor: rowBg, color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                    <td className="md:sticky left-[105px] z-10 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.3)] px-2 py-2 text-[11px] whitespace-nowrap font-medium min-w-[200px]" style={{ backgroundColor: rowBg, color: 'var(--color-on-surface-variant)' }} title={row.nama_material}>{row.nama_material}</td>
                    <td className="px-2 py-2 text-[11px] text-center font-medium" style={{ color: 'var(--color-on-surface)' }}>{row.current_stock.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-2 text-[11px] text-center" style={{ color: 'var(--color-on-surface-variant)' }}>{row.stok_ideal.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-2 text-[11px] text-center" style={{ color: 'var(--color-on-surface-variant)' }}>{(row.safety_stock ?? 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-2 text-[11px] text-center" style={{ color: 'var(--color-on-surface-variant)' }}>{(row.rop ?? 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <StatusBadge status={getFisikStatus(row)} perspective="FISIK" />
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center">
                      {/* % Ketersediaan bar */}
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-container-highest)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.pct_ketersediaan)}%`, backgroundColor: pctColor }} />
                        </div>
                        <span className="font-bold text-[11px] w-8 text-right" style={{ color: 'var(--color-on-surface)' }}>{row.pct_ketersediaan}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center font-medium whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>{(row as any).plan_habis_label}</td>
                    
                    {/* Skenario Tanpa PO (Orange Tint) */}
                    <td className="px-2 py-2 text-[11px] text-center font-medium whitespace-nowrap" style={{ color: 'var(--color-on-surface)', backgroundColor: 'rgba(217,119,6,0.02)' }}>{(row as any).koreksi_habis_no_po_label}</td>
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
                    <td className="px-2 py-2 text-center whitespace-nowrap" style={{ backgroundColor: 'rgba(217,119,6,0.02)' }}>
                      <StatusBadge status={getGapStatus(row)} perspective="GAP" />
                    </td>

                    {/* Skenario Dengan PO (Green Tint) */}
                    <td className="px-2 py-2 text-[11px] text-center font-semibold whitespace-nowrap" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: (row as any).po_kirim_label === '-' ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)' }}>
                      {(row as any).po_kirim_label}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center font-medium" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: 'var(--color-on-surface-variant)' }}>
                      {(row as any).jumlah_dipesan_label}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-center font-medium whitespace-nowrap" style={{ backgroundColor: 'rgba(16,185,129,0.02)', color: (row as any).koreksi_habis_with_po_label === '-' ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)' }}>{(row as any).koreksi_habis_with_po_label}</td>
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
        </TableScrollWrapper>
        <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
      </div>

      {/* Catatan & Keterangan Rumus Analisis Tabel */}
      <div className="mt-4 p-4 rounded-xl border flex flex-col gap-3 text-xs" style={{ backgroundColor: 'var(--color-surface-container-elevated)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
        <button
          onClick={() => setShowCalculationHelp(prev => !prev)}
          className="flex items-center justify-between font-bold w-full text-left cursor-pointer select-none"
          style={{ color: 'var(--color-on-surface)' }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--color-led-amber)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Keterangan Perhitungan Tabel:</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded border" style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>
            {showCalculationHelp ? 'Sembunyikan ▲' : 'Tampilkan ▼'}
          </span>
        </button>

        {showCalculationHelp && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--color-background-metallic)', borderColor: 'var(--color-steel-border)' }}>
              <span className="font-semibold block mb-1" style={{ color: 'var(--color-on-surface)' }}>1. % Ketersediaan</span>
              <code className="text-[10px] px-1 py-0.5 rounded font-mono block mb-1" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--color-on-surface)' }}>
                (Stok Saat Ini / Stok Ideal) × 100%
              </code>
              Persentase kecukupan persediaan barang fisik di depo saat ini dibanding batas aman ideal.
            </div>
            <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--color-background-metallic)', borderColor: 'var(--color-steel-border)' }}>
              <span className="font-semibold block mb-1" style={{ color: 'var(--color-on-surface)' }}>2. Habis (Plan)</span>
              <code className="text-[10px] px-1 py-0.5 rounded font-mono block mb-1" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--color-on-surface)' }}>
                Bulan GR Terakhir + (Qty GR / Target Plan Bulanan)
              </code>
              Estimasi waktu stok habis dari penerimaan barang (GR) terakhir jika pemakaian tepat sesuai target rencana perawatan baku.
            </div>
            <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--color-background-metallic)', borderColor: 'var(--color-steel-border)' }}>
              <span className="font-semibold block mb-1" style={{ color: 'var(--color-on-surface)' }}>3. Habis (Tanpa PO / Riwayat)</span>
              <code className="text-[10px] px-1 py-0.5 rounded font-mono block mb-1" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--color-on-surface)' }}>
                Stok Saat Ini / Laju Konsumsi Riil (Run Rate)
              </code>
              Estimasi waktu stok habis berdasarkan saldo fisik saat ini dibagi rata-rata laju konsumsi aktual riil tanpa tambahan pesanan baru.
            </div>
            <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--color-background-metallic)', borderColor: 'var(--color-steel-border)' }}>
              <span className="font-semibold block mb-1" style={{ color: 'var(--color-on-surface)' }}>4. Gap Defisit (Bulan)</span>
              <code className="text-[10px] px-1 py-0.5 rounded font-mono block mb-1" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--color-on-surface)' }}>
                Estimasi Bulan Habis - Rencana Kirim Barang
              </code>
              Selisih bulan antara waktu persediaan barang habis dengan perkiraan datangnya pasokan pengadaan baru.
            </div>
          </div>
        )}
      </div>

      <ThresholdModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        onSave={setThresholdConfig}
        allowedFields={['limitKritis', 'limitWaspada', 'limitAman', 'safetyStockMonths', 'ropMonths']}
      />
    </PageWrapper>
  );
}
