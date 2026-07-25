const { createClient } = require('@supabase/supabase-js');

const url = 'https://mtdvafucrlcbcdewhryy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

const supabase = createClient(url, key);

async function check() {
  const { data: mat } = await supabase.from('master_materials').select('*').eq('nomor_material', '6000373').single();
  const { data: config } = await supabase.from('ideal_stock_configurations').select('*').eq('nomor_material', '6000373').single();
  const { data: param } = await supabase.from('procurement_progress').select('*').eq('nomor_material', '6000373').single();
  const { data: plans } = await supabase.from('monthly_absorption_plans').select('*').eq('nomor_material', '6000373');

  const totalStock = Number(mat.pst || 0) + Number(mat.dpk || 0) + Number(mat.dpkt || 0) + Number(mat.dbkd || 0) + Number(mat.dbkdt || 0) + Number(mat.omri || 0) + Number(mat.omrit || 0) + Number(mat.dbgr || 0) + Number(mat.dbgrt || 0) + Number(mat.dmri || 0) + Number(mat.dmrit || 0);

  const leadTimeDays = config?.plan_lead_time || param?.plan_lead_time || 90;
  const leadTimeMonths = Math.round((leadTimeDays / 30.44) * 10) / 10;
  const idealQty = config?.ideal_qty_manual || 0;
  const safetyStockManual = config?.safety_stock_manual || Math.round(idealQty * 0.3);

  console.log('=== MATERIAL 6000373 SUMMARY ===');
  console.log(`Nama Material: ${mat.nama_material}`);
  console.log(`Total Stok Fisik: ${totalStock} ${mat.satuan}`);
  console.log(`Stok Ideal: ${idealQty} ${mat.satuan}`);
  console.log(`Safety Stock: ${safetyStockManual} ${mat.satuan}`);
  console.log(`Lead Time: ${leadTimeDays} Hari (~${leadTimeMonths} Bulan)`);
  console.log(`PO Arrival Plan: ${param?.tanggal_rencana_pengiriman || 'Tidak Ada PO'}`);

  // Simulasi proyeksi saldo stok bulanan dari Juli 2026 ke depan
  const BULAN_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  let currentBal = totalStock;
  let ropMonth = null;
  let exhaustMonth = null;

  console.log('\n=== PROYEKSI SALDO KULMULATIF ===');
  for (let yr = 2026; yr <= 2027; yr++) {
    const startMo = yr === 2026 ? 7 : 1;
    for (let mo = startMo; mo <= 12; mo++) {
      const p = plans?.find(pl => pl.tahun === yr && pl.bulan === mo && (pl.gudang === 'GLOBAL' || !pl.gudang));
      const planQty = p ? p.plan_qty : 50;
      currentBal -= planQty;
      const monthLabel = `${BULAN_NAMES[mo - 1]} '${String(yr).slice(2)}`;

      if (currentBal <= safetyStockManual && !ropMonth) {
        // ROP calculation: Lead Time months prior to safety stock breach
        const ropMoIdx = Math.max(1, mo - Math.round(leadTimeMonths));
        ropMonth = `${BULAN_NAMES[ropMoIdx - 1]} '${String(yr).slice(2)}`;
      }

      if (currentBal <= 0 && !exhaustMonth) {
        exhaustMonth = monthLabel;
        currentBal = 0;
      }

      console.log(`${monthLabel}: Consumed=${planQty}, Sisa Saldo=${currentBal}`);
    }
  }

  console.log('\n=== PEMETAAN HARI INI & ROP ===');
  console.log(`Bulan Hari Ini: Juli '26`);
  console.log(`Bulan ROP (Batas Order): ${ropMonth || 'Stok Melimpah (Belum Butuh ROP)'}`);
  console.log(`Bulan Stok Habis: ${exhaustMonth || 'Stok Mencukupi'}`);
}

check();
