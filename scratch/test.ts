import { getCriticalStockData } from '../src/services/supabaseService';

async function main() {
  try {
    const data = await getCriticalStockData();
    const item = data.find(d => d.nomor_material === '6000373');
    if (!item) {
      console.log('Item not found');
      return;
    }
    
    // We want to calculate the runRateMultiplier exactly how we did in CriticalStockPage.tsx
    let sumActualsForRate = 0;
    let sumPlansForRate = 0;
    
    for (let yr = 2026; yr <= 2026; yr++) {
      for (let mo = 1; mo <= 7; mo++) {
         const hist = item.all_history?.filter(h => {
           if (!h.tanggal) return false;
           const dateObj = new Date(h.tanggal);
           return dateObj.getFullYear() === yr && (dateObj.getMonth() + 1) === mo;
         }) || [];
         const sumQty = hist.reduce((sum, hItem) => sum + (hItem.qty || 0), 0);
         sumActualsForRate += sumQty;

         const p = item.all_plans?.find(pl => pl.tahun === yr && pl.bulan === mo);
         sumPlansForRate += (p ? p.plan_qty : 0);
      }
    }
    let runRateMultiplier = 1;
    if (sumPlansForRate > 0) {
      runRateMultiplier = sumActualsForRate / sumPlansForRate;
    }

    console.log('=== DATA UNTUK 6000373 ===');
    console.log(`Current Stock (Juli): ${item.current_stock}`);
    console.log(`Total Rencana (Jan-Jul): ${sumPlansForRate}`);
    console.log(`Total Aktual (Jan-Jul): ${sumActualsForRate}`);
    console.log(`Run Rate Multiplier (Aktual / Rencana): ${runRateMultiplier}`);
    console.log('=== PROYEKSI ===');
    
    let remainingStock = item.current_stock;
    for (let mo = 7; mo <= 12; mo++) {
      const p = item.all_plans?.find(pl => pl.tahun === 2026 && pl.bulan === mo);
      const planVal = p ? p.plan_qty : 0;
      const adjustedPlan = Math.round(planVal * runRateMultiplier);
      
      let actualThisMonth = 0;
      if (mo === 7) {
        // deduct actuals in current month
        const hist = item.all_history?.filter(h => {
           if (!h.tanggal) return false;
           const dateObj = new Date(h.tanggal);
           return dateObj.getFullYear() === 2026 && (dateObj.getMonth() + 1) === 7;
         }) || [];
         actualThisMonth = hist.reduce((sum, hItem) => sum + (hItem.qty || 0), 0);
      }
      
      const toDeduct = Math.max(0, adjustedPlan - actualThisMonth);
      remainingStock -= toDeduct;
      
      console.log(`Bulan ${mo}: Plan Awal=${planVal}, Plan Terkoreksi=${adjustedPlan}, Pengurangan=${toDeduct}, Sisa Stok Akhir=${remainingStock}`);
    }

  } catch (err) {
    console.error(err);
  }
}

main();
