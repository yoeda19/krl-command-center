import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import { getMaintenanceSchedule, getWorkOrders, getFleetMetrics, getMaintenanceBomConfig, getRealSAPTrains, getAllEquipment, getProcurementData } from '../services/supabaseService';
import { formatTanggal } from '../utils/calculations';
import type { PropulsiType, SeriKereta, TipePerawatan, PelaksanaanStatus, PemenuhStatus, FleetMetrics, MaintenanceSchedule, WorkOrder, MaintenanceBomConfig, ProcurementItem } from '../types';

const statusCfg: Record<PelaksanaanStatus, { bg: string; text: string; border: string }> = {
  'Rencana':        { bg: 'rgba(96,165,250,0.12)',  text: '#60a5fa',               border: 'rgba(96,165,250,0.28)' },
  'Sedang Dirawat': { bg: 'rgba(217,119,6,0.12)',   text: 'var(--color-led-amber)', border: 'rgba(217,119,6,0.28)' },
  'Selesai':        { bg: 'rgba(22,163,74,0.12)',   text: 'var(--color-led-green)', border: 'rgba(22,163,74,0.28)' },
};

const fulfillCfg: Record<PemenuhStatus, { bg: string; text: string }> = {
  'Outstanding': { bg: 'rgba(220,38,38,0.10)',  text: 'var(--color-led-red)' },
  'Fulfilled':   { bg: 'rgba(22,163,74,0.10)',  text: 'var(--color-led-green)' },
};

const exportColsSchedule = [
  { key: 'nomor_rangkaian',    header: 'Nomor Rangkaian' },
  { key: 'seri_kereta',        header: 'Seri Kereta' },
  { key: 'jenis_propulsi',     header: 'Jenis Propulsi' },
  { key: 'tipe_perawatan',     header: 'Tipe Perawatan' },
  { key: 'tanggal_rencana',    header: 'Tanggal Rencana' },
  { key: 'status_pelaksanaan', header: 'Status Pelaksanaan' },
  { key: 'dipo',               header: 'Lokasi Perawatan' },
];

const exportColsWO = [
  { key: 'nomor_wo',         header: 'Nomor WO' },
  { key: 'nomor_rangkaian',  header: 'Nomor Rangkaian' },
  { key: 'nomor_material',   header: 'Kode Material' },
  { key: 'nama_material',    header: 'Nama Material' },
  { key: 'qty_reservasi',    header: 'Qty Reservasi' },
  { key: 'status_pemenuhan', header: 'Status Pemenuhan' },
];

// Fungsi mapping tipe perawatan ke warna visual
const tipeColor = (tipe: string): string => {
  if (tipe.startsWith('P48')) return 'var(--color-led-red)';
  if (tipe.startsWith('P24')) return 'var(--color-led-amber)';
  if (tipe.startsWith('P12')) return '#60a5fa';
  if (tipe.startsWith('P6'))  return '#a855f7'; // Purple
  if (tipe.startsWith('P3'))  return '#06b6d4'; // Cyan
  if (tipe.startsWith('P1'))  return 'var(--color-led-green)'; // Green
  return '#9ca3af';
};

