import { supabase } from '../lib/supabaseClient';
import type {
  FleetMetrics, CriticalStockItem, SafetyStockItem,
  ProcurementItem, SlowMovingItem, MaintenanceSchedule,
  WorkOrder, AuditLog, AdminParameter, MonthlyPlan, MaintenanceBomConfig,
  RestockItem, AgingKategori
} from '../types';

// ── 1. FLEET METRICS ──────────────────────────────────────
export async function getFleetMetrics(): Promise<FleetMetrics> {
  try {
    const { data: dbMetrics } = await supabase
      .from('fleet_maintenance_metrics')
      .select('*')
      .order('id', { ascending: false })
      .limit(1);

    if (dbMetrics && dbMetrics.length > 0) {
      const metric = dbMetrics[0];
      return {
        total_fleet: Number(metric.total_fleet),
        siap_dinas: Number(metric.siap_dinas),
        in_maintenance: Number(metric.in_maintenance),
        tidak_beroperasi: Number(metric.tidak_beroperasi),
        efisiensi_perawatan: Number(metric.efisiensi_perawatan),
      };
    }

    const { data: allEquipment } = await supabase
      .from('equipment_master')
      .select('id, parent_id, level');

    const { data: activeOrders } = await supabase
      .from('orders')
      .select('equipment_id')
      .not('status', 'eq', 'Selesai')
      .not('status', 'eq', 'Closed')
      .not('status', 'eq', 'Completed')
      .not('status', 'eq', 'CLSD')
      .not('status', 'eq', 'TECO');

    if (!allEquipment || allEquipment.length === 0) {
      return { total_fleet: 0, siap_dinas: 0, in_maintenance: 0, tidak_beroperasi: 0, efisiensi_perawatan: 0 };
    }

    const trains = allEquipment.filter(e => e.parent_id === null || e.level === 1);
    const total_fleet = trains.length;

    const activeEqIds = new Set(activeOrders?.map(o => o.equipment_id).filter(Boolean) || []);
    let in_maintenance = 0;
    trains.forEach(t => {
      const children = allEquipment.filter(e => e.parent_id === t.id);
      const hasActiveOrder = activeEqIds.has(t.id) || children.some(c => activeEqIds.has(c.id));
      if (hasActiveOrder) {
        in_maintenance++;
      }
    });

    const tidak_beroperasi = Math.round(total_fleet * 0.08); // 8% default
    const siap_dinas = Math.max(0, total_fleet - in_maintenance - tidak_beroperasi);
    const efisiensi_perawatan = 98.0;

    return {
      total_fleet,
      siap_dinas,
      in_maintenance,
      tidak_beroperasi,
      efisiensi_perawatan,
    };
  } catch (err) {
    console.error('Error calculating fleet metrics:', err);
    return { total_fleet: 0, siap_dinas: 0, in_maintenance: 0, tidak_beroperasi: 0, efisiensi_perawatan: 0 };
  }
}

export async function updateFleetMetrics(metrics: Omit<FleetMetrics, 'tidak_beroperasi'>): Promise<void> {
  const tidak_beroperasi = metrics.total_fleet - metrics.siap_dinas - metrics.in_maintenance;
  await supabase
    .from('fleet_maintenance_metrics')
    .insert([{ ...metrics, tidak_beroperasi }]);
}

// ── 1b. MASTER MATERIALS LIST ──────────────────────────────
export async function getMasterMaterials(): Promise<{ nomor_material: string; nama_material: string }[]> {
  const { data, error } = await supabase
    .from('master_materials')
    .select('nomor_material, nama_material')
    .order('nomor_material', { ascending: true });
  if (error || !data) return [];
  return data;
}

