import type { MaintenanceSchedule, WorkOrder, TipePerawatan } from '../types';

export interface ScheduleComplianceDetail {
  id: string;
  nomor_rangkaian: string;
  seri_kereta?: string;
  tipe_perawatan: TipePerawatan | string;
  dipo?: string;
  status_plan: 'TERJADWAL' | 'TIDAK_ADA_PLAN';
  status_realisasi: 'TERLAKSANA' | 'BELUM_TERLAKSANA';
  order_no?: string;
  kepatuhan_status: 'TEPAT_WAKTU' | 'TERLAMBAT' | 'INSIDENTIL';
  tanggal_plan?: string;
}

export interface ScheduleComplianceSummary {
  hasPlan: boolean;
  totalPlan: number;
  totalRealisasi: number;
  tepatWaktuCount: number;
  terlambatCount: number;
  insidentilCount: number;
  rateKepatuhan: number; // 0 - 100
  details: ScheduleComplianceDetail[];
}

export function calculateScheduleCompliance(
  scheduleList: MaintenanceSchedule[],
  woList: WorkOrder[],
  filterMonth: number, // 0-indexed (0 = Jan, 6 = Jul)
  filterYear: number
): ScheduleComplianceSummary {
  // 1. Filter schedule (Plan) for selected month & year
  const monthlyPlans = scheduleList.filter(s => {
    if (!s.tanggal_rencana) return false;
    const d = new Date(s.tanggal_rencana);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  const hasPlan = monthlyPlans.length > 0;

  // 2. Aggregate WorkOrders/SAP transactions for selected month & year
  const realisedMap = new Map<string, { order_no: string; nomor_rangkaian: string; seri?: string; propulsi?: string }>();
  
  woList.forEach(wo => {
    if (wo.nomor_rangkaian && wo.nomor_wo) {
      const key = `${wo.nomor_rangkaian.toUpperCase()}_${wo.nomor_wo}`;
      if (!realisedMap.has(key)) {
        realisedMap.set(key, {
          order_no: wo.nomor_wo,
          nomor_rangkaian: wo.nomor_rangkaian,
          seri: wo.seri_kereta,
          propulsi: wo.propulsi
        });
      }
    }
  });

  const details: ScheduleComplianceDetail[] = [];
  const matchedWoKeys = new Set<string>();

  let tepatWaktuCount = 0;
  let terlambatCount = 0;

  // 3. Process Plans
  monthlyPlans.forEach(plan => {
    const matchedEntryKey = Array.from(realisedMap.keys()).find(k => {
      const entry = realisedMap.get(k);
      if (!entry) return false;
      const cleanEntry = entry.nomor_rangkaian.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanPlan = plan.nomor_rangkaian.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanEntry && cleanPlan && (cleanEntry === cleanPlan || cleanEntry.includes(cleanPlan) || cleanPlan.includes(cleanEntry));
    });

    if (matchedEntryKey || plan.status_pelaksanaan === 'Selesai' || plan.status_pelaksanaan === 'Sedang Dirawat') {
      const matched = matchedEntryKey ? realisedMap.get(matchedEntryKey) : null;
      if (matchedEntryKey) matchedWoKeys.add(matchedEntryKey);

      tepatWaktuCount++;
      details.push({
        id: `plan-${plan.id}`,
        nomor_rangkaian: plan.nomor_rangkaian,
        seri_kereta: plan.seri_kereta,
        tipe_perawatan: plan.tipe_perawatan,
        dipo: plan.dipo,
        status_plan: 'TERJADWAL',
        status_realisasi: 'TERLAKSANA',
        order_no: matched?.order_no || 'SAP-ONGOING',
        kepatuhan_status: 'TEPAT_WAKTU',
        tanggal_plan: plan.tanggal_rencana
      });
    } else {
      terlambatCount++;
      details.push({
        id: `plan-${plan.id}`,
        nomor_rangkaian: plan.nomor_rangkaian,
        seri_kereta: plan.seri_kereta,
        tipe_perawatan: plan.tipe_perawatan,
        dipo: plan.dipo,
        status_plan: 'TERJADWAL',
        status_realisasi: 'BELUM_TERLAKSANA',
        kepatuhan_status: 'TERLAMBAT',
        tanggal_plan: plan.tanggal_rencana
      });
    }
  });

  // 4. Process Unplanned Realisations (Insidentil)
  let insidentilCount = 0;
  if (hasPlan) {
    realisedMap.forEach((val, key) => {
      if (!matchedWoKeys.has(key)) {
        const inPlan = monthlyPlans.some(p => p.nomor_rangkaian.toLowerCase() === val.nomor_rangkaian.toLowerCase());
        if (!inPlan) {
          insidentilCount++;
          details.push({
            id: `unplanned-${key}`,
            nomor_rangkaian: val.nomor_rangkaian,
            seri_kereta: val.seri || '—',
            tipe_perawatan: 'PB PLH',
            dipo: 'Gudang Utama / Depo',
            status_plan: 'TIDAK_ADA_PLAN',
            status_realisasi: 'TERLAKSANA',
            order_no: val.order_no,
            kepatuhan_status: 'INSIDENTIL'
          });
        }
      }
    });
  }

  const totalPlan = monthlyPlans.length;
  const totalRealisasi = tepatWaktuCount + insidentilCount;
  const rateKepatuhan = totalPlan > 0 ? Math.round((tepatWaktuCount / totalPlan) * 100) : 0;

  return {
    hasPlan,
    totalPlan,
    totalRealisasi,
    tepatWaktuCount,
    terlambatCount,
    insidentilCount,
    rateKepatuhan,
    details
  };
}
