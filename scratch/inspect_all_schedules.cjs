const http = require('https');

const supabaseUrl = 'https://mtdvafucrlcbcdewhryy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

function request(path, headers = {}) {
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
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchAll() {
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
  console.log(`Total rows in database: ${allRows.length}`);

  // Inspect dipos and types
  const dipos = new Set(allRows.map(r => r.dipo));
  console.log('Unique Dipos:', Array.from(dipos));

  const types = new Set(allRows.map(r => r.tipe_perawatan));
  console.log('Unique Tipe Perawatan:', Array.from(types));

  // Check P24 & P48 dipo distribution
  const p24p48 = allRows.filter(r => r.tipe_perawatan && (r.tipe_perawatan.startsWith('P24') || r.tipe_perawatan.startsWith('P48')));
  console.log(`P24/P48 count: ${p24p48.length}`);
  const p24p48Dipos = {};
  p24p48.forEach(r => {
    p24p48Dipos[r.dipo] = (p24p48Dipos[r.dipo] || 0) + 1;
  });
  console.log('P24/P48 dipos:', p24p48Dipos);
}

fetchAll();
