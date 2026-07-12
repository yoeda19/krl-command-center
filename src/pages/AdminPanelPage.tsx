import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import {
  getAdminParameters, saveAdminParameter, getMonthlyPlans, saveMonthlyPlans, addAuditLog,
  getProcurementData, addProcurement, updateProcurement, deleteProcurement,
  getMaintenanceSchedule, addMaintenanceSchedule, updateMaintenanceSchedule, deleteMaintenanceSchedule,
  getWorkOrders, addWorkOrder, updateWorkOrder, deleteWorkOrder,
  getRealSAPTrains, getRealSAPOrders, getMasterMaterials,
  getMaintenanceBomConfig, addMaintenanceBomConfig, updateMaintenanceBomConfig, deleteMaintenanceBomConfig,
  getAllEquipment
} from '../services/supabaseService';
import { formatRupiah, formatTanggal } from '../utils/calculations';
import type {
  AdminParameter, MonthlyPlan, ProcurementItem, ProcurementStatus, RisikoLevel,
  MaintenanceSchedule, WorkOrder, JenisKereta, SeriKereta, PropulsiType, TipePerawatan, PelaksanaanStatus, PemenuhStatus,
  MaintenanceBomConfig
} from '../types';

interface ConfirmModal { message?: string; customContent?: React.ReactNode; onConfirm: () => void; }
type ActiveTab = 'parameter' | 'pengadaan' | 'perawatan' | 'bom';

const PROCUREMENT_STATUSES: ProcurementStatus[] = ['PO Diterbitkan', 'Dalam Pengadaan', 'Dikirim Vendor', 'Dalam Transit', 'Tiba di Gudang'];
const RISIKO_LEVELS: RisikoLevel[] = ['Rendah', 'Sedang', 'Tinggi'];

const statusCfg: Record<ProcurementStatus | 'Tiba di Depo', { color: string }> = {
  'PO Diterbitkan':  { color: '#60a5fa' },
  'Dalam Pengadaan': { color: 'var(--color-led-amber)' },
  'Dikirim Vendor':  { color: '#9ca3af' },
  'Dalam Transit':   { color: '#10b981' },
  'Tiba di Gudang':  { color: 'var(--color-led-green)' },
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
  // ── New Fields ──
  proposed_by: 'Unit Perawatan KRL',
  publish_nod: null,
  rkap_non_rkap: 'RKAP',
  link_document_nod: '',
  category: 'Suku Cadang Utama',
  tech_spec_release_date: null,
  rilis_evaluasi_ctpp: null,
  rilis_rab_logistik: null,
  review_logistic_status: 'SELESAI',
  pr_number: '',
  pr_release_date: null,
  approval_sap_status: 'APPROVED CEP/CE/C2/CAA',
  aanwijzing_date: null,
  vendor_sap: '',
  po_number: '',
  po_release_date: null,
  goods_inspection_status: 'LULUS UJI',
  gr_release_date: null,
  cost: 0
});

const emptySchedule = (): Omit<MaintenanceSchedule, 'id'> => ({
  nomor_rangkaian: '',
  seri_kereta: 'JR205',
  jenis_propulsi: 'VVVF',
  tipe_perawatan: 'P1',
  tanggal_rencana: new Date('2026-07-11').toISOString().split('T')[0],
  status_pelaksanaan: 'Rencana',
  dipo: 'Depo Depok',
});