// ── 2. CRITICAL STOCK & ABSOLUTION HISTORY ────────────────
// Pemetaan kode gudang SAP ke label nama depo
export const GUDANG_LABEL_MAP: Record<string, string> = {
  'C009': 'Gudang Overhaul Manggarai',
  'C009T': 'Transit OHM', 'C010': 'Transit OHM',
  'C013': 'Gudang Pusat', 'C001': 'Gudang Pusat',
  'C007': 'Gudang Depo Depok',
  'C007T': 'Transit Depok', 'C003': 'Transit Depok',
  'C006': 'Gudang Depo Bukit Duri',
  'C006T': 'Transit Bukit Duri',
  'C020': 'Gudang Depo Manggarai',
  'C020T': 'Transit Manggarai',
  'C008': 'Gudang Depo Bogor',
  'C008T': 'Transit Bogor',
};

export async function getCriticalStockData(): Promise<CriticalStockItem[]> {
  const { data: materials, error: errMat } = await supabase
    .from('master_materials')
    .select('*');

  if (errMat || !materials) return [];

  const { data: configs } = await supabase
    .from('ideal_stock_configurations')
    .select('*');

  const { data: adminParams } = await supabase
    .from('procurement_progress')
    .select('nomor_material, plan_lead_time, tanggal_rencana_pengiriman, jumlah_dipesan');

  // Caching mechanism for recent_history (cutoff dari Januari 2025)
  let history: { id: number; nomor_material: string; qty: number; tanggal: string | null; gudang: string; order_no: string | null }[] = [];
  const cutoffStr = '2025-01-01';

  try {
    const cacheKey = 'skcd_recent_history_cache_v12';
    const cachedStr = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
    let cachedData: any[] = [];
    if (cachedStr) {
      try {
        cachedData = JSON.parse(cachedStr);
      } catch (e) {
        console.error('Failed to parse recent_history cache:', e);
      }
    }

    // Tentukan tanggal awal kueri
    let queryStartStr = cutoffStr;
    if (cachedData.length > 0) {
      const dates = cachedData.map(d => d.tanggal).filter(Boolean) as string[];
      if (dates.length > 0) {
        // Ambil tanggal max dari cache, kurangi 1 hari untuk memastikan overlap agar tidak ada yang terlewat
        const maxDate = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
        maxDate.setDate(maxDate.getDate() - 1);
        queryStartStr = maxDate.toISOString().split('T')[0];
      }
    }

    const registeredMaterialNos = (materials || []).map(m => String(m.nomor_material).trim());

    // Ambil data baru dari Supabase dengan loop paginasi (karena limit max_rows server Supabase adalah 1000)
    let dbNewData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data: pageData, error: dbErr } = await supabase
        .from('recent_history')
        .select('id, nomor_material, qty, tanggal, gudang, order_no')
        .gte('tanggal', queryStartStr)
        .in('nomor_material', registeredMaterialNos)
        .range(from, to);

      if (dbErr) {
        console.error(`Error fetching history page ${page}:`, dbErr);
        hasMore = false;
        break;
      }

      if (pageData && pageData.length > 0) {
        dbNewData = dbNewData.concat(pageData);
        if (pageData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
      if (page > 30) break; // safety cutoff
    }

    const newData = dbNewData || [];
    
    // Gabungkan cache dan data baru
    const mergedMap = new Map<number, any>();
    cachedData.forEach(item => {
      if (item.id) mergedMap.set(item.id, item);
    });
    newData.forEach(item => {
      if (item.id) mergedMap.set(item.id, item);
    });

    // Filter yang sesuai cutoff Januari 2025
    const allHistory = Array.from(mergedMap.values()).filter(item => {
      return item.tanggal && item.tanggal >= cutoffStr;
    });

    // Simpan kembali ke localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(allHistory));
      } catch (e) {
        console.warn('Storage quota exceeded, could not write recent_history cache:', e);
      }
    }
    history = allHistory;
  } catch (err) {
    console.error('Error inside caching routine:', err);
    
    // Fallback query dengan paginasi
    let fallbackData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data: pageData, error: dbErr } = await supabase
        .from('recent_history')
        .select('id, nomor_material, qty, tanggal, gudang, order_no')
        .gte('tanggal', cutoffStr)
        .range(from, to);

      if (dbErr || !pageData || pageData.length === 0) {
        hasMore = false;
      } else {
        fallbackData = fallbackData.concat(pageData);
        if (pageData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
      if (page > 30) break;
    }
    history = fallbackData;
  }

  const { data: monthlyPlans } = await supabase
    .from('monthly_absorption_plans')
    .select('*');

  const result: CriticalStockItem[] = [];

  materials.forEach(mat => {
    const config = configs?.find(c => c.nomor_material === mat.nomor_material);
    const param = adminParams?.find(p => p.nomor_material === mat.nomor_material);
    const matHistory = history?.filter(h => h.nomor_material === mat.nomor_material) || [];
    const matPlans = (monthlyPlans || []).filter(p => p.nomor_material === mat.nomor_material).map(p => ({
      ...p,
      gudang: p.gudang || 'GLOBAL'
    }));

    const ideal_qty = config?.ideal_qty_manual || 0;

    // Rencana kedatangan
    let t_arrival = 99;
    if (param?.tanggal_rencana_pengiriman) {
      const deliveryDate = new Date(param.tanggal_rencana_pengiriman);
      const today = new Date();
      const diffMonths = (deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.4);
      t_arrival = diffMonths > 0 ? Math.round(diffMonths * 10) / 10 : 0;
    }

    const lead_time = param?.plan_lead_time ? Math.round((param.plan_lead_time / 30) * 10) / 10 : 4.0;

    // 6 Warehouse definitions based on master_materials columns
    const warehouses = [
      {
        gudang: 'C013',
        gudang_label: 'Gudang Pusat',
        current_stock: Number(mat.pst || 0)
      },
      {
        gudang: 'C007',
        gudang_label: 'Gudang Depo Depok',
        current_stock: Number(mat.dpk || 0) + Number(mat.dpkt || 0)
      },
      {
        gudang: 'C006',
        gudang_label: 'Gudang Depo Bukit Duri',
        current_stock: Number(mat.dbkd || 0) + Number(mat.dbkdt || 0)
      },
      {
        gudang: 'C009',
        gudang_label: 'Gudang Overhaul Manggarai',
        current_stock: Number(mat.omri || 0) + Number(mat.omrit || 0)
      },
      {
        gudang: 'C008',
        gudang_label: 'Gudang Depo Bogor',
        current_stock: Number(mat.dbgr || 0) + Number(mat.dbgrt || 0)
      },
      {
        gudang: 'C020',
        gudang_label: 'Gudang Depo Manggarai',
        current_stock: Number(mat.dmri || 0) + Number(mat.dmrit || 0)
      }
    ];

    const now = new Date();

    warehouses.forEach(wh => {
      // History spesifik gudang ini
      const whHistory = matHistory.filter(h => h.gudang === wh.gudang);

      // Hitung Laju Konsumsi Aktual (CR_actual) per gudang dari history 12 bulan terakhir
      const cutoff12 = new Date();
      cutoff12.setMonth(cutoff12.getMonth() - 12);
      const whHistory12 = whHistory.filter(h => h.tanggal && new Date(h.tanggal) >= cutoff12);
      const totalQty = whHistory12.reduce((sum, h) => sum + (h.qty || 0), 0);
      const cr_actual = totalQty > 0 ? Math.round((totalQty / 12) * 10) / 10 : 0;

      // Plan bulanan untuk bulan ini (dengan fallback jika bukan C013)
      let plan_bulanan = 0;
      if (wh.gudang !== 'C013') {
        const curPlanWh = matPlans.find(p => p.gudang === wh.gudang && p.tahun === now.getFullYear() && p.bulan === (now.getMonth() + 1));
        if (curPlanWh) {
          plan_bulanan = curPlanWh.plan_qty;
        } else {
          const curPlanGlobal = matPlans.find(p => (p.gudang === 'GLOBAL' || !p.gudang) && p.tahun === now.getFullYear() && p.bulan === (now.getMonth() + 1));
          plan_bulanan = curPlanGlobal ? Math.round(curPlanGlobal.plan_qty / 5) : 0;
        }
      }

      // Perkiraan habis per gudang
      const t_exhaustion = cr_actual > 0 ? Math.round((wh.current_stock / cr_actual) * 10) / 10 : 99;
      const pct_ketersediaan = ideal_qty > 0 ? Math.round((wh.current_stock / ideal_qty) * 100) : 0;

      // Status berdasarkan Gap Analisis
      const gap_analisis = Math.round((t_exhaustion - lead_time) * 10) / 10;
      let status: 'AMAN' | 'WASPADA' | 'KRITIS' = 'AMAN';
      if (gap_analisis <= 2.0) status = 'KRITIS';
      else if (gap_analisis <= 3.0) status = 'WASPADA';

      // Data realisasi per bulan dari history nyata (Jan–Des tahun berjalan)
      const monthlyRealisasi: (number | null)[] = Array(12).fill(null);
      const monthlyPlanArray: number[] = [];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const targetYr = d.getFullYear();
        const targetMo = d.getMonth() + 1;

        // Plan target bulanan dinamis per gudang (dengan fallback)
        let plan_qty = 0;
        if (wh.gudang !== 'C013') {
          const pRecordWh = matPlans.find(p => p.gudang === wh.gudang && p.tahun === targetYr && p.bulan === targetMo);
          if (pRecordWh) {
            plan_qty = pRecordWh.plan_qty;
          } else {
            const pRecordGlobal = matPlans.find(p => (p.gudang === 'GLOBAL' || !p.gudang) && p.tahun === targetYr && p.bulan === targetMo);
            plan_qty = pRecordGlobal ? Math.round(pRecordGlobal.plan_qty / 5) : 0;
          }
        }
        monthlyPlanArray.push(plan_qty);

        // Cari transaksi realisasi spesifik gudang ini
        const monthsAgo = (now.getFullYear() - targetYr) * 12 + (now.getMonth() - (targetMo - 1));
        const idx = 11 - monthsAgo;
        if (idx >= 0 && idx < 12) {
          const matchedTx = whHistory.filter(h => {
            if (!h.tanggal) return false;
            const txDate = new Date(h.tanggal);
            return txDate.getFullYear() === targetYr && (txDate.getMonth() + 1) === targetMo;
          });
          const sumQty = matchedTx.reduce((s, h) => s + (h.qty || 0), 0);
          monthlyRealisasi[idx] = sumQty > 0 ? sumQty : null;
        }
      }

      result.push({
        nomor_material: mat.nomor_material,
        nama_material: mat.nama_material,
        satuan: mat.satuan,
        gudang: wh.gudang,
        gudang_label: wh.gudang_label,
        current_stock: wh.current_stock,
        stok_ideal: ideal_qty,
        cr_actual,
        plan_bulanan,
        lead_time,
        t_exhaustion,
        t_arrival,
        gap_defisit: gap_analisis,
        pct_ketersediaan,
        status,
        rencana_awal: monthlyPlanArray,
        realisasi: monthlyRealisasi,
        all_plans: (() => {
          const keys = Array.from(new Set(matPlans.map(p => `${p.tahun}-${p.bulan}`)));
          return keys.map(key => {
            const [tahun, bulan] = key.split('-').map(Number);
            const pWh = matPlans.find(p => p.gudang === wh.gudang && p.tahun === tahun && p.bulan === bulan);
            if (pWh) {
              return { tahun, bulan, plan_qty: pWh.plan_qty };
            }
            const pGlobal = matPlans.find(p => (p.gudang === 'GLOBAL' || !p.gudang) && p.tahun === tahun && p.bulan === bulan);
            return {
              tahun,
              bulan,
              plan_qty: wh.gudang === 'C013' ? 0 : (pGlobal ? Math.round(pGlobal.plan_qty / 5) : 0)
            };
          });
        })(),
        all_history: whHistory.map(h => ({ qty: h.qty, tanggal: h.tanggal, gudang: h.gudang, order_no: h.order_no })),
        tanggal_rencana_pengiriman: param?.tanggal_rencana_pengiriman || null,
        jumlah_dipesan: param?.jumlah_dipesan || 0,
      });
    });
  });

  return result;
}

