import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import { getMaintenanceSchedule, getWorkOrders, getFleetMetrics, getMaintenanceBomConfig, getRealSAPTrains } from '../services/supabaseService';
import { formatTanggal } from '../utils/calculations';
import type { PropulsiType, JenisKereta, TipePerawatan, PelaksanaanStatus, PemenuhStatus, FleetMetrics, MaintenanceSchedule, WorkOrder, MaintenanceBomConfig } from '../types';

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
  { key: 'jenis_kereta',       header: 'Jenis Kereta' },
  { key: 'jenis_propulsi',     header: 'Jenis Propulsi' },
  { key: 'tipe_perawatan',     header: 'Tipe Perawatan' },
  { key: 'tanggal_rencana',    header: 'Tanggal Rencana' },
  { key: 'status_pelaksanaan', header: 'Status Pelaksanaan' },
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
  return '#9ca3af';
};

export default function WorkOrderPage() {
  const [scheduleList, setScheduleList] = useState<MaintenanceSchedule[]>([]);
  const [woList, setWoList] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FleetMetrics | null>(null);
  const [bomConfigs, setBomConfigs] = useState<MaintenanceBomConfig[]>([]);
  const [filterBOMTipe, setFilterBOMTipe] = useState<TipePerawatan>('P1');
  const [filterPropulsi, setFilterPropulsi]       = useState<PropulsiType | 'Semua'>('Semua');
  const [filterJenisKereta, setFilterJenisKereta] = useState<JenisKereta | 'Semua'>('Semua');
  const [filterTipe, setFilterTipe]               = useState<TipePerawatan | 'Semua'>('Semua');
  const [filterWOStatus, setFilterWOStatus]       = useState<PemenuhStatus | 'Semua'>('Semua');
  const [validasiMsg, setValidasiMsg]             = useState<{ text: string; ok: boolean } | null>(null);

  const [totalTrainsCount, setTotalTrainsCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [sData, wData, fMetrics, bData, trainData] = await Promise.all([
          getMaintenanceSchedule(),
          getWorkOrders(),
          getFleetMetrics(),
          getMaintenanceBomConfig(),
          getRealSAPTrains()
        ]);
        setScheduleList(sData);
        setWoList(wData);
        setMetrics(fMetrics);
        setBomConfigs(bData);
        setTotalTrainsCount(trainData.length);
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
    const matchKereta   = filterJenisKereta === 'Semua' || row.jenis_kereta === filterJenisKereta;
    const matchTipe     = filterTipe === 'Semua' || row.tipe_perawatan === filterTipe;
    return matchPropulsi && matchKereta && matchTipe;
  });

  const filteredWO = woList.filter(row =>
    filterWOStatus === 'Semua' || row.status_pemenuhan === filterWOStatus
  );

  const demoValidasi = () => {
    // Cari apakah ada jadwal aktif yang stok material standar (BOM)-nya tidak mencukupi
    const outstandingBoms = scheduleList.filter(sched => {
      const boms = bomConfigs.filter(b => b.tipe_perawatan === sched.tipe_perawatan);
      return boms.some(b => (b.current_stock ?? 0) < b.qty_standar);
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
  const now = new Date('2026-07-11');
  const currentMonthLabel = `${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][now.getMonth()]} ${now.getFullYear()}`;
  const calendarWeeks = [1, 2, 3, 4].map(weekNum => {
    const items = filteredSchedule
      .filter(s => {
        if (!s.tanggal_rencana) return false;
        const d = new Date(s.tanggal_rencana);
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        const dayOfMonth = d.getDate();
        const wk = Math.ceil(dayOfMonth / 7);
        return wk === weekNum;
      })
      .map(s => ({
        label: `${s.nomor_rangkaian} ${s.tipe_perawatan}`,
        color: tipeColor(s.tipe_perawatan),
        tipe: s.tipe_perawatan,
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
        <div className="flex items-center justify-center h-96">
          <span className="text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>Memuat data...</span>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper fullWidth>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-secondary)' }}>
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Perawatan KRL (Work Order)
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          Jadwal perawatan berkala armada KRL dan pemenuhan kebutuhan material suku cadang
        </p>
      </div>

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
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)' }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Calendar View — Perawatan {currentMonthLabel}</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-steel-border)' }}>
            {filteredSchedule.length} jadwal aktif
          </span>
        </div>
        <div className="p-5 grid grid-cols-4 gap-3">
          {calendarWeeks.map(week => (
            <div key={week.week} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
              <div className="px-3 py-2 border-b text-[10px] font-black tracking-widest uppercase" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container-high)' }}>
                {week.week}
              </div>
              <div className="p-2 flex flex-col gap-1.5 min-h-[80px]">
                {week.items.length === 0
                  ? <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>—</span>
                  : week.items.map(it => (
                    <div key={it.label} className="rounded px-2 py-1.5 text-[10px] font-bold leading-tight"
                      style={{ backgroundColor: `${it.color}18`, border: `1px solid ${it.color}40`, color: it.color }}>
                      {it.label}
                    </div>
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ECharts — Pie + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart Pemenuhan WO */}
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Status Pemenuhan Material WO</h3>
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
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Armada Berdasarkan Status</h3>
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

      {/* BOM Standard Requirements Section */}
      <div className="tactile-card rounded-lg overflow-hidden mb-6">
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-secondary)' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Master BOM (Bill of Materials) Standar Perawatan</h3>
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
                  {['Kode Material', 'Nama Material', 'Satuan', 'Kebutuhan Standar', 'Stok Saat Ini (Gudang)', 'Status Kecukupan'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-surface)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bomConfigs.filter(b => b.tipe_perawatan === filterBOMTipe).map(bom => {
                  const currentStock = bom.current_stock ?? 0;
                  const isSufficient = currentStock >= bom.qty_standar;
                  return (
                    <tr key={bom.id} style={{ borderColor: 'var(--color-steel-border)' }}>
                      <td className="px-4 py-2.5 text-xs font-bold text-blue-400">
                        <Link to={`/critical-stock?material=${encodeURIComponent(bom.nomor_material)}`} className="hover:underline">
                          {bom.nomor_material}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{bom.nama_material}</td>
                      <td className="px-4 py-2.5 text-xs">{bom.satuan}</td>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{bom.qty_standar} unit</td>
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
                    <td colSpan={6} className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      Belum ada konfigurasi kebutuhan material standar untuk tipe perawatan ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>Filter Jadwal:</span>
        {([
          { value: filterPropulsi,    set: setFilterPropulsi,    opts: ['Semua', 'VVVF', 'Rheostatik'] },
          { value: filterJenisKereta, set: setFilterJenisKereta, opts: ['Semua', 'TC', 'M1', 'M2', 'T', 'T6'] },
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
          <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Jadwal Rencana Perawatan KRL</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['Nomor Rangkaian','Jenis Kereta','Propulsi','Tipe Perawatan','Tanggal Rencana','Status'].map(h => (
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
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-steel-border)' }}>{row.jenis_kereta}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: pCfg.bg, color: pCfg.text }}>{row.jenis_propulsi}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)', backgroundColor: 'var(--color-surface-container-high)' }}>{row.tipe_perawatan}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface)' }}>{formatTanggal(row.tanggal_rencana)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{row.status_pelaksanaan}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Work Orders Detail */}
      <div className="tactile-card rounded-lg overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Reservasi Material Work Order</h3>
          <div className="flex items-center gap-2">
            {(['Semua', 'Outstanding', 'Fulfilled'] as const).map(s => (
              <button key={s} onClick={() => setFilterWOStatus(s)}
                className="px-3 py-1 rounded-full text-[11px] font-black tracking-wider border transition-all"
                style={{
                  backgroundColor: filterWOStatus === s ? 'var(--color-on-surface)' : 'var(--color-surface-container-high)',
                  color: filterWOStatus === s ? 'var(--color-background)' : 'var(--color-on-surface-variant)',
                  borderColor: filterWOStatus === s ? 'var(--color-on-surface)' : 'var(--color-steel-border)',
                }}>{s}</button>
            ))}
            <ExportButton data={filteredWO as unknown as Record<string, unknown>[]} filename="work_order_material" columns={exportColsWO} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] data-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                {['No. WO','Rangkaian','Propulsi','Gerbong','Kode Material','Nama Material','Qty Reservasi','Stok Saat Ini','Status Kecukupan','Status Pemenuhan','Aksi'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase whitespace-nowrap" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredWO.map((row, i) => {
                const fCfg = fulfillCfg[row.status_pemenuhan];
                const pCfg = propulsiCfg(row.propulsi);
                const isOutstanding = row.status_pemenuhan === 'Outstanding';
                const currentStock = row.current_stock ?? 0;
                const isSufficient = currentStock >= row.qty_reservasi;
                
                return (
                  <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-secondary)' }}>{row.nomor_wo}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_rangkaian}</td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: pCfg.bg, color: pCfg.text }}>{row.propulsi}</span></td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)', backgroundColor: 'var(--color-surface-container-high)' }}>{row.jenis_kereta}</span></td>
                    <td className="px-4 py-3 text-xs font-bold text-blue-400">
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
