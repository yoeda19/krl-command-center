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
    // Fetch all orders in batches to inspect prefixes
    let prefixes = new Set();
    let page = 0;
    while (page < 10) {
      const pageData = await get(`https://mtdvafucrlcbcdewhryy.supabase.co/rest/v1/orders?select=order_no&limit=5000&offset=${page * 5000}`);
      if (!pageData || pageData.length === 0) break;
      pageData.forEach(o => {
        if (o.order_no) {
          prefixes.add(o.order_no.substring(0, 4));
        }
      });
      page++;
    }
    console.log('Order number prefixes in orders table:', Array.from(prefixes));
  } catch (err) {
    console.error(err);
  }
}
run();
