const http = require('https');

const supabaseUrl = 'https://mtdvafucrlcbcdewhryy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

function request(path) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${supabaseUrl}${path}`);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function simulate() {
  let allRows = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const rows = await request(`/rest/v1/maintenance_schedule?select=*&order=id.asc&offset=${offset}&limit=${pageSize}`);
    if (!rows || rows.length === 0) break;
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`Fetched total rows: ${allRows.length}`);

  // Group by year-month
  const monthGroups = {};
  allRows.forEach(r => {
    if (!r.tanggal_rencana) return;
    const parts = r.tanggal_rencana.split('-');
    const ym = `${parts[0]}-${parts[1]}`;
    if (!monthGroups[ym]) monthGroups[ym] = [];
    monthGroups[ym].push(r);
  });

  const updates = [];
  let violationCount = 0;

  for (const [ym, items] of Object.entries(monthGroups)) {
    const [yearStr, monthStr] = ym.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed
    const lastDay = new Date(year, month, 0).getDate();

    // Group items by dipo
    const dipoGroups = {};
    items.forEach(it => {
      let dipo = it.dipo || 'Depo Depok';
      // Rule: P24 & P48 must be Overhaul Manggarai or Depo Depok
      if (it.tipe_perawatan === 'P24' || it.tipe_perawatan === 'P48') {
        if (dipo !== 'Depo Depok' && dipo !== 'Overhaul Manggarai') {
          dipo = 'Overhaul Manggarai';
        }
      }
      if (!dipoGroups[dipo]) dipoGroups[dipo] = [];
      dipoGroups[dipo].push({ ...it, dipo });
    });

    for (const [dipo, dipoItems] of Object.entries(dipoGroups)) {
      // Group by week (1 to 5) based on original tanggal_rencana
      const weekGroups = { 1: [], 2: [], 3: [], 4: [], 5: [] };
      dipoItems.forEach(it => {
        const d = parseInt(it.tanggal_rencana.split('-')[2], 10);
        const wk = Math.min(5, Math.ceil(d / 7));
        weekGroups[wk].push(it);
      });

      // Day slot tracker: dayNumber -> count of items (max 2)
      const daySlots = {};
      for (let day = 1; day <= lastDay; day++) daySlots[day] = 0;

      // Assign days for each week
      for (let wk = 1; wk <= 5; wk++) {
        const startDay = (wk - 1) * 7 + 1;
        const endDay = Math.min(lastDay, wk * 7);
        if (startDay > lastDay) continue;

        const wkItems = weekGroups[wk];
        let currentDay = startDay;

        wkItems.forEach(it => {
          // Find next day in month with slots < 2, prioritizing current week
          while (currentDay <= lastDay && daySlots[currentDay] >= 2) {
            currentDay++;
          }
          if (currentDay > lastDay) {
            // Fallback: find any day in the month from day 1 with slot < 2
            let fallbackDay = 1;
            while (fallbackDay <= lastDay && daySlots[fallbackDay] >= 2) {
              fallbackDay++;
            }
            if (fallbackDay <= lastDay) {
              currentDay = fallbackDay;
            } else {
              console.error(`Month ${ym} Dipo ${dipo} exceeded month capacity!`);
              violationCount++;
            }
          }

          daySlots[currentDay] = (daySlots[currentDay] || 0) + 1;
          const newDate = `${yearStr}-${monthStr.padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          updates.push({
            id: it.id,
            old_date: it.tanggal_rencana,
            new_date: newDate,
            old_dipo: it.dipo,
            new_dipo: dipo,
            nomor_rangkaian: it.nomor_rangkaian,
            tipe_perawatan: it.tipe_perawatan
          });
        });
      }
    }
  }

  console.log(`Simulation complete! Total updates to apply: ${updates.length}`);
  console.log(`Capacity violations: ${violationCount}`);

  // Check sample September 2026 new dates
  const sepUpdates = updates.filter(u => u.new_date.startsWith('2026-09'));
  console.log(`September 2026 updates: ${sepUpdates.length}`);
  const sepDaily = {};
  sepUpdates.forEach(u => {
    const key = `${u.new_date} | ${u.new_dipo}`;
    sepDaily[key] = (sepDaily[key] || 0) + 1;
  });
  console.log('Sample Sep 2026 daily distributions:');
  const sortedKeys = Object.keys(sepDaily).sort();
  sortedKeys.slice(0, 25).forEach(k => {
    console.log(`  ${k} -> ${sepDaily[k]} trainsets`);
  });

  const maxOnAnyDay = Math.max(...Object.values(sepDaily));
  console.log(`Maximum trainsets on ANY day for ANY dipo in Sep 2026: ${maxOnAnyDay} (MUST BE <= 2)`);
}

simulate();
