import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import { getProcurementData } from '../services/supabaseService';
import { formatRupiah, formatTanggal } from '../utils/calculations';
import type { ProcurementStatus, RisikoLevel, ProcurementItem } from '../types';

const statusOptions: Array<'Semua' | ProcurementStatus> = ['Semua', 'PO Diterbitkan', 'Dalam Pengadaan', 'Dikirim Vendor', 'Dalam Transit', 'Tiba di Gudang'];
const risikoOptions: Array<'Semua' | RisikoLevel> = ['Semua', 'Rendah', 'Sedang', 'Tinggi'];

const statusCfg: Record<ProcurementStatus | 'Tiba di Depo', { bg: string; text: string; border: string }> = {
  'PO Diterbitkan':   { bg: 'rgba(37,99,235,0.12)',  text: '#60a5fa',                  border: 'rgba(59,130,246,0.3)' },
  'Dalam Pengadaan':  { bg: 'rgba(217,119,6,0.12)',  text: 'var(--color-led-amber)',   border: 'rgba(217,119,6,0.3)' },
  'Dikirim Vendor':   { bg: 'rgba(107,114,128,0.12)',text: '#9ca3af',                  border: 'rgba(107,114,128,0.3)' },
  'Dalam Transit':    { bg: 'rgba(16,185,129,0.12)', text: '#10b981',                  border: 'rgba(16,185,129,0.3)' },
  'Tiba di Gudang':   { bg: 'rgba(22,163,74,0.12)',  text: 'var(--color-led-green)',   border: 'rgba(22,163,74,0.3)' },
  'Tiba di Depo':     { bg: 'rgba(22,163,74,0.12)',  text: 'var(--color-led-green)',   border: 'rgba(22,163,74,0.3)' },
};

const riskCfg: Record<RisikoLevel, { bg: string; text: string }> = {
  Rendah: { bg: 'rgba(22,163,74,0.1)',  text: 'var(--color-led-green)' },
  Sedang: { bg: 'rgba(217,119,6,0.1)', text: 'var(--color-led-amber)' },
  Tinggi: { bg: 'rgba(220,38,38,0.1)', text: 'var(--color-led-red)' },
};



