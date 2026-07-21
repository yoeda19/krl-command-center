// =========================================================
// TYPES - KRL Parts Command Center
// =========================================================

export type AlertStatus = 'KRITIS' | 'WASPADA' | 'AMAN';
export type ThemeMode = 'dark' | 'light';
export type PropulsiType = 'VVVF' | 'Rheostatik';
export type JenisKereta = 'TC' | 'M1' | 'M2' | 'T' | 'T6';
export type SeriKereta = 'JR205' | 'CLI125' | 'CLI225' | 'Metro' | 'KFW' | 'EA203';
export type TipePerawatan = 'P1' | 'P3' | 'P6' | 'P12' | 'P24' | 'P48';
export type PelaksanaanStatus = 'Rencana' | 'Sedang Dirawat' | 'Selesai';
export type PemenuhStatus = 'Outstanding' | 'Fulfilled';
export type ProcurementStatus =
  | 'Dalam Pengadaan'
  | 'Proses Evaluasi'
  | 'Proses PR & Approval'
  | 'Proses PO'
  | 'Goods Inspection'
  | 'Goods Receipt (GR)';
export type RisikoLevel = 'Rendah' | 'Sedang' | 'Tinggi';
export type AgingKategori = 'Fresh' | 'Slow-Moving' | 'At Risk' | 'Dead Stock' | 'Stock Out';

// ── Interfaces ────────────────────────────────────────────

export interface MasterMaterial {
  nomor_material: string;
  nama_material: string;
  satuan: string;
  total_stock: number;
}

export interface FleetMetrics {
  total_fleet: number;
  siap_dinas: number;
  in_maintenance: number;
  tidak_beroperasi: number;
  efisiensi_perawatan: number;
}

export interface CriticalStockItem {
  nomor_material: string;
  nama_material: string;
  satuan: string;
  gudang: string;
  gudang_label: string;
  current_stock: number;
  stok_ideal: number;        // Stok Ideal (PDF Hal.11)
  cr_actual: number;
  plan_bulanan: number;
  lead_time: number;
  t_exhaustion: number;
  t_arrival: number;
  gap_defisit: number;
  pct_ketersediaan: number;  // % Ketersediaan = (current / ideal) × 100
  status: AlertStatus;
  rencana_awal: number[];
  realisasi: (number | null)[];
  all_plans?: { tahun: number; bulan: number; plan_qty: number }[];
  all_history?: { qty: number; tanggal: string | null; gudang?: string; order_no?: string | null }[];
  jumlah_dipesan?: number;
  safety_stock?: number;
  safety_stock_manual?: number;
  safety_stock_days?: number;
  use_formula?: boolean;
  rop?: number;
  tanggal_rencana_pengiriman?: string | null;
}

export interface SafetyStockItem {
  nomor_material: string;
  nama_material: string;
  satuan: string;
  current_stock: number;
  safety_stock_level: number;
  reorder_point: number;
  status: AlertStatus;
  gap_bulan: number;
  silenced: boolean;
}

