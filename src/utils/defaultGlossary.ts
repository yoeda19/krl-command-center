export interface GlossaryTerm {
  kategori: 'Istilah Bisnis' | 'Pengadaan' | 'Logistik & Perawatan' | 'Status & Indikator';
  istilah: string;
  definisi: string;
  konteks: string;
}

export const DEFAULT_GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    kategori: 'Istilah Bisnis',
    istilah: 'Anomali Stok (Instability)',
    definisi: 'Kondisi ketidaksesuaian pola konsumsi material terhadap jadwal perawatan (over-absorption / under-absorption) akibat lonjakan pemakaian insidentil atau keterlambatan pelaksanaan perawatan.',
    konteks: 'Grafik & Tabel Anomali Stok'
  },
  {
    kategori: 'Istilah Bisnis',
    istilah: 'Over-absorption',
    definisi: 'Kondisi lonjakan penyerapan material yang melebihi batas standar BOM (Bill of Materials) akibat kerusakan insidentil komponen.',
    konteks: 'Analisis Keborosan Material'
  },
  {
    kategori: 'Istilah Bisnis',
    istilah: 'Under-absorption',
    definisi: 'Kondisi penyerapan material yang lebih rendah dari target rencana karena perawatan terlambat atau belum terealisasi.',
    konteks: 'Analisis Akumulasi Stok'
  },
  {
    kategori: 'Logistik & Perawatan',
    istilah: 'Refilled (Pengisian Stok)',
    definisi: 'Transaksi penerimaan kembali atau penambahan kuantitas pasokan fisik material ke gudang/dipo.',
    konteks: 'Riwayat Transaksi Stok'
  },
  {
    kategori: 'Logistik & Perawatan',
    istilah: 'Availability Stok',
    definisi: 'Persentase tingkat ketersediaan fisik stok material di gudang dibandingkan dengan batas stok ideal yang ditetapkan.',
    konteks: 'Halaman Utama & Monitoring Stok'
  },
  {
    kategori: 'Logistik & Perawatan',
    istilah: 'Holding Cost (Biaya Pengendapan)',
    definisi: 'Estimasi biaya finansial yang timbul akibat penyimpanan atau pengendapan aset material di gudang (dikonfigurasi di Panel Admin, dapat disesuaikan).',
    konteks: 'Analisa Usia Stok (Slow Moving)'
  },
  {
    kategori: 'Logistik & Perawatan',
    istilah: 'Safety Stock (Stok Pengaman)',
    definisi: 'Batas minimum persediaan stok fisik yang wajib ada di gudang untuk mencegah kekosongan stok (stock-out) saat terjadi lonjakan mendadak.',
    konteks: 'Parameter Stok & Proyeksi'
  },
  {
    kategori: 'Logistik & Perawatan',
    istilah: 'ROP (Re-Order Point / Batas Order)',
    definisi: 'Titik ambang minimum saldo stok di mana proses pemesanan pengadaan baru (PR/PO) harus segera diterbitkan berdasarkan durasi waktu tenggang (Lead Time).',
    konteks: 'Tabel Availability & Peringatan Order'
  },
  {
    kategori: 'Logistik & Perawatan',
    istilah: 'Stok Ideal',
    definisi: 'Target jumlah persediaan stok fisik maksimum yang paling efisien untuk disimpan di gudang tanpa memicu biaya pembengkakan pengendapan.',
    konteks: 'Parameter Utama Material'
  },
  {
    kategori: 'Status & Indikator',
    istilah: 'Fast Moving',
    definisi: 'Kategori material dengan laju pemakaian/penyerapan sangat tinggi yang berpotensi kehabisan stok dalam waktu dekat jika tidak diisi kembali.',
    konteks: 'Indikator Risiko Material'
  },
  {
    kategori: 'Status & Indikator',
    istilah: 'Fresh Stock',
    definisi: 'Material baru yang baru saja masuk gudang atau memiliki usia pengendapan rendah.',
    konteks: 'Kategori Usia Pengendapan'
  },
  {
    kategori: 'Status & Indikator',
    istilah: 'Slow Moving',
    definisi: 'Material yang mengendap di gudang tanpa pergerakan transaksi sesuai ambang batas Slow-Moving.',
    konteks: 'Kategori Usia Pengendapan'
  },
  {
    kategori: 'Status & Indikator',
    istilah: 'At-Risk',
    definisi: 'Material yang mengendap di gudang tanpa pergerakan sesuai ambang batas At-Risk.',
    konteks: 'Kategori Usia Pengendapan'
  },
  {
    kategori: 'Status & Indikator',
    istilah: 'Dead Stock',
    definisi: 'Material mati / tidak bergerak sama sekali melampaui ambang batas Dead-Stock.',
    konteks: 'Kategori Usia Pengendapan'
  },
  {
    kategori: 'Pengadaan',
    istilah: 'NOD (Nota Dinas)',
    definisi: 'Dokumen usulan kebutuhan awal pengadaan barang/jasa yang diterbitkan oleh unit kerja peminta.',
    konteks: 'Progres PO & Tahapan Pengadaan'
  },
  {
    kategori: 'Pengadaan',
    istilah: 'Spektek',
    definisi: 'Dokumen spesifikasi teknis rincian barang yang disusun untuk keperluan pengadaan.',
    konteks: 'Tahap Penyusunan Pengadaan'
  },
  {
    kategori: 'Pengadaan',
    istilah: 'CTPE & CTPP',
    definisi: 'Tim evaluasi teknis dan panitia pengadaan yang bertugas meninjau serta menyetujui dokumen teknis dan penawaran.',
    konteks: 'Progres Verifikasi Pengadaan'
  },
  {
    kategori: 'Pengadaan',
    istilah: 'PR (Permintaan Pembelian)',
    definisi: 'Dokumen permintaan pembelian resmi yang telah disetujui dalam Sistem pengadaan.',
    konteks: 'Tahap Pembelian / Purchase Requisition'
  },
  {
    kategori: 'Pengadaan',
    istilah: 'PO (Pesanan Pembelian)',
    definisi: 'Dokumen kontrak pesanan resmi yang diterbitkan kepada pihak penyedia/vendor.',
    konteks: 'Tahap Pesanan / Purchase Order'
  },
  {
    kategori: 'Logistik & Perawatan',
    istilah: 'GI (Goods Issue)',
    definisi: 'Transaksi pengeluaran atau pemakaian barang dari gudang untuk keperluan perawatan KRL.',
    konteks: 'Riwayat Pemakaian Transaksi'
  },
  {
    kategori: 'Logistik & Perawatan',
    istilah: 'GR (Goods Receipt)',
    definisi: 'Transaksi penerimaan fisik barang di gudang dari penyedia setelah proses verifikasi kualitas.',
    konteks: 'Riwayat Penerimaan Pengadaan'
  },
  {
    kategori: 'Istilah Bisnis',
    istilah: 'Run Rate Multiplier',
    definisi: 'Faktor rasio perbandingan antara konsumsi pemakaian aktual historis (3/6/12 bulan) terhadap rencana target awal.',
    konteks: 'Kalkulasi Proyeksi Riwayat'
  }
];