// ── 3. SAFETY STOCK ───────────────────────────────────────
export async function getSafetyStockData(): Promise<SafetyStockItem[]> {
  const critical = await getCriticalStockData();
  const groups: Record<string, SafetyStockItem> = {};

  critical.forEach(c => {
    if (!groups[c.nomor_material]) {
      const safety_level = Math.round(c.stok_ideal * 0.6);
      const reorder_point = Math.round(c.stok_ideal * 0.3);
      groups[c.nomor_material] = {
        nomor_material: c.nomor_material,
        nama_material: c.nama_material,
        satuan: c.satuan,
        current_stock: 0,
        safety_stock_level: safety_level,
        reorder_point,
        status: 'AMAN',
        gap_bulan: 99,
        silenced: false,
      };
    }
    groups[c.nomor_material].current_stock += c.current_stock;
  });

  return Object.values(groups).map(item => {
    const ref = critical.find(c => c.nomor_material === item.nomor_material);
    if (ref) {
      const t_exhaustion = ref.cr_actual > 0 ? Math.round((item.current_stock / ref.cr_actual) * 10) / 10 : 99;
      const gap_defisit = Math.round((t_exhaustion - ref.lead_time) * 10) / 10;
      let status: 'AMAN' | 'WASPADA' | 'KRITIS' = 'AMAN';
      if (gap_defisit <= 2.0) status = 'KRITIS';
      else if (gap_defisit <= 3.0) status = 'WASPADA';

      return {
        ...item,
        status,
        gap_bulan: gap_defisit,
      };
    }
    return item;
  });
}