export default function WorkOrderPage() {
  const [scheduleList, setScheduleList] = useState<MaintenanceSchedule[]>([]);
  const [woList, setWoList] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FleetMetrics | null>(null);
  const [bomConfigs, setBomConfigs] = useState<MaintenanceBomConfig[]>([]);
  const [allEquipment, setAllEquipment] = useState<{ id: string; parent_id: string | null; level: number; name: string }[]>([]);
  const [filterBOMTipe, setFilterBOMTipe] = useState<TipePerawatan>('P1');
  const [filterPropulsi, setFilterPropulsi]       = useState<PropulsiType | 'Semua'>('Semua');
  const [filterSeriKereta, setFilterSeriKereta]   = useState<SeriKereta | 'Semua'>('Semua');
  const [filterTipe, setFilterTipe]               = useState<TipePerawatan | 'Semua'>('Semua');
  const [filterWOStatus, setFilterWOStatus]       = useState<PemenuhStatus | 'Semua'>('Semua');
  const [filterWOMaterial, setFilterWOMaterial]   = useState<string>('Semua');
  const [filterWOMonth, setFilterWOMonth]         = useState<number>(6); // Juli
  const [filterWOYear, setFilterWOYear]           = useState<number>(2026);
  const [filterMode, setFilterMode]               = useState<'monthly' | 'accumulative'>('monthly');
  const [procurementList, setProcurementList]     = useState<ProcurementItem[]>([]);
  const [validasiMsg, setValidasiMsg]             = useState<{ text: string; ok: boolean } | null>(null);

  const [filterMonth, setFilterMonth] = useState<number>(6); // Juli (0-indexed)
  const [filterYear, setFilterYear]   = useState<number>(2026);

  const [totalTrainsCount, setTotalTrainsCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [sData, wData, fMetrics, bData, trainData, eqData, pData] = await Promise.all([
          getMaintenanceSchedule(),
          getWorkOrders(),
          getFleetMetrics(),
          getMaintenanceBomConfig(),
          getRealSAPTrains(),
          getAllEquipment(),
          getProcurementData()
        ]);
        setScheduleList(sData);
        setWoList(wData);
        setMetrics(fMetrics);
        setBomConfigs(bData);
        setTotalTrainsCount(trainData.length);
        setAllEquipment(eqData);
        setProcurementList(pData);
      } catch (err) {
        console.error('Error loading work order page data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredSchedule = scheduleList.filter(row => {
    const matchPropulsi = filterPropulsi === 'Semua' || row.jenis_propulsi === filterPropulsi;
    const matchKereta   = filterSeriKereta === 'Semua' || row.seri_kereta === filterSeriKereta;
    const matchTipe     = filterTipe === 'Semua' || row.tipe_perawatan === filterTipe;
    return matchPropulsi && matchKereta && matchTipe;
  });

  const getRequiredBomQty = (nomor_rangkaian: string, bom: MaintenanceBomConfig) => {
    // Check compatibility first
    const sched = scheduleList.find(s => s.nomor_rangkaian === nomor_rangkaian);
    if (sched) {
      if (bom.compat_seri_kereta) {
        const list = bom.compat_seri_kereta.split(',').map(x => x.trim()).filter(Boolean);
        if (list.length > 0 && !list.includes(sched.seri_kereta)) {
          return 0; // not compatible
        }
      }
      if (bom.compat_propulsi) {
        const list = bom.compat_propulsi.split(',').map(x => x.trim()).filter(Boolean);
        if (list.length > 0 && !list.includes(sched.jenis_propulsi)) {
          return 0; // not compatible
        }
      }
    }

    const cleanNum = nomor_rangkaian.split('-')[0].trim();
    const lvl1 = allEquipment.find(e => e.level === 1 && (e.name === nomor_rangkaian || e.name === cleanNum));
    if (!lvl1) return bom.qty_standar;
    const children = allEquipment.filter(e => e.level === 2 && e.parent_id === lvl1.id);
    if (children.length === 0) return bom.qty_standar;

    let countTC = 0, countM1 = 0, countM2 = 0, countT6 = 0, countT = 0;
    children.forEach(c => {
      let type = '';
      if (c.name.includes('/')) {
        const parts = c.name.split('/');
        type = parts[parts.length - 1].trim().toUpperCase();
      } else if (c.name.includes('-')) {
        const parts = c.name.split('-');
        type = parts[parts.length - 1].trim().toUpperCase();
      } else {
        type = c.name.trim().toUpperCase();
      }

      if (type.includes('TC')) countTC++;
      else if (type.includes('M1')) countM1++;
      else if (type.includes('M2')) countM2++;
      else if (type.includes('T6')) countT6++;
      else if (type.includes('T')) countT++;
    });

    const qtyTC = bom.qty_tc ?? 0;
    const qtyM1 = bom.qty_m1 ?? 0;
    const qtyM2 = bom.qty_m2 ?? 0;
    const qtyT6 = bom.qty_t6 ?? 0;
    const qtyT = bom.qty_t ?? 0;

    const formulaTotal = (countTC * qtyTC) + (countM1 * qtyM1) + (countM2 * qtyM2) + (countT6 * qtyT6) + (countT * qtyT);
    return formulaTotal === 0 ? bom.qty_standar : formulaTotal;
  };

  // Generate dynamic reservations based on scheduled plans in the active month
  const activeMonthReservations = scheduleList
    .filter(sched => {
      if (!sched.tanggal_rencana) return false;
      const d = new Date(sched.tanggal_rencana);
      return d.getMonth() === filterWOMonth && d.getFullYear() === filterWOYear;
    })
    .flatMap(sched => {
      const boms = bomConfigs.filter(b => b.tipe_perawatan === sched.tipe_perawatan);
      return boms.map(bom => {
        const requiredQty = getRequiredBomQty(sched.nomor_rangkaian, bom);
        if (requiredQty === 0) return null;
        return {
          id: `${sched.id}-${bom.id}`,
          nomor_wo: `WO-${sched.id.toString().slice(-6)}`,
          nomor_rangkaian: sched.nomor_rangkaian,
          seri_kereta: sched.seri_kereta,
          propulsi: sched.jenis_propulsi,
          tipe_perawatan: sched.tipe_perawatan,
          tanggal_rencana: sched.tanggal_rencana,
          nomor_material: bom.nomor_material,
          nama_material: bom.nama_material,
          qty_reservasi: requiredQty,
          current_stock: bom.current_stock ?? 0,
          status_pemenuhan: (bom.current_stock ?? 0) >= requiredQty ? 'Fulfilled' : 'Outstanding'
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null);
    });

  // Accumulative data
  const accumulativeData = Array.from(new Set(bomConfigs.map(b => b.nomor_material))).map(matNo => {
    const config = bomConfigs.find(b => b.nomor_material === matNo);
    const name = config?.nama_material ?? '—';
    const currentStock = config?.current_stock ?? 0;
    
    // Sum required qty across all schedules
    let totalRequired = 0;
    scheduleList.forEach(sched => {
      const bom = bomConfigs.find(b => b.nomor_material === matNo && b.tipe_perawatan === sched.tipe_perawatan);
      if (bom) {
        totalRequired += getRequiredBomQty(sched.nomor_rangkaian, bom);
      }
    });

    // Sum incoming POs (outstanding progress)
    const incomingPO = procurementList
      .filter(p => p.nomor_material === matNo && p.status !== 'Tiba di Gudang')
      .reduce((sum, p) => sum + (p.jumlah_dipesan ?? 0), 0);

    const netProjection = currentStock - totalRequired + incomingPO;
    const status_pemenuhan = netProjection >= 0 ? 'Fulfilled' : 'Outstanding';

    return {
      id: matNo,
      nomor_material: matNo,
      nama_material: name,
      current_stock: currentStock,
      qty_reservasi: totalRequired, // Used as 'Total Kebutuhan'
      incoming_po: incomingPO,
      net_projection: netProjection,
      status_pemenuhan
    };
  });

  // Filter reservations by selected material and status depending on active mode
  const filteredByMaterial = filterWOMaterial === 'Semua' 
    ? activeMonthReservations 
    : activeMonthReservations.filter(r => r.nomor_material === filterWOMaterial);

  const accumulativeFiltered = filterWOMaterial === 'Semua'
    ? accumulativeData
    : accumulativeData.filter(r => r.nomor_material === filterWOMaterial);

  const filteredWO = filterMode === 'monthly'
    ? filteredByMaterial.filter(row => filterWOStatus === 'Semua' || row.status_pemenuhan === filterWOStatus)
    : accumulativeFiltered.filter(row => filterWOStatus === 'Semua' || row.status_pemenuhan === filterWOStatus);

  // Extract unique materials that appear in active mode for dropdown filter
  const uniqueMaterials = Array.from(new Set(
    (filterMode === 'monthly' ? activeMonthReservations : accumulativeData).map(r => JSON.stringify({
      nomor_material: r.nomor_material,
      nama_material: r.nama_material
    }))
  )).map(s => JSON.parse(s) as { nomor_material: string; nama_material: string });

  // Calculate total requirement for active material
  const totalRequiredInMonth = filteredByMaterial.reduce((acc, r) => acc + r.qty_reservasi, 0);
  const activeMaterialBom = bomConfigs.find(b => b.nomor_material === filterWOMaterial);
  const activeMaterialStock = activeMaterialBom?.current_stock ?? 0;
  const activeMaterialName = activeMaterialBom?.nama_material ?? '';

  const totalOutstanding = filterMode === 'monthly'
    ? activeMonthReservations.filter(r => r.status_pemenuhan === 'Outstanding').reduce((acc, r) => acc + r.qty_reservasi, 0)
    : accumulativeData.filter(r => r.net_projection < 0).reduce((acc, r) => acc + Math.abs(r.net_projection), 0);

  const totalFulfilled = filterMode === 'monthly'
    ? activeMonthReservations.filter(r => r.status_pemenuhan === 'Fulfilled').reduce((acc, r) => acc + r.qty_reservasi, 0)
    : accumulativeData.filter(r => r.net_projection >= 0).reduce((acc, r) => acc + r.net_projection, 0);

  const grandTotalRequired = filterMode === 'monthly'
    ? activeMonthReservations.reduce((acc, r) => acc + r.qty_reservasi, 0)
    : accumulativeData.reduce((acc, r) => acc + r.qty_reservasi, 0);

  const demoValidasi = () => {
    // Cari apakah ada jadwal aktif yang stok material standar (BOM)-nya tidak mencukupi
    const outstandingBoms = scheduleList.filter(sched => {
      const boms = bomConfigs.filter(b => b.tipe_perawatan === sched.tipe_perawatan);
      return boms.some(b => (b.current_stock ?? 0) < getRequiredBomQty(sched.nomor_rangkaian, b));
    });

    if (outstandingBoms.length > 0) {
      const names = outstandingBoms.map(s => `${s.nomor_rangkaian} (${s.tipe_perawatan})`).join(', ');
      setValidasiMsg({
        text: `⚠ PERINGATAN: Terdapat ${outstandingBoms.length} rangkaian KRL yang dijadwalkan servis memiliki defisit stok material standar BOM: ${names}. Periksa tabel Master BOM Standar atau silakan ajukan PO pengadaan baru.`,
        ok: false
      });
    } else {
      setValidasiMsg({
        text: '✅ VALIDASI BERHASIL: Seluruh rangkaian KRL yang dijadwalkan perawatan saat ini memiliki ketersediaan material BOM standar yang CUKUP di gudang.',
        ok: true
      });
    }
  };

  // Bangun Calendar View dari scheduleList (kelompok per minggu bulan berjalan)
  const currentMonthLabel = `${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][filterMonth]} ${filterYear}`;
  const calendarWeeks = [1, 2, 3, 4, 5].map(weekNum => {
    const items = filteredSchedule
      .filter(s => {
        if (!s.tanggal_rencana) return false;
        const d = new Date(s.tanggal_rencana);
        if (d.getMonth() !== filterMonth || d.getFullYear() !== filterYear) return false;
        const dayOfMonth = d.getDate();
        const wk = Math.ceil(dayOfMonth / 7);
        return wk === weekNum;
      })
      .map(s => ({
        nomor_rangkaian: s.nomor_rangkaian,
        seri_kereta: s.seri_kereta,
        tipe_perawatan: s.tipe_perawatan,
        tanggal_rencana: s.tanggal_rencana,
        dipo: s.dipo || 'Depo Depok',
        color: tipeColor(s.tipe_perawatan),
      }));
    return { week: `Minggu ${weekNum}`, items };
  });

  const propulsiCfg = (p: string) => p === 'VVVF'
    ? { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa' }
    : { bg: 'rgba(217,119,6,0.12)', text: 'var(--color-led-amber)' };

  const outstandingCount = filteredWO.filter(w => w.status_pemenuhan === 'Outstanding').length;
  const fulfilledCount   = filteredWO.filter(w => w.status_pemenuhan === 'Fulfilled').length;

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

      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Armada',   value: totalTrainsCount || 101,              color: 'var(--color-secondary)',   sub: 'Total rangkaian KRL terdaftar' },
          { label: 'Siap Dinas',     value: (totalTrainsCount || 101) - scheduleList.filter(s => s.status_pelaksanaan === 'Sedang Dirawat').length, color: 'var(--color-led-green)',   sub: 'Rangkaian On the Move' },
          { label: 'In Maintenance', value: scheduleList.filter(s => s.status_pelaksanaan === 'Sedang Dirawat').length, color: 'var(--color-led-amber)',   sub: 'Rangkaian TSO/sedang diservis' },
          { label: 'Efisiensi',      value: `${metrics?.efisiensi_perawatan ?? 98}%`, color: 'var(--color-secondary)', sub: 'Tepat waktu perawatan' },
        ].map(kpi => (
          <div key={kpi.label} className="tactile-card rounded-lg p-5" style={{ borderLeft: `4px solid ${kpi.color}` }}>
            <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{kpi.label}</p>
            <p className="text-4xl font-black" style={{ color: 'var(--color-on-surface)' }}>{kpi.value}</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Calendar View jadwal perawatan */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)' }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Calendar View — Perawatan {currentMonthLabel}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Periode:</span>
            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
              className="rounded px-2.5 py-1 text-xs border"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
              {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
              className="rounded px-2.5 py-1 text-xs border"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
              {[2026, 2027, 2028, 2029, 2030].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-steel-border)' }}>
              {filteredSchedule.filter(s => {
                if (!s.tanggal_rencana) return false;
                const d = new Date(s.tanggal_rencana);
                return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
              }).length} jadwal aktif
            </span>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
          {calendarWeeks.map(week => (
            <div key={week.week} className="rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
              <div className="px-4 py-2.5 border-b text-xs font-black tracking-widest uppercase flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container-high)' }}>
                <span>{week.week}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
                  {week.items.length} Perawatan
                </span>
              </div>
              <div className="p-3 flex flex-col gap-2.5 min-h-[140px] max-h-[450px] overflow-y-auto scrollbar-thin">
                {week.items.length === 0 ? (
                  <div className="flex items-center justify-center h-28 text-xs italic text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Tidak ada jadwal
                  </div>
                ) : (
                  week.items.map((it, idx) => (
                    <div key={idx} className="rounded-lg p-2.5 border shadow-sm flex flex-col gap-1.5 hover:border-gray-500 transition-all"
                      style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-xs" style={{ color: 'var(--color-on-surface)' }}>{it.nomor_rangkaian}</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black border tracking-wider shrink-0"
                          style={{ backgroundColor: `${it.color}15`, borderColor: `${it.color}35`, color: it.color }}>
                          {it.tipe_perawatan}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-[9px] border-t pt-1.5 mt-0.5" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-75">
                              <rect x="4" y="3" width="16" height="16" rx="2"/>
                              <path d="M4 11h16M8 15h.01M16 15h.01M6 19l-2 3M18 19l2 3"/>
                            </svg>
                            {it.seri_kereta}
                          </span>
                          <span className="font-bold truncate max-w-[120px] flex items-center gap-1" style={{ color: 'var(--color-on-surface)' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                            {it.dipo}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[8px] font-bold" style={{ color: 'var(--color-on-surface)' }}>
                          <span className="flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-75">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            {formatTanggal(it.tanggal_rencana)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
      </div>
    </div>

       {/* Validasi Alert */}
      {validasiMsg && (
        <div className="rounded-lg p-4 flex items-start gap-3 border"
          style={{ backgroundColor: validasiMsg.ok ? 'rgba(22,163,74,0.03)' : 'rgba(220,38,38,0.03)', borderColor: 'var(--color-steel-border)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: validasiMsg.ok ? 'var(--color-led-green)' : 'var(--color-led-red)', marginTop: 2, flexShrink: 0 }}>
            {validasiMsg.ok
              ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
              : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
            }
          </svg>
          <p className="text-sm flex-1" style={{ color: 'var(--color-on-surface)' }}>{validasiMsg.text}</p>
          <button onClick={() => setValidasiMsg(null)} style={{ color: 'var(--color-on-surface-variant)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>Filter Jadwal:</span>
        {([
          { value: filterPropulsi,    set: setFilterPropulsi,    opts: ['Semua', 'VVVF', 'Rheostatik'] },
          { value: filterSeriKereta,   set: setFilterSeriKereta,   opts: ['Semua', 'JR205', 'CLI125', 'CLI225', 'Metro', 'KFW', 'EA203'] },
          { value: filterTipe,        set: setFilterTipe,        opts: ['Semua', 'P1', 'P3', 'P6', 'P12', 'P24', 'P48'] },
        ] as { value: string; set: (v: string) => void; opts: string[] }[]).map((sel, i) => (
          <select key={i} value={sel.value} onChange={e => sel.set(e.target.value)}
            className="rounded px-3 py-2 border text-sm"
            style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
            {sel.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
        <button onClick={demoValidasi}
          className="px-3 py-2 rounded border text-[11px] font-black tracking-wider uppercase transition-all hover:opacity-80"
          style={{ backgroundColor: 'rgba(220,38,38,0.03)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
          Audit Kompatibilitas Material
        </button>
        <div className="ml-auto">
          <ExportButton data={filteredSchedule as unknown as Record<string, unknown>[]} filename="jadwal_perawatan_krl" columns={exportColsSchedule} />
        </div>
      </div>

      {/* Schedule Table */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)' }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Rencana Perawatan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['Nomor Rangkaian','Seri Kereta','Propulsi','Tipe Perawatan','Tanggal Rencana','Lokasi Perawatan','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSchedule.map((row, i) => {
                const cfg  = statusCfg[row.status_pelaksanaan];
                const pCfg = propulsiCfg(row.jenis_propulsi);
                return (
                  <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                    <td className="px-4 py-3 font-bold text-xs" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_rangkaian}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-steel-border)' }}>{row.seri_kereta}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: pCfg.bg, color: pCfg.text }}>{row.jenis_propulsi}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)', backgroundColor: 'var(--color-surface-container-high)' }}>{row.tipe_perawatan}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface)' }}>{formatTanggal(row.tanggal_rencana)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface)' }}>
                      <span>{row.dipo || 'Depo Depok'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{row.status_pelaksanaan}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
      </div>

      {/* BOM Standard Requirements Section */}
      <div className="tactile-card rounded-lg overflow-hidden mb-6">
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-secondary)' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Master BOM</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs mr-1" style={{ color: 'var(--color-on-surface-variant)' }}>Pilih Perawatan:</span>
            {(['P1', 'P3', 'P6', 'P12', 'P24', 'P48'] as TipePerawatan[]).map(t => (
              <button key={t} onClick={() => setFilterBOMTipe(t)}
                className="px-3 py-1 rounded text-xs font-bold transition-all border"
                style={{
                  backgroundColor: filterBOMTipe === t ? 'var(--color-secondary)' : 'var(--color-surface-container-high)',
                  color: filterBOMTipe === t ? '#fff' : 'var(--color-on-surface-variant)',
                  borderColor: filterBOMTipe === t ? 'var(--color-secondary)' : 'var(--color-steel-border)',
                }}>{t}</button>
            ))}
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
            Daftar kebutuhan suku cadang standar yang harus dipersiapkan untuk tipe perawatan <strong>{filterBOMTipe}</strong>. Daftar ini dikelola langsung melalui Admin Panel.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse data-table">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-high)' }}>
                  {['Kode Material', 'Nama Material', 'Satuan', 'Kebutuhan Rangkaian', 'Rumus (TC/M1/M2/T6/T)', 'Kompatibilitas', 'Stok Saat Ini (Gudang)', 'Status Kecukupan'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-surface)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bomConfigs.filter(b => b.tipe_perawatan === filterBOMTipe).map(bom => {
                  const currentStock = bom.current_stock ?? 0;
                  const isSufficient = currentStock >= bom.qty_standar;
                  const hasCompat = bom.compat_seri_kereta || bom.compat_propulsi;
                  return (
                    <tr key={bom.id} style={{ borderColor: 'var(--color-steel-border)' }}>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>
                        <Link to={`/critical-stock?material=${encodeURIComponent(bom.nomor_material)}`} className="hover:underline">
                          {bom.nomor_material}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{bom.nama_material}</td>
                      <td className="px-4 py-2.5 text-xs">{bom.satuan}</td>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{bom.qty_standar} unit</td>
                      <td className="px-4 py-2.5 text-xs font-mono">
                        { (bom.qty_tc || bom.qty_m1 || bom.qty_m2 || bom.qty_t6 || bom.qty_t) ? (
                          <span style={{ color: 'var(--color-secondary)', fontWeight: 'bold' }}>
                            TC:{bom.qty_tc ?? 0} | M1:{bom.qty_m1 ?? 0} | M2:{bom.qty_m2 ?? 0} | T6:{bom.qty_t6 ?? 0} | T:{bom.qty_t ?? 0}
                          </span>
                        ) : (
                          <span className="opacity-40">— (Flat Rangkaian)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] font-mono">
                        {hasCompat ? (
                          <div className="flex flex-col gap-0.5 text-blue-400">
                            {bom.compat_seri_kereta && <div>Seri: {bom.compat_seri_kereta}</div>}
                            {bom.compat_propulsi && <div>Propulsi: {bom.compat_propulsi}</div>}
                          </div>
                        ) : (
                          <span className="opacity-40">Semua (Universal)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: isSufficient ? 'var(--color-led-green)' : 'var(--color-led-red)' }}>{currentStock} unit</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: isSufficient ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                            color: isSufficient ? 'var(--color-led-green)' : 'var(--color-led-red)',
                            border: isSufficient ? '1px solid rgba(22,163,74,0.3)' : '1px solid rgba(220,38,38,0.3)'
                          }}>
                          {isSufficient ? 'Stok Cukup' : 'Stok Kurang (Pesan Baru)'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {bomConfigs.filter(b => b.tipe_perawatan === filterBOMTipe).length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      Belum ada konfigurasi kebutuhan material standar untuk tipe perawatan ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
        </div>
      </div>

      {/* ECharts — Pie + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart Pemenuhan WO */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Status Pemenuhan WO</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Distribusi Outstanding vs Fulfilled</p>
          </div>
          <ReactECharts
            option={{
              backgroundColor: 'transparent',
              tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
              legend: { bottom: 8, textStyle: { color: '#9ca3af', fontSize: 10 } },
              series: [{
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['50%', '45%'],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: {
                  show: true,
                  formatter: '{b}\n{c} item',
                  fontSize: 11,
                  color: '#374151',
                },
                data: [
                  {
                    name: 'Outstanding',
                    value: outstandingCount,
                    itemStyle: { color: '#dc2626' },
                  },
                  {
                    name: 'Fulfilled',
                    value: fulfilledCount,
                    itemStyle: { color: '#16a34a' },
                  },
                ],
              }],
            }}
            style={{ height: 240 }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* Bar Chart Propulsi + Status */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Status Armada</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Distribusi kondisi armada KRL saat ini</p>
          </div>
          <ReactECharts
            option={{
              backgroundColor: 'transparent',
              tooltip: { trigger: 'item', formatter: '{b}: {c} rangkaian' },
              legend: { show: false },
              series: [{
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['50%', '45%'],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: {
                  formatter: '{b}\n{c}',
                  fontSize: 11,
                  color: '#374151',
                },
                data: [
                  { name: 'Siap Dinas',     value: (totalTrainsCount || 101) - scheduleList.filter(s => s.status_pelaksanaan === 'Sedang Dirawat').length,        itemStyle: { color: '#16a34a' } },
                  { name: 'In Maintenance', value: scheduleList.filter(s => s.status_pelaksanaan === 'Sedang Dirawat').length,    itemStyle: { color: '#d97706' } },
                  { name: 'Tidak Operasi',  value: metrics?.tidak_beroperasi ?? 8,  itemStyle: { color: '#dc2626' } },
                ],
              }],
            }}
            style={{ height: 240 }}
            opts={{ renderer: 'svg' }}
          />
        </div>
      </div>

      {/* Work Orders Detail */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="p-4 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Reservasi Material</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Kebutuhan material berdasarkan rencana perawatan bulanan</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Toggle Button Group */}
            <span className="text-xs font-bold mr-1" style={{ color: 'var(--color-on-surface-variant)' }}>Mode:</span>
            <div className="flex border rounded overflow-hidden mr-2" style={{ borderColor: 'var(--color-steel-border)' }}>
              <button
                onClick={() => setFilterMode('monthly')}
                className="px-3 py-1 text-xs font-black transition-colors"
                style={{
                  backgroundColor: filterMode === 'monthly' ? 'var(--color-on-surface)' : 'var(--color-surface-container-high)',
                  color: filterMode === 'monthly' ? 'var(--color-background)' : 'var(--color-on-surface-variant)'
                }}
              >
                Bulanan
              </button>
              <button
                onClick={() => setFilterMode('accumulative')}
                className="px-3 py-1 text-xs font-black transition-colors"
                style={{
                  backgroundColor: filterMode === 'accumulative' ? 'var(--color-on-surface)' : 'var(--color-surface-container-high)',
                  color: filterMode === 'accumulative' ? 'var(--color-background)' : 'var(--color-on-surface-variant)'
                }}
              >
                Akumulatif
              </button>
            </div>

            {/* Dropdown Month and Year Filter for Reservasi (Only shown in monthly mode) */}
            {filterMode === 'monthly' && (
              <>
                <span className="text-xs animate-fade-in" style={{ color: 'var(--color-on-surface-variant)' }}>Periode:</span>
                <select value={filterWOMonth} onChange={e => setFilterWOMonth(Number(e.target.value))}
                  className="rounded px-2.5 py-1 text-xs border animate-fade-in"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                  {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
                <select value={filterWOYear} onChange={e => setFilterWOYear(Number(e.target.value))}
                  className="rounded px-2.5 py-1 text-xs border mr-2 animate-fade-in"
                  style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                  {[2026, 2027, 2028, 2029, 2030].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            )}

            {/* Dropdown Material Filter */}
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>Suku Cadang:</span>
            <select
              value={filterWOMaterial}
              onChange={e => setFilterWOMaterial(e.target.value)}
              className="rounded px-2.5 py-1 text-xs border max-w-[200px]"
              style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
            >
              <option value="Semua">Semua Suku Cadang</option>
              {uniqueMaterials.map(m => (
                <option key={m.nomor_material} value={m.nomor_material}>
                  {m.nomor_material} - {m.nama_material}
                </option>
              ))}
            </select>

            <div className="w-px h-6" style={{ backgroundColor: 'var(--color-steel-border)' }} />

            {(['Semua', 'Outstanding', 'Fulfilled'] as const).map(s => (
              <button key={s} onClick={() => setFilterWOStatus(s)}
                className="px-3 py-1 rounded-full text-[11px] font-black tracking-wider border transition-all"
                style={{
                  backgroundColor: filterWOStatus === s ? 'var(--color-on-surface)' : 'var(--color-surface-container-high)',
                  color: filterWOStatus === s ? 'var(--color-background)' : 'var(--color-on-surface-variant)',
                  borderColor: filterWOStatus === s ? 'var(--color-on-surface)' : 'var(--color-steel-border)',
                }}>{s}</button>
            ))}
            <ExportButton
              data={filteredWO as unknown as Record<string, unknown>[]}
              filename={filterMode === 'monthly' ? "reservasi_material_bulanan" : "rekap_kebutuhan_akumulatif"}
              columns={
                filterMode === 'monthly'
                  ? [
                      { key: 'nomor_rangkaian',  header: 'Nomor Rangkaian' },
                      { key: 'propulsi',         header: 'Propulsi' },
                      { key: 'seri_kereta',      header: 'Seri Kereta' },
                      { key: 'nomor_material',   header: 'Kode Material' },
                      { key: 'nama_material',    header: 'Nama Material' },
                      { key: 'qty_reservasi',    header: 'Qty Reservasi' },
                      { key: 'current_stock',    header: 'Stok Saat Ini' },
                      { key: 'status_pemenuhan', header: 'Status Pemenuhan' },
                    ]
                  : [
                      { key: 'nomor_material',   header: 'Kode Material' },
                      { key: 'nama_material',    header: 'Nama Material' },
                      { key: 'current_stock',    header: 'Stok Sekarang' },
                      { key: 'qty_reservasi',    header: 'Total Kebutuhan' },
                      { key: 'incoming_po',      header: 'Incoming PO' },
                      { key: 'net_projection',   header: 'Net Proyeksi' },
                      { key: 'status_pemenuhan', header: 'Status Kelayakan' },
                    ]
              }
            />
          </div>
        </div>

        {/* Dynamic Month/Material Summary Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b animate-fade-in" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background)' }}>
          {filterWOMaterial === 'Semua' ? (
            <>
              <div className="tactile-card rounded-lg p-3 flex flex-col justify-center" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
                <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {filterMode === 'monthly' ? 'Total Kebutuhan Bulan Ini' : 'Total Kebutuhan Kumulatif'}
                </span>
                <span className="text-lg font-black" style={{ color: 'var(--color-secondary)' }}>{grandTotalRequired} Unit</span>
                <span className="text-[10px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Akumulasi semua suku cadang</span>
              </div>
              <div className="tactile-card rounded-lg p-3 flex flex-col justify-center" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
                <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>Total Defisit (Outstanding)</span>
                <span className="text-lg font-black" style={{ color: 'var(--color-led-red)' }}>{totalOutstanding} Unit</span>
                <span className="text-[10px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Kekurangan stok di masa depan</span>
              </div>
              <div className="tactile-card rounded-lg p-3 flex flex-col justify-center" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
                <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>Total Terpenuhi (Fulfilled)</span>
                <span className="text-lg font-black" style={{ color: 'var(--color-led-green)' }}>{totalFulfilled} Unit</span>
                <span className="text-[10px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Stok aman / surplus</span>
              </div>
            </>
          ) : (
            <>
              <div className="tactile-card rounded-lg p-3 flex flex-col justify-center" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
                <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>Suku Cadang Terpilih</span>
                <span className="text-xs font-bold truncate" style={{ color: 'var(--color-on-surface)' }}>{activeMaterialName || filterWOMaterial}</span>
                <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Kode: {filterWOMaterial}</span>
              </div>
              <div className="tactile-card rounded-lg p-3 flex flex-col justify-center" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
                <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>Total Kebutuhan</span>
                <span className="text-lg font-black" style={{ color: 'var(--color-secondary)' }}>{totalRequiredInMonth} Unit</span>
                <span className="text-[10px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{filterMode === 'monthly' ? 'Bulan terpilih' : 'Semua rencana'}</span>
              </div>
              <div className="tactile-card rounded-lg p-3 flex flex-col justify-center" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
                <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>Stok Tersedia di Gudang</span>
                <span className="text-lg font-black animate-pulse" style={{ color: activeMaterialStock >= totalRequiredInMonth ? 'var(--color-led-green)' : 'var(--color-led-red)' }}>
                  {activeMaterialStock} Unit
                </span>
              </div>
            </>
          )}
        </div>
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '250px', minHeight: '200px' }}>
          <table className="w-full text-left border-collapse min-w-[800px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {(filterMode === 'monthly'
                  ? ['Rangkaian','Propulsi','Seri Kereta','Kode Material','Nama Material','Qty Reservasi','Stok Saat Ini','Status Kecukupan','Status Pemenuhan','Aksi']
                  : ['Kode Material','Nama Material','Stok Sekarang','Total Kebutuhan','Incoming PO','Net Proyeksi','Status Kelayakan','Aksi']
                ).map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredWO.map((row, i) => {
                const currentStock = row.current_stock ?? 0;

                if (filterMode === 'monthly') {
                  const fCfg = fulfillCfg[row.status_pemenuhan];
                  const pCfg = propulsiCfg(row.propulsi ?? '—');
                  const isSufficient = currentStock >= row.qty_reservasi;

                  return (
                    <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_rangkaian}</td>
                      <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: pCfg.bg, color: pCfg.text }}>{row.propulsi}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container-high)' }}>{row.seri_kereta}</span></td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>
                        <Link to={`/critical-stock?material=${encodeURIComponent(row.nomor_material)}`} className="hover:underline">
                          {row.nomor_material}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.qty_reservasi} unit</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: isSufficient ? 'var(--color-led-green)' : 'var(--color-led-red)' }}>
                        {currentStock} unit
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: isSufficient ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                            color: isSufficient ? 'var(--color-led-green)' : 'var(--color-led-red)',
                            border: isSufficient ? '1px solid rgba(22,163,74,0.3)' : '1px solid rgba(220,38,38,0.3)'
                          }}>
                          {isSufficient ? 'Cukup' : 'Kurang'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: fCfg.bg, color: fCfg.text }}>{row.status_pemenuhan}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <Link to={`/critical-stock?material=${encodeURIComponent(row.nomor_material)}`}
                            className="text-[9px] font-bold px-2 py-1 rounded border transition-all hover:opacity-80"
                            style={{ backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: 'var(--color-led-red)' }}>
                            Stok
                          </Link>
                          <Link to={`/progress-po?material=${encodeURIComponent(row.nomor_material)}`}
                            className="text-[9px] font-bold px-2 py-1 rounded border transition-all hover:opacity-80"
                            style={{ backgroundColor: 'rgba(37,99,235,0.08)', borderColor: 'rgba(37,99,235,0.3)', color: '#60a5fa' }}>
                            PO
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                } else {
                  const totalRequired = row.qty_reservasi ?? 0;
                  const incomingPO = (row as any).incoming_po ?? 0;
                  const netProj = (row as any).net_projection ?? 0;
                  const isSufficient = netProj >= 0;

                  return (
                    <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>
                        <Link to={`/critical-stock?material=${encodeURIComponent(row.nomor_material)}`} className="hover:underline">
                          {row.nomor_material}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{currentStock} unit</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-secondary)' }}>{totalRequired} unit</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: '#60a5fa' }}>{incomingPO} unit</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: isSufficient ? 'var(--color-led-green)' : 'var(--color-led-red)' }}>
                        {netProj} unit
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: isSufficient ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                            color: isSufficient ? 'var(--color-led-green)' : 'var(--color-led-red)',
                            border: isSufficient ? '1px solid rgba(22,163,74,0.3)' : '1px solid rgba(220,38,38,0.3)'
                          }}>
                          {isSufficient ? 'Cukup' : `Kurang [Order: ${Math.abs(netProj)} unit]`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <Link to={`/critical-stock?material=${encodeURIComponent(row.nomor_material)}`}
                            className="text-[9px] font-bold px-2 py-1 rounded border transition-all hover:opacity-80"
                            style={{ backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: 'var(--color-led-red)' }}>
                            Stok
                          </Link>
                          <Link to={`/progress-po?material=${encodeURIComponent(row.nomor_material)}`}
                            className="text-[9px] font-bold px-2 py-1 rounded border transition-all hover:opacity-80"
                            style={{ backgroundColor: 'rgba(37,99,235,0.08)', borderColor: 'rgba(37,99,235,0.3)', color: '#60a5fa' }}>
                            PO
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
        <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
      </div>
    </PageWrapper>
  );
}
