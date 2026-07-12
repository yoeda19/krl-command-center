const url = 'https://mtdvafucrlcbcdewhryy.supabase.co/rest/v1/master_materials?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(res => res.json())
.then(materials => {
  const mapped = materials.map(m => ({
    nomor_material: m.nomor_material,
    nama_material: m.nama_material,
    stocks: {
      'Gudang Pusat': Number(m.pst || 0),
      'Depo Depok': Number(m.dpk || 0) + Number(m.dpkt || 0),
      'Depo Bukit Duri': Number(m.dbkd || 0) + Number(m.dbkdt || 0),
      'Overhaul Manggarai': Number(m.omri || 0) + Number(m.omrit || 0),
      'Depo Bogor': Number(m.dbgr || 0) + Number(m.dbgrt || 0),
      'Depo Manggarai': Number(m.dmri || 0) + Number(m.dmrit || 0),
    }
  }));
  console.log('MAPPED STOCK EXAMPLES:', mapped);
})
.catch(err => console.error(err));
