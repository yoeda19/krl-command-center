const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const supabase = createClient(url, key);

async function migrate() {
  // Check if columns already exist by querying
  const { data, error } = await supabase
    .from('procurement_progress')
    .select('plan_approval_sap_status, plan_aanwijzing_date')
    .limit(1);

  if (error) {
    console.log('Columns do not exist yet.');
    console.log('Please run the following SQL in your Supabase Dashboard > SQL Editor:');
    console.log('');
    console.log('ALTER TABLE procurement_progress');
    console.log('  ADD COLUMN IF NOT EXISTS plan_approval_sap_status TEXT,');
    console.log('  ADD COLUMN IF NOT EXISTS plan_aanwijzing_date TEXT;');
  } else {
    console.log('Columns already exist! No migration needed.');
    console.log('Sample data:', data);
  }
}

migrate();
