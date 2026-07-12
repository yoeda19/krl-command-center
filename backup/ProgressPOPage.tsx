import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import { getProcurementData } from '../services/supabaseService';
import { formatRupiah, formatTanggal } from '../utils/calculations';
import type { ProcurementStatus, RisikoLevel, ProcurementItem } from '../types';

const statusOptions: Array<'Semua' | ProcurementStatus> = ['Semua', 'PO Diterbitkan', 'Dalam Pengadaan', 'Dikirim Vendor', 'Dalam Transit', 'Tiba di Depo'];
const risikoOptions: Array<'Semua' | RisikoLevel> = ['Semua', 'Rendah', 'Sedang', 'Tinggi'];

const statusCfg: Record<ProcurementStatus, { bg: string; text: string; border: string }> = {
  'PO Diterbitkan':   { bg: 'rgba(37,99,235,0.12)',  text: '#60a5fa',                  border: 'rgba(59,130,246,0.3)' },
  'Dalam Pengadaan':  { bg: 'rgba(217,119,6,0.12)',  text: 'var(--color-led-amber)',   border: 'rgba(217,119,6,0.3)' },
  'Dikirim Vendor':   { bg: 'rgba(107,114,128,0.12)',text: '#9ca3af',                  border: 'rgba(107,114,128,0.3)' },
  'Dalam Transit':    { bg: 'rgba(16,185,129,0.12)', text: '#10b981',                  border: 'rgba(16,185,129,0.3)' },
  'Tiba di Depo':     { bg: 'rgba(22,163,74,0.12)',  text: 'var(--color-led-green)',   border: 'rgba(22,163,74,0.3)' },
};

const riskCfg: Record<RisikoLevel, { bg: string; text: string }> = {
  Rendah: { bg: 'rgba(22,163,74,0.1)',  text: 'var(--color-led-green)' },
  Sedang: { bg: 'rgba(217,119,6,0.1)', text: 'var(--color-led-amber)' },
  Tinggi: { bg: 'rgba(220,38,38,0.1)', text: 'var(--color-led-red)' },
};

const statusIndex: Record<ProcurementStatus, number> = {
  'PO Diterbitkan': 1, 'Dalam Pengadaan': 1, 'Dikirim Vendor': 2, 'Dalam Transit': 3, 'Tiba di Depo': 4,
};

interface StepDef {
  label: string;
  short: string;
  numKey: keyof ProcurementItem | null;
  dateKey: keyof ProcurementItem | null;
  idx: number;
}

const STEPS: StepDef[] = [
  { label: 'NOD / PR',        short: 'NOD',    numKey: 'nomor_nod',   dateKey: 'tanggal_nod',          idx: 0 },
  { label: 'PO Diterbitkan',  short: 'PO',     numKey: 'nomor_po',    dateKey: 'tanggal_po',           idx: 1 },
  { label: 'Dikirim Vendor',  short: 'Kirim',  numKey: null,           dateKey: 'tanggal_kirim_vendor', idx: 2 },
  { label: 'Dalam Transit',   short: 'Transit',numKey: null,           dateKey: null,                   idx: 3 },
  { label: 'Tiba & GR',       short: 'GR',     numKey: 'nomor_gr',    dateKey: 'tanggal_gr',           idx: 4 },
];

