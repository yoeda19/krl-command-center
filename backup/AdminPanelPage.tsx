import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import {
  getAdminParameters, saveAdminParameter, getMonthlyPlans, saveMonthlyPlans,
  getProcurementData, addProcurement, updateProcurement, deleteProcurement,
  getMaintenanceSchedule, addMaintenanceSchedule, updateMaintenanceSchedule, deleteMaintenanceSchedule,
  getWorkOrders, addWorkOrder, updateWorkOrder, deleteWorkOrder,
  getRealSAPTrains, getRealSAPOrders, getMasterMaterials,
  getMaintenanceBomConfig, addMaintenanceBomConfig, updateMaintenanceBomConfig, deleteMaintenanceBomConfig
} from '../services/supabaseService';
import { formatRupiah, formatTanggal } from '../utils/calculations';
import type {
  AdminParameter, MonthlyPlan, ProcurementItem, ProcurementStatus, RisikoLevel,
  MaintenanceSchedule, WorkOrder, JenisKereta, PropulsiType, TipePerawatan, PelaksanaanStatus, PemenuhStatus,
  MaintenanceBomConfig
} from '../types';

interface ConfirmModal { message: string; onConfirm: () => void; }
type ActiveTab = 'parameter' | 'pengadaan' | 'perawatan' | 'bom';

const PROCUREMENT_STATUSES: ProcurementStatus[] = ['PO Diterbitkan', 'Dalam Pengadaan', 'Dikirim Vendor', 'Dalam Transit', 'Tiba di Depo'];
const RISIKO_LEVELS: RisikoLevel[] = ['Rendah', 'Sedang', 'Tinggi'];

const statusCfg: Record<ProcurementStatus, { color: string }> = {
  'PO Diterbitkan':  { color: '#60a5fa' },
  'Dalam Pengadaan': { color: 'var(--color-led-amber)' },
  'Dikirim Vendor':  { color: '#9ca3af' },
  'Dalam Transit':   { color: '#10b981' },
  'Tiba di Depo':    { color: 'var(--color-led-green)' },
};

const emptyPO = (): Partial<ProcurementItem> => ({
  nomor_material: '',
  uraian_material: '',
  satuan: 'PCS',
  sisa_stok: 0,
  harga_satuan: 0,
  jumlah_dipesan: 0,
  total_harga: 0,
  nomor_nod: '',
  tanggal_nod: null,
  nomor_pr: '',
  tanggal_pr: null,
  nomor_po: '',
  tanggal_po: '',
  tanggal_kirim_vendor: null,
  tanggal_tiba_depo: null,
  tanggal_gr: null,
  nomor_gr: '',
  tanggal_rencana_pengiriman: '',
  tanggal_penerimaan_barang: null,
  vendor: '',
  kota_asal: '',
  status: 'PO Diterbitkan',
  plan_lead_time: 90,
  actual_lead_time: null,
  risiko_keterlambatan: 'Rendah',
  keterangan: '',
});

const emptySchedule = (): Omit<MaintenanceSchedule, 'id'> => ({
  nomor_rangkaian: '',
  jenis_kereta: 'M1',
  jenis_propulsi: 'VVVF',
  tipe_perawatan: 'P1',
  tanggal_rencana: new Date('2026-07-11').toISOString().split('T')[0],
  status_pelaksanaan: 'Rencana',
});

