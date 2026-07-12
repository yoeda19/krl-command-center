const http = require('https');

const supabaseUrl = 'https://mtdvafucrlcbcdewhryy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

function get(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => resolve(JSON.parse(responseBody)));
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    console.log('Querying 5 rows of level 2 equipment...');
    const result = await get(`${supabaseUrl}/rest/v1/equipment_master?level=eq.2&limit=5`);
    console.log('Level 2 equipment:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