// ── 4. PROCUREMENT PO & TRANSIT ───────────────────────────
export async function getProcurementData(): Promise<ProcurementItem[]> {
  const { data, error } = await supabase
    .from('procurement_progress')
    .select('*')
    .order('id', { ascending: true });

  if (error || !data) return [];
  return data as ProcurementItem[];
}

export async function addProcurement(item: Omit<ProcurementItem, 'id' | 'actual_lead_time' | 'tanggal_penerimaan_barang'>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('procurement_progress')
    .insert([item]);
  return { error: error?.message ?? null };
}

export async function updateProcurement(id: number, updates: Partial<ProcurementItem>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('procurement_progress')
    .update(updates)
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteProcurement(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('procurement_progress')
    .delete()
    .eq('id', id);
  return { error: error?.message ?? null };
}

// ── 5. SLOW MOVING & AGING ────────────────────────────────
export async function getSlowMovingData(): Promise<SlowMovingItem[]> {
  const { data: materials } = await supabase
    .from('master_materials')
    .select('*');

  const { data: recs } = await supabase
    .from('dead_stock_recommendations')
    .select('*');

  if (!materials) return [];

  const matIds = materials.map(m => m.nomor_material);

  const { data: history } = await supabase
    .from('recent_history')
    .select('nomor_material, tanggal, harga_satuan')
    .in('nomor_material', matIds)
    .order('tanggal', { ascending: false });

  const today = new Date('2026-07-11'); // Anchor to system current date

  // Map history to get latest movement and average unit price per material
  const matStats: Record<string, { lastDate: Date; harga: number }> = {};
  if (history) {
    history.forEach(h => {
      const matNo = h.nomor_material;
      const d = new Date(h.tanggal);
      const price = Number(h.harga_satuan) || 0;
      
      if (!matStats[matNo]) {
        matStats[matNo] = { lastDate: d, harga: price };
      } else {
        if (d > matStats[matNo].lastDate) {
          matStats[matNo].lastDate = d;
        }
        if (price > 0) {
          matStats[matNo].harga = price;
        }
      }
    });
  }

  return materials.map(m => {
    const rec = recs?.find(r => r.nomor_material === m.nomor_material);
    const stats = matStats[m.nomor_material];
    
    const lastDate = stats ? stats.lastDate : new Date('2025-06-01');
    const harga_satuan = stats?.harga || 45000;
    
    // Calculate difference in days
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const usia_pengendapan_hari = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let kategori: AgingKategori = 'Fresh';
    if (m.total_stock === 0) {
      kategori = 'Stock Out';
    } else {
      if (usia_pengendapan_hari > 180) kategori = 'Dead Stock';
      else if (usia_pengendapan_hari > 90) kategori = 'At Risk';
      else if (usia_pengendapan_hari > 30) kategori = 'Slow-Moving';
    }

    let autoRec = 'Stok dalam kondisi normal.';
    if (kategori === 'Stock Out') {
      autoRec = 'Stok habis (Stock Out). Disarankan segera lakukan PO / pengadaan ulang.';
    } else if (kategori === 'Dead Stock') {
      autoRec = 'Stok mati (>180 hari). Disarankan retur ke vendor, lelang disposal, atau transfer depo.';
    } else if (kategori === 'At Risk') {
      autoRec = 'Risiko pengendapan tinggi (91-180 hari). Batasi pengadaan baru, pantau laju konsumsi.';
    } else if (kategori === 'Slow-Moving') {
      autoRec = 'Pergerakan lambat (31-90 hari). Pantau berkala sebelum melakukan PO baru.';
    }

    const rekomendasi = rec?.rekomendasi_ahli || autoRec;

    return {
      nomor_material: m.nomor_material,
      nama_material: m.nama_material,
      satuan: m.satuan,
      current_stock: m.total_stock,
      harga_satuan,
      nilai_aset: m.total_stock * harga_satuan,
      last_movement: lastDate.toISOString().split('T')[0],
      usia_pengendapan_hari,
      kategori,
      rekomendasi,
      stocks: {
        'Gudang Pusat': Number(m.pst || 0),
        'Depo Depok': Number(m.dpk || 0) + Number(m.dpkt || 0),
        'Depo Bukit Duri': Number(m.dbkd || 0) + Number(m.dbkdt || 0),
        'Overhaul Manggarai': Number(m.omri || 0) + Number(m.omrit || 0),
        'Depo Bogor': Number(m.dbgr || 0) + Number(m.dbgrt || 0),
        'Depo Manggarai': Number(m.dmri || 0) + Number(m.dmrit || 0),
      }
    };
  });
}

// ── 5b. RESTOCK DATA ──────────────────────────────────────
export async function getRestockData(): Promise<RestockItem[]> {
  const { data: materials } = await supabase
    .from('master_materials')
    .select('nomor_material');

  if (!materials || materials.length === 0) return [];
  const matIds = materials.map(m => m.nomor_material);

  const { data, error } = await supabase
    .from('restock')
    .select('*')
    .in('nomor_material', matIds)
    .order('tanggal', { ascending: false });

  if (error || !data) return [];
  return data as RestockItem[];
}

// ── 6. MAINTENANCE SCHEDULE & WORK ORDERS ──────────────────
export async function getMaintenanceSchedule(): Promise<MaintenanceSchedule[]> {
  const { data, error } = await supabase
    .from('maintenance_schedule')
    .select('*')
    .order('tanggal_rencana', { ascending: true });

  if (error || !data) return [];
  return data as MaintenanceSchedule[];
}

export async function addMaintenanceSchedule(schedule: Omit<MaintenanceSchedule, 'id'>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('maintenance_schedule')
    .insert([schedule]);
  return { error: error?.message ?? null };
}

export async function updateMaintenanceSchedule(id: number, updates: Partial<MaintenanceSchedule>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('maintenance_schedule')
    .update(updates)
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteMaintenanceSchedule(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('maintenance_schedule')
    .delete()
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const { data: woData, error: errWO } = await supabase
    .from('work_orders')
    .select('*')
    .order('id', { ascending: true });

  if (errWO || !woData) return [];

  const { data: schedData } = await supabase
    .from('maintenance_schedule')
    .select('*');

  const { data: matData } = await supabase
    .from('master_materials')
    .select('nomor_material, nama_material, total_stock');

  return woData.map(wo => {
    const sched = schedData?.find(s => s.id === wo.schedule_id);
    const mat = matData?.find(m => m.nomor_material === wo.nomor_material);
    const current_stock = mat ? Number(mat.total_stock) : 0;
    const status_pemenuhan = current_stock >= wo.qty_reservasi ? 'Fulfilled' : 'Outstanding';
    return {
      ...wo,
      nomor_rangkaian: sched ? sched.nomor_rangkaian : '—',
      propulsi: sched ? sched.jenis_propulsi : '—',
      seri_kereta: sched ? sched.seri_kereta : '—',
      nama_material: mat ? mat.nama_material : '—',
      current_stock,
      status_pemenuhan,
    } as WorkOrder;
  });
}

export async function addWorkOrder(wo: Omit<WorkOrder, 'id' | 'nomor_rangkaian' | 'nama_material' | 'propulsi' | 'seri_kereta'>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('work_orders')
    .insert([{
      nomor_wo: wo.nomor_wo,
      schedule_id: wo.schedule_id,
      nomor_material: wo.nomor_material,
      qty_reservasi: wo.qty_reservasi,
      status_pemenuhan: wo.status_pemenuhan
    }]);
  return { error: error?.message ?? null };
}

export async function updateWorkOrder(id: number, updates: Partial<WorkOrder>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('work_orders')
    .update({
      nomor_wo: updates.nomor_wo,
      schedule_id: updates.schedule_id,
      nomor_material: updates.nomor_material,
      qty_reservasi: updates.qty_reservasi,
      status_pemenuhan: updates.status_pemenuhan
    })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteWorkOrder(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('work_orders')
    .delete()
    .eq('id', id);
  return { error: error?.message ?? null };
}

// ── 6b. REAL SAP DATA FETCHERS FOR MAINTENANCE PANEL ──────────────────
export async function getRealSAPTrains(): Promise<{ id: string; name: string; model_no: string }[]> {
  const { data, error } = await supabase
    .from('equipment_master')
    .select('id, name, model_no')
    .eq('level', 1)
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function getAllEquipment(): Promise<{ id: string; parent_id: string | null; level: number; name: string }[]> {
  const { data, error } = await supabase
    .from('equipment_master')
    .select('id, parent_id, level, name')
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data as { id: string; parent_id: string | null; level: number; name: string }[];
}

export async function getRealSAPOrders(): Promise<{ order_no: string; description: string }[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('order_no, description')
    .order('order_no', { ascending: true })
    .limit(200); // limit to prevent large payloads
  if (error || !data) return [];
  return data;
}

// ── 6c. MAINTENANCE BOM CONFIG FUNCTIONS ──────────────────
export async function getMaintenanceBomConfig(): Promise<MaintenanceBomConfig[]> {
  const { data: bomData, error: bomErr } = await supabase
    .from('maintenance_bom_config')
    .select('*')
    .order('tipe_perawatan', { ascending: true });

  if (bomErr || !bomData) return [];

  const { data: matData } = await supabase
    .from('master_materials')
    .select('nomor_material, nama_material, satuan, total_stock');

  return bomData.map(bom => {
    const mat = matData?.find(m => m.nomor_material === bom.nomor_material);
    return {
      ...bom,
      nama_material: mat?.nama_material ?? '—',
      satuan: mat?.satuan ?? 'PCS',
      current_stock: mat ? Number(mat.total_stock) : 0,
    } as MaintenanceBomConfig;
  });
}

export async function addMaintenanceBomConfig(bom: Omit<MaintenanceBomConfig, 'id' | 'nama_material' | 'satuan' | 'current_stock'>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('maintenance_bom_config')
    .insert([bom]);
  return { error: error?.message ?? null };
}

export async function updateMaintenanceBomConfig(id: number, updates: Partial<MaintenanceBomConfig>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('maintenance_bom_config')
    .update({
      tipe_perawatan: updates.tipe_perawatan,
      nomor_material: updates.nomor_material,
      qty_standar: updates.qty_standar,
      qty_tc: updates.qty_tc,
      qty_m1: updates.qty_m1,
      qty_m2: updates.qty_m2,
      qty_t6: updates.qty_t6,
      qty_t: updates.qty_t,
      compat_seri_kereta: updates.compat_seri_kereta,
      compat_propulsi: updates.compat_propulsi,
    })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteMaintenanceBomConfig(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('maintenance_bom_config')
    .delete()
    .eq('id', id);
  return { error: error?.message ?? null };
}


// ── 7. AUDIT LOGS ─────────────────────────────────────────
export async function getAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('changed_at', { ascending: false });

  if (error || !data) return [];
  return data as AuditLog[];
}

export async function addAuditLog(log: Omit<AuditLog, 'id' | 'changed_at'>): Promise<void> {
  await supabase
    .from('audit_logs')
    .insert([log]);
}

// ── 8. ADMIN PARAMETERS ───────────────────────────────────
export async function getAdminParameters(): Promise<AdminParameter[]> {
  const { data: mats } = await supabase.from('master_materials').select('*');
  const { data: configs } = await supabase.from('ideal_stock_configurations').select('*');
  const { data: progs } = await supabase.from('procurement_progress').select('*');

  if (!mats) return [];

  return mats.map(m => {
    const config = configs?.find(c => c.nomor_material === m.nomor_material);
    const prog = progs?.find(p => p.nomor_material === m.nomor_material);
    return {
      nomor_material: m.nomor_material,
      nama_material: m.nama_material,
      ideal_qty: config?.ideal_qty_manual || 0,
      lead_time_hari: prog?.plan_lead_time || 0,
      plan_bulanan: config?.ideal_qty_manual ? Math.round(config.ideal_qty_manual / 12) : 0,
      use_formula: config?.use_formula_calculation || false,
    };
  });
}

export async function saveAdminParameter(param: AdminParameter, adminEmail: string, adminName: string): Promise<void> {
  // Update ideal stock config
  const { data: existingConfig } = await supabase
    .from('ideal_stock_configurations')
    .select('*')
    .eq('nomor_material', param.nomor_material)
    .single();

  const originalIdeal = existingConfig?.ideal_qty_manual ?? 0;

  await supabase
    .from('ideal_stock_configurations')
    .upsert({
      nomor_material: param.nomor_material,
      ideal_qty_manual: param.ideal_qty,
      use_formula_calculation: param.use_formula
    });

  // Catat Audit Log
  if (originalIdeal !== param.ideal_qty) {
    await addAuditLog({
      nomor_material: param.nomor_material,
      parameter_name: 'ideal_qty_manual',
      original_value: String(originalIdeal),
      new_value: String(param.ideal_qty),
      admin_email: adminEmail,
      admin_name: adminName,
      modul: 'Panel Parameter Admin'
    });
  }
}

// ── 9. MONTHLY ABSORPTION PLANS (3 YEARS) ──────────────────
export async function getMonthlyPlans(nomorMaterial: string): Promise<MonthlyPlan[]> {
  const { data, error } = await supabase
    .from('monthly_absorption_plans')
    .select('*')
    .eq('nomor_material', nomorMaterial)
    .order('tahun', { ascending: true })
    .order('bulan', { ascending: true });

  if (error || !data) return [];
  return data.map(d => ({
    ...d,
    gudang: d.gudang || 'GLOBAL'
  })) as MonthlyPlan[];
}

export async function saveMonthlyPlans(plans: MonthlyPlan[]): Promise<void> {
  const { error } = await supabase
    .from('monthly_absorption_plans')
    .upsert(plans.map(p => ({
      nomor_material: p.nomor_material,
      gudang: p.gudang || 'GLOBAL',
      tahun: p.tahun,
      bulan: p.bulan,
      plan_qty: p.plan_qty
    })), { onConflict: 'nomor_material,gudang,tahun,bulan' });

  if (error) {
    console.error('Error saving monthly plans:', error);
    throw error;
  }
}
