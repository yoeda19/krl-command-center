# 📊 Laporan Audit Mendalam Sistem Command Center Pengadaan & Pemeliharaan Material Sparepart KRL

**Peran:** Senior Procurement & IT Dashboard Development Expert  
**Tanggal Audit:** 29 Juli 2026  
**Status Sistem:** Audit Selesai & Rekomendasi Siap Diterapkan  

---

## 1. 📌 Ringkasan Eksekutif

Sistem **KRL Command Center** dirancang untuk menghubungkan **Jadwal Pemeliharaan Sarana (Work Order)** dengan **Kebutuhan Material (BOM)** dan **Progres Pengadaan (Purchase Order)**.

Berdasarkan audit teknis dan analisis proses bisnis pengadaan (*procurement workflow*), sistem ini memiliki fondasi yang kuat, namun ditemukan beberapa **gap alur data (data flow mismatches)**, **bug kalkulasi proyeksi stok**, serta **hambatan operasional tim procurement** yang perlu diselaraskan agar perencanaan material suku cadang berjalan presisi dan efisien.

---

## 2. 🛡️ Audit Kepatuhan Aturan AGENTS.md & Antarmuka UI/UX

### A. Teks & Istilah Teknis (Business Terminology Compliance)
* ⚠️ **Temuan:** Beberapa nama kolom, tooltip, dan field modal di UI masih menggunakan istilah teknis backend (`vendor_sap`, `approval_sap_status`, `MB52`).
* 💡 **Rekomendasi Penyesuaian:**
  * *"Vendor SAP"* ➡️ **"Vendor Terdaftar"** / **"Penyedia Barang"**
  * *"Approval SAP Status"* ➡️ **"Status Persetujuan Direksi/Manajemen"**
  * *"PR SAP"* ➡️ **"Permintaan Pembelian (PR)"**
  * *"Data MB52"* ➡️ **"Master Saldo Stok Gudang"**

### B. Kontras Warna & Aksesibilitas (Light & Dark Theme)
* ⚠️ **Temuan:** Di mode terang (*Light Mode*), beberapa teks header tabel dan sub-label KPI menggunakan warna abu-abu muda (`text-slate-400` / `text-gray-400`) yang mengurangi tingkat keterbacaan (*readability*) pada layar monitor operasional.
* 💡 **Rekomendasi Penyesuaian:** Standardisasi warna teks mode terang menggunakan hitam pekat (`#0f172a` / `#1e293b`) dan mode gelap menggunakan putih/abu terang (`#f8fafc` / `#e2e8f0`).

### C. Penggunaan Ikon & Kapitalisasi Teks
* ✅ **Ikon:** 100% menggunakan SVG (vektor bersih tanpa gambar PNG/JPG).
* ⚠️ **Kapitalisasi:** Masih terdapat beberapa teks tombol dan header yang menggunakan huruf kapital semua (*UPPERCASE*). Perlu disesuaikan menjadi *Title Case* / *Sentence Case*.

---

## 3. 🔍 Audit Halaman per Halaman & Flow Data

### 1. Halaman Availability Stok (`/critical-stock`)
* **Fungsi Utama:** Proyeksi ketahanan stok material berdasarkan konsumsi pemeliharaan (BOM) vs rencana kedatangan barang (PO).
* 🐛 **Bug Logic Kalkulasi (`initialStock`):**
  * Pada fungsi `calculateDynamicMetrics`, `initialStock` dihitung dengan formula `current_stock + sumActuals`. Karena `current_stock` adalah stok riil saat ini, menambahkan *historical actual issue* sebelum hari ini ke stok saat ini saat pengguna memilih rentang waktu masa lalu menyebabkan proyeksi saldo stok terhitung **ganda (overestimated)** jika ada transaksi penerimaan barang di rentang tersebut.
* ⚠️ **Flow Data Mismatch (Single PO Assumption):**
  * Pengambilan data pengadaan aktif hanya mengambil **1 PO pertama** (`.find()`) yang berstatus *non-GR*. Jika sebuah suku cadang memiliki beberapa PO parsial (misal: 100 unit datang Agustus, 200 unit datang Oktober), proyeksi kedatangan barang hanya memperhitungkan PO pertama, sehingga material tampak "kritis" padahal PO tahap berikutnya sudah berjalan.
