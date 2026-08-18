const http = require('https');

const supabaseUrl = 'https://mtdvafucrlcbcdewhryy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${supabaseUrl}${path}`);
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: method,
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

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
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function analyze() {
  const schedules = await request('/rest/v1/maintenance_schedule?select=*&order=id.asc&limit=10000');
  console.log(`Total schedules found: ${schedules.length}`);

  // Count by month-year
  const monthMap = {};
  schedules.forEach(s => {
    if (!s.tanggal_rencana) return;
    const [yr, mo] = s.tanggal_rencana.split('-');
    const key = `${yr}-${mo}`;
    monthMap[key] = (monthMap[key] || 0) + 1;
  });
  console.log('Schedules per month:', monthMap);

  // Sample check for September 2026
  const sep26 = schedules.filter(s => s.tanggal_rencana && s.tanggal_rencana.startsWith('2026-09'));
  console.log(`September 2026 count: ${sep26.length}`);
  
  const dipoCount = {};
  sep26.forEach(s => {
    const dipo = s.dipo || 'Unknown';
    dipoCount[dipo] = (dipoCount[dipo] || 0) + 1;
  });
  console.log('September 2026 dipo counts:', dipoCount);
}

analyze();
