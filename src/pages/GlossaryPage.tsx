import { useState, useEffect, useMemo } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import TableScrollWrapper from '../components/ui/TableScrollWrapper';
import { getThresholdConfig, DEFAULT_THRESHOLDS } from '../utils/thresholdSettings';
import { getGlobalThresholdsFromDB, getGlossaryFromDB, getFormulasFromDB } from '../services/supabaseService';
import type { ThresholdConfig } from '../utils/thresholdSettings';

interface GlossaryTerm {
  kategori: 'Istilah Bisnis' | 'Pengadaan' | 'Logistik & Perawatan' | 'Status & Indikator';
  istilah: string;
  definisi: string;
  konteks: string;
}

interface FormulaItem {
  nama: string;
  komponen: string;
  rumus: string;
  penjelasan: string;
}

export default function GlossaryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'istilah' | 'rumus' | 'panduan'>('istilah');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cfg, setCfg] = useState<ThresholdConfig>(() => getThresholdConfig());
  const [dbTerms, setDbTerms] = useState<GlossaryTerm[] | null>(null);
  const [dbFormulas, setDbFormulas] = useState<FormulaItem[] | null>(null);

  const safeCfg = { ...DEFAULT_THRESHOLDS, ...(cfg || {}) };

  useEffect(() => {
    getGlobalThresholdsFromDB()
      .then(remoteCfg => {
        if (remoteCfg) setCfg(remoteCfg);
      })
      .catch(() => {});

    getGlossaryFromDB()
      .then(data => {
        if (data && data.length > 0) setDbTerms(data);
      })
      .catch(() => {});

    getFormulasFromDB()
      .then(data => {
        if (data && data.length > 0) setDbFormulas(data);
      })
      .catch(() => {});
  }, []);

  const defaultGlossaryTerms: GlossaryTerm[] = [
    {
      kategori: 'Pengadaan',
      istilah: 'Multi-PO (Multi Purchase Order)',
      definisi: 'Dukungan pengelolaan dan akumulasi beberapa dokumen pesanan pengadaan (Purchase Order) yang berjalan secara simultan untuk satu material dengan tanggal pengiriman (GR) parsial bertahap.',
      konteks: 'Safety Stock Alert (Grafik Proyeksi)'
    },
    {
      kategori: 'Status & Indikator',
      istilah: 'Defisit Stok',
      definisi: 'Durasi jarak waktu (bulan) dari saat persediaan stok fisik mencapai 0 unit hingga barang dari PO pengadaan pertama tiba di gudang.',
      konteks: 'Safety Stock Alert (Mode Konsumsi)'
    },
    {
      kategori: 'Status & Indikator',
      istilah: 'Gap Aman (Safety Stock Gap)',
      definisi: 'Durasi jarak waktu (bulan) sejak persediaan stok menembus batas Stok Pengaman (Safety Stock) hingga barang dari PO pengadaan pertama tiba di gudang.',
      konteks: 'Safety Stock Alert (Mode Saldo Stok)'
    },
    {
      kategori: 'Istilah Bisnis',
      istilah: 'Anomali Stok (Instability)',
      definisi: 'Kondisi ketidaksesuaian pola konsumsi material terhadap jadwal perawatan (over-absorption / under-absorption) akibat lonjakan pemakaian insidentil atau keterlambatan pelaksanaan perawatan.',
      konteks: 'Anomaly Stock (Grafik & Tabel)'
    },
    {
      kategori: 'Istilah Bisnis',
      istilah: 'Over-absorption',
      definisi: 'Kondisi lonjakan penyerapan material yang melebihi batas standar BOM (Bill of Materials) akibat kerusakan insidentil komponen.',
      konteks: 'Anomaly Stock (Analisis Keborosan)'
    },
    {
      kategori: 'Istilah Bisnis',
      istilah: 'Under-absorption',
      definisi: 'Kondisi penyerapan material yang lebih rendah dari target rencana karena perawatan terlambat atau belum terealisasi.',
      konteks: 'Anomaly Stock (Analisis Penyerapan)'
    },
    {
      kategori: 'Logistik & Perawatan',
      istilah: 'Refilled (Pengisian Stok)',
      definisi: 'Transaksi penerimaan kembali atau penambahan kuantitas pasokan fisik material ke gudang/dipo.',
      konteks: 'Safety Stock Alert & Slow-Moving'
    },
    {
      kategori: 'Logistik & Perawatan',
      istilah: 'Availability Stok',
      definisi: 'Persentase tingkat ketersediaan fisik stok material di gudang dibandingkan dengan batas stok ideal yang ditetapkan.',
      konteks: 'Safety Stock Alert (KPI & Tabel)'
    },
    {
      kategori: 'Logistik & Perawatan',
      istilah: 'Holding Cost (Biaya Pengendapan)',
      definisi: `Estimasi biaya finansial yang timbul akibat penyimpanan atau pengendapan aset material di gudang (dikonfigurasi ${safeCfg.holdingCostPct}% per tahun di Panel Admin, dapat disesuaikan).`,
      konteks: 'Slow-Moving & Dead Stock'
    },
    {
      kategori: 'Logistik & Perawatan',
      istilah: 'Safety Stock (Stok Pengaman)',
      definisi: 'Batas minimum persediaan stok fisik yang wajib ada di gudang untuk mencegah kekosongan stok (*stock-out*) saat terjadi lonjakan mendadak.',
      konteks: 'Safety Stock Alert & Panel Admin'
    },
    {
      kategori: 'Logistik & Perawatan',
      istilah: 'ROP (Re-Order Point / Batas Order)',
      definisi: 'Titik ambang minimum saldo stok di mana proses pemesanan pengadaan baru (PR/PO) harus segera diterbitkan berdasarkan durasi waktu tenggang (*Lead Time*).',
      konteks: 'Safety Stock Alert & Panel Admin'
    },
    {
      kategori: 'Logistik & Perawatan',
      istilah: 'Stok Ideal',
      definisi: 'Target jumlah persediaan stok fisik maksimum yang paling efisien untuk disimpan di gudang tanpa memicu biaya pembengkakan pengendapan.',
      konteks: 'Safety Stock Alert & Panel Admin'
    },
    {
      kategori: 'Status & Indikator',
      istilah: 'Fast Moving',
      definisi: 'Kategori material dengan laju pemakaian/penyerapan sangat tinggi yang berpotensi kehabisan stok dalam waktu dekat jika tidak diisi kembali.',
      konteks: 'Safety Stock Alert (Indikator Risiko)'
    },
    {
      kategori: 'Status & Indikator',
      istilah: 'Fresh Stock',
      definisi: `Material baru yang baru saja masuk gudang atau memiliki usia pengendapan kurang dari atau sama dengan ${safeCfg.limitSlowMoving} hari.`,
      konteks: 'Slow-Moving & Dead Stock'
    },
    {
      kategori: 'Status & Indikator',
      istilah: 'Slow Moving',
      definisi: `Material yang mengendap di gudang tanpa pergerakan transaksi selama ${safeCfg.limitSlowMoving + 1} hingga ${safeCfg.limitAtRisk} hari (ambang batas dapat diubah di Panel Admin).`,
      konteks: 'Slow-Moving & Dead Stock'
    },
    {
      kategori: 'Status & Indikator',
      istilah: 'At-Risk',
      definisi: `Material yang mengendap di gudang tanpa pergerakan selama ${safeCfg.limitAtRisk + 1} hingga ${safeCfg.limitDeadStock} hari yang memerlukan evaluasi pemanfaatan (ambang batas dapat diubah di Panel Admin).`,
      konteks: 'Slow-Moving & Dead Stock'
    },
    {
      kategori: 'Status & Indikator',
      istilah: 'Dead Stock',
      definisi: `Material mati / tidak bergerak sama sekali lebih dari ${safeCfg.limitDeadStock} hari yang berpotensi menimbulkan biaya pengendapan tinggi (ambang batas dapat diubah di Panel Admin).`,
      konteks: 'Slow-Moving & Dead Stock'
    },
    {
      kategori: 'Pengadaan',
      istilah: 'NOD (Nota Dinas)',
      definisi: 'Dokumen usulan kebutuhan awal pengadaan barang/jasa yang diterbitkan oleh unit kerja peminta.',
      konteks: 'Stock In Transit & On PO'
    },
    {
      kategori: 'Pengadaan',
      istilah: 'Spektek',
      definisi: 'Dokumen spesifikasi teknis rincian barang yang disusun untuk keperluan pengadaan.',
      konteks: 'Stock In Transit & On PO'
    },
    {
      kategori: 'Pengadaan',
      istilah: 'CTPE & CTPP',
      definisi: 'Tim evaluasi teknis dan panitia pengadaan yang bertugas meninjau serta menyetujui dokumen teknis dan penawaran.',
      konteks: 'Stock In Transit & On PO'
    },
    {
      kategori: 'Pengadaan',
      istilah: 'PR (Permintaan Pembelian)',
      definisi: 'Dokumen permintaan pembelian resmi yang telah disetujui dalam Sistem pengadaan.',
      konteks: 'Stock In Transit & On PO'
    },
    {
      kategori: 'Pengadaan',
      istilah: 'PO (Pesanan Pembelian)',
      definisi: 'Dokumen kontrak pesanan resmi yang diterbitkan kepada pihak penyedia/vendor.',
      konteks: 'Stock In Transit & On PO'
    },
    {
      kategori: 'Logistik & Perawatan',
      istilah: 'GI (Goods Issue)',
      definisi: 'Transaksi pengeluaran atau pemakaian barang dari gudang untuk keperluan perawatan KRL.',
      konteks: 'Maintenance Order Integration & Safety Stock Alert'
    },
    {
      kategori: 'Logistik & Perawatan',
      istilah: 'GR (Goods Receipt)',
      definisi: 'Transaksi penerimaan fisik barang di gudang dari penyedia setelah proses verifikasi kualitas.',
      konteks: 'Stock In Transit & On PO & Safety Stock Alert'
    },
    {
      kategori: 'Istilah Bisnis',
      istilah: 'Run Rate Multiplier',
      definisi: 'Faktor rasio perbandingan antara konsumsi pemakaian aktual historis (3/6/12 bulan) terhadap rencana target awal.',
      konteks: 'Safety Stock Alert (Mode Riwayat)'
    }
  ];

  const defaultFormulas: FormulaItem[] = [
    {
      nama: '% Ketersediaan Stok',
      komponen: 'Safety Stock Alert',
      rumus: '(Stok Saat Ini / Stok Ideal) × 100%',
      penjelasan: 'Menghitung tingkat kecukupan stok fisik gudang terhadap kapasitas ideal.'
    },
    {
      nama: 'Holding Cost (Biaya Pengendapan)',
      komponen: 'Slow-Moving & Dead Stock',
      rumus: `Nilai Aset × ${safeCfg.holdingCostPct}% × (Usia Pengendapan Hari / 365)`,
      penjelasan: `Memperkirakan kerugian biaya pengendapan dari barang yang mengendap lama (faktor persentase ${safeCfg.holdingCostPct}% dapat diatur di Panel Admin).`
    },
    {
      nama: 'ROP (Re-Order Point / Batas Order)',
      komponen: 'Safety Stock Alert',
      rumus: 'Safety Stock + (Rata-Rata Penyerapan Bulanan × (Lead Time Hari / 30))',
      penjelasan: 'Ambang batas di mana pesanan pengadaan baru harus sudah terbit agar barang tiba sebelum Safety Stock tersentuh.'
    },
    {
      nama: 'Estimasi Bulan Habis (Plan Standar)',
      komponen: 'Safety Stock Alert',
      rumus: 'Bulan GR Terakhir + (Qty GR Terakhir / Plan Penyerapan Bulanan)',
      penjelasan: 'Menentukan perkiraan bulan berapa stok barang dari penerimaan (GR) terakhir akan habis murni berdasarkan target rencana penyerapan tahunan.'
    },
    {
      nama: 'Run Rate Multiplier (Rasio Keborosan)',
      komponen: 'Safety Stock Alert (Mode Riwayat)',
      rumus: 'Sum Pemakaian Aktual (N Bln) / Sum Rencana Target (N Bln)',
      penjelasan: 'Mengukur seberapa boros atau hemat konsumsi riil dibanding rencana awal. Nilai > 1.0 berarti lebih boros dari rencana.'
    },
    {
      nama: 'Plan Terkoreksi Bulanan',
      komponen: 'Safety Stock Alert (Mode Riwayat)',
      rumus: 'Plan Penyerapan Bulanan × Run Rate Multiplier',
      penjelasan: 'Menyesuaikan rencana penyerapan bulanan ke depan berdasarkan laju keborosan konsumsi nyata.'
    },
    {
      nama: 'Proyeksi Saldo Stok (Dengan Multi-PO)',
      komponen: 'Safety Stock Alert (Mode Saldo Stok)',
      rumus: 'Saldo(t) = Saldo(t-1) - Konsumsi(t) + Sum(Qty PO_i yang tiba pada bulan t)',
      penjelasan: 'Simulasi pergerakan saldo persediaan yang melompat naik secara dinamis pada setiap bulan kedatangan dari masing-masing PO aktif.'
    },
    {
      nama: 'Gap Ke PO (Defisit vs Gap Aman)',
      komponen: 'Safety Stock Alert (Toolbar & Grafik)',
      rumus: 'Mode Konsumsi = Bulan PO - Bulan Stok Habis (0 Unit) | Mode Saldo Stok = Bulan PO - Bulan Safety Stock Breach',
      penjelasan: 'Mengukur durasi risiko kekosongan barang total (Defisit) pada Mode Konsumsi atau durasi operasi di bawah batas pengaman (Gap Aman) pada Mode Saldo Stok.'
    },
    {
      nama: 'Deviasi Konsumsi (Qty & %)',
      komponen: 'Anomaly Stock',
      rumus: 'Deviasi Qty = Aktual Rata-Rata - Plan Bulanan | Deviasi % = (Deviasi Qty / Plan Bulanan) × 100%',
      penjelasan: 'Menghitung selisih deviasi kuantitas dan persentase penyerapan aktual terhadap rencana target.'
    },
    {
      nama: 'Tingkat Kepatuhan Jadwal Perawatan',
      komponen: 'Maintenance Order Integration',
      rumus: '(Jumlah Perawatan Selesai / Total Target Rencana) × 100%',
      penjelasan: 'Mengukur efektivitas dan kepatuhan pelaksanaan jadwal perawatan armada kereta terhadap rencana.'
    }
  ];

  const glossaryTerms = useMemo<GlossaryTerm[]>(() => {
    if (dbTerms && dbTerms.length > 0) return dbTerms;
    return defaultGlossaryTerms;
  }, [dbTerms, safeCfg]);

  const formulas = useMemo<FormulaItem[]>(() => {
    if (dbFormulas && dbFormulas.length > 0) return dbFormulas;
    return defaultFormulas;
  }, [dbFormulas, safeCfg]);

  const categories = ['ALL', 'Istilah Bisnis', 'Pengadaan', 'Logistik & Perawatan', 'Status & Indikator'];

  const filteredTerms = glossaryTerms.filter(item => {
    const matchCat = selectedCategory === 'ALL' || item.kategori === selectedCategory;
    const matchSearch = !searchQuery || 
      item.istilah.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.definisi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.konteks.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const filteredFormulas = formulas.filter(item => {
    return !searchQuery ||
      item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.komponen.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rumus.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.penjelasan.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <PageWrapper>
      <div className="space-y-6">
        
        {/* Header Banner */}
        <div 
          className="tactile-card rounded-xl p-5 border relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
        >
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Kamus Istilah, Rumus Perhitungan &amp; Panduan</span>
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              Pusat referensi lengkap untuk memahami seluruh istilah bisnis, formula matematik grafik, serta panduan operasional Command Center.
            </p>

            {/* Dynamic Parameter Badge */}
            <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[11px] font-bold w-fit" style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#3b82f6' }}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Parameter Admin Aktif: Slow Moving {cfg.limitSlowMoving}h | At-Risk {cfg.limitAtRisk}h | Dead Stock {cfg.limitDeadStock}h | Holding Cost {cfg.holdingCostPct}%/th</span>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari istilah, rumus, atau kata kunci..."
              className="w-full px-3.5 py-2 pl-9 rounded-lg border text-xs font-medium focus:outline-none transition-all"
              style={{
                backgroundColor: 'var(--color-surface-container-high)',
                borderColor: 'var(--color-steel-border)',
                color: 'var(--color-on-surface)'
              }}
            />
            <svg 
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              viewBox="0 0 24 24"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b gap-2" style={{ borderColor: 'var(--color-steel-border)' }}>
          <button
            onClick={() => setActiveTab('istilah')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'istilah'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
            style={{ color: activeTab === 'istilah' ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)' }}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Glosarium Istilah ({filteredTerms.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('rumus')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'rumus'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
            style={{ color: activeTab === 'rumus' ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)' }}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Rumus &amp; Perhitungan ({filteredFormulas.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('panduan')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'panduan'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
            style={{ color: activeTab === 'panduan' ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)' }}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h-0a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Panduan Penggunaan App
            </span>
          </button>
        </div>

        {/* ── TAB 1: GLOSARIUM ISTILAH ── */}
        {activeTab === 'istilah' && (
          <div className="space-y-4">
            {/* Filter Category Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold mr-1" style={{ color: 'var(--color-on-surface-variant)' }}>Kategori:</span>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                      : 'hover:opacity-80'
                  }`}
                  style={selectedCategory !== cat ? {
                    backgroundColor: 'var(--color-surface-container)',
                    borderColor: 'var(--color-steel-border)',
                    color: 'var(--color-on-surface-variant)'
                  } : undefined}
                >
                  {cat === 'ALL' ? 'Semua Kategori' : cat}
                </button>
              ))}
            </div>

            {/* Table Glosarium */}
            <div className="tactile-card rounded-xl overflow-hidden">
              <TableScrollWrapper maxHeight="600px">
                <table className="w-full text-left border-collapse min-w-[850px] data-table">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                      <th className="md:sticky left-0 z-20 px-4 py-3 text-[11px] font-black uppercase tracking-wider min-w-[140px]" style={{ color: 'var(--color-on-primary-container)', backgroundColor: 'var(--color-primary-container)' }}>
                        Kategori
                      </th>
                      <th className="md:sticky left-[140px] z-20 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.3)] px-4 py-3 text-[11px] font-black uppercase tracking-wider min-w-[180px]" style={{ color: 'var(--color-on-primary-container)', backgroundColor: 'var(--color-primary-container)' }}>
                        Istilah / Kata Khusus
                      </th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>
                        Penjelasan &amp; Definisi Bisnis
                      </th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider min-w-[180px]" style={{ color: 'var(--color-on-primary-container)' }}>
                        Konteks Penggunaan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTerms.map((row, i) => {
                      const rowBg = i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)';
                      return (
                        <tr key={row.istilah} style={{ backgroundColor: rowBg }}>
                          <td className="md:sticky left-0 z-10 px-4 py-3 text-xs font-bold" style={{ backgroundColor: rowBg, color: 'var(--color-on-surface)' }}>
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border" style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>
                              {row.kategori}
                            </span>
                          </td>
                          <td className="md:sticky left-[140px] z-10 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.3)] px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ backgroundColor: rowBg, color: 'var(--color-on-surface)' }}>
                            {row.istilah}
                          </td>
                          <td className="px-4 py-3 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {row.definisi}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-secondary)' }}>
                            {row.konteks}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTerms.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-xs opacity-60">
                          Tidak ditemukan istilah yang sesuai dengan kata kunci pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TableScrollWrapper>
            </div>
          </div>
        )}

        {/* ── TAB 2: RUMUS PERHITUNGAN ── */}
        {activeTab === 'rumus' && (
          <div className="tactile-card rounded-xl overflow-hidden">
            <TableScrollWrapper maxHeight="600px">
              <table className="w-full text-left border-collapse min-w-[900px] data-table">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                    <th className="md:sticky left-0 z-20 px-4 py-3 text-[11px] font-black uppercase tracking-wider min-w-[200px]" style={{ color: 'var(--color-on-primary-container)', backgroundColor: 'var(--color-primary-container)' }}>
                      Nama Perhitungan
                    </th>
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider min-w-[180px]" style={{ color: 'var(--color-on-primary-container)' }}>
                      Komponen / Halaman
                    </th>
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider min-w-[260px]" style={{ color: 'var(--color-on-primary-container)' }}>
                      Formula / Rumus Matematika
                    </th>
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>
                      Fungsi &amp; Penjelasan Hasil
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFormulas.map((f, i) => {
                    const rowBg = i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)';
                    return (
                      <tr key={f.nama} style={{ backgroundColor: rowBg }}>
                        <td className="md:sticky left-0 z-10 px-4 py-3.5 text-xs font-bold" style={{ backgroundColor: rowBg, color: 'var(--color-on-surface)' }}>
                          {f.nama}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-semibold" style={{ color: 'var(--color-secondary)' }}>
                          {f.komponen}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-mono font-bold" style={{ color: '#3b82f6' }}>
                          <span className="px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 inline-block">
                            {f.rumus}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {f.penjelasan}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredFormulas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs opacity-60">
                        Tidak ada rumus yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScrollWrapper>
          </div>
        )}

        {/* ── TAB 3: PANDUAN PENGGUNAAN APP ── */}
        {activeTab === 'panduan' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Card 1: Safety Stock Alert */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-extrabold text-xs flex items-center justify-center">1</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Safety Stock Alert
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Menganalisis risiko ketersediaan stok fisik material terhadap rencana penyerapan perawatan hingga tahun 2030.</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>KPI Header:</b> Memantau total item Kritis, Waspada, % Ketersediaan Stok, dan Total Nilai Aset gudang.</li>
                  <li>• <b>Toggle Konsumsi vs Saldo Stok:</b> Mode Konsumsi menampilkan volume pemakaian bulanan, Mode Saldo Stok mensimulasikan sisa fisik persediaan ke depan.</li>
                  <li>• <b>Toggle Standar vs Riwayat:</b> Mode Standar menggunakan target rencana murni, Mode Riwayat mengalikan target dengan <i>Run Rate Multiplier</i> (laju keborosan riil).</li>
                  <li>• <b>Toggle Dengan PO:</b> Memasukkan akumulasi pasokan PO pengadaan ke grafik pada estimasi bulan kedatangan barang.</li>
                  <li>• <b>Tabel Skenario &amp; PO:</b> Menampilkan sisa bulan habis stok, status risiko (Kritis / Waspada / Aman), gap kedatangan PO, serta tombol simulasi order PO.</li>
                  <li>• <b>Detail Material:</b> Klik baris material untuk melihat riwayat transaksi (GI/GR), konsumsi per trainset kereta, dan rencana penyerapan s.d 2030.</li>
                </ul>
              </div>
            </div>

            {/* Card 2: Anomaly Stock */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-extrabold text-xs flex items-center justify-center">2</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Anomaly Stock
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Mendeteksi ketidaksesuaian pola konsumsi aktual material terhadap target rencana penyerapan.</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>Filter Periode:</b> Pemilihan rentang bulan dan tahun evaluasi pergerakan konsumsi material.</li>
                  <li>• <b>Toleransi Deviasi:</b> Konfigurasi batas ambang deviasi (+/- %) untuk mengklasifikasikan status Normal vs Anomali.</li>
                  <li>• <b>Grafik Deviasi:</b> Visualisasi garis (Line) dan batang (Bar) perbandingan target rencana versus realisasi aktual.</li>
                  <li>• <b>Riwayat Transaksi Bulanan:</b> Pop-up rincian transaksi pemakaian dan verifikasi kesesuaian terhadap jadwal perawatan dan Work Order.</li>
                </ul>
              </div>
            </div>

            {/* Card 3: Slow-Moving & Dead Stock */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-extrabold text-xs flex items-center justify-center">3</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Slow-Moving &amp; Dead Stock
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Memantau pergerakan pengendapan barang di gudang dan mengestimasi biaya penyimpanan finansial.</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>Kategori Usia:</b> Membagi persediaan ke dalam <i>Fresh Stock</i> (≤{safeCfg.limitSlowMoving}h), <i>Slow-Moving</i> ({safeCfg.limitSlowMoving+1}-{safeCfg.limitAtRisk}h), <i>At-Risk</i> ({safeCfg.limitAtRisk+1}-{safeCfg.limitDeadStock}h), dan <i>Dead Stock</i> (&gt;{safeCfg.limitDeadStock}h).</li>
                  <li>• <b>Heatmap Gudang:</b> Matriks warna untuk mengidentifikasi gudang atau dipo dengan penumpukan barang mengendap.</li>
                  <li>• <b>Kalkulasi Holding Cost:</b> Memperkirakan kerugian biaya pengendapan dari nilai aset dikali persentase biaya simpan ({safeCfg.holdingCostPct}%/tahun).</li>
                  <li>• <b>Rekomendasi Pemindahan:</b> Saran relokasi stok mati antar gudang sebelum menerbitkan pesanan PO baru.</li>
                </ul>
              </div>
            </div>

            {/* Card 4: Stock In Transit & On PO */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold text-xs flex items-center justify-center">4</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Stock In Transit &amp; On PO
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Melacak tahapan siklus pengadaan material dari nota dinas usulan hingga barang diterima di gudang.</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>Pipeline Progres:</b> Memantau tahapan Nota Dinas (NOD), Spektek, Verifikasi CTPE/CTPP, Permintaan Pembelian (PR), dan Kontrak PO.</li>
                  <li>• <b>Filter &amp; Tingkat Risiko:</b> Penyaringan data pengadaan berdasarkan status pemrosesan dan klasifikasi risiko waktu pengiriman.</li>
                  <li>• <b>Navigasi Tabel:</b> Kolom kode dan uraian material terkunci (sticky) dengan kontrol tombol panah geser.</li>
                  <li>• <b>Integrasi Pengiriman:</b> Tanggal kedatangan PO yang disetujui terhubung otomatis ke grafik proyeksi Safety Stock Alert.</li>
                </ul>
              </div>
            </div>

            {/* Card 5: Maintenance Order Integration */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-extrabold text-xs flex items-center justify-center">5</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Maintenance Order Integration
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Menyinkronkan jadwal pemeliharaan armada kereta dengan reservasi dan pemenuhan suku cadang (Work Order).</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>Jadwal Perawatan:</b> Kalender pelaksanaan perawatan berkala P1, P3, P6, P12, P24, hingga P48 (Overhaul).</li>
                  <li>• <b>Status Pelaksanaan:</b> Pemantauan status pengerjaan (Rencana, Proses Perawatan, Sedang Dirawat, Selesai).</li>
                  <li>• <b>Pemenuhan Work Order:</b> Pelacakan status pemenuhan material reservasi (Outstanding vs Fulfilled).</li>
                  <li>• <b>BOM Standar:</b> Alokasi standar suku cadang sesuai seri kereta dan jenis propulsi.</li>
                </ul>
              </div>
            </div>

            {/* Card 6: Komposisi Rangkaian */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-extrabold text-xs flex items-center justify-center">6</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Komposisi Rangkaian
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Menampilkan struktur hierarki peralatan armada kereta dan penempatan komponen per trainset.</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>Filter Armada:</b> Penyaringan berdasarkan nomor rangkaian, seri kereta, jenis propulsi, dan dipo penugasan.</li>
                  <li>• <b>Struktur Hierarki:</b> Penelusuran pohon aset dari level trainset, car (gerbong), bogie, hingga komponen peralatan.</li>
                  <li>• <b>Formasi Kereta:</b> Visualisasi susunan car (SF) dan konfigurasi teknis unit kereta yang beroperasi.</li>
                </ul>
              </div>
            </div>

            {/* Card 7: Panel Admin */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-extrabold text-xs flex items-center justify-center">7</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Panel Admin
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Pengaturan konfigurasi parameter persediaan, master data, jadwal perawatan, dan kamus istilah terpusat.</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>Parameter Material:</b> Mengatur Stok Ideal, Safety Stock, Lead Time, serta target Rencana Penyerapan Bulanan s.d 2030.</li>
                  <li>• <b>Ambang Batas Global:</b> Memperbarui batas Slow-Moving, At-Risk, Dead Stock, dan tarif Holding Cost per tahun.</li>
                  <li>• <b>Kelola Glosarium &amp; Rumus:</b> Mengedit, menambah, dan menghapus definisi istilah bisnis serta formula kalkulasi.</li>
                </ul>
              </div>
            </div>

            {/* Card 8: Log Audit */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 font-extrabold text-xs flex items-center justify-center">8</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Log Audit
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Merekam seluruh jejak aktivitas perubahan parameter dan konfigurasi sistem untuk transparansi tata kelola.</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>Riwayat Perubahan:</b> Mencatat nilai parameter lama (Original Value) dan nilai baru (New Value).</li>
                  <li>• <b>Informasi Administrator:</b> Identitas nama admin, email, tanggal/waktu perubahan, dan nama modul terkait.</li>
                  <li>• <b>Pencarian &amp; Filter:</b> Pencarian cepat log riwayat berdasarkan admin, kode material, atau nama parameter.</li>
                </ul>
              </div>
            </div>

            {/* Card 9: Glosarium & Panduan */}
            <div 
              className="tactile-card rounded-xl p-5 border space-y-3 md:col-span-2"
              style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}
            >
              <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: 'var(--color-steel-border)' }}>
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-extrabold text-xs flex items-center justify-center">9</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  Glosarium &amp; Panduan
                </h3>
              </div>
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p><b>Fungsi Utama:</b> Pusat referensi istilah bisnis perkeretaapian &amp; logistik, formula perhitungan matematika grafik, dan dokumentasi operasional pengguna.</p>
                <ul className="space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <li>• <b>Glosarium Istilah:</b> Pencarian dan filter kategori istilah bisnis, status pengadaan, dan logistik perkeretaapian.</li>
                  <li>• <b>Rumus &amp; Perhitungan:</b> Rincian formula matematika kalkulasi grafik dengan nilai parameter aktif real-time.</li>
                  <li>• <b>Panduan Modul:</b> Dokumentasi petunjuk operasional lengkap untuk seluruh modul halaman aplikasi.</li>
                </ul>
              </div>
            </div>

          </div>
        )}

      </div>
    </PageWrapper>
  );
}