const exportCols = [
  { key: 'nomor_material',          header: 'Kode Material' },
  { key: 'uraian_material',         header: 'Uraian Material' },
  { key: 'satuan',                  header: 'Satuan' },
  { key: 'jumlah_dipesan',          header: 'Qty' },
  { key: 'proposed_by',             header: 'Proposed by' },
  { key: 'nomor_nod',               header: 'NOD Number' },
  { key: 'publish_nod',             header: 'Publish NOD' },
  { key: 'rkap_non_rkap',           header: 'RKAP/NON RKAP' },
  { key: 'link_document_nod',       header: 'Link Document NOD' },
  { key: 'category',                header: 'Category' },
  { key: 'tech_spec_release_date',  header: 'Technical Specification Release Date' },
  { key: 'rilis_evaluasi_ctpp',     header: 'Rilis Dokumen Evaluasi Ke CTPP' },
  { key: 'rilis_rab_logistik',      header: 'Rilis RAB Ke Logistik' },
  { key: 'review_logistic_status',  header: 'REVIEW LOGISTIC/IF Under 500 JT RP' },
  { key: 'pr_number',               header: 'Purchase Requisitions Number' },
  { key: 'pr_release_date',         header: 'Purchase Requisitions Release Date' },
  { key: 'approval_sap_status',     header: 'APPROVAL CEP, CE, C2, CAA' },
  { key: 'aanwijzing_date',         header: 'AANWIJZING' },
  { key: 'vendor_sap',              header: 'VENDOR (SAP)' },
  { key: 'po_number',               header: 'Purchase Order Number' },
  { key: 'po_release_date',         header: 'Purchase Order Release date' },
  { key: 'goods_inspection_status', header: 'Goods Inspection' },
  { key: 'gr_release_date',         header: 'Good Receipt Release Date' },
  { key: 'status',                  header: 'Status' },
  { key: 'cost',                    header: 'Cost' }
];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PipelineCard({ item }: { item: ProcurementItem }) {
  const cfg = statusCfg[item.status];
  const rCfg = riskCfg[item.risiko_keterlambatan];

  const grDate = item.tanggal_gr || item.tanggal_penerimaan_barang;
  const actualLt = grDate && item.tanggal_po
    ? Math.round((new Date(grDate).getTime() - new Date(item.tanggal_po).getTime()) / 86400000)
    : item.actual_lead_time;
  const isLate = actualLt !== null && actualLt !== undefined && item.plan_lead_time > 0 && actualLt > item.plan_lead_time;

  const costVal = item.cost ?? item.total_harga ?? 0;
  const isLelang = costVal >= 500000000;

  // Bangun langkah-langkah timeline secara dinamis berdasarkan nilai pengadaan (Lelang vs PL)
  const steps: { label: string; short: string; num: string | null; date: string | null; active: boolean }[] = [];

  if (isLelang) {
    steps.push({ label: 'NOD', short: 'NOD', num: item.nomor_nod, date: (item.publish_nod || item.tanggal_nod || null), active: !!(item.publish_nod || item.nomor_nod) });
    steps.push({ label: 'Spektek', short: 'Spektek', num: null, date: (item.tech_spec_release_date || null), active: !!item.tech_spec_release_date });
    steps.push({ label: 'CTPP', short: 'CTPP', num: null, date: (item.rilis_evaluasi_ctpp || null), active: !!item.rilis_evaluasi_ctpp });
    steps.push({ label: 'RAB', short: 'RAB', num: null, date: (item.rilis_rab_logistik || null), active: !!item.rilis_rab_logistik });
    steps.push({ label: 'PR SAP', short: 'PR SAP', num: (item.pr_number || item.nomor_pr || null), date: (item.pr_release_date || item.tanggal_pr || null), active: !!(item.pr_number || item.nomor_pr) });
    steps.push({ label: 'Approval', short: 'Approval', num: (item.approval_sap_status || null), date: null, active: !!item.approval_sap_status });
    steps.push({ label: 'Aanwijzing', short: 'Aanwijzing', num: null, date: (item.aanwijzing_date || null), active: !!item.aanwijzing_date });
    steps.push({ label: 'PO SAP', short: 'PO SAP', num: (item.po_number || item.nomor_po || null), date: (item.po_release_date || item.tanggal_po || null), active: !!(item.po_number || item.nomor_po) });
    steps.push({ label: 'Goods Inspection', short: 'Inspection', num: (item.goods_inspection_status || null), date: null, active: !!item.goods_inspection_status });
    steps.push({ label: 'GR SAP', short: 'GR SAP', num: item.nomor_gr, date: (item.gr_release_date || item.tanggal_gr || null), active: !!(item.gr_release_date || item.nomor_gr) });
  } else {
    steps.push({ label: 'NOD', short: 'NOD', num: item.nomor_nod, date: (item.publish_nod || item.tanggal_nod || null), active: !!(item.publish_nod || item.nomor_nod) });
    steps.push({ label: 'RAB', short: 'RAB Log', num: null, date: (item.rilis_rab_logistik || null), active: !!item.rilis_rab_logistik });
    steps.push({ label: 'Review Logistik', short: 'Review Log', num: (item.review_logistic_status || null), date: null, active: !!item.review_logistic_status });
    steps.push({ label: 'PR SAP', short: 'PR SAP', num: (item.pr_number || item.nomor_pr || null), date: (item.pr_release_date || item.tanggal_pr || null), active: !!(item.pr_number || item.nomor_pr) });
    steps.push({ label: 'Approval', short: 'Approval', num: (item.approval_sap_status || null), date: null, active: !!item.approval_sap_status });
    steps.push({ label: 'PO SAP', short: 'PO SAP', num: (item.po_number || item.nomor_po || null), date: (item.po_release_date || item.tanggal_po || null), active: !!(item.po_number || item.nomor_po) });
    steps.push({ label: 'GR SAP', short: 'GR SAP', num: item.nomor_gr, date: (item.gr_release_date || item.tanggal_gr || null), active: !!(item.gr_release_date || item.nomor_gr) });
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
        <div>
          <span className="font-black text-xs" style={{ color: 'var(--color-on-surface)' }}>{item.nomor_material}</span>
          <span className="mx-2 opacity-30">|</span>
          <span className="text-xs mr-2" style={{ color: 'var(--color-on-surface-variant)' }}>{item.uraian_material}</span>
          <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full ${
            isLelang ? 'bg-red-500/10 text-red-400 border border-red-500/25' : 'bg-green-500/10 text-green-400 border border-green-500/25'
          }`}>
            {isLelang ? 'JALUR LELANG / TENDER' : 'JALUR PENUNJUKAN LANGSUNG'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{item.status}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: rCfg.bg, color: rCfg.text }}>Risiko: {item.risiko_keterlambatan}</span>
          {isLate && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ backgroundColor: 'rgba(220,38,38,0.12)', color: 'var(--color-led-red)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Terlambat {actualLt! - item.plan_lead_time} hari
            </span>
          )}
        </div>
      </div>

      {/* ── Pipeline Timeline ── */}
      <div className="px-4 pt-5 pb-4 overflow-x-auto">
        <div className="flex items-start min-w-[800px] justify-between">
          {steps.map((step, si) => {
            return (
              <div key={step.label} className="flex items-start flex-1 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0 relative group" style={{ minWidth: 70 }}>
                  {/* Node circle */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 text-[10px] font-black transition-all cursor-pointer"
                    style={{
                      backgroundColor: step.date ? 'var(--color-led-green)' : 'var(--color-surface-container-highest)',
                      borderColor: step.date ? 'var(--color-led-green)' : 'var(--color-steel-border)',
                      color: step.date ? '#ffffff' : 'var(--color-on-surface-variant)',
                      boxShadow: 'none',
                    }}>
                    {step.date ? <CheckIcon /> : si + 1}
                  </div>

                  {/* Custom Styled Tooltip */}
                  <div className="absolute bottom-12 hidden group-hover:flex flex-col bg-gray-900 border border-gray-800 text-white rounded p-2.5 text-[10px] z-30 shadow-xl pointer-events-none left-1/2 -translate-x-1/2 min-w-[130px]"
                    style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>
                    <div className="font-bold text-gray-300 border-b border-gray-800 pb-1 mb-1">{step.label}</div>
                    <div className="text-gray-400">Status: <span className={step.date ? 'text-green-400 font-bold' : 'text-gray-400'}>{step.date ? 'Selesai' : 'Belum'}</span></div>
                    {step.num && <div className="mt-1 font-mono text-[9px] text-blue-400 overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]" title={step.num}>No: {step.num}</div>}
                    {step.date && <div className="mt-0.5 text-amber-400">Tgl: {formatTanggal(step.date)}</div>}
                    {/* Small triangle arrow */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-r border-b border-gray-800 rotate-45"></div>
                  </div>

                  {/* Step label */}
                  <span className="text-[9px] mt-1.5 text-center font-bold leading-tight"
                    style={{ color: step.date ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', maxWidth: 68 }}>
                    {step.short}
                  </span>
                </div>
                {/* Connector */}
                {si < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mt-4 mx-0.5"
                    style={{ backgroundColor: (step.date && steps[si + 1]?.date) ? 'var(--color-led-green)' : 'var(--color-steel-border)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Meta info ── */}
      <div className="px-4 pb-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px]" style={{ color: 'var(--color-on-surface-variant)', borderTop: '1px solid var(--color-steel-border)' }}>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 w-full">
          <span>Vendor: <b style={{ color: 'var(--color-on-surface)' }}>{item.vendor_sap || item.vendor}</b> <span className="opacity-60">({item.kota_asal})</span></span>
          <span>Qty: <b style={{ color: 'var(--color-on-surface)' }}>{item.jumlah_dipesan} {item.satuan}</b></span>
          <span>Nilai: <b style={{ color: 'var(--color-secondary)' }}>{formatRupiah(costVal)}</b></span>
          <span>Lead Time Plan: <b style={{ color: 'var(--color-on-surface)' }}>{item.plan_lead_time} hari</b></span>
          {actualLt !== null && actualLt !== undefined && (
            <span>Actual: <b style={{ color: isLate ? 'var(--color-led-red)' : 'var(--color-led-green)' }}>{actualLt} hari</b></span>
          )}
          {item.keterangan && (
            <span className="w-full italic flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Keterangan: {item.keterangan}
            </span>
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
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('table');

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

  const vendors = ['Semua Vendor', ...new Set(procureList.map(d => d.vendor_sap || d.vendor).filter(Boolean))];

  const filtered = procureList.filter(row => {
    const matchStatus = filterStatus === 'Semua' || row.status === filterStatus;
    const matchRisiko = filterRisiko === 'Semua' || row.risiko_keterlambatan === filterRisiko;
    const matchVendor = filterVendor === 'Semua Vendor' || (row.vendor_sap || row.vendor) === filterVendor;
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
      <div className="h-4" />

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
            <table className="w-full text-left border-collapse min-w-[2200px] data-table">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                  {[
                    'NO', 'NOD', 'Progress', 'Proposed by', 'NOD Number', 'Publish NOD',
                    'RKAP/NON RKAP', 'Link Doc NOD', 'Category', 'Spektek Release',
                    'Evaluasi CTPP', 'RAB ke Logistik', 'Review Logistic',
                    'PR Number (SAP)', 'PR Release Date (SAP)', 'Approval (SAP)',
                    'Aanwijzing', 'Vendor (SAP)', 'PO Number (SAP)', 'PO Release Date (SAP)',
                    'Goods Inspection', 'GR Release Date (SAP)', 'Duration', 'Status', 'Cost'
                  ].map(h => (
                    <th key={h} className="px-3 py-3 text-[10px] font-black tracking-widest uppercase whitespace-nowrap text-center first:text-left last:text-right"
                      style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const cfg = statusCfg[row.status];
                  return (
                    <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                      {/* 1. NO */}
                      <td className="px-3 py-3 text-xs font-bold text-center">{i + 1}</td>
                      
                      {/* 2. NOD */}
                      <td className="px-3 py-3 text-xs text-center">
                        {row.publish_nod ? (
                          <span className="text-green-500 font-extrabold text-[10px]">✓ READY</span>
                        ) : (
                          <span className="text-gray-500 font-bold">—</span>
                        )}
                      </td>
                      
                      {/* 3. Progress */}
                      <td className="px-3 py-3 text-xs">
                        {(() => {
                          let stepCount = 0;
                          if (row.publish_nod) stepCount++;
                          if (row.pr_number || row.nomor_pr) stepCount++;
                          if (row.po_number || row.nomor_po) stepCount++;
                          if (row.goods_inspection_status && row.goods_inspection_status !== '—') stepCount++;
                          if (row.gr_release_date || row.tanggal_gr) stepCount++;
                          const percent = Math.min(100, Math.round((stepCount / 5) * 100));
                          const barColor = percent === 100 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#3b82f6';
                          return (
                            <div className="flex items-center gap-2 min-w-[120px] mx-auto justify-center">
                              <div className="flex-1 bg-gray-700/30 rounded-full h-1.5 overflow-hidden max-w-[80px]">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: barColor }} />
                              </div>
                              <span className="text-[10px] font-bold" style={{ color: barColor }}>{percent}%</span>
                            </div>
                          );
                        })()}
                      </td>
                      
                      {/* 4. Proposed by */}
                      <td className="px-3 py-3 text-xs text-center">{row.proposed_by || 'Unit Perawatan KRL'}</td>
                      
                      {/* 5. NOD Number */}
                      <td className="px-3 py-3 text-xs font-mono font-bold text-center" style={{ color: cfg.text }}>
                        {row.nomor_nod || '—'}
                      </td>
                      
                      {/* 6. Publish NOD */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.publish_nod ? formatTanggal(row.publish_nod) : '—'}
                      </td>
                      
                      {/* 7. RKAP/NON RKAP */}
                      <td className="px-3 py-3 text-xs text-center">
                        <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full ${
                          row.rkap_non_rkap === 'NON RKAP' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {row.rkap_non_rkap || 'RKAP'}
                        </span>
                      </td>
                      
                      {/* 8. Link Document NOD */}
                      <td className="px-3 py-3 text-xs text-center">
                        {row.link_document_nod ? (
                          <a href={row.link_document_nod} target="_blank" rel="noopener noreferrer" 
                            className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-500/15 text-gray-300 border border-gray-500/30 hover:bg-gray-500/25 transition-all">
                            🔗 DOC
                          </a>
                        ) : '—'}
                      </td>
                      
                      {/* 9. Category */}
                      <td className="px-3 py-3 text-xs text-center">{row.category || 'Suku Cadang'}</td>
                      
                      {/* 10. Technical Specification Release Date (Spektek) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.tech_spec_release_date ? formatTanggal(row.tech_spec_release_date) : '—'}
                      </td>
                      
                      {/* 11. Rilis Dokumen Evaluasi Ke CTPP */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.rilis_evaluasi_ctpp ? formatTanggal(row.rilis_evaluasi_ctpp) : '—'}
                      </td>
                      
                      {/* 12. Rilis RAB Ke Logistik */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.rilis_rab_logistik ? formatTanggal(row.rilis_rab_logistik) : '—'}
                      </td>
                      
                      {/* 13. REVIEW LOGISTIC/IF Under 500 JT RP */}
                      <td className="px-3 py-3 text-xs text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                          {row.review_logistic_status || 'SELESAI'}
                        </span>
                      </td>
                      
                      {/* 14. Purchase Requisitions Number (SAP) */}
                      <td className="px-3 py-3 text-xs font-mono font-bold text-center" style={{ color: cfg.text }}>
                        {row.pr_number || row.nomor_pr || '—'}
                      </td>
                      
                      {/* 15. Purchase Requisitions Release Date (SAP) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.pr_release_date || row.tanggal_pr ? formatTanggal(row.pr_release_date || row.tanggal_pr!) : '—'}
                      </td>
                      
                      {/* 16. APPROVAL CEP, CE, C2, CAA (SAP) */}
                      <td className="px-3 py-3 text-xs text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                          {row.approval_sap_status || 'APPROVED'}
                        </span>
                      </td>
                      
                      {/* 17. AANWIJZING */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.aanwijzing_date ? formatTanggal(row.aanwijzing_date) : '—'}
                      </td>
                      
                      {/* 18. VENDOR (SAP) */}
                      <td className="px-3 py-3 text-xs text-center">{row.vendor_sap || row.vendor || '—'}</td>
                      
                      {/* 19. Purchase Order Number (SAP) */}
                      <td className="px-3 py-3 text-xs font-mono font-bold text-center" style={{ color: cfg.text }}>
                        {row.po_number || row.nomor_po || '—'}
                      </td>
                      
                      {/* 20. Purchase Order Release date (SAP) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.po_release_date || row.tanggal_po ? formatTanggal(row.po_release_date || row.tanggal_po) : '—'}
                      </td>
                      
                      {/* 21. Goods Inspection (Pengujian) */}
                      <td className="px-3 py-3 text-xs text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                          {row.goods_inspection_status || 'LULUS UJI'}
                        </span>
                      </td>
                      
                      {/* 22. Good Receipt Release Date (SAP) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.gr_release_date || row.tanggal_gr ? formatTanggal(row.gr_release_date || row.tanggal_gr!) : '—'}
                      </td>
                      
                      {/* 23. DURATION */}
                      <td className="px-3 py-3 text-xs font-bold text-center">
                        {(() => {
                          const start = row.publish_nod ? new Date(row.publish_nod) : null;
                          const end = row.gr_release_date || row.tanggal_gr ? new Date(row.gr_release_date || row.tanggal_gr!) : new Date('2026-07-12');
                          if (start) {
                            const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
                            return `${diffDays} Hari`;
                          }
                          return '—';
                        })()}
                      </td>
                      
                      {/* 24. STATUS */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
                          {row.status}
                        </span>
                      </td>
                      
                      {/* 25. COST */}
                      <td className="px-3 py-3 text-xs font-bold text-right" style={{ color: 'var(--color-secondary)' }}>
                        {formatRupiah(row.cost || row.total_harga)}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={25} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Tidak ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
