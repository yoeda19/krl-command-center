# Aturan Pengembangan UI (ruleai.md)

## Standar Layar dan Responsivitas
- **Dukungan Monitor Besar (Maksimal 43 Inch):**
  * Seluruh halaman dashboard dan visualisasinya harus didesain agar optimal dan mengisi layar dengan baik pada monitor berukuran hingga **43 inch**.
  * Hindari adanya area kosong menganga (empty whitespace) di bagian bawah layar pada monitor besar.
  * Gunakan unit tinggi relatif (seperti `vh`, `flex-grow`, atau perhitungan dinamis) pada grafik ECharts dan kontainer utama dengan batas pengaman (`min-height` dan `max-height`) agar layout meregang dengan proporsional pada monitor resolusi tinggi/ukuran besar tanpa merusak visualisasi pada monitor ukuran kecil (seperti 19 inch).