const emptyWO = (): Omit<WorkOrder, 'id' | 'nomor_rangkaian' | 'nama_material' | 'propulsi' | 'seri_kereta'> => ({
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
  const [selectedPlanWarehouse, setSelectedPlanWarehouse] = useState<string>('GLOBAL');
  const [originalDbPlans, setOriginalDbPlans] = useState<MonthlyPlan[]>([]);
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
  const [newWO, setNewWO] = useState<Omit<WorkOrder, 'id' | 'nomor_rangkaian' | 'nama_material' | 'propulsi' | 'seri_kereta'>>(emptyWO());
  const [editingWO, setEditingWO] = useState<WorkOrder | null>(null);
  const [allEquipment, setAllEquipment] = useState<{ id: string; parent_id: string | null; level: number; name: string }[]>([]);
  const [selectedScheduleForBOM, setSelectedScheduleForBOM] = useState<MaintenanceSchedule | null>(null);

  // BOM Config tab state
  const [bomList, setBomList] = useState<MaintenanceBomConfig[]>([]);
  const [showBOMForm, setShowBOMForm] = useState(false);
  const [activeBOMTypeModal, setActiveBOMTypeModal] = useState<string | null>(null);
  const [newBOM, setNewBOM] = useState<Omit<MaintenanceBomConfig, 'id' | 'nama_material' | 'satuan' | 'current_stock'>>({
    tipe_perawatan: 'P1',
    nomor_material: '',
    qty_standar: 1,
    qty_tc: 0,
    qty_m1: 0,
    qty_m2: 0,
    qty_t6: 0,
    qty_t: 0,
    compat_seri_kereta: '',
    compat_propulsi: ''
  });
  const [editingBOM, setEditingBOM] = useState<MaintenanceBomConfig | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [paramData, matData, eqData] = await Promise.all([
          getAdminParameters(),
          getMasterMaterials(),
          getAllEquipment()
        ]);
        setParams(paramData);
        setMasterMaterials(matData);
        setAllEquipment(eqData);
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
      getMaintenanceBomConfig().then(data => setBomList(data)); // also load BOM config to calculate requirements
    } else if (activeTab === 'bom') {
      getMaintenanceBomConfig().then(data => setBomList(data));
    }
  }, [activeTab]);

  const getRequiredBomQty = (nomor_rangkaian: string, bom: MaintenanceBomConfig) => {
    // Check compatibility first
    const sched = schedules.find(s => s.nomor_rangkaian === nomor_rangkaian);
    if (sched) {
      if (bom.compat_seri_kereta) {
        const list = bom.compat_seri_kereta.split(',').map(x => x.trim()).filter(Boolean);
        if (list.length > 0 && !list.includes(sched.seri_kereta)) {
          return 0; // not compatible
        }
      }
      if (bom.compat_propulsi) {
        const list = bom.compat_propulsi.split(',').map(x => x.trim()).filter(Boolean);
        if (list.length > 0 && !list.includes(sched.jenis_propulsi)) {
          return 0; // not compatible
        }
      }
    }

    const cleanNum = nomor_rangkaian.split('-')[0].trim();
    const lvl1 = allEquipment.find(e => e.level === 1 && (e.name === nomor_rangkaian || e.name === cleanNum));
    if (!lvl1) return bom.qty_standar;
    const children = allEquipment.filter(e => e.level === 2 && e.parent_id === lvl1.id);
    if (children.length === 0) return bom.qty_standar;

    let countTC = 0, countM1 = 0, countM2 = 0, countT6 = 0, countT = 0;
    children.forEach(c => {
      let type = '';
      if (c.name.includes('/')) {
        const parts = c.name.split('/');
        type = parts[parts.length - 1].trim().toUpperCase();
      } else if (c.name.includes('-')) {
        const parts = c.name.split('-');
        type = parts[parts.length - 1].trim().toUpperCase();
      } else {
        type = c.name.trim().toUpperCase();
      }

      if (type.includes('TC')) countTC++;
      else if (type.includes('M1')) countM1++;
      else if (type.includes('M2')) countM2++;
      else if (type.includes('T6')) countT6++;
      else if (type.includes('T')) countT++;
    });

    const qtyTC = bom.qty_tc ?? 0;
    const qtyM1 = bom.qty_m1 ?? 0;
    const qtyM2 = bom.qty_m2 ?? 0;
    const qtyT6 = bom.qty_t6 ?? 0;
    const qtyT = bom.qty_t ?? 0;

    const formulaTotal = (countTC * qtyTC) + (countM1 * qtyM1) + (countM2 * qtyM2) + (countT6 * qtyT6) + (countT * qtyT);
    return formulaTotal === 0 ? bom.qty_standar : formulaTotal;
  };

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
        setNewBOM({ tipe_perawatan: 'P1', nomor_material: '', qty_standar: 1, qty_tc: 0, qty_m1: 0, qty_m2: 0, qty_t6: 0, qty_t: 0 });
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
        const originalItem = bomList.find(b => b.id === id);
        const { error } = await deleteMaintenanceBomConfig(id);
        if (error) showError(error);
        else {
          const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
          const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
          if (originalItem) {
            await addAuditLog({
              nomor_material: originalItem.nomor_material,
              parameter_name: `Hapus BOM ${originalItem.tipe_perawatan}`,
              original_value: `Qty: ${originalItem.qty_standar}`,
              new_value: 'DELETED',
              admin_email: email,
              admin_name: name,
              modul: 'BOM Standar Perawatan'
            });
          }
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
    setSelectedPlanWarehouse('GLOBAL');
    try {
      const plans = await getMonthlyPlans(id);
      setOriginalDbPlans(plans);
      const seeded: MonthlyPlan[] = ['GLOBAL', 'C007', 'C006', 'C009', 'C008', 'C020'].flatMap(wh =>
        [2026, 2027, 2028, 2029, 2030].flatMap(yr =>
          Array.from({ length: 12 }, (_, i) => {
            const mo = i + 1;
            const ex = plans.find(p => p.gudang === wh && p.tahun === yr && p.bulan === mo);
            if (ex) {
              return { nomor_material: id, gudang: wh, tahun: yr, bulan: mo, plan_qty: ex.plan_qty };
            }
            if (wh === 'GLOBAL') {
              return { nomor_material: id, gudang: wh, tahun: yr, bulan: mo, plan_qty: 0 };
            }
            const globalEx = plans.find(p => p.gudang === 'GLOBAL' && p.tahun === yr && p.bulan === mo);
            const defaultQty = globalEx ? Math.round(globalEx.plan_qty / 5) : 0;
            return { nomor_material: id, gudang: wh, tahun: yr, bulan: mo, plan_qty: defaultQty };
          })
        )
      );
      setMonthlyPlans(seeded);
    } catch (err) {
      console.error('Error loading monthly plans:', err);
    }
  };

  const handleSaveRequest = () => {
    if (!editValues) return;

    const activeWarehouses = ['C007', 'C006', 'C009', 'C008', 'C020'];
    const differences: { label: string; oldVal: number; newVal: number; diff: number }[] = [];
    const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    [2026, 2027, 2028, 2029, 2030].forEach(yr => {
      for (let mo = 1; mo <= 12; mo++) {
        // 1. Hitung Old Total Plan
        let oldTotal = 0;
        const origGlobalRecord = originalDbPlans.find(p => (p.gudang === 'GLOBAL' || !p.gudang) && p.tahun === yr && p.bulan === mo);
        const origGlobalQty = origGlobalRecord ? origGlobalRecord.plan_qty : 0;

        activeWarehouses.forEach(wh => {
          const origWhRecord = originalDbPlans.find(p => p.gudang === wh && p.tahun === yr && p.bulan === mo);
          if (origWhRecord) {
            oldTotal += origWhRecord.plan_qty;
          } else {
            oldTotal += Math.round(origGlobalQty / 5);
          }
        });

        // 2. Hitung New Total Plan
        let newTotal = 0;
        const newGlobalRecord = monthlyPlans.find(p => (p.gudang === 'GLOBAL' || !p.gudang) && p.tahun === yr && p.bulan === mo);
        const newGlobalQty = newGlobalRecord ? newGlobalRecord.plan_qty : 0;

        activeWarehouses.forEach(wh => {
          const newWhRecord = monthlyPlans.find(p => p.gudang === wh && p.tahun === yr && p.bulan === mo);
          if (newWhRecord) {
            newTotal += newWhRecord.plan_qty;
          } else {
            newTotal += Math.round(newGlobalQty / 5);
          }
        });

        if (oldTotal !== newTotal) {
          differences.push({
            label: `${MONTH_NAMES[mo - 1]} ${yr}`,
            oldVal: oldTotal,
            newVal: newTotal,
            diff: newTotal - oldTotal
          });
        }
      }
    });

    if (differences.length > 0) {
      setConfirmModal({
        customContent: (
          <div className="text-sm space-y-3">
            <p className="font-bold text-yellow-500">Peringatan: Perubahan rencana penyerapan akan mengubah total plan bulanan sebagai berikut:</p>
            <div className="max-h-48 overflow-y-auto border rounded p-2.5 space-y-1.5" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container-high)' }}>
              {differences.map((d, i) => (
                <div key={i} className="flex justify-between text-xs font-mono border-b pb-1 last:border-0 last:pb-0" style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'var(--color-on-surface)' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{d.label}:</span>
                  <span style={{ color: d.diff > 0 ? 'var(--color-led-green)' : 'var(--color-led-red)', fontWeight: 'bold' }}>
                    {d.diff > 0 ? `+${d.diff} (Bertambah)` : `${d.diff} (Berkurang)`} ({d.oldVal} ➔ {d.newVal})
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Apakah Anda yakin ingin memproses dan menyimpan perubahan rencana penyerapan ini?
            </p>
          </div>
        ),
        onConfirm: handleSave,
      });
    } else {
      setConfirmModal({
        message: `Apakah Anda yakin ingin menyimpan perubahan parameter dan target penyerapan sampai tahun 2030 untuk material ${editValues.nomor_material}? Tindakan ini akan dicatat dalam log audit.`,
        onConfirm: handleSave,
      });
    }
  };

  const handleSave = async () => {
    if (!editValues) return;
    try {
      const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
      const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
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
    setMonthlyPlans(prev => prev.map(p => p.gudang === selectedPlanWarehouse && p.tahun === tahun && p.bulan === bulan ? { ...p, plan_qty: qty } : p));

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
      const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
      const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
      if (editingPO) {
        const originalItem = procureList.find(p => p.id === editingPO.id);
        const changedFields: string[] = [];
        if (originalItem) {
          Object.keys(editingPO).forEach(k => {
            const key = k as keyof ProcurementItem;
            if (String(originalItem[key]) !== String(editingPO[key])) {
              changedFields.push(`${key}: ${originalItem[key]} -> ${editingPO[key]}`);
            }
          });
        }
        const { error } = await updateProcurement(editingPO.id, editingPO);
        if (error) { showError(`Gagal update: ${error}`); return; }
        await addAuditLog({
          nomor_material: editingPO.nomor_material,
          parameter_name: `Update PO #${editingPO.id}`,
          original_value: originalItem ? `PO: ${originalItem.nomor_po}, Status: ${originalItem.status}` : '-',
          new_value: changedFields.join(', ').slice(0, 250) || 'No change',
          admin_email: email,
          admin_name: name,
          modul: 'Progress PO & Transit'
        });
        setProcureList(prev => prev.map(p => p.id === editingPO.id ? editingPO : p));
        setEditingPO(null);
        showSuccess(`Progress PO #${editingPO.id} (${editingPO.nomor_material}) berhasil diperbarui.`);
      } else {
        if (!newPO.nomor_material || !newPO.tanggal_po || !newPO.vendor) {
          showError('Kode material, tanggal PO, dan vendor wajib diisi.'); return;
        }
        const { error } = await addProcurement(newPO as Omit<ProcurementItem, 'id' | 'actual_lead_time' | 'tanggal_penerimaan_barang'>);
        if (error) { showError(`Gagal menyimpan: ${error}`); return; }
        await addAuditLog({
          nomor_material: newPO.nomor_material,
          parameter_name: 'Tambah PO Baru',
          original_value: null,
          new_value: `PO: ${newPO.nomor_po}, Vendor: ${newPO.vendor}, Qty: ${newPO.jumlah_dipesan}`,
          admin_email: email,
          admin_name: name,
          modul: 'Progress PO & Transit'
        });
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
          const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
          const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
          await addAuditLog({
            nomor_material: item.nomor_material,
            parameter_name: `Hapus PO #${item.id}`,
            original_value: `PO: ${item.nomor_po}, Vendor: ${item.vendor}, Qty: ${item.jumlah_dipesan}`,
            new_value: 'DELETED',
            admin_email: email,
            admin_name: name,
            modul: 'Progress PO & Transit'
          });
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
      const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
      const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
      if (editingSchedule) {
        const originalItem = schedules.find(s => s.id === editingSchedule.id);
        const changedFields: string[] = [];
        if (originalItem) {
          Object.keys(editingSchedule).forEach(k => {
            const key = k as keyof MaintenanceSchedule;
            if (String(originalItem[key]) !== String(editingSchedule[key])) {
              changedFields.push(`${key}: ${originalItem[key]} -> ${editingSchedule[key]}`);
            }
          });
        }
        const { error } = await updateMaintenanceSchedule(editingSchedule.id, editingSchedule);
        if (error) { showError(error); return; }
        await addAuditLog({
          nomor_material: null,
          parameter_name: `Update Jadwal #${editingSchedule.id}`,
          original_value: originalItem ? `Rangkaian: ${originalItem.nomor_rangkaian}, Tipe: ${originalItem.tipe_perawatan}, Status: ${originalItem.status_pelaksanaan}` : '-',
          new_value: changedFields.join(', ').slice(0, 250) || 'No change',
          admin_email: email,
          admin_name: name,
          modul: 'Perawatan KRL'
        });
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? editingSchedule : s));
        setEditingSchedule(null);
        showSuccess('Jadwal perawatan berhasil diperbarui.');
      } else {
        const { error } = await addMaintenanceSchedule(newSchedule);
        if (error) { showError(error); return; }
        await addAuditLog({
          nomor_material: null,
          parameter_name: 'Tambah Jadwal Perawatan',
          original_value: null,
          new_value: `Rangkaian: ${newSchedule.nomor_rangkaian}, Tipe: ${newSchedule.tipe_perawatan}, Tgl: ${newSchedule.tanggal_rencana}`,
          admin_email: email,
          admin_name: name,
          modul: 'Perawatan KRL'
        });
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
        const originalItem = schedules.find(s => s.id === id);
        const { error } = await deleteMaintenanceSchedule(id);
        if (error) showError(error);
        else {
          const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
          const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
          await addAuditLog({
            nomor_material: null,
            parameter_name: `Hapus Jadwal #${id}`,
            original_value: originalItem ? `Rangkaian: ${originalItem.nomor_rangkaian}, Tipe: ${originalItem.tipe_perawatan}` : '-',
            new_value: 'DELETED',
            admin_email: email,
            admin_name: name,
            modul: 'Perawatan KRL'
          });
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
      const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
      const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
      if (editingWO) {
        const originalItem = workOrdersList.find(w => w.id === editingWO.id);
        const changedFields: string[] = [];
        if (originalItem) {
          Object.keys(editingWO).forEach(k => {
            const key = k as keyof WorkOrder;
            if (String(originalItem[key]) !== String(editingWO[key])) {
              changedFields.push(`${key}: ${originalItem[key]} -> ${editingWO[key]}`);
            }
          });
        }
        const { error } = await updateWorkOrder(editingWO.id, editingWO);
        if (error) { showError(error); return; }
        await addAuditLog({
          nomor_material: editingWO.nomor_material,
          parameter_name: `Update Work Order #${editingWO.id}`,
          original_value: originalItem ? `WO: ${originalItem.nomor_wo}, Qty: ${originalItem.qty_reservasi}, Status: ${originalItem.status_pemenuhan}` : '-',
          new_value: changedFields.join(', ').slice(0, 250) || 'No change',
          admin_email: email,
          admin_name: name,
          modul: 'Perawatan KRL'
        });
        const fresh = await getWorkOrders();
        setWorkOrdersList(fresh);
        setEditingWO(null);
        showSuccess('Work Order berhasil diperbarui.');
      } else {
        const { error } = await addWorkOrder(newWO);
        if (error) { showError(error); return; }
        await addAuditLog({
          nomor_material: newWO.nomor_material,
          parameter_name: 'Tambah Work Order Baru',
          original_value: null,
          new_value: `WO: ${newWO.nomor_wo}, Qty: ${newWO.qty_reservasi}, Schedule ID: ${newWO.schedule_id}`,
          admin_email: email,
          admin_name: name,
          modul: 'Perawatan KRL'
        });
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
        const originalItem = workOrdersList.find(w => w.id === id);
        const { error } = await deleteWorkOrder(id);
        if (error) showError(error);
        else {
          const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
          const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
          await addAuditLog({
            nomor_material: originalItem?.nomor_material || null,
            parameter_name: `Hapus Work Order #${id}`,
            original_value: originalItem ? `WO: ${originalItem.nomor_wo}, Qty: ${originalItem.qty_reservasi}` : '-',
            new_value: 'DELETED',
            admin_email: email,
            admin_name: name,
            modul: 'Perawatan KRL'
          });
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
      <div className="rounded-2xl border overflow-hidden shadow-xl" style={{ borderColor: 'var(--color-steel-border)' }}>
        {/* Form Title Header */}
        <div className="px-6 py-4 flex justify-between items-center border-b"
          style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <h4 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>{title}</h4>
          <button onClick={() => { setShowAddForm(false); setEditingPO(null); }}
            style={{ color: 'var(--color-on-surface-variant)' }} className="hover:opacity-70 transition-all">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Scrollable Form Area with Neatly Spaced Card Groups */}
        <div className="p-6 space-y-6 max-h-[66vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface-container-low)' }}>
          
          {/* Card 1: Data Material */}
          <div className="p-5 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
            <h5 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5" style={{ color: 'var(--color-secondary)' }}>
              Data Material &amp; Detail Cost
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
              <Field label="Category">
                <input value={poData.category || ''} onChange={e => updatePOField('category', e.target.value)} className={inputCls} style={inputStyle} placeholder="Suku Cadang Utama" />
              </Field>
              <Field label="Qty Dipesan">
                <input type="number" value={poData.jumlah_dipesan || 0} onChange={e => updateNewPOHarga('jumlah_dipesan', +e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Harga Satuan (Rp)">
                <input type="number" value={poData.harga_satuan || 0} onChange={e => updateNewPOHarga('harga_satuan', +e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Total Harga (Rp)">
                <div className="px-3 py-2 rounded border text-sm font-bold h-[38px] flex items-center" style={{ ...inputStyle, color: 'var(--color-secondary)', minHeight: 38 }}>
                  {formatRupiah((poData.jumlah_dipesan ?? 0) * (poData.harga_satuan ?? 0))}
                </div>
              </Field>
              <Field label="Cost Pengadaan (Rp)">
                <input type="number" value={poData.cost || 0} onChange={e => updatePOField('cost', +e.target.value)} className={inputCls} style={inputStyle} placeholder="Nilai Kontrak / Riil" />
              </Field>
            </div>
          </div>

          {/* Card 2: Tahap 1 — Nota Dinas (NOD) */}
          <div className="p-5 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
            <h5 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5" style={{ color: 'var(--color-secondary)' }}>
              Tahap 1 — Nota Dinas (NOD)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              <Field label="Proposed By">
                <input value={poData.proposed_by || ''} onChange={e => updatePOField('proposed_by', e.target.value)} className={inputCls} style={inputStyle} placeholder="Unit Perawatan KRL" />
              </Field>
              <Field label="Nomor NOD">
                <input value={poData.nomor_nod || ''} onChange={e => updatePOField('nomor_nod', e.target.value)} className={inputCls} style={inputStyle} placeholder="NOD-2026-001" />
              </Field>
              <Field label="Publish NOD Date">
                <input type="date" value={poData.publish_nod || ''} onChange={e => updatePOField('publish_nod', e.target.value || null)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="RKAP / NON RKAP">
                <select value={poData.rkap_non_rkap || 'RKAP'} onChange={e => updatePOField('rkap_non_rkap', e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="RKAP">RKAP</option>
                  <option value="NON RKAP">NON RKAP</option>
                </select>
              </Field>
              <Field label="Link Document NOD">
                <input value={poData.link_document_nod || ''} onChange={e => updatePOField('link_document_nod', e.target.value)} className={inputCls} style={inputStyle} placeholder="https://..." />
              </Field>
            </div>
          </div>

          {/* Card 3: Tahap 2 — Spesifikasi Teknis & RAB */}
          <div className="p-5 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
            <h5 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5" style={{ color: 'var(--color-secondary)' }}>
              Tahap 2 — Spesifikasi Teknis &amp; RAB
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Field label="Spektek Release Date">
                <input type="date" value={poData.tech_spec_release_date || ''} onChange={e => updatePOField('tech_spec_release_date', e.target.value || null)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Rilis Dokumen Evaluasi ke CTPP">
                <input type="date" value={poData.rilis_evaluasi_ctpp || ''} onChange={e => updatePOField('rilis_evaluasi_ctpp', e.target.value || null)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Rilis RAB ke Logistik">
                <input type="date" value={poData.rilis_rab_logistik || ''} onChange={e => updatePOField('rilis_rab_logistik', e.target.value || null)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Review Logistik Status">
                <input value={poData.review_logistic_status || ''} onChange={e => updatePOField('review_logistic_status', e.target.value)} className={inputCls} style={inputStyle} placeholder="SELESAI / UNDER REVIEW" />
              </Field>
            </div>
          </div>

          {/* Card 4: Tahap 3 — PR SAP (Permintaan Pembelian) */}
          <div className="p-5 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
            <h5 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5" style={{ color: 'var(--color-secondary)' }}>
              Tahap 3 — Purchase Requisitions SAP (PR)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="PR Number (SAP)">
                <input value={poData.pr_number || ''} onChange={e => updatePOField('pr_number', e.target.value)} className={inputCls} style={inputStyle} placeholder="PR-5000xxxxx" />
              </Field>
              <Field label="PR Release Date (SAP)">
                <input type="date" value={poData.pr_release_date || ''} onChange={e => updatePOField('pr_release_date', e.target.value || null)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Approval SAP (CEP, CE, C2, CAA)">
                <input value={poData.approval_sap_status || ''} onChange={e => updatePOField('approval_sap_status', e.target.value)} className={inputCls} style={inputStyle} placeholder="APPROVED CEP/CE/C2/CAA" />
              </Field>
            </div>
          </div>

          {/* Card 5: Tahap 4 — Aanwijzing & PO SAP */}
          <div className="p-5 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
            <h5 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5" style={{ color: 'var(--color-secondary)' }}>
              Tahap 4 — Aanwijzing &amp; Purchase Order (PO)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Field label="Aanwijzing Date">
                <input type="date" value={poData.aanwijzing_date || ''} onChange={e => updatePOField('aanwijzing_date', e.target.value || null)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Vendor (SAP)">
                <input value={poData.vendor_sap || ''} onChange={e => updatePOField('vendor_sap', e.target.value)} className={inputCls} style={inputStyle} placeholder="Nama Vendor SAP" />
              </Field>
              <Field label="PO Number (SAP)">
                <input value={poData.po_number || ''} onChange={e => updatePOField('po_number', e.target.value)} className={inputCls} style={inputStyle} placeholder="PO-4500xxxxx" />
              </Field>
              <Field label="PO Release Date (SAP)">
                <input type="date" value={poData.po_release_date || ''} onChange={e => updatePOField('po_release_date', e.target.value || null)} className={inputCls} style={inputStyle} />
              </Field>
            </div>
          </div>

          {/* Card 6: Goods Inspection & GR */}
          <div className="p-5 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
            <h5 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5" style={{ color: 'var(--color-secondary)' }}>
              Tahap 5 — Goods Receipt &amp; Inspection (GR)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Field label="Goods Inspection Status">
                <input value={poData.goods_inspection_status || ''} onChange={e => updatePOField('goods_inspection_status', e.target.value)} className={inputCls} style={inputStyle} placeholder="LULUS UJI / SEDANG DIUJI" />
              </Field>
              <Field label="Good Receipt Release Date (SAP)">
                <input type="date" value={poData.gr_release_date || ''} onChange={e => updatePOField('gr_release_date', e.target.value || null)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Sisa Stok Sebelum GR">
                <input type="number" value={poData.sisa_stok || 0} onChange={e => updatePOField('sisa_stok', +e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Rencana Tiba Fisik (Depo)">
                <input type="date" value={poData.tanggal_rencana_pengiriman || ''} onChange={e => updatePOField('tanggal_rencana_pengiriman', e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
            </div>
          </div>

          {/* Card 7: Legacy Fields (Backwards Compatibility) */}
          <div className="p-5 rounded-xl border space-y-4" style={{ borderColor: 'rgba(220,38,38,0.2)', backgroundColor: 'var(--color-surface-container)' }}>
            <h5 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              Data Kompatibilitas Legacy (Wajib untuk Stok Kritis)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Field label="Legacy Vendor"><input value={poData.vendor || ''} onChange={e => { updatePOField('vendor', e.target.value); updatePOField('vendor_sap', e.target.value); }} className={inputCls} style={inputStyle} placeholder="Nama vendor legacy" /></Field>
              <Field label="Legacy Tgl PO"><input type="date" value={poData.tanggal_po || ''} onChange={e => { updatePOField('tanggal_po', e.target.value); updatePOField('po_release_date', e.target.value || null); }} className={inputCls} style={inputStyle} /></Field>
              <Field label="Legacy Nomor PO"><input value={poData.nomor_po || ''} onChange={e => { updatePOField('nomor_po', e.target.value); updatePOField('po_number', e.target.value); }} className={inputCls} style={inputStyle} placeholder="PO legacy" /></Field>
              <Field label="Legacy Tgl GR"><input type="date" value={poData.tanggal_gr || ''} onChange={e => { updatePOField('tanggal_gr', e.target.value || null); updatePOField('gr_release_date', e.target.value || null); }} className={inputCls} style={inputStyle} /></Field>
            </div>
          </div>

          {/* Card 8: Status & Risk */}
          <div className="p-5 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
            <h5 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5" style={{ color: 'var(--color-secondary)' }}>
              Status &amp; Kontrol
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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

        </div>

        {/* Form Actions Footer */}
        <div className="px-6 py-4 flex gap-3 justify-end border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
          <button onClick={() => { setShowAddForm(false); setEditingPO(null); }}
            className="px-5 py-2.5 rounded-lg border text-sm font-bold transition-all hover:opacity-70"
            style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>
            Batal
          </button>
          <button onClick={handleSavePO} disabled={poLoading}
            className="skeuomorphic-btn px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-all">
            {poLoading ? 'Menyimpan...' : (editingPO ? 'Update Progress' : 'Simpan NOD/PO Baru')}
          </button>
        </div>
      </div>
    );
  };

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
              <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Parameter Material</h3>
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
            <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                    <h4 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>Target Penyerapan Bulanan (Sampai 2030)</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>Edit Rencana Untuk:</span>
                      <select
                        value={selectedPlanWarehouse}
                        onChange={e => setSelectedPlanWarehouse(e.target.value)}
                        className="rounded px-2.5 py-1 border text-xs font-bold"
                        style={{ backgroundColor: 'var(--color-surface-container-high)', borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}
                      >
                        <option value="GLOBAL">Global (Seluruh Gudang)</option>
                        <option value="C007">Gudang Depo Depok</option>
                        <option value="C006">Gudang Depo Bukit Duri</option>
                        <option value="C009">Gudang Overhaul Manggarai</option>
                        <option value="C008">Gudang Depo Bogor</option>
                        <option value="C020">Gudang Depo Manggarai</option>
                      </select>
                    </div>
                  </div>
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
                              const plan = monthlyPlans.find(p => p.gudang === selectedPlanWarehouse && p.tahun === yr && p.bulan === mo);
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
              <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Proses Pengadaan</h3>
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
            <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
          </div>
        </>
      )}



      {/* ── TAB: Perawatan KRL ── */}
      {activeTab === 'perawatan' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Rencana Perawatan</h3>
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
                      // Auto detect Seri Kereta
                      let autoSeri: SeriKereta = 'JR205';
                      if (e.target.value) {
                        const nameUpper = e.target.value.toUpperCase();
                        if (nameUpper.includes('CLI125') || nameUpper.includes('125CLI')) autoSeri = 'CLI125';
                        else if (nameUpper.includes('CLI225') || nameUpper.includes('225-')) autoSeri = 'CLI225';
                        else if (nameUpper.includes('JR205') || nameUpper.startsWith('205-') || nameUpper.includes('JR')) autoSeri = 'JR205';
                        else if (nameUpper.includes('METRO')) autoSeri = 'Metro';
                        else if (nameUpper.includes('KFW')) autoSeri = 'KFW';
                        else if (nameUpper.includes('EA203') || nameUpper.includes('203')) autoSeri = 'EA203';
                      }
                      
                      if (editingSchedule) {
                        setEditingSchedule(prev => prev ? { 
                          ...prev, 
                          nomor_rangkaian: e.target.value, 
                          jenis_propulsi: (t?.model_no as PropulsiType) || 'VVVF',
                          seri_kereta: autoSeri
                        } : prev);
                      } else {
                        setNewSchedule(prev => ({ 
                          ...prev, 
                          nomor_rangkaian: e.target.value, 
                          jenis_propulsi: (t?.model_no as PropulsiType) || 'VVVF',
                          seri_kereta: autoSeri
                        }));
                      }
                    }}
                    className={inputCls} style={inputStyle}>
                    <option value="">-- Pilih Rangkaian KRL --</option>
                    {sapTrains.map(t => <option key={t.id} value={t.name}>{t.name} ({t.model_no})</option>)}
                  </select>
                </Field>
                <Field label="Seri Kereta">
                  <select value={(editingSchedule ?? newSchedule).seri_kereta}
                    onChange={e => {
                      if (editingSchedule) setEditingSchedule(prev => prev ? { ...prev, seri_kereta: e.target.value as SeriKereta } : prev);
                      else setNewSchedule(prev => ({ ...prev, seri_kereta: e.target.value as SeriKereta }));
                    }}
                    className={inputCls} style={inputStyle}>
                    {['JR205', 'CLI125', 'CLI225', 'Metro', 'KFW', 'EA203'].map(t => <option key={t}>{t}</option>)}
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
                <Field label="Lokasi Dipo *">
                  <select value={(editingSchedule ?? newSchedule).dipo ?? 'Depo Depok'}
                    onChange={e => {
                      if (editingSchedule) setEditingSchedule(prev => prev ? { ...prev, dipo: e.target.value } : prev);
                      else setNewSchedule(prev => ({ ...prev, dipo: e.target.value }));
                    }}
                    className={inputCls} style={inputStyle}>
                    {['Depo Depok', 'Depo Bukit Duri', 'Depo Bogor', 'Depo Manggarai', 'Overhaul Manggarai'].map(d => <option key={d}>{d}</option>)}
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
                    {['Nomor Rangkaian', 'Seri Kereta', 'Propulsi', 'Tipe Perawatan', 'Tanggal Rencana', 'Status Pelaksanaan', 'Lokasi Dipo', 'Aksi'].map(h => (
                      <th key={h} className="px-4 py-2 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{row.nomor_rangkaian}</td>
                      <td className="px-4 py-2.5 text-xs">{row.seri_kereta}</td>
                      <td className="px-4 py-2.5 text-xs">{row.jenis_propulsi}</td>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--color-secondary)' }}>{row.tipe_perawatan}</td>
                      <td className="px-4 py-2.5 text-xs">{formatTanggal(row.tanggal_rencana)}</td>
                      <td className="px-4 py-2.5 text-xs font-bold">{row.status_pelaksanaan}</td>
                      <td className="px-4 py-2.5 text-xs">{row.dipo || 'Depo Depok'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedScheduleForBOM(row)} className="px-2.5 py-1 rounded text-[10px] font-bold text-white transition-all hover:opacity-85" style={{ backgroundColor: 'var(--color-secondary)' }}>Detail BOM</button>
                          <button onClick={() => { setEditingSchedule({ ...row }); setShowScheduleForm(false); }} className="px-2 py-1 rounded border text-[10px] font-bold" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>Edit</button>
                          <button onClick={() => handleDeleteSchedule(row.id)} className="px-2 py-1 rounded border text-[10px] font-bold" style={{ borderColor: 'rgba(220,38,38,0.3)', color: 'var(--color-led-red)' }}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
          </div>
        </div>
      )}

      {/* ── TAB: BOM Standar Perawatan ── */}
      {activeTab === 'bom' && (() => {
        const dynamicBOMTypes = Array.from(new Set([
          'P1', 'P3', 'P6', 'P12', 'P24', 'P48',
          ...bomList.map(b => b.tipe_perawatan)
        ])).sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.replace(/\D/g, '')) || 0;
          return numA - numB;
        });

        const handleAddBOMType = () => {
          const name = prompt("Masukkan Kode Tipe Perawatan Baru (contoh: P2, P96):");
          if (name) {
            const clean = name.trim().toUpperCase();
            if (clean) {
              setActiveBOMTypeModal(clean);
            }
          }
        };

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                {dynamicBOMTypes.length} tipe perawatan terkonfigurasi di sistem
              </p>
              <button onClick={handleAddBOMType}
                className="skeuomorphic-btn px-4 py-1.5 rounded text-xs flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + Tambah Tipe Perawatan Baru
              </button>
            </div>

            {/* BOM Configurations summary table */}
            <div className="tactile-card rounded-lg overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }}>
                <h3 className="font-bold text-base" style={{ color: 'var(--color-on-surface)' }}>Master BOM</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse data-table">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                      {['Tipe Perawatan', 'Jumlah Suku Cadang', 'Daftar Suku Cadang Terkait', 'Aksi'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dynamicBOMTypes.map(type => {
                      const items = bomList.filter(b => b.tipe_perawatan === type);
                      const materialStr = items.map(i => i.nomor_material).join(', ');
                      return (
                        <tr key={type}>
                          <td className="px-4 py-3 text-sm font-black" style={{ color: 'var(--color-secondary)' }}>{type}</td>
                          <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{items.length} item</td>
                          <td className="px-4 py-3 text-xs max-w-[400px] truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {materialStr || <span className="opacity-40 italic">Belum ada material terdaftar</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => setActiveBOMTypeModal(type)}
                              className="px-3 py-1.5 rounded text-[10px] font-bold text-white transition-all hover:opacity-85"
                              style={{ backgroundColor: 'var(--color-secondary)' }}>
                              Atur BOM
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="h-4 border-t" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-background-metallic)' }} />
            </div>
          </div>
        );
      })()}

      {/* Detail BOM Modal */}
      {selectedScheduleForBOM && (() => {
        const sched = selectedScheduleForBOM;
        const boms = bomList.filter(b => b.tipe_perawatan === sched.tipe_perawatan);
        const cleanNum = sched.nomor_rangkaian.split('-')[0].trim();
        const lvl1 = allEquipment.find(e => e.level === 1 && (e.name === sched.nomor_rangkaian || e.name === cleanNum));
        const children = lvl1 ? allEquipment.filter(e => e.level === 2 && e.parent_id === lvl1.id) : [];

        // Count cars by type
        let countTC = 0, countM1 = 0, countM2 = 0, countT6 = 0, countT = 0;
        children.forEach(c => {
          let type = '';
          if (c.name.includes('/')) {
            const parts = c.name.split('/');
            type = parts[parts.length - 1].trim().toUpperCase();
          } else if (c.name.includes('-')) {
            const parts = c.name.split('-');
            type = parts[parts.length - 1].trim().toUpperCase();
          } else {
            type = c.name.trim().toUpperCase();
          }

          if (type.includes('TC')) countTC++;
          else if (type.includes('M1')) countM1++;
          else if (type.includes('M2')) countM2++;
          else if (type.includes('T6')) countT6++;
          else if (type.includes('T')) countT++;
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-4xl rounded-2xl p-6 shadow-2xl border animate-fade-in flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-steel-border)' }}>
              <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--color-steel-border)' }}>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--color-on-surface)' }}>Detail Kebutuhan BOM Perawatan</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Rangkaian: <b>{sched.nomor_rangkaian}</b> ({sched.seri_kereta}) | Tipe: <b>{sched.tipe_perawatan}</b>
                  </p>
                </div>
                <button onClick={() => setSelectedScheduleForBOM(null)} className="text-gray-400 hover:text-white transition-colors">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              {/* Rincian Kereta Aset */}
              <div className="p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                style={{ backgroundColor: 'var(--color-surface-container)', borderColor: 'var(--color-steel-border)' }}>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-secondary mb-1" style={{ color: 'var(--color-secondary)' }}>Susunan Kereta Aktif</p>
                  <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Terdeteksi <b>{children.length}</b> kereta terdaftar di master asset untuk rangkaian <b>{sched.nomor_rangkaian}</b>.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold font-mono">
                  <span className="px-2.5 py-1 rounded text-blue-400" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>TC: {countTC}</span>
                  <span className="px-2.5 py-1 rounded text-green-400" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>M1: {countM1}</span>
                  <span className="px-2.5 py-1 rounded text-cyan-400" style={{ backgroundColor: 'rgba(6,182,212,0.1)' }}>M2: {countM2}</span>
                  <span className="px-2.5 py-1 rounded text-purple-400" style={{ backgroundColor: 'rgba(168,85,247,0.1)' }}>T6: {countT6}</span>
                  <span className="px-2.5 py-1 rounded text-amber-400" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>T: {countT}</span>
                </div>
              </div>

              {/* Tabel Material */}
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-steel-border)' }}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                      {['Kode Material', 'Nama Material', 'Satuan', 'Rumus Kereta', 'Qty Kebutuhan', 'Stok Gudang', 'Status'].map(h => (
                        <th key={h} className="p-2.5 font-bold uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boms.map(bom => {
                      const reqQty = getRequiredBomQty(sched.nomor_rangkaian, bom);
                      const currentStock = bom.stocks && sched.dipo && (sched.dipo in bom.stocks)
                        ? (bom.stocks[sched.dipo] ?? 0)
                        : (bom.current_stock ?? 0);
                      const isSufficient = currentStock >= reqQty;
                      const hasFormula = bom.qty_tc || bom.qty_m1 || bom.qty_m2 || bom.qty_t6 || bom.qty_t;

                      return (
                        <tr key={bom.id} className="border-b" style={{ borderColor: 'var(--color-steel-border)' }}>
                          <td className="p-2.5 font-bold font-mono" style={{ color: 'var(--color-on-surface)' }}>{bom.nomor_material}</td>
                          <td className="p-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>{bom.nama_material}</td>
                          <td className="p-2.5">{bom.satuan}</td>
                          <td className="p-2.5 font-mono">
                            {hasFormula ? (
                              <span className="text-[10px]" style={{ color: 'var(--color-secondary)' }}>
                                TC:{bom.qty_tc ?? 0} | M1:{bom.qty_m1 ?? 0} | M2:{bom.qty_m2 ?? 0} | T6:{bom.qty_t6 ?? 0} | T:{bom.qty_t ?? 0}
                              </span>
                            ) : (
                              <span className="opacity-40 text-[10px]">— (Flat Rangkaian: {bom.qty_standar})</span>
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{reqQty} unit</td>
                          <td className="p-2.5 font-bold" style={{ color: isSufficient ? 'var(--color-led-green)' : 'var(--color-led-red)' }}>{currentStock} unit</td>
                          <td className="p-2.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: isSufficient ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                                color: isSufficient ? 'var(--color-led-green)' : 'var(--color-led-red)',
                              }}>
                              {isSufficient ? 'Cukup' : 'Defisit Stok'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {boms.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-5 text-center text-xs opacity-50">
                          Tidak ada konfigurasi BOM standar untuk tipe perawatan {sched.tipe_perawatan}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => setSelectedScheduleForBOM(null)} className="skeuomorphic-btn px-5 py-2 rounded text-xs">
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                {confirmModal.customContent ? (
                  confirmModal.customContent
                ) : (
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{confirmModal.message}</p>
                )}
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
              <li>• Data rangkaian dirujuk langsung dari database guna menjamin konsistensi nomor rangkaian.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal Configure BOM Suku Cadang Per Tipe Perawatan */}
      {activeBOMTypeModal && (() => {
        const type = activeBOMTypeModal;
        const items = bomList.filter(b => b.tipe_perawatan === type);
        const selectedSeriesList = (editingBOM ?? newBOM).compat_seri_kereta
          ? (editingBOM ?? newBOM).compat_seri_kereta!.split(',').map(s => s.trim()).filter(Boolean)
          : [];

        const selectedPropulsionList = (editingBOM ?? newBOM).compat_propulsi
          ? (editingBOM ?? newBOM).compat_propulsi!.split(',').map(p => p.trim()).filter(Boolean)
          : [];

        const toggleSeries = (seriesName: string) => {
          let newList: string[];
          if (selectedSeriesList.includes(seriesName)) {
            newList = selectedSeriesList.filter(s => s !== seriesName);
          } else {
            newList = [...selectedSeriesList, seriesName];
          }
          const strVal = newList.join(',');
          if (editingBOM) {
            setEditingBOM(prev => prev ? { ...prev, compat_seri_kereta: strVal } : null);
          } else {
            setNewBOM(prev => ({ ...prev, compat_seri_kereta: strVal }));
          }
        };

        const togglePropulsion = (propName: string) => {
          let newList: string[];
          if (selectedPropulsionList.includes(propName)) {
            newList = selectedPropulsionList.filter(p => p !== propName);
          } else {
            newList = [...selectedPropulsionList, propName];
          }
          const strVal = newList.join(',');
          if (editingBOM) {
            setEditingBOM(prev => prev ? { ...prev, compat_propulsi: strVal } : null);
          } else {
            setNewBOM(prev => ({ ...prev, compat_propulsi: strVal }));
          }
        };

        // Handle saving BOM inside modal
        const handleSaveBOMModal = async () => {
          const payload = {
            ...newBOM,
            tipe_perawatan: type as TipePerawatan
          };
          if (!payload.nomor_material) {
            showError("Pilih material terlebih dahulu.");
            return;
          }
          try {
            const email = localStorage.getItem('krl_admin_email') || 'dev@prisma.co.id';
            const name = localStorage.getItem('krl_admin_name') || 'Dev Admin';
            if (editingBOM) {
              const originalItem = bomList.find(b => b.id === editingBOM.id);
              const changedFields: string[] = [];
              if (originalItem) {
                Object.keys(editingBOM).forEach(k => {
                  const key = k as keyof MaintenanceBomConfig;
                  if (String(originalItem[key]) !== String(editingBOM[key])) {
                    changedFields.push(`${key}: ${originalItem[key]} -> ${editingBOM[key]}`);
                  }
                });
              }
              const { error } = await updateMaintenanceBomConfig(editingBOM.id, editingBOM);
              if (error) { showError(error); return; }
              await addAuditLog({
                nomor_material: editingBOM.nomor_material,
                parameter_name: `Update BOM ${type}`,
                original_value: originalItem ? `Qty: ${originalItem.qty_standar}, TC:${originalItem.qty_tc ?? 0}, M1:${originalItem.qty_m1 ?? 0}, M2:${originalItem.qty_m2 ?? 0}` : '-',
                new_value: changedFields.join(', ').slice(0, 250) || 'No change',
                admin_email: email,
                admin_name: name,
                modul: 'BOM Standar Perawatan'
              });
              const fresh = await getMaintenanceBomConfig();
              setBomList(fresh);
              setEditingBOM(null);
              showSuccess('BOM configuration updated.');
            } else {
              const { error } = await addMaintenanceBomConfig(payload);
              if (error) { showError(error); return; }
              await addAuditLog({
                nomor_material: payload.nomor_material,
                parameter_name: `Tambah BOM ${type}`,
                original_value: null,
                new_value: `Qty: ${payload.qty_standar}, TC:${payload.qty_tc ?? 0}, M1:${payload.qty_m1 ?? 0}, M2:${payload.qty_m2 ?? 0}, T6:${payload.qty_t6 ?? 0}, T:${payload.qty_t ?? 0}`,
                admin_email: email,
                admin_name: name,
                modul: 'BOM Standar Perawatan'
              });
              const fresh = await getMaintenanceBomConfig();
              setBomList(fresh);
              setNewBOM({ tipe_perawatan: type as TipePerawatan, nomor_material: '', qty_standar: 1, qty_tc: 0, qty_m1: 0, qty_m2: 0, qty_t6: 0, qty_t: 0, compat_seri_kereta: '', compat_propulsi: '' });
              showSuccess('Material added to BOM.');
            }
          } catch (err) {
            console.error(err);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-5xl rounded-2xl p-6 shadow-2xl border animate-fade-in flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-steel-border)' }}>
              
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--color-steel-border)' }}>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--color-on-surface)' }}>Atur Suku Cadang BOM — Perawatan {type}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Kelola daftar material standar dan rumus gerbong untuk tipe perawatan <b>{type}</b>
                  </p>
                </div>
                <button onClick={() => { setActiveBOMTypeModal(null); setEditingBOM(null); }} className="text-gray-400 hover:text-white transition-colors">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              {/* Form Input Suku Cadang */}
              <div className="p-4 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-steel-border)', backgroundColor: 'var(--color-surface-container)' }}>
                <p className="text-xs font-bold text-secondary" style={{ color: 'var(--color-secondary)' }}>
                  {editingBOM ? 'Ubah Material Terdaftar' : 'Tambah Material Baru ke Perawatan ' + type}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Pilih Material *">
                    {editingBOM ? (
                      <div className="px-3 py-2 rounded border text-sm font-bold font-mono" style={inputStyle}>
                        {editingBOM.nomor_material} — {editingBOM.nama_material}
                      </div>
                    ) : (
                      <select value={newBOM.nomor_material}
                        onChange={e => setNewBOM(prev => ({ ...prev, nomor_material: e.target.value }))}
                        className={inputCls} style={inputStyle}>
                        <option value="">-- Pilih Kode Material --</option>
                        {masterMaterials.map(m => <option key={m.nomor_material} value={m.nomor_material}>{m.nomor_material} — {m.nama_material}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label="Qty Standar Rangkaian">
                    <input type="number" value={(editingBOM ?? newBOM).qty_standar}
                      onChange={e => {
                        const val = Math.max(1, +e.target.value);
                        if (editingBOM) setEditingBOM(prev => prev ? { ...prev, qty_standar: val } : prev);
                        else setNewBOM(prev => ({ ...prev, qty_standar: val }));
                      }}
                      className={inputCls} style={inputStyle} min={1} />
                  </Field>
                </div>

                {/* Formula Kereta */}
                <div className="border-t pt-3" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <p className="text-[11px] font-bold mb-2 opacity-80" style={{ color: 'var(--color-on-surface)' }}>Rumus Dinamis per Kereta (TC / M1 / M2 / T6 / T) — Opsional</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { key: 'qty_tc', label: 'Qty TC' },
                      { key: 'qty_m1', label: 'Qty M1' },
                      { key: 'qty_m2', label: 'Qty M2' },
                      { key: 'qty_t6', label: 'Qty T6' },
                      { key: 'qty_t',  label: 'Qty T' },
                    ].map(f => (
                      <Field key={f.key} label={f.label}>
                        <input type="number" 
                          value={(() => {
                            const valObj = (editingBOM ?? newBOM);
                            const val = valObj[f.key as keyof typeof valObj];
                            return typeof val === 'number' ? val : 0;
                          })()}
                          onChange={e => {
                            const val = Math.max(0, +e.target.value);
                            if (editingBOM) setEditingBOM(prev => prev ? { ...prev, [f.key]: val } : prev);
                            else setNewBOM(prev => ({ ...prev, [f.key]: val }));
                          }}
                          className={inputCls} style={inputStyle} min={0} />
                      </Field>
                    ))}
                  </div>
                  <p className="text-[10px] mt-2 opacity-50 italic">
                    *Isi 0 jika kereta bersangkutan tidak menggunakan material ini. Jika semua 0, sistem menggunakan Qty Standar Rangkaian.
                  </p>
                </div>

                {/* Kompatibilitas Seri & Propulsi */}
                <div className="border-t pt-3" style={{ borderColor: 'var(--color-steel-border)' }}>
                  <p className="text-[11px] font-bold mb-2 opacity-80" style={{ color: 'var(--color-on-surface)' }}>
                    Kompatibilitas Target (Kosongkan jika bisa untuk SEMUA / Universal)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] block mb-1 opacity-70">Seri Kereta:</label>
                      <div className="flex flex-wrap gap-3">
                        {['JR205', 'CLI125', 'CLI225', 'Metro', 'KFW', 'EA203'].map(s => {
                          const isChecked = selectedSeriesList.includes(s);
                          return (
                            <label key={s} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                              <input type="checkbox" checked={isChecked} onChange={() => toggleSeries(s)} />
                              <span>{s}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] block mb-1 opacity-70">Propulsi:</label>
                      <div className="flex flex-wrap gap-3">
                        {['VVVF', 'Rheostatic'].map(p => {
                          const isChecked = selectedPropulsionList.includes(p);
                          return (
                            <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                              <input type="checkbox" checked={isChecked} onChange={() => togglePropulsion(p)} />
                              <span>{p}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {editingBOM && (
                    <button onClick={() => setEditingBOM(null)} className="px-4 py-1.5 rounded border text-xs font-bold" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface-variant)' }}>
                      Batal Edit
                    </button>
                  )}
                  <button onClick={handleSaveBOMModal} className="skeuomorphic-btn px-5 py-1.5 rounded text-xs">
                    {editingBOM ? 'Simpan Perubahan' : 'Tambah Suku Cadang'}
                  </button>
                </div>
              </div>

              {/* Tabel Material Aktif */}
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-steel-border)' }}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-primary-container)' }}>
                      {['Kode Material', 'Nama Material', 'Satuan', 'Qty Standar Rangkaian', 'Rumus Gerbong (TC/M1/M2/T6/T)', 'Kompatibilitas', 'Aksi'].map(h => (
                        <th key={h} className="p-2.5 font-bold uppercase tracking-wider" style={{ color: 'var(--color-on-primary-container)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(bom => {
                      const hasFormula = bom.qty_tc || bom.qty_m1 || bom.qty_m2 || bom.qty_t6 || bom.qty_t;
                      const hasCompat = bom.compat_seri_kereta || bom.compat_propulsi;
                      return (
                        <tr key={bom.id} className="border-b" style={{ borderColor: 'var(--color-steel-border)' }}>
                          <td className="p-2.5 font-bold font-mono" style={{ color: 'var(--color-on-surface)' }}>{bom.nomor_material}</td>
                          <td className="p-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>{bom.nama_material}</td>
                          <td className="p-2.5">{bom.satuan}</td>
                          <td className="p-2.5 font-bold" style={{ color: 'var(--color-on-surface)' }}>{bom.qty_standar} unit</td>
                          <td className="p-2.5 font-mono">
                            {hasFormula ? (
                              <span className="text-[10px]" style={{ color: 'var(--color-secondary)' }}>
                                TC:{bom.qty_tc ?? 0} | M1:{bom.qty_m1 ?? 0} | M2:{bom.qty_m2 ?? 0} | T6:{bom.qty_t6 ?? 0} | T:{bom.qty_t ?? 0}
                              </span>
                            ) : (
                              <span className="opacity-40 text-[10px]">— (Flat Rangkaian)</span>
                            )}
                          </td>
                          <td className="p-2.5 text-[10px] font-mono">
                            {hasCompat ? (
                              <div className="flex flex-col gap-0.5 text-blue-400">
                                {bom.compat_seri_kereta && <div>Seri: {bom.compat_seri_kereta}</div>}
                                {bom.compat_propulsi && <div>Propulsi: {bom.compat_propulsi}</div>}
                              </div>
                            ) : (
                              <span className="opacity-40">Semua (Universal)</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="flex gap-2">
                              <button onClick={() => setEditingBOM({ ...bom })} className="px-2 py-1 rounded border text-[10px] font-bold" style={{ borderColor: 'var(--color-steel-border)', color: 'var(--color-on-surface)' }}>Edit</button>
                              <button onClick={() => handleDeleteBOM(bom.id)} className="px-2 py-1 rounded border text-[10px] font-bold" style={{ borderColor: 'rgba(220,38,38,0.3)', color: 'var(--color-led-red)' }}>Hapus</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-5 text-center text-xs opacity-50">
                          Belum ada suku cadang terdaftar untuk tipe perawatan {type}. Silakan tambah di atas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-1">
                <button onClick={() => { setActiveBOMTypeModal(null); setEditingBOM(null); }} className="skeuomorphic-btn px-5 py-2 rounded text-xs">
                  Selesai &amp; Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
