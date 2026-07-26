# 📘 PANDUAN LENGKAP PENGGUNAAN APLIKASI COMMAND CENTER

Panduan operasional resmi untuk pengoperasian sistem monitoring persediaan material, analisis usia stok, manajemen pengadaan, dan sinkronisasi perawatan armada KRL.

---

## 1. 📊 HALAMAN MONITORING STOK KRITIS (CRITICAL STOCK)

### A. Tujuan & Fungsi Utama
Menganalisis risiko ketersediaan stok fisik gudang terhadap target rencana penyerapan perawatan hingga tahun 2030, serta mendeteksi secara dini potensi kekosongan stok (*stock-out*).

### B. Panduan Penggunaan Konten & Elemen UI:
1. **KPI Card Summary (Header):**
   - **Stok Kritis:** Jumlah material yang sisa stok fisiknya akan habis dalam batas kritis (misal $\le 2.0$ bulan).
   - **Stok Waspada:** Jumlah material dengan estimasi sisa stok pada batas waspada (misal $\le 3.0$ bulan).
   - **% Availability Stok:** Persentase ketersediaan persediaan fisik dibanding Stok Ideal.
   - **Total Aset:** Total nilai rupiah persediaan fisik yang tersimpan di gudang.

2. **Filter Periode Waktu & Pencarian:**
   - Gunakan dropdown tahun awal dan akhir (misal `2026 s.d 2030`) untuk menyesuaikan rentang waktu simulasi grafik.
   - Gunakan kolom pencarian nomor material/deskripsi untuk memfilter baris tabel.

3. **Toggle Mode Grafik Proyeksi:**
   - **KONSUMSI vs SALDO STOK:**
     - *Mode Konsumsi:* Menampilkan grafik volume pemakaian bulanan.
     - *Mode Saldo Stok:* Mensimulasikan sisa fisik persediaan kumulatif ke depan.
   - **STANDAR vs RIWAYAT:**
     - *Mode Standar:* Berdasarkan target rencana penyerapan bulanan murni.
     - *Mode Riwayat:* Mengalikan target rencana dengan *Run Rate Multiplier* (keborosan pemakaian riil historis).
   - **Toggle DENGAN PO:**
     - Mengaktifkan toggle PO secara otomatis menambahkan kuantitas pasokan barang dari PO pengadaan pada bulan kedatangan yang dijadwalkan.

4. **Tabel Skenario Pengadaan & Simulasi PO:**
   - **Kolom NO & Material (Sticky Left):** Terkunci di sisi kiri agar memudahkan identifikasi saat menggeser tabel ke kanan.
   - **Bulan Habis:** Menampilkan estimasi bulan berapa stok fisik akan habis murni berdasarkan pemakaian.
   - **Status Risiko:** Lencana warna **KRITIS** (Merah), **WASPADA** (Kuning), atau **AMAN** (Hijau).
   - **Gap Ke PO:** Selisih bulan antara kedatangan barang PO dengan bulan habis stok (Nilai minus = risiko *stock-out*).
   - **Tombol Simulasi Order PO:** Membuka pop-up untuk memasukkan tanggal order baru & kuantitas pesanan.

5. **Pop-up Detail Material (Klik Baris Tabel):**
   - Menampilkan riwayat transaksi pemakaian (*Goods Issue*) & penerimaan (*Goods Receipt*).
   - Rincian konsumsi material per unit kereta KRL.
   - Rencana penyerapan bulanan yang dapat disesuaikan hingga tahun 2030.

---

## 2. ⏳ HALAMAN ANALISIS USIA STOK (STOCK AGING)

### A. Tujuan & Fungsi Utama
Melacak pergerakan pengendapan barang di gudang/dipo, mengidentifikasi stok mati (*dead stock*), dan mengestimasi biaya finansial penyimpanan (*holding cost*).

### B. Panduan Penggunaan Konten & Elemen UI:
1. **Kategori Usia Pengendapan:**
   - **Fresh Stock:** Usia pengendapan $\le 30$ hari (baru masuk / bergerak aktif).
   - **Slow Moving:** Usia pengendapan $31 - 90$ hari (pergerakan lambat).
   - **At-Risk:** Usia pengendapan $91 - 180$ hari (risiko tinggi penumpukan).
   - **Dead Stock:** Usia pengendapan $> 180$ hari (stok mati / tidak bergerak).

2. **Matrix Heatmap Usia Gudang:**
   - Visualisasi matriks warna lokasi gudang/dipo untuk mendeteksi secara cepat di dipo mana barang mengendap paling lama.