const emptyWO = (): Omit<WorkOrder, 'id' | 'nomor_rangkaian' | 'nama_material' | 'propulsi' | 'jenis_kereta'> => ({
  nomor_wo: '',
  schedule_id: 0,
  nomor_material: '',
  qty_reservasi: 1,
  status_pemenuhan: 'Outstanding',
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--color-on-surface-variant)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded px-3 py-2 text-sm border";
const inputStyle = { backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' };

export default function AdminPanelPage() {
  const [searchParams] = useSearchParams();
  const materialParam = searchParams.get('material');

  const [activeTab, setActiveTab] = useState<ActiveTab>('parameter');
  const [params, setParams] = useState<AdminParameter[]>([]);
  const [masterMaterials, setMasterMaterials] = useState<{ nomor_material: string; nama_material: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<AdminParameter | null>(null);
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

  // Procurement tab state
  const [procureList, setProcureList] = useState<ProcurementItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPO, setEditingPO] = useState<ProcurementItem | null>(null);
  const [newPO, setNewPO] = useState<Partial<ProcurementItem>>(emptyPO());
  const [poLoading, setPOLoading] = useState(false);

  // Perawatan tab state
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [workOrdersList, setWorkOrdersList] = useState<WorkOrder[]>([]);
  const [sapTrains, setSapTrains] = useState<{ id: string; name: string; model_no: string }[]>([]);
  const [sapOrders, setSapOrders] = useState<{ order_no: string; description: string }[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showWOForm, setShowWOForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Omit<MaintenanceSchedule, 'id'>>(emptySchedule());
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [newWO, setNewWO] = useState<Omit<WorkOrder, 'id' | 'nomor_rangkaian' | 'nama_material' | 'propulsi' | 'jenis_kereta'>>(emptyWO());
  const [editingWO, setEditingWO] = useState<WorkOrder | null>(null);

  // BOM Config tab state
  const [bomList, setBomList] = useState<MaintenanceBomConfig[]>([]);
  const [showBOMForm, setShowBOMForm] = useState(false);
  const [newBOM, setNewBOM] = useState<Omit<MaintenanceBomConfig, 'id' | 'nama_material' | 'satuan' | 'current_stock'>>({
    tipe_perawatan: 'P1',
    nomor_material: '',
    qty_standar: 1
  });
  const [editingBOM, setEditingBOM] = useState<MaintenanceBomConfig | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [paramData, matData] = await Promise.all([
          getAdminParameters(),
          getMasterMaterials(),
        ]);
        setParams(paramData);
        setMasterMaterials(matData);
        if (materialParam) {
          setActiveTab('parameter');
          const row = paramData.find(p => p.nomor_material === materialParam);
          if (row) handleEdit(row.nomor_material, paramData);
        }
      } catch (err) {
        console.error('Error loading admin data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'pengadaan' && procureList.length === 0) {
      getProcurementData().then(data => setProcureList(data));
    } else if (activeTab === 'perawatan') {
      getMaintenanceSchedule().then(data => setSchedules(data));
      getWorkOrders().then(data => setWorkOrdersList(data));
      getRealSAPTrains().then(data => setSapTrains(data));
      getRealSAPOrders().then(data => setSapOrders(data));
    } else if (activeTab === 'bom') {
      getMaintenanceBomConfig().then(data => setBomList(data));
    }
  }, [activeTab]);

  // BOM Configuration handlers
  const handleSaveBOM = async () => {
    const data = editingBOM ?? newBOM;
    if (!data.nomor_material || !data.tipe_perawatan) {
      showError('Tipe perawatan dan Kode material wajib diisi.');
      return;
    }
    try {
      if (editingBOM) {
        const { error } = await updateMaintenanceBomConfig(editingBOM.id, editingBOM);
        if (error) { showError(error); return; }
        const fresh = await getMaintenanceBomConfig();
        setBomList(fresh);
        setEditingBOM(null);
        showSuccess('BOM configuration updated.');
      } else {
        const { error } = await addMaintenanceBomConfig(newBOM);
        if (error) { showError(error); return; }
        const fresh = await getMaintenanceBomConfig();
        setBomList(fresh);
        setNewBOM({ tipe_perawatan: 'P1', nomor_material: '', qty_standar: 1 });
        setShowBOMForm(false);
        showSuccess('New BOM requirement configuration saved.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBOM = (id: number) => {
    setConfirmModal({
      message: 'Hapus konfigurasi kebutuhan material standar untuk tipe perawatan ini?',
      onConfirm: async () => {
        const { error } = await deleteMaintenanceBomConfig(id);
        if (error) showError(error);
        else {
          setBomList(prev => prev.filter(b => b.id !== id));
          showSuccess('BOM config deleted successfully.');
        }
        setConfirmModal(null);
      }
    });
  };

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4500); };
  const showError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), 5000); };

  // ── Parameter tab handlers ──────────────────────────────
  const handleEdit = async (id: string, data?: AdminParameter[]) => {
    const source = data ?? params;
    const row = source.find(p => p.nomor_material === id);
    if (!row) return;
    setEditingId(id);
    setEditValues({ ...row });
    try {
      const plans = await getMonthlyPlans(id);
      const seeded: MonthlyPlan[] = [2026, 2027, 2028, 2029, 2030].flatMap(yr =>
        Array.from({ length: 12 }, (_, i) => {
          const mo = i + 1;
          const ex = plans.find(p => p.tahun === yr && p.bulan === mo);
          return { nomor_material: id, tahun: yr, bulan: mo, plan_qty: ex?.plan_qty ?? 0 };
        })
      );
      setMonthlyPlans(seeded);
    } catch (err) {
      console.error('Error loading monthly plans:', err);
    }
  };

  const handleSaveRequest = () => {
    if (!editValues) return;
    setConfirmModal({
      message: `Apakah Anda yakin ingin menyimpan perubahan parameter dan target penyerapan sampai tahun 2030 untuk material ${editValues.nomor_material}? Tindakan ini akan dicatat dalam log audit.`,
      onConfirm: handleSave,
    });
  };

  const handleSave = async () => {
    if (!editValues) return;
    try {
      const email = localStorage.getItem('krl_admin_email') || 'rifaldi.emon@krl.co.id';
      const name = localStorage.getItem('krl_admin_name') || 'M. Rifaldi';
      await Promise.all([saveAdminParameter(editValues, email, name), saveMonthlyPlans(monthlyPlans)]);
      setParams(prev => prev.map(p => p.nomor_material === editingId ? { ...p, ...editValues } : p));
      setEditingId(null); setEditValues(null); setMonthlyPlans([]);
      setConfirmModal(null);
      showSuccess(`Parameter dan Rencana Bulanan untuk ${editValues.nomor_material} berhasil disimpan.`);
    } catch (err) {
      console.error('Error saving parameter:', err);
    }
  };

  const updateField = <K extends keyof AdminParameter>(key: K, value: AdminParameter[K]) =>
    setEditValues(prev => prev ? { ...prev, [key]: value } : prev);

  const updateMonthlyPlan = (tahun: number, bulan: number, qty: number) =>
    setMonthlyPlans(prev => prev.map(p => p.tahun === tahun && p.bulan === bulan ? { ...p, plan_qty: qty } : p));

  // ── Procurement tab handlers ─────────────────────────────
  const updatePOField = <K extends keyof ProcurementItem>(key: K, value: ProcurementItem[K]) => {
    if (editingPO) {
      setEditingPO(prev => prev ? { ...prev, [key]: value } : prev);
    } else {
      setNewPO(prev => ({ ...prev, [key]: value }));
    }
  };

  const updateNewPOHarga = (field: 'harga_satuan' | 'jumlah_dipesan', val: number) => {
    if (editingPO) {
      setEditingPO(prev => {
        if (!prev) return null;
        const next = { ...prev, [field]: val };
        next.total_harga = (next.harga_satuan ?? 0) * (next.jumlah_dipesan ?? 0);
        return next;
      });
    } else {
      setNewPO(prev => {
        const next = { ...prev, [field]: val };
        next.total_harga = (next.harga_satuan ?? 0) * (next.jumlah_dipesan ?? 0);
        return next;
      });
    }
  };

  const handleSavePO = async () => {
    setPOLoading(true);
    try {
      if (editingPO) {
        const { error } = await updateProcurement(editingPO.id, editingPO);
        if (error) { showError(`Gagal update: ${error}`); return; }
        setProcureList(prev => prev.map(p => p.id === editingPO.id ? editingPO : p));
        setEditingPO(null);
        showSuccess(`Progress PO #${editingPO.id} (${editingPO.nomor_material}) berhasil diperbarui.`);
      } else {
        if (!newPO.nomor_material || !newPO.tanggal_po || !newPO.vendor) {
          showError('Kode material, tanggal PO, dan vendor wajib diisi.'); return;
        }
        const { error } = await addProcurement(newPO as Omit<ProcurementItem, 'id' | 'actual_lead_time' | 'tanggal_penerimaan_barang'>);
        if (error) { showError(`Gagal menyimpan: ${error}`); return; }
        const freshData = await getProcurementData();
        setProcureList(freshData);
        setNewPO(emptyPO());
        setShowAddForm(false);
        showSuccess(`NOD/PO baru untuk ${newPO.nomor_material} berhasil disimpan.`);
      }
    } finally {
      setPOLoading(false);
    }
  };

  const handleDeletePO = (item: ProcurementItem) => {
    setConfirmModal({
      message: `Hapus data pengadaan ${item.nomor_material} (${item.uraian_material})? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        const { error } = await deleteProcurement(item.id);
        if (error) { showError(`Gagal hapus: ${error}`); }
        else {
          setProcureList(prev => prev.filter(p => p.id !== item.id));
          showSuccess(`Data pengadaan ${item.nomor_material} berhasil dihapus.`);
        }
        setConfirmModal(null);
      },
    });
  };

  // ── Perawatan tab handlers ─────────────────────────────
  const handleSaveSchedule = async () => {
    const data = editingSchedule ?? newSchedule;
    if (!data.nomor_rangkaian) { showError('Pilih rangkaian terlebih dahulu.'); return; }
    try {
      if (editingSchedule) {
        const { error } = await updateMaintenanceSchedule(editingSchedule.id, editingSchedule);
        if (error) { showError(error); return; }
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? editingSchedule : s));
        setEditingSchedule(null);
        showSuccess('Jadwal perawatan berhasil diperbarui.');
      } else {
        const { error } = await addMaintenanceSchedule(newSchedule);
        if (error) { showError(error); return; }
        const fresh = await getMaintenanceSchedule();
        setSchedules(fresh);
        setNewSchedule(emptySchedule());
        setShowScheduleForm(false);
        showSuccess('Jadwal rencana perawatan baru berhasil dibuat.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchedule = (id: number) => {
    setConfirmModal({
      message: 'Hapus jadwal rencana perawatan ini? Data work order terkait mungkin tidak terhapus otomatis.',
      onConfirm: async () => {
        const { error } = await deleteMaintenanceSchedule(id);
        if (error) showError(error);
        else {
          setSchedules(prev => prev.filter(s => s.id !== id));
          showSuccess('Jadwal perawatan berhasil dihapus.');
        }
        setConfirmModal(null);
      }
    });
  };

  const handleSaveWO = async () => {
    const data = editingWO ?? newWO;
    if (!data.nomor_wo || !data.nomor_material || !data.schedule_id) {
      showError('No. WO, Material, dan Rencana Perawatan wajib diisi.');
      return;
    }
    try {
      if (editingWO) {
        const { error } = await updateWorkOrder(editingWO.id, editingWO);
        if (error) { showError(error); return; }
        const fresh = await getWorkOrders();
        setWorkOrdersList(fresh);
        setEditingWO(null);
        showSuccess('Work Order berhasil diperbarui.');
      } else {
        const { error } = await addWorkOrder(newWO);
        if (error) { showError(error); return; }
        const fresh = await getWorkOrders();
        setWorkOrdersList(fresh);
        setNewWO(emptyWO());
        setShowWOForm(false);
        showSuccess('Work Order baru berhasil didaftarkan.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWO = (id: number) => {
    setConfirmModal({
      message: 'Apakah Anda yakin ingin menghapus reservasi Work Order ini?',
      onConfirm: async () => {
        const { error } = await deleteWorkOrder(id);
        if (error) showError(error);
        else {
          setWorkOrdersList(prev => prev.filter(w => w.id !== id));
          showSuccess('Work Order berhasil dihapus.');
        }
        setConfirmModal(null);
      }
    });
  };

  // ── PO Form section ─────────────────────────────────────
  const poData = editingPO ?? newPO;

  const renderPOForm = (title: string) => {
    const mat = masterMaterials.find(m => m.nomor_material === poData.nomor_material);
    return (
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-steel-border)' }}>
        <div className="px-5 py-4 flex justify-between items-center border-b"
          style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <h4 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>{title}</h4>
          <button onClick={() => { setShowAddForm(false); setEditingPO(null); }}
            style={{ color: 'var(--color-on-surface-variant)' }} className="hover:opacity-70">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-5">
          {/* Material */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-secondary)' }}>Data Material</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Kode Material *">
                <select value={poData.nomor_material || ''} onChange={e => {
                  const m = masterMaterials.find(x => x.nomor_material === e.target.value);
                  updatePOField('nomor_material', e.target.value);
                  if (m && !editingPO) updatePOField('uraian_material', m.nama_material);
                }} className={inputCls} style={inputStyle}>
                  <option value="">-- Pilih Material --</option>
                  {masterMaterials.map(m => <option key={m.nomor_material} value={m.nomor_material}>{m.nomor_material} – {m.nama_material}</option>)}
                </select>
              </Field>
              <Field label="Uraian / Deskripsi *">
                <input value={poData.uraian_material || ''} onChange={e => updatePOField('uraian_material', e.target.value)} className={inputCls} style={inputStyle} placeholder={mat?.nama_material || 'Uraian material'} />
              </Field>
              <Field label="Satuan">
                <select value={poData.satuan || 'PCS'} onChange={e => updatePOField('satuan', e.target.value)} className={inputCls} style={inputStyle}>
                  {['PCS', 'SET', 'M', 'KG', 'LITER', 'UNIT', 'BOX'].map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Qty Dipesan">
                <input type="number" value={poData.jumlah_dipesan || 0} onChange={e => updateNewPOHarga('jumlah_dipesan', +e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Harga Satuan (Rp)">
                <input type="number" value={poData.harga_satuan || 0} onChange={e => updateNewPOHarga('harga_satuan', +e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Total Harga">
                <div className="px-3 py-2 rounded border text-sm font-bold" style={{ ...inputStyle, color: 'var(--color-secondary)' }}>
                  {formatRupiah((poData.jumlah_dipesan ?? 0) * (poData.harga_satuan ?? 0))}
                </div>
              </Field>
            </div>
          </div>

          {/* NOD & PR */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-secondary)' }}>Tahap 1 — NOD &amp; PR</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Nomor NOD"><input value={poData.nomor_nod || ''} onChange={e => updatePOField('nomor_nod', e.target.value)} className={inputCls} style={inputStyle} placeholder="NOD-2026-001" /></Field>
              <Field label="Tanggal NOD"><input type="date" value={poData.tanggal_nod || ''} onChange={e => updatePOField('tanggal_nod', e.target.value || null)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Nomor PR"><input value={poData.nomor_pr || ''} onChange={e => updatePOField('nomor_pr', e.target.value)} className={inputCls} style={inputStyle} placeholder="PR-2026-001" /></Field>
              <Field label="Tanggal PR"><input type="date" value={poData.tanggal_pr || ''} onChange={e => updatePOField('tanggal_pr', e.target.value || null)} className={inputCls} style={inputStyle} /></Field>
            </div>
          </div>

          {/* PO */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-secondary)' }}>Tahap 2 — PO Diterbitkan</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Nomor PO"><input value={poData.nomor_po || ''} onChange={e => updatePOField('nomor_po', e.target.value)} className={inputCls} style={inputStyle} placeholder="PO-2026-001" /></Field>
              <Field label="Tanggal PO *"><input type="date" value={poData.tanggal_po || ''} onChange={e => updatePOField('tanggal_po', e.target.value)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Vendor *"><input value={poData.vendor || ''} onChange={e => updatePOField('vendor', e.target.value)} className={inputCls} style={inputStyle} placeholder="Nama perusahaan vendor" /></Field>
              <Field label="Kota Asal"><input value={poData.kota_asal || ''} onChange={e => updatePOField('kota_asal', e.target.value)} className={inputCls} style={inputStyle} placeholder="Jakarta" /></Field>
            </div>
          </div>

          {/* Transit */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-secondary)' }}>Tahap 3–4 — Pengiriman &amp; Transit</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Tgl Kirim Vendor"><input type="date" value={poData.tanggal_kirim_vendor || ''} onChange={e => updatePOField('tanggal_kirim_vendor', e.target.value || null)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Rencana Tiba Depo"><input type="date" value={poData.tanggal_rencana_pengiriman || ''} onChange={e => updatePOField('tanggal_rencana_pengiriman', e.target.value)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Tgl Tiba Fisik"><input type="date" value={poData.tanggal_tiba_depo || ''} onChange={e => updatePOField('tanggal_tiba_depo', e.target.value || null)} className={inputCls} style={inputStyle} /></Field>
            </div>
          </div>

          {/* GR */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-secondary)' }}>Tahap 5 — GR (Goods Receipt)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Nomor GR (MIGO)"><input value={poData.nomor_gr || ''} onChange={e => updatePOField('nomor_gr', e.target.value)} className={inputCls} style={inputStyle} placeholder="GR-2026-001" /></Field>
              <Field label="Tanggal GR"><input type="date" value={poData.tanggal_gr || ''} onChange={e => updatePOField('tanggal_gr', e.target.value || null)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Sisa Stok Sebelum GR">
                <input type="number" value={poData.sisa_stok || 0} onChange={e => updatePOField('sisa_stok', +e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
            </div>
          </div>

          {/* Status & Risk */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-secondary)' }}>Status &amp; Kontrol</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Status Pengadaan">
                <select value={poData.status || 'PO Diterbitkan'} onChange={e => updatePOField('status', e.target.value as ProcurementStatus)} className={inputCls} style={inputStyle}>
                  {PROCUREMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Risiko Keterlambatan">
                <select value={poData.risiko_keterlambatan || 'Rendah'} onChange={e => updatePOField('risiko_keterlambatan', e.target.value as RisikoLevel)} className={inputCls} style={inputStyle}>
                  {RISIKO_LEVELS.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Lead Time Plan (hari)">
                <input type="number" value={poData.plan_lead_time || 90} onChange={e => updatePOField('plan_lead_time', +e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Keterangan">
                <input value={poData.keterangan || ''} onChange={e => updatePOField('keterangan', e.target.value)} className={inputCls} style={inputStyle} placeholder="Catatan tambahan..." />
              </Field>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t" style={{ borderColor: 'var(--color-steel-border)' }}>
            <button onClick={() => { setShowAddForm(false); setEditingPO(null); }}
              className="px-4 py-2 rounded border text-sm font-bold transition-all hover:opacity-70"
              style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>
              Batal
            </button>
            <button onClick={handleSavePO} disabled={poLoading}
              className="skeuomorphic-btn px-5 py-2 rounded text-sm disabled:opacity-50">
              {poLoading ? 'Menyimpan...' : (editingPO ? 'Update Progress' : 'Simpan NOD/PO Baru')}
            </button>
          </div>
        </div>
      </div>
    );
  };

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
      <div>
        <h2 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-secondary)' }}>
            <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
          </svg>
          Panel Parameter Admin
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          Pengaturan target, rencana penyerapan material, monitoring pengadaan, serta penjadwalan perawatan KRL
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--color-steel-border)' }}>
        {[
          ['parameter', 'Parameter Material'],
          ['pengadaan', 'Manajemen Pengadaan'],
          ['perawatan', 'Perawatan KRL'],
          ['bom', 'BOM Standar Perawatan']
        ].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab as ActiveTab)}
            className="px-5 py-3 text-sm font-bold border-b-2 transition-all"
            style={{
              borderColor: activeTab === tab ? 'var(--color-secondary)' : 'transparent',
              color: activeTab === tab ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-green)', flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-red)', flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>{errorMsg}</p>
        </div>
      )}

      {/* ── TAB: Parameter Material ── */}
      {activeTab === 'parameter' && (
        <>
          <div className="tactile-card rounded-lg overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Konfigurasi Parameter Material</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px] data-table">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                    {['Kode Material','Nama Material','Stok Ideal','Lead Time (hari)','Metode','Aksi'].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-black tracking-widest uppercase" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {params.map((row, i) => (
                    <tr key={row.nomor_material} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                      <td className="px-4 py-3 font-bold text-xs" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.ideal_qty} PCS</td>
                      <td className="px-4 py-3 text-xs">{row.lead_time_hari} hari</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: row.use_formula ? 'rgba(59,130,246,0.12)' : 'var(--color-surface-container-high)', color: row.use_formula ? '#60a5fa' : 'var(--color-on-surface-variant)' }}>
                          {row.use_formula ? 'Rumus Dinamis' : 'Input Manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleEdit(row.nomor_material)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded border text-[10px] font-bold transition-all hover:opacity-85"
                          style={{ borderColor: 'var(--color-on-surface-variant)', color: 'var(--color-on-surface)', backgroundColor: 'transparent' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Ubah &amp; Rencana
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Parameter Modal */}
          {editingId && editValues && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <div className="w-full max-w-4xl rounded-2xl p-6 shadow-2xl border animate-fade-in flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
                style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-steel-border)' }}>
                <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: 'var(--color-on-surface)' }}>Edit Parameter &amp; Rencana Penyerapan</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Material: <b>{editValues.nomor_material}</b> — {editValues.nama_material}</p>
                  </div>
                  <button onClick={() => { setEditingId(null); setEditValues(null); }} className="text-gray-400 hover:text-white transition-colors">
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>Stok Ideal</label>
                    <input type="number" value={editValues.ideal_qty}
                      onChange={e => updateField('ideal_qty', parseInt(e.target.value) || 0)}
                      className="w-full rounded px-3 py-2 text-sm border" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>Lead Time (Hari)</label>
                    <input type="number" value={editValues.lead_time_hari}
                      onChange={e => updateField('lead_time_hari', parseInt(e.target.value) || 0)}
                      className="w-full rounded px-3 py-2 text-sm border" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>Metode Perhitungan</label>
                    <label className="flex items-center gap-2 mt-2.5 cursor-pointer text-sm">
                      <input type="checkbox" checked={editValues.use_formula}
                        onChange={e => updateField('use_formula', e.target.checked)} />
                      <span style={{ color: 'var(--color-on-surface)' }}>Gunakan Rumus Dinamis</span>
                    </label>
                  </div>
                </div>
                <div className="border-t pt-4" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <h4 className="font-bold text-sm mb-3" style={{ color: 'var(--color-on-surface)' }}>Target Penyerapan Bulanan (Sampai 2030)</h4>
                  <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-steel-border)' }}>
                    <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                          <th className="p-2 font-bold" style={{ color: 'var(--color-on-primary-container)' }}>Tahun</th>
                          {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'].map(m => (
                            <th key={m} className="p-2 font-bold text-center" style={{ color: 'var(--color-on-primary-container)' }}>{m}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[2026, 2027, 2028, 2029, 2030].map(yr => (
                          <tr key={yr} className="border-b" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-dim)' }}>
                            <td className="p-2 font-bold" style={{ color: 'var(--color-on-surface)' }}>{yr}</td>
                            {Array.from({ length: 12 }).map((_, i) => {
                              const mo = i + 1;
                              const plan = monthlyPlans.find(p => p.tahun === yr && p.bulan === mo);
                              return (
                                <td key={mo} className="p-1">
                                  <input type="number" value={plan?.plan_qty ?? 0}
                                    onChange={e => updateMonthlyPlan(yr, mo, parseInt(e.target.value) || 0)}
                                    className="w-full text-center rounded p-1 text-xs border"
                                    style={inputStyle} />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex gap-3 justify-end border-t pt-4" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <button onClick={() => { setEditingId(null); setEditValues(null); }}
                    className="px-4 py-2 rounded border text-sm font-bold transition-all hover:opacity-70"
                    style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>Batal</button>
                  <button onClick={handleSaveRequest} className="skeuomorphic-btn px-5 py-2 rounded text-sm">Simpan Parameter &amp; Rencana</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Manajemen Pengadaan ── */}
      {activeTab === 'pengadaan' && (
        <>
          {/* Action Bar */}
          <div className="flex justify-between items-center">
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              {procureList.length} proses pengadaan aktif
            </p>
            {!showAddForm && !editingPO && (
              <button onClick={() => { setShowAddForm(true); setEditingPO(null); setNewPO(emptyPO()); }}
                className="skeuomorphic-btn px-4 py-2 rounded text-sm flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + Buat NOD / PO Baru
              </button>
            )}
          </div>

          {/* Form: Add or Edit */}
          {(showAddForm || editingPO) && (
            renderPOForm(editingPO ? `Update Progress — ${editingPO.nomor_material} (${editingPO.uraian_material})` : 'Buat NOD / PO Baru')
          )}

          {/* Procurement List Table */}
          <div className="tactile-card rounded-lg overflow-hidden">
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Daftar Proses Pengadaan</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded ml-1" style={{ backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                🔐 Hanya Admin
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1200px] data-table">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                    {['Kode','Uraian','Vendor','Nomor NOD','Nomor PR','Nomor PO','Tgl PO','Nomor GR','Tgl GR','Status','Risiko','Aksi'].map(h => (
                      <th key={h} className="px-3 py-3 text-[10px] font-black tracking-widest uppercase whitespace-nowrap"
                        style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {procureList.map((row, i) => {
                    const sc = statusCfg[row.status];
                    const nil = <span style={{ color: 'var(--color-on-surface-variant)', opacity: 0.35 }}>—</span>;
                    return (
                      <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface-dim)' : 'var(--color-background)' }}>
                        <td className="px-3 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_material}</td>
                        <td className="px-3 py-3 text-xs max-w-[160px]" style={{ color: 'var(--color-on-surface-variant)' }}>{row.uraian_material}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.vendor}</td>
                        <td className="px-3 py-3 text-xs font-mono" style={{ color: sc.color }}>{row.nomor_nod || nil}</td>
                        <td className="px-3 py-3 text-xs font-mono" style={{ color: sc.color }}>{row.nomor_pr || nil}</td>
                        <td className="px-3 py-3 text-xs font-mono font-bold" style={{ color: sc.color }}>{row.nomor_po || nil}</td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">{row.tanggal_po ? formatTanggal(row.tanggal_po) : nil}</td>
                        <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--color-led-green)' }}>{row.nomor_gr || nil}</td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">{(row.tanggal_gr || row.tanggal_penerimaan_barang) ? formatTanggal((row.tanggal_gr || row.tanggal_penerimaan_barang)!) : nil}</td>
                        <td className="px-3 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ backgroundColor: `${sc.color}20`, color: sc.color }}>{row.status}</span>
                        </td>
                        <td className="px-3 py-3 text-xs">{row.risiko_keterlambatan}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => { setEditingPO({ ...row }); setShowAddForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className="px-2 py-1 rounded border text-[10px] font-bold hover:opacity-85 transition-all"
                              style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>
                              Edit
                            </button>
                            <button onClick={() => handleDeletePO(row)}
                              className="px-2 py-1 rounded border text-[10px] font-bold hover:opacity-85 transition-all"
                              style={{ borderColor: 'rgba(220,38,38,0.4)', color: 'var(--color-led-red)' }}>
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {procureList.length === 0 && (
                    <tr><td colSpan={12} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Belum ada data pengadaan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}



      {/* ── TAB: Perawatan KRL ── */}
      {activeTab === 'perawatan' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Jadwal Rencana Perawatan KRL</h3>
            {!showScheduleForm && !editingSchedule && (
              <button onClick={() => { setShowScheduleForm(true); setEditingSchedule(null); setNewSchedule(emptySchedule()); }}
                className="skeuomorphic-btn px-4 py-1.5 rounded text-xs flex items-center gap-2">
                + Buat Jadwal Rencana Baru
              </button>
            )}
          </div>

          {(showScheduleForm || editingSchedule) && (
            <div className="rounded-xl border overflow-hidden p-5 space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
              <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                <h4 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  {editingSchedule ? 'Ubah Rencana Perawatan' : 'Buat Rencana Perawatan Baru'}
                </h4>
                <button onClick={() => { setShowScheduleForm(false); setEditingSchedule(null); }} style={{ color: 'var(--color-on-surface-variant)' }} className="hover:opacity-75">✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="No Rangkaian (Master Rangkaian) *">
                  <select value={(editingSchedule ?? newSchedule).nomor_rangkaian}
                    onChange={e => {
                      const t = sapTrains.find(x => x.name === e.target.value);
                      if (editingSchedule) {
                        setEditingSchedule(prev => prev ? { ...prev, nomor_rangkaian: e.target.value, jenis_propulsi: (t?.model_no as PropulsiType) || 'VVVF' } : prev);
                      } else {
                        setNewSchedule(prev => ({ ...prev, nomor_rangkaian: e.target.value, jenis_propulsi: (t?.model_no as PropulsiType) || 'VVVF' }));
                      }
                    }}
                    className={inputCls} style={inputStyle}>
                    <option value="">-- Pilih Rangkaian KRL --</option>
                    {sapTrains.map(t => <option key={t.id} value={t.name}>{t.name} ({t.model_no})</option>)}
                  </select>
                </Field>
                <Field label="Jenis Kereta">
                  <select value={(editingSchedule ?? newSchedule).jenis_kereta}
                    onChange={e => {
                      if (editingSchedule) setEditingSchedule(prev => prev ? { ...prev, jenis_kereta: e.target.value as JenisKereta } : prev);
                      else setNewSchedule(prev => ({ ...prev, jenis_kereta: e.target.value as JenisKereta }));
                    }}
                    className={inputCls} style={inputStyle}>
                    {['TC', 'M1', 'M2', 'T', 'T6'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Propulsi (Otomatis dari Master)">
                  <div className="px-3 py-2 rounded border text-sm" style={inputStyle}>
                    {(editingSchedule ?? newSchedule).jenis_propulsi}
                  </div>
                </Field>
                <Field label="Tipe Perawatan">
                  <select value={(editingSchedule ?? newSchedule).tipe_perawatan}
                    onChange={e => {
                      if (editingSchedule) setEditingSchedule(prev => prev ? { ...prev, tipe_perawatan: e.target.value as TipePerawatan } : prev);
                      else setNewSchedule(prev => ({ ...prev, tipe_perawatan: e.target.value as TipePerawatan }));
                    }}
                    className={inputCls} style={inputStyle}>
                    {['P1', 'P3', 'P6', 'P12', 'P24', 'P48'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Tanggal Rencana">
                  <input type="date" value={(editingSchedule ?? newSchedule).tanggal_rencana}
                    onChange={e => {
                      if (editingSchedule) setEditingSchedule(prev => prev ? { ...prev, tanggal_rencana: e.target.value } : prev);
                      else setNewSchedule(prev => ({ ...prev, tanggal_rencana: e.target.value }));
                    }}
                    className={inputCls} style={inputStyle} />
                </Field>
                <Field label="Status Pelaksanaan">
                  <select value={(editingSchedule ?? newSchedule).status_pelaksanaan}
                    onChange={e => {
                      if (editingSchedule) setEditingSchedule(prev => prev ? { ...prev, status_pelaksanaan: e.target.value as PelaksanaanStatus } : prev);
                      else setNewSchedule(prev => ({ ...prev, status_pelaksanaan: e.target.value as PelaksanaanStatus }));
                    }}
                    className={inputCls} style={inputStyle}>
                    {['Rencana', 'Sedang Dirawat', 'Selesai'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={handleSaveSchedule} className="skeuomorphic-btn px-4 py-1.5 rounded text-xs">
                  {editingSchedule ? 'Perbarui Rencana' : 'Simpan Rencana'}
                </button>
              </div>
            </div>
          )}

          <div className="tactile-card rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse data-table">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                    {['Nomor Rangkaian', 'Jenis Kereta', 'Propulsi', 'Tipe Perawatan', 'Tanggal Rencana', 'Status Pelaksanaan', 'Aksi'].map(h => (
                      <th key={h} className="px-4 py-2 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_rangkaian}</td>
                      <td className="px-4 py-2.5 text-xs">{row.jenis_kereta}</td>
                      <td className="px-4 py-2.5 text-xs">{row.jenis_propulsi}</td>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-secondary)' }}>{row.tipe_perawatan}</td>
                      <td className="px-4 py-2.5 text-xs">{formatTanggal(row.tanggal_rencana)}</td>
                      <td className="px-4 py-2.5 text-xs font-bold">{row.status_pelaksanaan}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingSchedule({ ...row }); setShowScheduleForm(false); }} className="px-2 py-1 rounded border text-[10px] font-bold" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>Edit</button>
                          <button onClick={() => handleDeleteSchedule(row.id)} className="px-2 py-1 rounded border text-[10px] font-bold" style={{ borderColor: 'rgba(220,38,38,0.3)', color: 'var(--color-led-red)' }}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: BOM Standar Perawatan ── */}
      {activeTab === 'bom' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              {bomList.length} konfigurasi kebutuhan material standar terdaftar
            </p>
            {!showBOMForm && !editingBOM && (
              <button onClick={() => { setShowBOMForm(true); setEditingBOM(null); setNewBOM({ tipe_perawatan: 'P1', nomor_material: '', qty_standar: 1 }); }}
                className="skeuomorphic-btn px-4 py-1.5 rounded text-xs flex items-center gap-2">
                + Tambah Kebutuhan BOM Baru
              </button>
            )}
          </div>

          {(showBOMForm || editingBOM) && (
            <div className="rounded-xl border overflow-hidden p-5 space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
              <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: 'var(--color-steel-border)' }}>
                <h4 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  {editingBOM ? 'Ubah Konfigurasi BOM' : 'Tambah Kebutuhan BOM Standar Baru'}
                </h4>
                <button onClick={() => { setShowBOMForm(false); setEditingBOM(null); }} style={{ color: 'var(--color-on-surface-variant)' }} className="hover:opacity-75">✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Tipe Perawatan *">
                  <select value={(editingBOM ?? newBOM).tipe_perawatan}
                    onChange={e => {
                      if (editingBOM) setEditingBOM(prev => prev ? { ...prev, tipe_perawatan: e.target.value as TipePerawatan } : prev);
                      else setNewBOM(prev => ({ ...prev, tipe_perawatan: e.target.value as TipePerawatan }));
                    }}
                    className={inputCls} style={inputStyle}>
                    {['P1', 'P3', 'P6', 'P12', 'P24', 'P48'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Pilih Material *">
                  <select value={(editingBOM ?? newBOM).nomor_material}
                    onChange={e => {
                      if (editingBOM) setEditingBOM(prev => prev ? { ...prev, nomor_material: e.target.value } : prev);
                      else setNewBOM(prev => ({ ...prev, nomor_material: e.target.value }));
                    }}
                    className={inputCls} style={inputStyle}>
                    <option value="">-- Pilih Kode Material --</option>
                    {masterMaterials.map(m => <option key={m.nomor_material} value={m.nomor_material}>{m.nomor_material} — {m.nama_material}</option>)}
                  </select>
                </Field>
                <Field label="Quantity Kebutuhan Standar">
                  <input type="number" value={(editingBOM ?? newBOM).qty_standar}
                    onChange={e => {
                      if (editingBOM) setEditingBOM(prev => prev ? { ...prev, qty_standar: +e.target.value } : prev);
                      else setNewBOM(prev => ({ ...prev, qty_standar: +e.target.value }));
                    }}
                    className={inputCls} style={inputStyle} min={1} />
                </Field>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={handleSaveBOM} className="skeuomorphic-btn px-4 py-1.5 rounded text-xs">
                  {editingBOM ? 'Perbarui BOM' : 'Simpan Kebutuhan BOM'}
                </button>
              </div>
            </div>
          )}

          {/* BOM Configurations table */}
          <div className="tactile-card rounded-lg overflow-hidden">
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
              <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Matriks Master Kebutuhan BOM Standar</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse data-table">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                    {['Tipe Perawatan', 'Kode Material', 'Nama Material', 'Satuan', 'Qty Standar Kebutuhan', 'Aksi'].map(h => (
                      <th key={h} className="px-4 py-2 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bomList.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-secondary)' }}>{row.tipe_perawatan}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{row.nomor_material}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{row.nama_material}</td>
                      <td className="px-4 py-2.5 text-xs">{row.satuan}</td>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.qty_standar} unit</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingBOM({ ...row }); setShowBOMForm(false); }} className="px-2 py-1 rounded border text-[10px] font-bold" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>Edit</button>
                          <button onClick={() => handleDeleteBOM(row.id)} className="px-2 py-1 rounded border text-[10px] font-bold" style={{ borderColor: 'rgba(220,38,38,0.3)', color: 'var(--color-led-red)' }}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bomList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                        Belum ada konfigurasi BOM standar. Silakan tambah baru.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-fade-in"
            style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-steel-border)' }}>
            <div className="flex items-start gap-3 mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-led-amber)' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <h3 className="font-bold text-base mb-2" style={{ color: 'var(--color-on-surface)' }}>Konfirmasi Tindakan</h3>
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded border text-sm font-bold transition-all hover:opacity-70"
                style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>Batal</button>
              <button onClick={confirmModal.onConfirm} className="skeuomorphic-btn px-4 py-2 rounded text-sm">Ya, Lanjutkan</button>
            </div>
          </div>
        </div>
      )}

      {/* Info footer */}
      {activeTab === 'parameter' && (
        <div className="rounded-lg p-4 flex items-start gap-3 border" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)', marginTop: '2px', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--color-on-surface)' }}>Catatan Penting untuk Administrator:</p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              <li>• <strong>Metode Rumus Dinamis</strong>: Stok ideal dihitung otomatis dari rata-rata pemakaian 12 bulan × Lead Time + Buffer Stock.</li>
              <li>• <strong>Rencana Penyerapan Bulanan</strong>: Target penyerapan per material dapat dikonfigurasi berbeda setiap bulan hingga 3 tahun ke depan.</li>
              <li>• Seluruh perubahan dicatat otomatis dalam <strong>Log Audit</strong> dengan timestamp dan identitas admin.</li>
            </ul>
          </div>
        </div>
      )}
      {activeTab === 'perawatan' && (
        <div className="rounded-lg p-4 flex items-start gap-3 border" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)', marginTop: '2px', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--color-on-surface)' }}>Catatan Perawatan KRL:</p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              <li>• Admin menginput jadwal pemeliharaan depo secara manual untuk fleksibilitas pengaturan jadwal harian.</li>
              <li>• Data lokomotif dirujuk langsung dari master data `equipment_master` guna menjamin konsistensi nomor rangkaian.</li>
            </ul>
          </div>
        </div>
      )}
      {activeTab === 'bom' && (
        <div className="rounded-lg p-4 flex items-start gap-3 border" style={{ backgroundColor: 'var(--color-surface-container-low)', borderColor: 'var(--color-steel-border)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-on-surface-variant)', marginTop: '2px', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--color-on-surface)' }}>Catatan Manajemen BOM Standar:</p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              <li>• Kebutuhan material standar ini akan dipasang secara otomatis saat jadwal rencana perawatan dibuat di halaman Work Order.</li>
              <li>• Status kecukupan material dihitung secara langsung membandingkan stok gudang saat ini terhadap Qty standar yang dikonfigurasikan di sini.</li>
            </ul>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