* 🎯 **Kemudahan Tim Procurement:**
  * **Belum ada tombol langsung "Buat Draft Usulan PR"** dari baris material yang berstatus *Kritis/Waspada*. Tim procurement harus berpindah secara manual ke Panel Admin atau dokumen spreadsheet terpisah.

---

### 2. Halaman Anomali Stok (`/anomaly-stock`)
* **Fungsi Utama:** Mendeteksi ketidaksesuaian (*deviasi*) antara rencana pemeliharaan resmi KRL dengan pengeluaran fisik barang di depo.
* 🐛 **Bug Pembagian Nol (Zero Demand Division):**
  * Logika rasio anomali membagi *Total Stok Gudang* dengan *Rata-rata Konsumsi Bulanan*. Untuk material cadangan darurat (*insurance item / capital spare*) yang konsumsinya 0 dalam 12 bulan terakhir, kalkulasi berpotensi menghasilkan `Infinity` atau terlewat dari deteksi *holding cost*.
* 🎯 **Kemudahan Tim Procurement:**
  * Halaman ini belum terhubung langsung dengan status **Usia Stok (Slow Moving)**. Material anomali bernilai tinggi seharusnya memberikan opsi tindakan bisnis langsung: *Reroute ke Depo lain* atau *Penyesuaian Buffer Stock*.

---

### 3. Halaman Analisa Usia Stok & Slow Moving (`/slow-moving`)
* **Fungsi Utama:** Mengidentifikasi akumulasi modal mati (*dead stock*) dan estimasi biaya penyimpanan (*holding cost*).
* ⚠️ **Flow Data Mismatch:**
  * Kategori umur stok (30 hari, 90 hari, >180 hari) dihitung dari tanggal transaksi terakhir. Namun, jika ada transaksi pengeluaran kecil (misal 1 unit dari 1.000 unit), item tersebut mendadak dianggap "fast moving" padahal 999 unit sisanya sudah mengendap lebih dari 2 tahun.
* 🎯 **Kemudahan Tim Procurement:**
  * Perlu penambahan fitur *Dead Stock Redemption*: Rekomendasi pemanfaatan/substitusi material untuk jadwal pemeliharaan KRL jenis lain yang memiliki spesifikasi kompatibel.

---

### 4. Halaman Progres PO & Transit (`/progress-po`)
* **Fungsi Utama:** Melacak milestone pengadaan barang (PR ➔ Approval ➔ Tender ➔ PO ➔ Produksi ➔ Shipment ➔ GR).
* 🐛 **Bug Visualisasi Timeline Milestone:**
  * Rentang hari keterlambatan (*Lead Time Gap*) dihitung berdasarkan `tanggal_rencana_pengiriman` vs hari ini. Namun untuk PO yang sudah berstatus *Goods Receipt (GR)*, kalkulasi gap keterlambatan kadang tetap menghitung akumulasi hari hingga hari ini (membuat status PO seolah-olah terlambat padahal sudah selesai diterima).
* 🎯 **Kemudahan Tim Procurement:**
  * **Indikator Kinerja Vendor (OTP - On Time Performance):** Tim pengadaan membutuhkan matriks performa ketepatan waktu vendor langsung pada tabel PO untuk mempermudah evaluasi penyedia barang saat pembukaan tender baru.

---

### 5. Halaman Perawatan KRL & Work Order (`/work-order`)
* **Fungsi Utama:** Menjadwalkan pemeliharaan berkas sarana KRL (P1, P3, P6, P12, P24, P48, Overhaul) dan menghitung estimasi kebutuhan suku cadang.
* 🐛 **Bug String Matching Seri Kereta & Propulsi:**
  * Pencocokan jadwal pemeliharaan dengan Aturan BOM (`maintenance_bom_config`) sangat sensitif terhadap spasi dan format huruf (misal: `"KRL JR205"` vs `"KRL JR 205"`). Kesalahan variasi penulisan nama trainset menyebabkan kalkulasi BOM bernilai `0` tanpa adanya notifikasi peringatan.