const exportCols = [
  { key: 'nomor_material',          header: 'Kode Material' },
  { key: 'uraian_material',         header: 'Uraian Material' },
  { key: 'satuan',                  header: 'Satuan' },
  { key: 'jumlah_dipesan',          header: 'Qty' },
  { key: 'total_harga',             header: 'Total Harga (Rp)' },
  { key: 'nomor_nod',               header: 'Nomor NOD' },
  { key: 'tanggal_nod',             header: 'Tgl NOD' },
  { key: 'nomor_pr',                header: 'Nomor PR' },
  { key: 'tanggal_pr',              header: 'Tgl PR' },
  { key: 'nomor_po',                header: 'Nomor PO' },
  { key: 'tanggal_po',              header: 'Tgl PO' },
  { key: 'tanggal_kirim_vendor',    header: 'Tgl Kirim Vendor' },
  { key: 'tanggal_rencana_pengiriman', header: 'Rencana Tiba' },
  { key: 'tanggal_tiba_depo',       header: 'Tgl Tiba Depo' },
  { key: 'nomor_gr',                header: 'Nomor GR' },
  { key: 'tanggal_gr',              header: 'Tgl GR' },
  { key: 'vendor',                  header: 'Vendor' },
  { key: 'status',                  header: 'Status' },
  { key: 'plan_lead_time',          header: 'Lead Time Plan (hari)' },
  { key: 'actual_lead_time',        header: 'Lead Time Actual (hari)' },
  { key: 'risiko_keterlambatan',    header: 'Risiko' },
  { key: 'keterangan',              header: 'Keterangan' },
];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PipelineCard({ item }: { item: ProcurementItem }) {
  const sIdx = statusIndex[item.status] ?? 0;
  const cfg = statusCfg[item.status];
  const rCfg = riskCfg[item.risiko_keterlambatan];

  const grDate = item.tanggal_gr || item.tanggal_penerimaan_barang;
  const actualLt = grDate && item.tanggal_po
    ? Math.round((new Date(grDate).getTime() - new Date(item.tanggal_po).getTime()) / 86400000)
    : item.actual_lead_time;
  const isLate = actualLt !== null && actualLt !== undefined && item.plan_lead_time > 0 && actualLt > item.plan_lead_time;

  // PR special: may have its own number even without a step slot
  const prBlock = (item.nomor_pr || item.tanggal_pr) ? (
    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
      <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>PR:</span>
      {item.nomor_pr && <span className="font-mono font-bold" style={{ color: cfg.text }}>{item.nomor_pr}</span>}
      {item.tanggal_pr && <span>({formatTanggal(item.tanggal_pr)})</span>}
    </div>
  ) : null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
        <div>
          <span className="font-black text-xs" style={{ color: 'var(--color-on-surface)' }}>{item.nomor_material}</span>
          <span className="mx-2 opacity-30">|</span>
          <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{item.uraian_material}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{item.status}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: rCfg.bg, color: rCfg.text }}>Risiko: {item.risiko_keterlambatan}</span>
          {isLate && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(220,38,38,0.12)', color: 'var(--color-led-red)' }}>
              ⚠ Terlambat {actualLt! - item.plan_lead_time} hari
            </span>
          )}
        </div>
      </div>

      {/* ── Pipeline Timeline ── */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-start">
          {STEPS.map((step, si) => {
            const done = si <= sIdx;
            const current = si === sIdx;
            const numVal = step.numKey ? (item[step.numKey] as string | null) : null;
            const dateVal = step.dateKey ? (item[step.dateKey] as string | null) : null;
            // Override: for GR step use tanggal_gr OR tanggal_penerimaan_barang
            const displayDate = si === 4 ? (item.tanggal_gr || item.tanggal_penerimaan_barang) : dateVal;
            const displayNum = si === 0 ? (item.nomor_nod || null) : numVal;

            return (
              <div key={step.label} className="flex items-start flex-1 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 64 }}>
                  {/* Node circle */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all"
                    style={{
                      backgroundColor: done ? cfg.text : 'var(--color-surface-container-highest)',
                      borderColor: done ? cfg.text : 'var(--color-steel-border)',
                      color: done ? '#000' : 'var(--color-on-surface-variant)',
                      boxShadow: current ? `0 0 16px ${cfg.text}70` : 'none',
                    }}>
                    {done ? <CheckIcon /> : si + 1}
                  </div>
                  {/* Step label */}
                  <span className="text-[9px] mt-1 text-center font-bold leading-tight"
                    style={{ color: done ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', maxWidth: 60 }}>
                    {step.short}
                  </span>
                  {/* Nomor dokumen */}
                  <span className="text-[8px] mt-0.5 text-center font-mono leading-tight"
                    style={{ color: displayNum ? cfg.text : 'transparent', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={displayNum ?? ''}>
                    {displayNum || '·'}
                  </span>
                  {/* Tanggal */}
                  <span className="text-[8px] mt-0.5 text-center leading-tight"
                    style={{ color: displayDate ? 'var(--color-on-surface-variant)' : 'transparent', maxWidth: 60 }}>
                    {displayDate ? formatTanggal(displayDate) : '·'}
                  </span>
                </div>
                {/* Connector */}
                {si < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mt-4 mx-0.5"
                    style={{ backgroundColor: si < sIdx ? cfg.text : 'var(--color-steel-border)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Meta info ── */}
      <div className="px-4 pb-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px]" style={{ color: 'var(--color-on-surface-variant)', borderTop: '1px solid var(--color-steel-border)' }}>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 w-full">
          <span>Vendor: <b style={{ color: 'var(--color-on-surface)' }}>{item.vendor}</b> <span className="opacity-60">({item.kota_asal})</span></span>
          <span>Qty: <b style={{ color: 'var(--color-on-surface)' }}>{item.jumlah_dipesan} {item.satuan}</b></span>
          <span>Nilai: <b style={{ color: 'var(--color-secondary)' }}>{formatRupiah(item.total_harga)}</b></span>
          <span>Lead Time Plan: <b style={{ color: 'var(--color-on-surface)' }}>{item.plan_lead_time} hari</b></span>
          {actualLt !== null && actualLt !== undefined && (
            <span>Actual: <b style={{ color: isLate ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>{actualLt} hari</b></span>
          )}
          {prBlock}
          {item.keterangan && (
            <span className="w-full italic">📝 {item.keterangan}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProgressPOPage() {
  const [searchParams] = useSearchParams();
  const materialParam = searchParams.get('material');

  const [procureList, setProcureList] = useState<ProcurementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'Semua' | ProcurementStatus>('Semua');
  const [filterRisiko, setFilterRisiko] = useState<'Semua' | RisikoLevel>('Semua');
  const [filterVendor, setFilterVendor] = useState('Semua Vendor');
  const [searchText, setSearchText] = useState(materialParam || '');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getProcurementData();
        setProcureList(data);
      } catch (err) {
        console.error('Error loading procurement data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const vendors = ['Semua Vendor', ...new Set(procureList.map(d => d.vendor))];

  const filtered = procureList.filter(row => {
    const matchStatus = filterStatus === 'Semua' || row.status === filterStatus;
    const matchRisiko = filterRisiko === 'Semua' || row.risiko_keterlambatan === filterRisiko;
    const matchVendor = filterVendor === 'Semua Vendor' || row.vendor === filterVendor;
    const matchSearch = !searchText ||
      row.nomor_material.toLowerCase().includes(searchText.toLowerCase()) ||
      row.uraian_material.toLowerCase().includes(searchText.toLowerCase()) ||
      (row.nomor_po?.toLowerCase().includes(searchText.toLowerCase()) ?? false) ||
      (row.nomor_nod?.toLowerCase().includes(searchText.toLowerCase()) ?? false);
    return matchStatus && matchRisiko && matchVendor && matchSearch;
  });

  const totalNilai = filtered.reduce((sum, r) => sum + r.total_harga, 0);

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
            <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          Progres PO &amp; Transit
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          Pemantauan proses pengadaan dari NOD/PR → PO → Kirim → Transit → GR beserta nomor dokumen &amp; tanggal setiap tahap
        </p>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statusOptions.slice(1).map(s => {
          const count = procureList.filter(d => d.status === s).length;
          const cfg = statusCfg[s as ProcurementStatus];
          const active = filterStatus === s;
          return (
            <div key={s}
              className="tactile-card rounded-lg p-4 text-center cursor-pointer transition-all hover:scale-105 active:scale-100"
              style={active ? { backgroundColor: cfg.bg, borderColor: cfg.border } : undefined}
              onClick={() => setFilterStatus(prev => prev === s ? 'Semua' : s as ProcurementStatus)}>
              <p className="text-3xl font-black" style={{ color: cfg.text }}>{count}</p>
              <p className="text-[9px] font-black tracking-widest uppercase mt-1" style={{ color: cfg.text }}>{s}</p>
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="tactile-card rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex items-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3" style={{ color: 'var(--color-on-surface-variant)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Cari material / nomor PO / NOD..." value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-8 pr-3 py-2 rounded border text-sm w-64"
            style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }} />
        </div>
        {[
          { value: filterStatus, onChange: (v: string) => setFilterStatus(v as 'Semua' | ProcurementStatus), options: statusOptions },
          { value: filterVendor, onChange: (v: string) => setFilterVendor(v), options: vendors },
          { value: filterRisiko, onChange: (v: string) => setFilterRisiko(v as 'Semua' | RisikoLevel), options: risikoOptions },
        ].map((sel, i) => (
          <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)}
            className="rounded px-3 py-2 border text-sm"
            style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
            {sel.options.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
        <div className="flex rounded border overflow-hidden" style={{ borderColor: 'var(--color-steel-border)' }}>
          {(['timeline', 'table'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className="px-3 py-2 text-xs font-bold transition-all"
              style={{
                backgroundColor: viewMode === v ? 'var(--color-secondary)' : 'var(--color-surface-container-high)',
                color: viewMode === v ? '#fff' : 'var(--color-on-surface-variant)',
              }}>
              {v === 'timeline' ? '⬡ Timeline' : '☰ Tabel'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            Total: <strong style={{ color: 'var(--color-secondary)' }}>{formatRupiah(totalNilai)}</strong>
          </span>
          <ExportButton data={filtered as unknown as Record<string, unknown>[]} filename="progress_po_transit" columns={exportCols} />
        </div>
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="tactile-card rounded-lg p-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              Tidak ada data yang sesuai filter.
            </div>
          )}
          {filtered.map(item => <PipelineCard key={item.id} item={item} />)}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="tactile-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1400px] data-table">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                  {['Kode','Uraian Material','Qty','Nilai',
                    'Nomor NOD','Tgl NOD',
                    'Nomor PR','Tgl PR',
                    'Nomor PO','Tgl PO',
                    'Tgl Kirim','Rencana Tiba','Tgl Tiba',
                    'Nomor GR','Tgl GR',
                    'Lead Time (P/A)','Status','Risiko'].map(h => (
                    <th key={h} className="px-3 py-3 text-[10px] font-black tracking-widest uppercase whitespace-nowrap"
                      style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const cfg = statusCfg[row.status];
                  const rCfg = riskCfg[row.risiko_keterlambatan];
                  const grDate = row.tanggal_gr || row.tanggal_penerimaan_barang;
                  const actualLt = grDate && row.tanggal_po
                    ? Math.round((new Date(grDate).getTime() - new Date(row.tanggal_po).getTime()) / 86400000)
                    : row.actual_lead_time;
                  const isLate = actualLt !== null && actualLt !== undefined && row.plan_lead_time > 0 && actualLt > row.plan_lead_time;
                  const nil = <span style={{ color: 'var(--color-on-surface-variant)', opacity: 0.4 }}>—</span>;
                  const td = (val: string | null | undefined, mono = false) =>
                    val ? <span className={mono ? 'font-mono font-bold text-[10px]' : ''}
                      style={{ color: mono ? cfg.text : 'var(--color-on-surface)' }}>{val}</span> : nil;
                  return (
                    <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                      <td className="px-3 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                      <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.uraian_material}</td>
                      <td className="px-3 py-3 text-xs">{row.jumlah_dipesan} {row.satuan}</td>
                      <td className="px-3 py-3 text-xs font-bold" style={{ color: 'var(--color-secondary)' }}>{formatRupiah(row.total_harga)}</td>
                      <td className="px-3 py-3 text-xs">{td(row.nomor_nod, true)}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{row.tanggal_nod ? formatTanggal(row.tanggal_nod) : nil}</td>
                      <td className="px-3 py-3 text-xs">{td(row.nomor_pr, true)}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{row.tanggal_pr ? formatTanggal(row.tanggal_pr) : nil}</td>
                      <td className="px-3 py-3 text-xs">{td(row.nomor_po, true)}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{formatTanggal(row.tanggal_po)}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{row.tanggal_kirim_vendor ? formatTanggal(row.tanggal_kirim_vendor) : nil}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{formatTanggal(row.tanggal_rencana_pengiriman)}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{row.tanggal_tiba_depo ? formatTanggal(row.tanggal_tiba_depo) : nil}</td>
                      <td className="px-3 py-3 text-xs">{td(row.nomor_gr, true)}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{grDate ? formatTanggal(grDate) : nil}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        <span style={{ color: 'var(--color-on-surface)' }}>{row.plan_lead_time}h</span>
                        {actualLt !== null && actualLt !== undefined && (
                          <span className="ml-1 font-bold" style={{ color: isLate ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>/ {actualLt}h</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{row.status}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: rCfg.bg, color: rCfg.text }}>{row.risiko_keterlambatan}</span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={18} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Tidak ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
