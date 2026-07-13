import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import ExportButton from '../components/ui/ExportButton';
import ReactECharts from 'echarts-for-react';
import { getProcurementData } from '../services/supabaseService';
import { formatRupiah, formatTanggal } from '../utils/calculations';
import type { ProcurementStatus, RisikoLevel, ProcurementItem } from '../types';

const statusOptions: Array<'Semua' | ProcurementStatus> = ['Semua', 'Dalam Pengadaan', 'Proses Evaluasi', 'Proses PR & Approval', 'Proses PO', 'Goods Inspection', 'Tiba di Gudang'];
const risikoOptions: Array<'Semua' | RisikoLevel> = ['Semua', 'Rendah', 'Sedang', 'Tinggi'];

const statusCfg: Record<string, { bg: string; text: string; border: string }> = {
  'Dalam Pengadaan':       { bg: 'rgba(217,119,6,0.12)',  text: 'var(--color-led-amber)',  border: 'rgba(217,119,6,0.3)' },
  'Proses Evaluasi':       { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa',                  border: 'rgba(139,92,246,0.3)' },
  'Proses PR & Approval':  { bg: 'rgba(37,99,235,0.12)',  text: '#60a5fa',                  border: 'rgba(59,130,246,0.3)' },
  'Proses PO':             { bg: 'rgba(6,182,212,0.12)',  text: '#22d3ee',                  border: 'rgba(6,182,212,0.3)' },
  'Goods Inspection':      { bg: 'rgba(234,179,8,0.12)',  text: '#facc15',                  border: 'rgba(234,179,8,0.3)' },
  'Tiba di Gudang':        { bg: 'rgba(22,163,74,0.12)',  text: 'var(--color-led-green)',   border: 'rgba(22,163,74,0.3)' },
  // Legacy fallbacks
  'PO Diterbitkan':        { bg: 'rgba(37,99,235,0.12)',  text: '#60a5fa',                  border: 'rgba(59,130,246,0.3)' },
  'Dikirim Vendor':        { bg: 'rgba(107,114,128,0.12)',text: '#9ca3af',                  border: 'rgba(107,114,128,0.3)' },
  'Dalam Transit':         { bg: 'rgba(16,185,129,0.12)', text: '#10b981',                  border: 'rgba(16,185,129,0.3)' },
  'Tiba di Depo':          { bg: 'rgba(22,163,74,0.12)',  text: 'var(--color-led-green)',   border: 'rgba(22,163,74,0.3)' },
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
  { key: 'rilis_evaluasi_ctpe',     header: 'Rilis Dokumen Evaluasi Ke CTPE' },
  { key: 'rilis_evaluasi_ctpp',     header: 'Rilis Dokumen Evaluasi Ke CTPP' },
  { key: 'rilis_rab_logistik',      header: 'Rilis RAB Ke Logistik' },
  { key: 'review_logistic_status',  header: 'REVIEW LOGISTIC/IF Under 500 JT RP' },
  { key: 'pr_number',               header: 'Purchase Requisitions Number' },
  { key: 'pr_release_date',         header: 'Purchase Requisitions Release Date' },
  { key: 'approval_sap_status',     header: 'APPROVAL CEP, CE, C2, CAA' },
  { key: 'aanwijzing_date',         header: 'AANWIJZING' },
  { key: 'vendor_sap',              header: 'VENDOR' },
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

function PipelineCard({ item, onSelect }: { item: ProcurementItem; onSelect: (item: ProcurementItem) => void }) {
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
  const steps: { label: string; short: string; num: string | null; planDate: string | null; realDate: string | null; active: boolean }[] = [];

  if (isLelang) {
    steps.push({ label: 'NOD', short: 'NOD', num: item.nomor_nod, planDate: item.tanggal_nod || null, realDate: item.publish_nod || null, active: !!item.publish_nod });
    steps.push({ label: 'Spektek', short: 'Spektek', num: null, planDate: item.plan_tech_spec_release_date || null, realDate: item.tech_spec_release_date || null, active: !!item.tech_spec_release_date });
    steps.push({ label: 'CTPE', short: 'CTPE', num: null, planDate: item.plan_rilis_evaluasi_ctpe || null, realDate: item.rilis_evaluasi_ctpe || null, active: !!item.rilis_evaluasi_ctpe });
    steps.push({ label: 'CTPP', short: 'CTPP', num: null, planDate: item.plan_rilis_evaluasi_ctpp || null, realDate: item.rilis_evaluasi_ctpp || null, active: !!item.rilis_evaluasi_ctpp });
    steps.push({ label: 'RAB', short: 'RAB', num: null, planDate: item.plan_rilis_rab_logistik || null, realDate: item.rilis_rab_logistik || null, active: !!item.rilis_rab_logistik });
    steps.push({ label: 'PR', short: 'PR', num: (item.pr_number || item.nomor_pr || null), planDate: item.tanggal_pr || null, realDate: item.pr_release_date || null, active: !!item.pr_release_date });
    steps.push({ label: 'Approval', short: 'Approval', num: null, planDate: null, realDate: item.approval_sap_status || null, active: !!item.approval_sap_status });
    steps.push({ label: 'Aanwijzing', short: 'Aanwijzing', num: null, planDate: null, realDate: item.aanwijzing_date || null, active: !!item.aanwijzing_date });
    steps.push({ label: 'PO', short: 'PO', num: (item.po_number || item.nomor_po || null), planDate: item.tanggal_po || null, realDate: item.po_release_date || null, active: !!item.po_release_date });
    steps.push({ label: 'Goods Inspection', short: 'GI', num: null, planDate: item.plan_goods_inspection_status || null, realDate: item.goods_inspection_status || null, active: !!item.goods_inspection_status });
    steps.push({ label: 'GR', short: 'GR', num: item.nomor_gr, planDate: item.tanggal_gr || item.tanggal_rencana_pengiriman || null, realDate: item.gr_release_date || null, active: !!item.gr_release_date });
  } else {
    steps.push({ label: 'NOD', short: 'NOD', num: item.nomor_nod, planDate: item.tanggal_nod || null, realDate: item.publish_nod || null, active: !!item.publish_nod });
    steps.push({ label: 'RAB', short: 'RAB Log', num: null, planDate: item.plan_rilis_rab_logistik || null, realDate: item.rilis_rab_logistik || null, active: !!item.rilis_rab_logistik });
    steps.push({ label: 'Review Logistik', short: 'Review Log', num: null, planDate: item.plan_review_logistic_status || null, realDate: item.review_logistic_status || null, active: !!item.review_logistic_status });
    steps.push({ label: 'PR', short: 'PR', num: (item.pr_number || item.nomor_pr || null), planDate: item.tanggal_pr || null, realDate: item.pr_release_date || null, active: !!item.pr_release_date });
    steps.push({ label: 'Approval', short: 'Approval', num: null, planDate: null, realDate: item.approval_sap_status || null, active: !!item.approval_sap_status });
    steps.push({ label: 'PO', short: 'PO', num: (item.po_number || item.nomor_po || null), planDate: item.tanggal_po || null, realDate: item.po_release_date || null, active: !!item.po_release_date });
    steps.push({ label: 'GR', short: 'GR', num: item.nomor_gr, planDate: item.tanggal_gr || item.tanggal_rencana_pengiriman || null, realDate: item.gr_release_date || null, active: !!item.gr_release_date });
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
          {(item.publish_nod || item.tanggal_nod) && (
            <button
              onClick={() => onSelect(item)}
              className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-600/20 transition-all cursor-pointer whitespace-nowrap"
            >
              ANALISIS
            </button>
          )}
        </div>
      </div>

      {/* ── Pipeline Timeline ── */}
      <div className="px-4 pt-16 pb-6 overflow-x-auto">
        <div className="flex items-start min-w-[800px] justify-between">
          {steps.map((step, si) => {
            return (
              <div key={step.label} className="flex items-start flex-1 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0 relative group" style={{ minWidth: 80 }}>
                  {/* Node circle */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 text-[10px] font-black transition-all cursor-pointer flex-col"
                    style={{
                      backgroundColor: step.realDate ? 'var(--color-led-green)' : 'transparent',
                      borderColor: step.realDate 
                        ? 'var(--color-led-green)' 
                        : step.planDate 
                          ? '#eab308' // yellow border if planned but not yet realized
                          : 'var(--color-steel-border)',
                      borderStyle: (!step.realDate && step.planDate) ? 'dashed' : 'solid',
                      color: step.realDate ? '#ffffff' : step.planDate ? '#eab308' : 'var(--color-on-surface-variant)',
                      boxShadow: 'none',
                    }}>
                    {step.realDate ? <CheckIcon /> : step.planDate ? 'Plan' : si + 1}
                  </div>

                  {/* Custom Styled Tooltip - dipasang kembali di atas (bottom-14) dengan aman karena padding container atas (pt-16) sudah diperbesar */}
                  <div className="absolute bottom-14 hidden group-hover:flex flex-col bg-gray-900 border border-gray-800 text-white rounded p-2.5 text-[10px] z-30 shadow-xl pointer-events-none left-1/2 -translate-x-1/2 min-w-[145px]"
                    style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>
                    <div className="font-bold text-gray-300 border-b border-gray-800 pb-1 mb-1">{step.label}</div>
                    <div className="text-gray-400">Status: <span className={step.realDate ? 'text-green-400 font-bold' : step.planDate ? 'text-amber-400 font-bold' : 'text-gray-400'}>{step.realDate ? 'Selesai' : step.planDate ? 'Direncanakan' : 'Belum'}</span></div>
                    {step.num && <div className="mt-1 font-mono text-[9px] text-blue-400 overflow-hidden text-ellipsis whitespace-nowrap max-w-[130px]" title={step.num}>No: {step.num}</div>}
                    {step.planDate && <div className="mt-0.5 text-amber-400">Rencana: {formatTanggal(step.planDate)}</div>}
                    {step.realDate && <div className="mt-0.5 text-green-400">Realisasi: {formatTanggal(step.realDate)}</div>}
                    {/* Small triangle arrow - pointing down */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-r border-b border-gray-800 rotate-45"></div>
                  </div>

                  {/* Step label */}
                  <span className="text-[10px] mt-1.5 text-center font-bold leading-tight"
                    style={{ color: step.realDate ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', maxWidth: 78 }}>
                    {step.short}
                  </span>

                  {/* Hanya munculkan tanggal realisasi di bawah node, teks lebih besar & warna hitam/putih default */}
                  <div className="flex flex-col items-center mt-1">
                    {step.realDate && (
                      <span className="text-xs font-bold font-mono mt-0.5 whitespace-nowrap" style={{ color: 'var(--color-on-surface)' }}>
                        {formatTanggal(step.realDate)}
                      </span>
                    )}
                  </div>
                </div>
                {/* Connector */}
                {si < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mt-4 mx-0.5"
                    style={{ backgroundColor: (step.realDate && steps[si + 1]?.realDate) ? 'var(--color-led-green)' : 'var(--color-steel-border)' }} />
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
  const [selectedPO, setSelectedPO] = useState<ProcurementItem | null>(null);

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

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {statusOptions.slice(1).map(s => {
          const count = procureList.filter(d => d.status === s).length;
          const cfg = statusCfg[s as ProcurementStatus] || { bg: 'rgba(107,114,128,0.12)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' };
          const active = filterStatus === s;
          return (
            <div key={s}
              className="tactile-card rounded-lg p-2.5 text-center cursor-pointer transition-all hover:scale-105 active:scale-100"
              style={active ? { backgroundColor: cfg.bg, borderColor: cfg.border } : undefined}
              onClick={() => setFilterStatus(prev => prev === s ? 'Semua' : s as ProcurementStatus)}>
              <p className="text-2xl font-black" style={{ color: cfg.text }}>{count}</p>
              <p className="text-[8px] font-black tracking-wider uppercase mt-1 leading-tight" style={{ color: cfg.text }}>{s}</p>
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
          {filtered.map(item => <PipelineCard key={item.id} item={item} onSelect={setSelectedPO} />)}
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
                    'NO', 'NOD Status', 'Progress', 'Proposed by', 'NOD Number', 'Plan NOD', 'Realisasi NOD',
                    'RKAP/NON RKAP', 'Link Doc NOD', 'Category', 
                    'Plan Spektek', 'Realisasi Spektek',
                    'Plan CTPE', 'Realisasi CTPE',
                    'Plan CTPP', 'Realisasi CTPP',
                    'Plan RAB', 'Realisasi RAB',
                    'Plan Review Log', 'Realisasi Review Log',
                    'PR Number', 'Plan PR', 'Realisasi PR', 'Approval',
                    'Aanwijzing', 'Vendor', 'PO Number', 'Plan PO', 'Realisasi PO',
                    'Plan GI', 'Realisasi GI', 'Plan GR', 'Realisasi GR', 'Duration', 'Status', 'Cost'
                  ].map(h => {
                    let textColor = 'var(--color-on-primary-container)';
                    if (h.toLowerCase().includes('plan')) {
                      textColor = '#3b82f6'; // Biru untuk Plan
                    } else if (h.toLowerCase().includes('realisasi')) {
                      textColor = '#f97316'; // Orange untuk Realisasi
                    }
                    return (
                      <th key={h} className="px-3 py-3 text-[10px] font-black tracking-widest uppercase whitespace-nowrap text-center first:text-left last:text-right"
                        style={{ color: textColor }}>{h}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const cfg = statusCfg[row.status] || { bg: 'rgba(107,114,128,0.12)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' };
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
                      
                      {/* 6. Plan NOD */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.tanggal_nod ? formatTanggal(row.tanggal_nod) : '—'}
                      </td>

                      {/* 7. Realisasi NOD */}
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
                      
                      {/* 10. Spektek (Plan vs Realisasi) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.plan_tech_spec_release_date ? formatTanggal(row.plan_tech_spec_release_date) : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.tech_spec_release_date ? formatTanggal(row.tech_spec_release_date) : '—'}
                      </td>
                      
                      {/* 11. Evaluasi CTPE (Plan vs Realisasi) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.plan_rilis_evaluasi_ctpe ? formatTanggal(row.plan_rilis_evaluasi_ctpe) : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.rilis_evaluasi_ctpe ? formatTanggal(row.rilis_evaluasi_ctpe) : '—'}
                      </td>
                      
                      {/* 12. Evaluasi CTPP (Plan vs Realisasi) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.plan_rilis_evaluasi_ctpp ? formatTanggal(row.plan_rilis_evaluasi_ctpp) : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.rilis_evaluasi_ctpp ? formatTanggal(row.rilis_evaluasi_ctpp) : '—'}
                      </td>
                      
                      {/* 13. Rilis RAB Ke Logistik (Plan vs Realisasi) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.plan_rilis_rab_logistik ? formatTanggal(row.plan_rilis_rab_logistik) : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.rilis_rab_logistik ? formatTanggal(row.rilis_rab_logistik) : '—'}
                      </td>
                      
                      {/* 14. REVIEW LOGISTIC (Plan vs Realisasi) */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.plan_review_logistic_status
                          ? (row.plan_review_logistic_status.match(/\d{4}-\d{2}-\d{2}/)
                              ? formatTanggal(row.plan_review_logistic_status)
                              : row.plan_review_logistic_status)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.review_logistic_status
                          ? (row.review_logistic_status.match(/\d{4}-\d{2}-\d{2}/)
                              ? formatTanggal(row.review_logistic_status)
                              : row.review_logistic_status)
                          : '—'}
                      </td>
                      
                      {/* 14. Purchase Requisitions Number (SAP) */}
                      <td className="px-3 py-3 text-xs font-mono font-bold text-center" style={{ color: cfg.text }}>
                        {row.pr_number || row.nomor_pr || '—'}
                      </td>
                      
                      {/* Plan PR */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.tanggal_pr ? formatTanggal(row.tanggal_pr) : '—'}
                      </td>

                      {/* Realisasi PR */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.pr_release_date ? formatTanggal(row.pr_release_date) : '—'}
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
                      
                      {/* Plan PO */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.tanggal_po ? formatTanggal(row.tanggal_po) : '—'}
                      </td>

                      {/* Realisasi PO */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.po_release_date ? formatTanggal(row.po_release_date) : '—'}
                      </td>
                      
                      {/* Plan GI */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.plan_goods_inspection_status ? formatTanggal(row.plan_goods_inspection_status) : '—'}
                      </td>

                      {/* Realisasi GI */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.goods_inspection_status ? formatTanggal(row.goods_inspection_status) : '—'}
                      </td>
                      
                      {/* Plan GR */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.tanggal_gr || row.tanggal_rencana_pengiriman ? formatTanggal(row.tanggal_gr || row.tanggal_rencana_pengiriman) : '—'}
                      </td>

                      {/* Realisasi GR */}
                      <td className="px-3 py-3 text-xs text-center whitespace-nowrap">
                        {row.gr_release_date ? formatTanggal(row.gr_release_date) : '—'}
                      </td>
                      
                      {/* 23. DURATION */}
                      <td className="px-3 py-3 text-xs font-bold text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span>
                            {(() => {
                              const start = row.publish_nod || row.tanggal_nod ? new Date(row.publish_nod || row.tanggal_nod!) : null;
                              const end = row.gr_release_date || row.tanggal_gr ? new Date(row.gr_release_date || row.tanggal_gr!) : new Date();
                              if (start) {
                                const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
                                return `${diffDays} Hari`;
                              }
                              return '—';
                            })()}
                          </span>
                          {(row.publish_nod || row.tanggal_nod) && (
                            <button
                              onClick={() => setSelectedPO(row)}
                              className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-600/20 transition-all cursor-pointer whitespace-nowrap"
                            >
                              ANALISIS
                            </button>
                          )}
                        </div>
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

      {/* Modal Analisis Jeda Proses PO */}
      {selectedPO && (() => {
        const costVal = selectedPO.cost ?? selectedPO.total_harga ?? 0;
        const isLelang = costVal >= 500000000;

        const getMilestoneDate = (label: string) => {
          switch (label) {
            case 'NOD': return selectedPO.publish_nod || selectedPO.tanggal_nod || null;
            case 'Spektek': return selectedPO.tech_spec_release_date || null;
            case 'CTPE': return selectedPO.rilis_evaluasi_ctpe || null;
            case 'CTPP': return selectedPO.rilis_evaluasi_ctpp || null;
            case 'RAB': return selectedPO.rilis_rab_logistik || null;
            case 'PR': return selectedPO.pr_release_date || selectedPO.tanggal_pr || null;
            case 'Approval': return selectedPO.approval_sap_status || null;
            case 'Aanwijzing': return selectedPO.aanwijzing_date || null;
            case 'PO': return selectedPO.po_release_date || selectedPO.tanggal_po || null;
            case 'Goods Inspection': return selectedPO.goods_inspection_status || null;
            case 'GR': return selectedPO.gr_release_date || selectedPO.tanggal_gr || null;
            default: return null;
          }
        };

        const stepsList = isLelang 
          ? ['NOD', 'Spektek', 'CTPE', 'CTPP', 'RAB', 'PR', 'Approval', 'Aanwijzing', 'PO', 'Goods Inspection', 'GR']
          : ['NOD', 'RAB', 'PR', 'Approval', 'PO', 'GR'];

        const gaps: { step: string; days: number; from: string; to: string; isOngoing: boolean }[] = [];
        for (let i = 0; i < stepsList.length - 1; i++) {
          const fromLabel = stepsList[i];
          const toLabel = stepsList[i+1];
          const fromDateStr = getMilestoneDate(fromLabel);
          const toDateStr = getMilestoneDate(toLabel);

          let days = 0;
          let isOngoing = false;

          if (fromDateStr && toDateStr) {
            const start = new Date(fromDateStr);
            const end = new Date(toDateStr);
            days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
          } else if (fromDateStr && !toDateStr) {
            const hasFutureDate = stepsList.slice(i + 1).some(step => getMilestoneDate(step) !== null);
            if (!hasFutureDate) {
              const start = new Date(fromDateStr);
              const end = new Date();
              days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
              isOngoing = true;
            }
          }

          gaps.push({
            step: `${fromLabel} → ${isOngoing ? 'Berjalan' : toLabel}`,
            days,
            from: fromLabel,
            to: isOngoing ? 'Berjalan' : toLabel,
            isOngoing
          });
        }

        const maxGap = gaps.length > 0 ? gaps.reduce((max, g) => g.days > max.days ? g : max, gaps[0]) : null;

        let runningTotal = 0;
        const accumulativeDays = gaps.map(g => {
          runningTotal += g.days;
          return runningTotal;
        });

        // Plan cumulative: map plan dates relative to plan NOD start (fallback ke publish_nod)
        const planStartDate = selectedPO.tanggal_nod
          ? new Date(selectedPO.tanggal_nod)
          : selectedPO.publish_nod
            ? new Date(selectedPO.publish_nod)
            : null;
        const getPlanDays = (dateStr: string | null): number | null => {
          if (!planStartDate || !dateStr) return null;
          return Math.max(0, Math.round((new Date(dateStr).getTime() - planStartDate.getTime()) / 86400000));
        };

        // Build plan cumulative mapped to the same gap x-axis positions
        // For each gap step "A → B", the plan point is at the plan date of B
        const getPlanMilestoneDate = (label: string): string | null => {
          switch (label) {
            case 'NOD': return selectedPO.tanggal_nod || null;
            case 'Spektek': return selectedPO.tech_spec_release_date || null;
            case 'CTPE': return selectedPO.rilis_evaluasi_ctpe || null;
            case 'CTPP': return selectedPO.rilis_evaluasi_ctpp || null;
            case 'RAB': return selectedPO.rilis_rab_logistik || null;
            case 'PR': return selectedPO.tanggal_pr || null;
            case 'Approval': return selectedPO.approval_sap_status || null;
            case 'Aanwijzing': return selectedPO.aanwijzing_date || null;
            case 'PO': return selectedPO.tanggal_po || null;
            case 'Goods Inspection': return selectedPO.goods_inspection_status || null;
            case 'GR': return selectedPO.tanggal_gr || selectedPO.tanggal_rencana_pengiriman || null;
            default: return null;
          }
        };

        // Plan cumulative per gap end point
        const planCumulativeLine = gaps.map(g => getPlanDays(getPlanMilestoneDate(g.to === 'Berjalan' ? g.from : g.to)));

        const chartOption = {
          backgroundColor: 'transparent',
          animation: true,
          animationDuration: 800,
          animationEasing: 'cubicInOut',
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
              const parts = label.split(' → ');
              const fromLabel = parts[0];
              const toLabel = parts[1];
              const fromDate = getMilestoneDate(fromLabel);
              const toDate = toLabel === 'Berjalan' ? new Date().toISOString() : getMilestoneDate(toLabel);
              const headerText = `${fromLabel} (${fromDate ? formatTanggal(fromDate) : '—'}) → ${toLabel} (${toDate ? formatTanggal(toDate) : '—'})`;
              const rows = params
                .filter((p: any) => p.value !== null && p.value !== undefined)
                .map((p: any) => {
                  const val = typeof p.value === 'number' ? p.value.toLocaleString('id-ID') + ' Hari' : '—';
                  const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.color};margin-right:8px;flex-shrink:0;box-shadow:0 0 0 2px rgba(255,255,255,0.3)"></span>`;
                  const nameMap: Record<string, string> = { 'Durasi Realisasi': 'Durasi Realisasi', 'Rencana (Kumulatif)': 'Rencana (Kumulatif)', 'Realisasi (Kumulatif)': 'Realisasi (Kumulatif)' };
                  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;padding:3px 0">${dot}<span style="color:${ct.tooltipSub};font-size:11px">${nameMap[p.seriesName] || p.seriesName}</span><b style="color:${ct.tooltipText};font-size:12px;font-variant-numeric:tabular-nums">${val}</b></div>`;
                }).join('');
              return `<div style="font-size:10px;font-weight:800;color:${ct.tooltipSub};margin-bottom:8px;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid ${ct.tooltipBorder};padding-bottom:6px">${headerText}</div>${rows}`;
            },
          },
          grid: {
            top: '16%',
            bottom: '12%',
            left: '4%',
            right: '4%',
            containLabel: true
          },
          legend: {
            data: ['Durasi Realisasi', 'Rencana (Kumulatif)', 'Realisasi (Kumulatif)'],
            itemWidth: 32,
            itemHeight: 6,
            itemGap: 24,
            icon: 'roundRect',
            textStyle: { color: ct.legendText, fontSize: 12, fontWeight: '700', fontFamily: 'inherit' },
            inactiveColor: isDark ? '#334155' : '#d1d5db',
            top: '0%'
          },
          xAxis: {
            type: 'category',
            data: gaps.map(g => g.step),
            axisLabel: {
              color: ct.axisLabel,
              fontSize: 10,
              fontWeight: '600',
              fontFamily: 'inherit',
              margin: 10,
              interval: 0,
              rotate: 20
            },
            axisLine: { lineStyle: { color: ct.axisLine, width: 1 } },
            axisTick: { show: false },
            splitLine: { show: true, lineStyle: { color: ct.gridLine, type: 'dashed', width: 1 } }
          },
          yAxis: [
            {
              type: 'value',
              name: 'Jeda (Hari)',
              nameLocation: 'end',
              nameTextStyle: { color: ct.axisLabel, fontSize: 9, fontWeight: '700', fontFamily: 'inherit', padding: [0, 16, 4, 0] },
              axisLabel: { color: ct.axisLabel, fontSize: 10, fontFamily: 'inherit' },
              axisLine: { show: false },
              axisTick: { show: false },
              splitLine: { lineStyle: { color: ct.gridLine, type: 'dashed', width: 1 } }
            },
            {
              type: 'value',
              name: 'Kumulatif (Hari)',
              nameLocation: 'end',
              nameTextStyle: { color: ct.axisLabel, fontSize: 9, fontWeight: '700', fontFamily: 'inherit', padding: [0, 0, 4, 16] },
              axisLabel: { color: ct.axisLabel, fontSize: 10, fontFamily: 'inherit' },
              axisLine: { show: false },
              axisTick: { show: false },
              splitLine: { show: false }
            }
          ],
          series: [
            {
              name: 'Durasi Realisasi',
              type: 'bar',
              barWidth: '24%',
              yAxisIndex: 0,
              data: gaps.map(g => g.days),
              label: {
                show: true,
                position: 'top',
                formatter: '{c} H',
                color: ct.axisLabel,
                fontSize: 9,
                fontWeight: '700',
                fontFamily: 'inherit'
              },
              itemStyle: {
                color: (params: any) => {
                  if (maxGap && params.value === maxGap.days && params.value > 0) {
                    return { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#b91c1c' }] };
                  }
                  return { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#1d4ed8' }] };
                },
                borderRadius: [3, 3, 0, 0]
              }
            },
            {
              name: 'Rencana (Kumulatif)',
              type: 'line',
              yAxisIndex: 1,
              smooth: true,
              showSymbol: true,
              symbol: 'circle',
              symbolSize: 8,
              data: planCumulativeLine,
              lineStyle: { color: '#eab308', width: 2.5, type: 'dashed', shadowColor: 'rgba(234,179,8,0.3)', shadowBlur: 4 },
              itemStyle: { color: '#eab308', borderColor: '#ffffff', borderWidth: 1.5 }
            },
            {
              name: 'Realisasi (Kumulatif)',
              type: 'line',
              yAxisIndex: 1,
              smooth: true,
              showSymbol: true,
              symbol: 'circle',
              symbolSize: 8,
              data: accumulativeDays,
              lineStyle: { color: '#10b981', width: 2.5, shadowColor: 'rgba(16,185,129,0.3)', shadowBlur: 4 },
              itemStyle: { color: '#10b981', borderColor: '#ffffff', borderWidth: 1.5 }
            }
          ]
        };

        const totalDays = (() => {
          const start = selectedPO.publish_nod || selectedPO.tanggal_nod ? new Date(selectedPO.publish_nod || selectedPO.tanggal_nod!) : null;
          const end = selectedPO.gr_release_date || selectedPO.tanggal_gr ? new Date(selectedPO.gr_release_date || selectedPO.tanggal_gr!) : new Date();
          if (start) {
            return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
          }
          return 0;
        })();

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="tactile-card rounded-lg overflow-hidden w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] shadow-2xl flex flex-col animate-scale-up"
                 style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)' }}>
              
              {/* Modal Header */}
              <div className="p-4 border-b flex justify-between items-center" 
                   style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
                <div>
                  <h3 className="font-extrabold text-lg" style={{ color: 'var(--color-on-surface)' }}>
                    Analisis Durasi &amp; Jeda Proses PO
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Material: <b>{selectedPO.nomor_material} — {selectedPO.uraian_material}</b>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedPO(null)}
                  className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
                  style={{ color: 'var(--color-on-surface)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
                {/* Stats row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border flex flex-col justify-center shadow-sm" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
                    <span className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Total Hari Proses</span>
                    <span className="text-xl font-black text-blue-500">
                      {totalDays} Hari
                    </span>
                    <span className="text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.8 }}>
                      NOD: {formatTanggal(selectedPO.publish_nod || selectedPO.tanggal_nod) || '—'} s/d {selectedPO.gr_release_date || selectedPO.tanggal_gr ? `GR: ${formatTanggal(selectedPO.gr_release_date || selectedPO.tanggal_gr!)}` : 'Berjalan (Hari ini)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border flex flex-col justify-center shadow-sm" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
                    <span className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Jeda Terlama (Bottleneck)</span>
                    <span className="text-xl font-black text-red-500">
                      {maxGap ? `${maxGap.days} Hari` : '—'}
                    </span>
                    <span className="text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.8 }}>
                      {maxGap ? `Proses: ${maxGap.step}` : 'Tidak ada data jeda'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border flex flex-col justify-center shadow-sm" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
                    <span className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Perbandingan GR (Rencana vs Realisasi)</span>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex justify-between text-[10px]">
                        <span style={{ color: 'var(--color-on-surface-variant)' }}>Rencana GR:</span>
                        <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{selectedPO.tanggal_rencana_pengiriman ? formatTanggal(selectedPO.tanggal_rencana_pengiriman) : '—'}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span style={{ color: 'var(--color-on-surface-variant)' }}>Realisasi GR:</span>
                        <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{(selectedPO.gr_release_date || selectedPO.tanggal_gr) ? formatTanggal(selectedPO.gr_release_date || selectedPO.tanggal_gr) : '—'}</span>
                      </div>
                      <div className="flex justify-between text-[10px] border-t pt-1 mt-1" style={{ borderColor: 'var(--color-steel-border)' }}>
                        <span style={{ color: 'var(--color-on-surface-variant)' }}>Status Kedatangan:</span>
                        {(() => {
                          if (!selectedPO.tanggal_rencana_pengiriman) return <span className="font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Belum Ada Rencana</span>;
                          const grDate = selectedPO.gr_release_date || selectedPO.tanggal_gr;
                          if (!grDate) return <span className="font-bold text-yellow-500">Dalam Proses</span>;
                          
                          const plan = new Date(selectedPO.tanggal_rencana_pengiriman);
                          const real = new Date(grDate);
                          const diffTime = real.getTime() - plan.getTime();
                          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                          
                          if (diffDays <= 0) return <span className="font-bold text-green-500">Tepat Waktu / Lebih Cepat</span>;
                          return <span className="font-bold text-red-500">Terlambat {diffDays} Hari</span>;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="p-5 border rounded-xl flex-1 flex flex-col shadow-sm" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
                  <h5 className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>Grafik Selisih Jeda Transisi &amp; Total Akumulatif (Hari)</h5>
                  <div className="flex-1 min-h-[400px]">
                    <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container-high)' }}>
                <button 
                  onClick={() => setSelectedPO(null)}
                  className="px-4 py-1.5 rounded text-xs font-extrabold skeuomorphic-btn transition-all"
                >
                  TUTUP
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </PageWrapper>
  );
}
