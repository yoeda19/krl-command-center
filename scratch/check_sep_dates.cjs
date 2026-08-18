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

async function inspectMonthDates() {
  const sep = await request('/rest/v1/maintenance_schedule?tanggal_rencana=gte.2026-09-01&tanggal_rencana=lte.2026-09-30&order=tanggal_rencana.asc');
  console.log('September 2026 rows:', sep.length);

  const dateCounts = {};
  sep.forEach(r => {
    const key = `${r.tanggal_rencana} | ${r.dipo}`;
    dateCounts[key] = (dateCounts[key] || 0) + 1;
  });
  console.log('Date + Dipo counts in Sep 2026:', dateCounts);
}

inspectMonthDates();
