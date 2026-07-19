# Workspace Custom Rules

## Aturan Teks UI (User Interface)
- **Larangan Teks Teknis:**
  * Dilarang keras menampilkan teks/istilah teknis seperti **"SAP"**, **"Supabase"**, **"MB52"**, atau **"MB51"** pada seluruh tampilan antarmuka (display/output UI) yang dapat dilihat oleh pengguna.
  * Gantilah istilah-istilah tersebut dengan padanan nama bisnis yang ramah pengguna (contoh: "SAP" -> "Sistem", "Master SAP" -> "Master Data", "PR SAP" -> "Permintaan Pembelian (PR)", "Supabase" -> "", dll.).

- **Desain & Kontras Warna (Light & Dark Theme):**
  * Hindari penggunaan warna teks default abu-abu, biru, merah, dll. saat teks berada pada latar terang. Utamakan menggunakan warna **hitam** untuk keterbacaan maksimal di mode terang (Light Theme), serta warna **putih** atau **abu-abu terang** di mode gelap (Dark Theme).
  * Warna latar belakang kontainer (background container) atau elemen UI lainnya harus mempertimbangkan kontras dan keterbacaan di kedua mode (Light & Dark Theme).

- **Penggunaan Ikon:**
  * Hindari penggunaan ikon non-vektor (seperti gambar PNG/JPG). Seluruh ikon harus berupa vektor (SVG).

- **Kapitalisasi Huruf:**
  * Hindari penggunaan huruf kapital semua (UPPERCASE) pada kata-kata di UI. Gunakan huruf kapital hanya di awal kata/kalimat (Title Case / Sentence Case).

- **Kepadatan Informasi:**
  * Hindari penamaan dan deskripsi/keterangan yang terlalu panjang di UI. Usahakan singkat, padat, dan langsung pada intinya.

---

# 🛠️ Developer Tools Suite — Token Saving Protocol

## ⚡ Tabel Pintasan Perintah Terminal (CLI Cheat Sheet)

| Tugas / Fungsi | Perintah Terminal | Hasil Keluaran |
| :--- | :--- | :--- |
| **🔄 Sinkronisasi Total** | `npm run update:tools` | Memperbarui outline, tags, graphify, repomix, dan dependency-cruiser sekaligus. |
| **🏷️ Update Outline & Tags** | `npm run update:outline` | Memperbarui `src/code-outline.json` & berkas `tags` Universal CTags. |
| **🔍 Cek Impor Melingkar** | `npx depcruise --no-config src` | Memverifikasi tidak ada *circular imports*. |
| **📊 Update Peta Graphify** | `python -m graphify update .` | Memperbarui peta arsitektur AST di `graphify-out/`. |

---

## 📋 Protokol Hemat Token AI (WAJIB DIIKUTI)

### A. PRIORITAS PENCARIAN KODE (ZERO-GREP FIRST)
- **Wajib** cek `src/code-outline.json` terlebih dahulu sebelum melakukan grep global.
- **Wajib** gunakan `python -m graphify query "<pertanyaan>"` sebelum membaca file mentah.
- **DILARANG** membuka file > 200 baris tanpa batasan StartLine/EndLine.
- **DILARANG** membaca `repomix-output.xml` secara langsung kecuali sangat mendesak.

### B. PRINSIP "LOCAL SCOPE EDITING" (ZERO TOLERANCE)
- **Hanya ubah baris kode yang SANGAT RELEVAN** dengan permintaan fitur baru.
- **DILARANG** menyentuh kode lain yang tidak diminta (refactoring, optimasi, kerapihan).
- Jika instruksi hanya meminta update UI, **DILARANG** menyentuh logika service/backend.

### C. PROTOKOL KOMUNIKASI
- **DILARANG** menampilkan diff/block kode panjang di chat kecuali diminta.
- **WAJIB** balasan singkat. Cukup akhiri dengan "Sudah direvisi. Anda setuju?".
- **DILARANG** menjalankan `npm run build` secara otomatis setelah revisi.
- **DILARANG** membuat `implementation_plan.md` untuk revisi kecil.

### D. LARANGAN INJEKSI KODE VIA TERMINAL (NO SILENT EDITS)
- **DILARANG KERAS** menggunakan `run_command` atau skrip eksternal untuk memanipulasi kode sumber (`.tsx`, `.ts`, `.css`, `.json`).
- Semua revisi kode **WAJIB** dikerjakan via `replace_file_content` atau `multi_replace_file_content`.

### E. PENUNDAAN UPDATE ALAT BANTU
- **DILARANG** menjalankan `npm run update:outline`, `python -m graphify update .`, atau `repomix` secara otomatis di setiap revisi.
- Pembaruan alat bantu **WAJIB** menunggu instruksi spesifik dari pengguna.

### F. LARANGAN GIT PUSH OTOMATIS
- **DILARANG KERAS** melakukan `git commit` atau `git push` ke repositori GitHub secara otomatis.
- Setiap tindakan penyimpanan atau pengiriman kode ke GitHub **WAJIB** menunggu instruksi langsung dan eksplisit dari pengguna.

---

## 🗂️ Graphify (AST Code Map)

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- For codebase or architecture questions, first run `python -m graphify query "<question>"` before grep.
- Use `python -m graphify path "<A>" "<B>"` for relationships between files.
- Use `python -m graphify explain "<concept>"` for focused concept lookup.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- Berikan saran singkat di akhir chat untuk menjalankan perintah pembaruan jika ada perubahan struktur file atau relasi kode baru.
- **DILARANG** memberikan saran pembaruan jika perubahan hanya visual/layout/nilai variabel.