export interface ProcurementItem {
  id: number;
  nomor_material: string;
  uraian_material: string;
  satuan: string;
  sisa_stok: number;
  harga_satuan: number;
  jumlah_dipesan: number;
  total_harga: number;
  // ── Milestone numbers ──────────────────────
  nomor_nod: string | null;
  nomor_pr: string | null;
  nomor_po: string | null;
  nomor_gr: string | null;
  // ── Milestone dates ────────────────────────
  tanggal_nod: string | null;
  tanggal_pr: string | null;
  tanggal_po: string;                       // wajib ada (PO diterbitkan)
  tanggal_kirim_vendor: string | null;
  tanggal_tiba_depo: string | null;
  tanggal_gr: string | null;
  tanggal_rencana_pengiriman: string;       // rencana tiba (plan)
  tanggal_penerimaan_barang: string | null; // GR aktual (legacy, sama dg tanggal_gr)
  // ── Status & risk ─────────────────────────
  vendor: string;
  kota_asal: string;
  status: ProcurementStatus;
  plan_lead_time: number;
  actual_lead_time: number | null;
  risiko_keterlambatan: RisikoLevel;
  keterangan: string | null;
  // ── New milestone columns ──
  proposed_by?: string | null;
  publish_nod?: string | null;
  rkap_non_rkap?: string | null;
  link_document_nod?: string | null;
  category?: string | null;
  tech_spec_release_date?: string | null;
  rilis_evaluasi_ctpe?: string | null;
  rilis_evaluasi_ctpp?: string | null;
  rilis_rab_logistik?: string | null;
  review_logistic_status?: string | null;
  plan_tech_spec_release_date?: string | null;
  plan_rilis_evaluasi_ctpe?: string | null;
  plan_rilis_evaluasi_ctpp?: string | null;
  plan_rilis_rab_logistik?: string | null;
  plan_review_logistic_status?: string | null;
  plan_goods_inspection_status?: string | null;
  pr_number?: string | null;
  pr_release_date?: string | null;
  plan_approval_sap_status?: string | null;
  approval_sap_status?: string | null;
  plan_aanwijzing_date?: string | null;
  aanwijzing_date?: string | null;
  vendor_sap?: string | null;
  po_number?: string | null;
  po_release_date?: string | null;
  goods_inspection_status?: string | null;
  gr_release_date?: string | null;
  duration?: number | null;
  cost?: number | null;
}

export interface SlowMovingItem {
  nomor_material: string;
  nama_material: string;
  satuan: string;
  current_stock: number;
  harga_satuan: number;
  nilai_aset: number;
  last_movement: string;
  usia_pengendapan_hari: number;
  kategori: AgingKategori;
  rekomendasi: string;
  stocks?: Record<string, number>;
}

export interface RestockItem {
  id: number;
  tanggal: string;
  nomor_material: string;
  nama_material: string;
  qty: number;
  satuan: string;
  amount: number;
  gudang: string;
  created_at?: string;
}

export interface AgingParameter {
  category_name: AgingKategori;
  min_days: number;
  max_days: number;
  color: string;
}

export interface MaintenanceSchedule {
  id: number;
  nomor_rangkaian: string;
  seri_kereta: SeriKereta;
  jenis_propulsi: PropulsiType;
  tipe_perawatan: TipePerawatan;
  tanggal_rencana: string;
  status_pelaksanaan: PelaksanaanStatus;
  dipo?: string;
}

export interface MaintenanceBomConfig {
  id: number;
  tipe_perawatan: TipePerawatan;
  nomor_material: string;
  qty_standar: number;
  qty_tc?: number;
  qty_m1?: number;
  qty_m2?: number;
  qty_t6?: number;
  qty_t?: number;
  compat_seri_kereta?: string;
  compat_propulsi?: string;
  // fields joined from master_materials
  nama_material?: string;
  satuan?: string;
  current_stock?: number;
  stocks?: Record<string, number> | null;
}

export interface WorkOrder {
  id: number;
  nomor_wo: string;
  schedule_id: number;
  nomor_rangkaian: string;
  nomor_material: string;
  nama_material: string;
  qty_reservasi: number;
  status_pemenuhan: PemenuhStatus;
  propulsi: PropulsiType;
  seri_kereta: SeriKereta;
  current_stock?: number;
}

export interface AuditLog {
  id: number;
  nomor_material: string | null;
  parameter_name: string;
  original_value: string | null;
  new_value: string;
  admin_email: string;
  admin_name: string;
  changed_at: string;
  modul: string;
}

export interface AdminParameter {
  nomor_material: string;
  nama_material: string;
  ideal_qty: number;
  safety_stock_manual?: number;
  safety_stock_days?: number;
  lead_time_hari: number;
  plan_bulanan: number;
  use_formula: boolean;
}

export interface MonthlyPlan {
  nomor_material: string;
  gudang?: string;
  tahun: number;
  bulan: number;
  plan_qty: number;
}

export interface MaterialCompatibilityRule {
  propulsi: PropulsiType[];
  jenis_kereta: JenisKereta[];
}

export interface ExportColumn {
  key: string;
  header: string;
}

export interface NavItem {
  path: string;
  icon: string;
  label: string;
  alertColor?: string;
}

export interface StatusColors {
  text: string;
  bg: string;
  border: string;
  glow: string;
}
