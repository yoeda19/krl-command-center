const http = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg'
      }
    };
    http.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function run() {
  try {
    const data = await get('https://mtdvafucrlcbcdewhryy.supabase.co/rest/v1/maintenance_schedule?limit=1');
    console.log('Sample maintenance_schedule row:', data);
  } catch (err) {
    console.error(err);
  }
}
run();