* 🎯 **Kemudahan Tim Procurement:**
  * **Simulasi Beban Perawatan (What-If Simulation):** Jika jadwal Overhaul diajukan atau dimajukan 1 bulan, tim procurement memerlukan gambaran instan apakah stok di gudang siap mendukung perubahan jadwal tersebut.

---

### 6. Halaman Formasi Rangkaian Kereta (`/composition`)
* **Fungsi Utama:** Menampilkan pemetaan car/kereta (Motor Car, Trailer Car) per seri KRL dan lokasi Depo.
* ⚠️ **Flow Data Mismatch:**
  * Data formasi kereta belum terhubung secara dinamis dengan pencatatan pemakaian komponen spesifik per car (misal: *Bogie*, *Pantograph*, *Inverter*). Tim procurement kesulitan mengetahui komponen spesifik mana di rangkaian tertentu yang sudah mendekati batas usia pakai (*Lifespan Limit*).

---

### 7. Halaman Panel Admin (`/admin-panel`)
* **Fungsi Utama:** Manajemen Master Material, Aturan BOM, Parameter Lead Time, dan Input Manual PO/WO.
* 🐛 **Bug Cache Invalidation saat Edit BOM:**
  * Saat Admin memperbarui jumlah kebutuhan BOM pada suatu tipe pemeliharaan, data di halaman *Availability Stok* dan *Work Order* tidak langsung ter-update karena sistem menyimpan cache IndexedDB (`skcd_recent_history_cache_v13`) tanpa melakukan pembersihan cache otomatis saat mutasi data BOM.

---

### 8. Glosarium & Log Audit (`/glossary` & `/audit-log`)
* 🎯 **Kemudahan Tim Procurement:**
  * Glosarium sudah memuat definisi rumus dasar, namun perlu menambahkan standar operasional prosedur (SOP) batas waktu tindakan pengadaan berdasarkan tingkat kekritisan (misal: *Status Kritis ➔ Wajib Terbit PR maksimal 3x24 Jam*).

---

## 4. 💡 Matriks Rekomendasi Solusi & Prioritas Perbaikan

| No | Komponen / Halaman | Isu Utama | Solusi Penyelarasan Tim Procurement | Prioritas |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Availability Stok** | Proyeksi PO hanya memperhitungkan 1 PO pertama & `initialStock` terhitung ganda. | Akumulasikan seluruh PO aktif (*multi-PO support*) & perbaiki formula saldo stok awal. | 🔴 **Tinggi** |
| **2** | **Work Order & BOM** | Matching string Seri Kereta rentan gagal secara *silent*. | Tambahkan normalisasi string (*uppercase & trim*) serta notifikasi jika BOM tidak terdaftar. | 🔴 **Tinggi** |
| **3** | **Progress PO** | Keterlambatan PO tidak memberikan notifikasi bahaya otomatis ke Stok Kritis. | Hubungkan delay PO di Progres PO langsung sebagai *Risk Factor* di Availability Stok. | 🟡 **Sedang** |
| **4** | **Admin Panel & Cache** | Pembaruan BOM/PO tidak membersihkan cache IndexedDB. | Invalidate cache secara otomatis (`clearCache()`) setiap kali ada perubahan master/BOM. | 🟡 **Sedang** |
| **5** | **UX Tim Procurement** | Belum ada tombol aksi cepat dari Kritis ke PR. | Tambahkan tombol **"Export Rekomendasi PR"** / **"Salin Daftar Reorder"** di Stok Kritis. | 🟢 **Fitur UX** |

---

## 5. 🚀 Rencana Aksi Pembenahan (Action Plan)

1. **Tahap 1 (Immediate Fix):** Refactoring kalkulasi `initialStock` dan pemrosesan multi-PO pada `CriticalStockPage.tsx`.
2. **Tahap 2 (BOM & Work Order Matching):** Implementasi penanganan string matching fleksibel untuk Seri Kereta & Propulsi di `WorkOrderPage.tsx` dan `supabaseService.ts`.
3. **Tahap 3 (Workflow Integration):** Penambahan fitur *Export Rekomendasi PR* dan integrasi indikator delay PO ke peringatan Stok Kritis.
4. **Tahap 4 (UI Polish):** Pembersihan istilah teknis tersisa dan penguatan kontras warna *Light Theme*.
