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

async function inspect2029() {
  const rows = await request('/rest/v1/maintenance_schedule?tanggal_rencana=gte.2029-02-01&tanggal_rencana=lte.2029-02-28');
  console.log(`2029-02 total rows: ${rows.length}`);
  const dipoCount = {};
  rows.forEach(r => {
    dipoCount[r.dipo] = (dipoCount[r.dipo] || 0) + 1;
  });
  console.log('2029-02 dipo counts:', dipoCount);
}

inspect2029();
