const http = require('https');

const supabaseUrl = 'https://mtdvafucrlcbcdewhryy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

function post(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const data = JSON.stringify(body);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Prefer': 'return=representation'
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => resolve(JSON.parse(responseBody)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const dummySchedules = [
  {
    id: 1010,
    nomor_rangkaian: '125CLI-01',
    seri_kereta: 'CLI125',
    jenis_propulsi: 'Rheostatik',
    tipe_perawatan: 'P1',
    tanggal_rencana: '2026-07-08',
    status_pelaksanaan: 'Sedang Dirawat',
    dipo: 'Depo Depok'
  },
  {
    id: 1011,
    nomor_rangkaian: '125CLI-02',
    seri_kereta: 'CLI125',
    jenis_propulsi: 'Rheostatik',
    tipe_perawatan: 'P3',
    tanggal_rencana: '2026-07-09',
    status_pelaksanaan: 'Rencana',
    dipo: 'Depo Bukit Duri'
  },
  {
    id: 1012,
    nomor_rangkaian: '205JR-12',
    seri_kereta: 'JR205',
    jenis_propulsi: 'VVVF',
    tipe_perawatan: 'P12',
    tanggal_rencana: '2026-07-10',
    status_pelaksanaan: 'Rencana',
    dipo: 'Depo Bogor'
  },
  {
    id: 1013,
    nomor_rangkaian: 'Metro-05',
    seri_kereta: 'Metro',
    jenis_propulsi: 'Rheostatik',
    tipe_perawatan: 'P6',
    tanggal_rencana: '2026-07-12',
    status_pelaksanaan: 'Rencana',
    dipo: 'Depo Manggarai'
  },
  {
    id: 1014,
    nomor_rangkaian: 'EA203-01',
    seri_kereta: 'EA203',
    jenis_propulsi: 'VVVF',
    tipe_perawatan: 'P24',
    tanggal_rencana: '2026-07-14',
    status_pelaksanaan: 'Rencana',
    dipo: 'Depo Depok'
  }
];

async function run() {
  try {
    console.log('Sending dummy schedules data with explicit IDs to Supabase...');
    const result = await post(`${supabaseUrl}/rest/v1/maintenance_schedule`, dummySchedules);
    console.log('Successfully inserted data:', result);
  } catch (err) {
    console.error('Error inserting data:', err);
  }
}
run();
