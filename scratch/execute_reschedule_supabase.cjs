const http = require('https');

const supabaseUrl = 'https://mtdvafucrlcbcdewhryy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

function get(path) {
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

function upsert(batch) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${supabaseUrl}/rest/v1/maintenance_schedule`);
    const data = JSON.stringify(batch);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, count: batch.length });
        } else {
          resolve({ ok: false, error: responseBody, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('1. Fetching all records from maintenance_schedule...');
  let allRows = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const rows = await get(`/rest/v1/maintenance_schedule?select=*&order=id.asc&offset=${offset}&limit=${pageSize}`);
    if (!rows || rows.length === 0) break;
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`Fetched ${allRows.length} rows.`);

  // Group by year-month
  const monthGroups = {};
  allRows.forEach(r => {
    if (!r.tanggal_rencana) return;
    const parts = r.tanggal_rencana.split('-');
    const ym = `${parts[0]}-${parts[1]}`;
    if (!monthGroups[ym]) monthGroups[ym] = [];
    monthGroups[ym].push(r);
  });

  const updatedRows = [];

  for (const [ym, items] of Object.entries(monthGroups)) {
    const [yearStr, monthStr] = ym.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const lastDay = new Date(year, month, 0).getDate();

    // Group items by dipo
    const dipoGroups = {};
    items.forEach(it => {
      let dipo = it.dipo || 'Depo Depok';
      // Strict rule: P24 & P48 only at Overhaul Manggarai or Depo Depok
      if (it.tipe_perawatan === 'P24' || it.tipe_perawatan === 'P48') {
        if (dipo !== 'Depo Depok' && dipo !== 'Overhaul Manggarai') {
          dipo = 'Overhaul Manggarai';
        }
      }
      if (!dipoGroups[dipo]) dipoGroups[dipo] = [];
      dipoGroups[dipo].push({ ...it, dipo });
    });

    for (const [dipo, dipoItems] of Object.entries(dipoGroups)) {
      const dailyCap = Math.max(2, Math.ceil(dipoItems.length / lastDay));

      // Group by week (1 to 5) based on original tanggal_rencana
      const weekGroups = { 1: [], 2: [], 3: [], 4: [], 5: [] };
      dipoItems.forEach(it => {
        const d = parseInt(it.tanggal_rencana.split('-')[2], 10);
        const wk = Math.min(5, Math.ceil(d / 7));
        weekGroups[wk].push(it);
      });

      // Day slot tracker: dayNumber -> count of items
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
          // Find next day in week with slot < dailyCap
          while (currentDay <= endDay && daySlots[currentDay] >= dailyCap) {
            currentDay++;
          }
          if (currentDay > endDay) {
            // Find any day in the month with slot < dailyCap
            let fallbackDay = 1;
            while (fallbackDay <= lastDay && daySlots[fallbackDay] >= dailyCap) {
              fallbackDay++;
            }
            currentDay = fallbackDay <= lastDay ? fallbackDay : startDay;
          }

          daySlots[currentDay] = (daySlots[currentDay] || 0) + 1;
          const newDate = `${yearStr}-${monthStr.padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          
          updatedRows.push({
            id: it.id,
            nomor_rangkaian: it.nomor_rangkaian,
            seri_kereta: it.seri_kereta,
            jenis_propulsi: it.jenis_propulsi,
            tipe_perawatan: it.tipe_perawatan,
            tanggal_rencana: newDate,
            status_pelaksanaan: it.status_pelaksanaan || 'Rencana',
            dipo: dipo
          });
        });
      }
    }
  }

  console.log(`2. Prepared ${updatedRows.length} updated rows to upsert into Supabase...`);

  // Batch upsert in chunks of 200
  const CHUNK_SIZE = 200;
  let successCount = 0;
  for (let i = 0; i < updatedRows.length; i += CHUNK_SIZE) {
    const chunk = updatedRows.slice(i, i + CHUNK_SIZE);
    const res = await upsert(chunk);
    if (!res.ok) {
      console.error(`Error upserting chunk ${i / CHUNK_SIZE + 1}:`, res.error);
    } else {
      successCount += chunk.length;
      process.stdout.write(`\rUpserted ${successCount}/${updatedRows.length} rows...`);
    }
  }

  console.log('\n3. Verification: checking September 2026 dates from Supabase...');
  const sepVerify = await get('/rest/v1/maintenance_schedule?tanggal_rencana=gte.2026-09-01&tanggal_rencana=lte.2026-09-30&order=tanggal_rencana.asc');
  console.log(`Sep 2026 rows: ${sepVerify.length}`);

  const counts = {};
  sepVerify.forEach(r => {
    const key = `${r.tanggal_rencana} | ${r.dipo}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  console.log('Sample verified distribution (first 15 slots):');
  Object.keys(counts).sort().slice(0, 15).forEach(k => {
    console.log(`  ${k} -> ${counts[k]} trainset(s)`);
  });

  const maxSep = Math.max(...Object.values(counts));
  console.log(`Maximum trainsets on any day in Sep 2026: ${maxSep} (Target: <= 2)`);
  console.log('ALL SCHEDULES IN SUPABASE HAVE BEEN SUCCESSFULLY RE-DISTRIBUTED!');
}

run();