3. **Kalkulasi Biaya Pengendapan (Holding Cost):**
   - Menghitung perkiraan kerugian biaya penyimpanan dengan rumus: 
     $$\text{Holding Cost} = \text{Nilai Aset} \times \text{Rate Simpan \%} \times \left(\frac{\text{Usia Hari}}{365}\right)$$

4. **Tabel Usulan Restock & Pemindahan Stok:**
   - Memberikan rekomendasi transfer material stok mati dari gudang lain sebelum unit kerja menerbitkan usulan PO pengadaan baru.

---

## 3. 📦 HALAMAN MANAJEMEN PENGADAAN (PROGRESS PO)

### A. Tujuan & Fungsi Utama
Melacak tahapan siklus pengadaan barang dari usulan awal Nota Dinas (NOD) hingga pengiriman fisik barang (*Goods Receipt*) di gudang vendor.

### B. Panduan Penggunaan Konten & Elemen UI:
1. **Pipeline Progress Tahapan Pengadaan:**
   - **NOD (Nota Dinas):** Dokumen usulan kebutuhan pengadaan dari unit peminta.
   - **Spektek:** Penyusunan spesifikasi teknis barang.
   - **Approval CTPE / CTPP:** Verifikasi tim teknis dan panitia pengadaan.
   - **PR (Purchase Requisition):** Permintaan pembelian resmi dalam Sistem.
   - **PO (Purchase Order):** Pesanan pembelian resmi / kontrak dengan vendor.

2. **Tabel PO Sticky Column & Navigasi:**
   - Kolom `NO` (Col 1), `Nomor Material` (Col 2), dan `Nama Material` (Col 3) terkunci di sisi kiri.
   - Gunakan tombol panah `<` dan `>` pada tepi tabel untuk navigasi horizontal yang halus.

---

## 4. 🚆 HALAMAN PERAWATAN KRL (MAINTENANCE SCHEDULE)

### A. Tujuan & Fungsi Utama
Menyinkronkan jadwal perawatan berkala armada trainset KRL dengan standar kebutuhan suku cadang (*Bill of Materials*).

### B. Panduan Penggunaan Konten & Elemen UI:
1. **Jadwal Perawatan Berkala:**
   - Menampilkan kalender pelaksanaan perawatan P1 (bulanan), P3 (3-bulanan), P6 (6-bulanan), P12 (tahunan), dan Overhaul P48 (4-tahunan).

2. **Standard BOM Material:**
   - Menampilkan alokasi standar suku cadang yang wajib terpasang berdasarkan Jenis Kereta, Seri Kereta, dan Tipe Propulsi.

3. **Analisis Anomali Penyerapan:**
   - **Over-absorption:** Lonjakan pemakaian melebihi standar BOM akibat kerusakan insidentil komponen.
   - **Under-absorption:** Penyerapan di bawah target karena perawatan terlambat terealisasi.

---

## 5. ⚙️ HALAMAN PANEL ADMIN (CONFIGURATION CENTER)

### A. Tujuan & Fungsi Utama
Pusat kendali pengaturan master data, parameter persediaan, jadwal perawatan, dan kamus istilah bisnis secara terpusat.

### B. Panduan Penggunaan Konten & Elemen UI:
1. **Tab Parameter Material:**
   - Mengatur Stok Ideal, Safety Stock, Lead Time, serta target Rencana Penyerapan Bulanan s.d 2030.
2. **Tab Ambang Batas Global:**
   - Mengatur nilai ambang Slow Moving, At-Risk, Dead Stock, dan persentase *Holding Cost* (% p.a.).
3. **Tab Kelola Glosarium & Definisi:**
   - Tampilan **Data Tabel** lengkap dengan tombol `Edit` (membuka Pop-up Modal) dan `Hapus` untuk mengubah definisi bisnis secara terpusat.

---

## 6. 📖 HALAMAN GLOSARIUM & PANDUAN

### A. Tujuan & Fungsi Utama
Pusat referensi ilmiah, formula matematika grafik, dan dokumentasi operasional pengguna.

### B. Panduan Penggunaan Konten & Elemen UI:
1. **Tab Glosarium Istilah:** Pencarian istilah bisnis dan kata khusus yang terhubung langsung ke database.
2. **Tab Rumus & Perhitungan:** Formula matematika resmi yang digunakan pada setiap grafik dan kalkulasi tabel.
3. **Tab Panduan Penggunaan App:** Dokumentasi langkah-demi-langkah pengoperasian seluruh modul Command Center.
