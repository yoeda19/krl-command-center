const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const supabaseUrl = 'https://mtdvafucrlcbcdewhryy.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg';

const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  // Convert parquet to json via python first
  const pythonCmd = `python -c "
import pandas as pd
df = pd.read_parquet(r'C:\\Users\\M. Rifaldi\\Downloads\\equipment_master (1).parquet')
df = df.where(pd.notnull(df), None)
l1 = df[df['level'] == 1]
l1.to_json(r'scratch\\l1_equipment.json', orient='records')
print(f'Exported {len(l1)} level 1 records')
"`;
  execSync(pythonCmd);

  const raw = fs.readFileSync('scratch/l1_equipment.json', 'utf8');
  const items = JSON.parse(raw);
  console.log(`Updating ${items.length} level 1 items in Supabase...`);

  for (const item of items) {
    const { error } = await supabase
      .from('equipment_master')
      .update({ funct_loc_descrip: item.funct_loc_descrip })
      .eq('id', String(item.id));
    if (error) {
      console.error(`Error updating id ${item.id}:`, error.message);
    }
  }

  console.log('Finished updating level 1 equipment funct_loc_descrip!');
}

run();
