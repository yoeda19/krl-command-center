import type { MaintenanceSchedule, WorkOrder, TipePerawatan } from '../types';

export interface RealOrderRecord {
  order_no: string;
  description: string;
  description2?: string;
  order_date?: string;
  status?: string;
}

export interface ScheduleComplianceDetail {
  id: string;
  nomor_rangkaian: string;
  seri_kereta?: string;
  tipe_perawatan: TipePerawatan | string;
  dipo?: string;
  status_plan: 'TERJADWAL' | 'TIDAK_ADA_PLAN';
  status_realisasi: 'TERLAKSANA' | 'BELUM_TERLAKSANA';
  order_no?: string;
  deskripsi_order?: string;
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

export function isOrderMatchingPlanType(planType: string, orderDesc: string): boolean {
  if (!orderDesc) return false;
  const cleanPlan = (planType || '').toUpperCase().replace(/[\s\-_]/g, '');
  const cleanDesc = (orderDesc || '').toUpperCase();

  // 1. Direct match (e.g. "P1-1", "P1-4", "P3", "P6", "P12", "P24", "P48")
  if (cleanDesc.includes(cleanPlan)) return true;

  // 2. P1 sub-types (P1-1..P1-5) matching generic "P1" or routine monthly orders
  if (cleanPlan.startsWith('P1')) {
    if (cleanDesc.includes('P1') || cleanDesc.includes('BULANAN') || cleanDesc.includes('PERIODIC 1') || cleanDesc.includes('TRUN TABLE')) {
      return true;
    }
  }

  // 3. PB / Perbaikan Khusus
  if (cleanPlan.startsWith('PB') || cleanPlan.includes('BUBUT') || cleanPlan.includes('KEPING') || cleanPlan.includes('GCU')) {
    if (cleanDesc.includes('PB') || cleanDesc.includes('BUBUT') || cleanDesc.includes('KEPING') || cleanDesc.includes('GCU') || cleanDesc.includes('PLH')) {
      return true;
    }
  }

  // 4. Exact word boundary match
  const regex = new RegExp(`\\b${cleanPlan}\\b`, 'i');
  if (regex.test(orderDesc)) return true;

  return false;
}

function isOrderForTrainset(planTrainNo: string, order: RealOrderRecord): boolean {
  const normPlan = (planTrainNo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normPlan) return false;
  const normDesc1 = (order.description || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normDesc2 = (order.description2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normDesc2 && (normDesc2 === normPlan || normDesc2.includes(normPlan) || normPlan.includes(normDesc2))) {
    return true;
  }
  if (normDesc1 && normDesc1.includes(normPlan)) {
    return true;
  }
  return false;
}

export function calculateScheduleCompliance(
  scheduleList: MaintenanceSchedule[],
  woList: WorkOrder[],
  filterMonth: number, // 0-indexed (0 = Jan, 6 = Jul)
  filterYear: number,
  realOrders: RealOrderRecord[] = []
): ScheduleComplianceSummary {
  // 1. Filter schedule (Plan) for selected month & year
  const monthlyPlans = scheduleList.filter(s => {
    if (!s.tanggal_rencana) return false;
    const parts = s.tanggal_rencana.split('-');
    if (parts.length < 2) return false;
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    return mo === filterMonth && yr === filterYear;
  });

  const hasPlan = monthlyPlans.length > 0;

  // 2. Aggregate WorkOrders for selected month & year
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
  const matchedOrderNos = new Set<string>();
  const matchedWoKeys = new Set<string>();

  let tepatWaktuCount = 0;
  let terlambatCount = 0;

  // 3. Process Plans with strict Description vs Type matching
  monthlyPlans.forEach(plan => {
    let matchedOrder: RealOrderRecord | null = null;
    let isTypeMatched = false;

    if (realOrders && realOrders.length > 0) {
      const trainOrders = realOrders.filter(o => isOrderForTrainset(plan.nomor_rangkaian, o));
      if (trainOrders.length > 0) {
        const typeMatch = trainOrders.find(o => isOrderMatchingPlanType(plan.tipe_perawatan, o.description));
        if (typeMatch) {
          matchedOrder = typeMatch;
          isTypeMatched = true;
        } else {
          matchedOrder = trainOrders[0];
          isTypeMatched = false;
        }
      }
    }

    const matchedWoEntryKey = Array.from(realisedMap.keys()).find(k => {
      const entry = realisedMap.get(k);
      if (!entry) return false;
      const cleanEntry = entry.nomor_rangkaian.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanPlan = plan.nomor_rangkaian.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanEntry && cleanPlan && (cleanEntry === cleanPlan || cleanEntry.includes(cleanPlan) || cleanPlan.includes(cleanEntry));
    });

    if (matchedOrder && isTypeMatched) {
      matchedOrderNos.add(matchedOrder.order_no);
      tepatWaktuCount++;
      const formattedOrderNo = matchedOrder.order_no.startsWith('WO-') ? matchedOrder.order_no : `WO-${matchedOrder.order_no}`;
      details.push({
        id: `plan-${plan.id}`,
        nomor_rangkaian: plan.nomor_rangkaian,
        seri_kereta: plan.seri_kereta,
        tipe_perawatan: plan.tipe_perawatan,
        dipo: plan.dipo,
        status_plan: 'TERJADWAL',
        status_realisasi: 'TERLAKSANA',
        order_no: formattedOrderNo,
        deskripsi_order: matchedOrder.description,
        kepatuhan_status: 'TEPAT_WAKTU',
        tanggal_plan: plan.tanggal_rencana
      });
    } else if (matchedOrder && !isTypeMatched) {
      // Order exists on this train, but description/type is DIFFERENT
      matchedOrderNos.add(matchedOrder.order_no);
      terlambatCount++;
      const formattedOrderNo = matchedOrder.order_no.startsWith('WO-') ? matchedOrder.order_no : `WO-${matchedOrder.order_no}`;
      details.push({
        id: `plan-${plan.id}`,
        nomor_rangkaian: plan.nomor_rangkaian,
        seri_kereta: plan.seri_kereta,
        tipe_perawatan: plan.tipe_perawatan,
        dipo: plan.dipo,
        status_plan: 'TERJADWAL',
        status_realisasi: 'BELUM_TERLAKSANA',
        order_no: formattedOrderNo,
        deskripsi_order: `Beda Program: ${matchedOrder.description}`,
        kepatuhan_status: 'TERLAMBAT',
        tanggal_plan: plan.tanggal_rencana
      });
    } else if (matchedWoEntryKey || plan.status_pelaksanaan === 'Selesai' || plan.status_pelaksanaan === 'Proses Perawatan' || plan.status_pelaksanaan === 'Sedang Dirawat') {
      const woMatch = matchedWoEntryKey ? realisedMap.get(matchedWoEntryKey) : null;
      if (matchedWoEntryKey) matchedWoKeys.add(matchedWoEntryKey);

      tepatWaktuCount++;
      const formattedOrderNo = woMatch?.order_no 
        ? (woMatch.order_no.startsWith('WO-') ? woMatch.order_no : `WO-${woMatch.order_no}`)
        : `WO-${String(200000000000 + plan.id)}`;

      details.push({
        id: `plan-${plan.id}`,
        nomor_rangkaian: plan.nomor_rangkaian,
        seri_kereta: plan.seri_kereta,
        tipe_perawatan: plan.tipe_perawatan,
        dipo: plan.dipo,
        status_plan: 'TERJADWAL',
        status_realisasi: 'TERLAKSANA',
        order_no: formattedOrderNo,
        deskripsi_order: `Perawatan Rutin ${plan.tipe_perawatan}`,
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
        order_no: undefined,
        deskripsi_order: 'Belum ada realisasi order',
        kepatuhan_status: 'TERLAMBAT',
        tanggal_plan: plan.tanggal_rencana
      });
    }
  });

  // 4. Process Unplanned Realisations (Insidentil)
  let insidentilCount = 0;
  if (hasPlan && realOrders && realOrders.length > 0) {
    realOrders.forEach(ord => {
      if (!matchedOrderNos.has(ord.order_no)) {
        const inPlan = monthlyPlans.some(p => isOrderForTrainset(p.nomor_rangkaian, ord));
        if (!inPlan) {
          insidentilCount++;
          details.push({
            id: `unplanned-ord-${ord.order_no}`,
            nomor_rangkaian: ord.description2 || 'Rangkaian Tambahan',
            seri_kereta: '—',
            tipe_perawatan: ord.description.slice(0, 15),
            dipo: 'Gudang Utama / Depo',
            status_plan: 'TIDAK_ADA_PLAN',
            status_realisasi: 'TERLAKSANA',
            order_no: ord.order_no,
            deskripsi_order: ord.description,
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
