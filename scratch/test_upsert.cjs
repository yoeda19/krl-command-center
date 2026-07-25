const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const supabase = createClient(url, key);

async function run() {
  console.log("Inserting direct audit log...");
  const { data, error } = await supabase
    .from('audit_logs')
    .insert([{
      nomor_material: '6000373',
      parameter_name: 'Test Audit Log',
      original_value: 'Test Original',
      new_value: 'Test New',
      admin_email: 'dev@prisma.co.id',
      admin_name: 'Dev Admin',
      modul: 'Parameter Material'
    }]);

  if (error) {
    console.error("Audit log error:", error);
  } else {
    console.log("Audit log success:", data);
  }
}

run();
