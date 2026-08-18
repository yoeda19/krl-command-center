export interface GlossaryTerm {
  kategori: 'Istilah Bisnis' | 'Pengadaan' | 'Logistik & Perawatan' | 'Status & Indikator';
  istilah: string;
  definisi: string;
  konteks: string;
}

export const DEFAULT_GLOSSARY_TERMS: GlossaryTerm[] = [
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
    definisi: 'Estimasi biaya finansial yang timbul akibat penyimpanan atau pengendapan aset material di gudang (dikonfigurasi di Panel Admin, dapat disesuaikan).',
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
    definisi: 'Material baru yang baru saja masuk gudang atau memiliki usia pengendapan rendah.',
    konteks: 'Slow-Moving & Dead Stock'
  },
  {
    kategori: 'Status & Indikator',
    istilah: 'Slow Moving',
    definisi: 'Material yang mengendap di gudang tanpa pergerakan transaksi sesuai ambang batas Slow-Moving.',
    konteks: 'Slow-Moving & Dead Stock'
  },
  {
    kategori: 'Status & Indikator',
    istilah: 'At-Risk',
    definisi: 'Material yang mengendap di gudang tanpa pergerakan sesuai ambang batas At-Risk.',
    konteks: 'Slow-Moving & Dead Stock'
  },
  {
    kategori: 'Status & Indikator',
    istilah: 'Dead Stock',
    definisi: 'Material mati / tidak bergerak sama sekali melampaui ambang batas Dead Stock.',
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
