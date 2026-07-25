import pandas as pd
import json
import urllib.request

supabase_url = 'https://mtdvafucrlcbcdewhryy.supabase.co'
anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg'

parquet_path = r'C:\Users\M. Rifaldi\Downloads\equipment_master (1).parquet'
df = pd.read_parquet(parquet_path)
df = df.where(pd.notnull(df), None)

l1 = df[df['level'] == 1]
print(f"Found {len(l1)} level 1 records.")

headers = {
    'apikey': anon_key,
    'Authorization': f'Bearer {anon_key}',
    'Content-Type': 'application/json'
}

success_count = 0
for idx, row in l1.iterrows():
    eq_id = str(row['id'])
    desc = row['funct_loc_descrip']
    
    payload = json.dumps({'funct_loc_descrip': desc}).encode('utf-8')
    url = f"{supabase_url}/rest/v1/equipment_master?id=eq.{eq_id}"
    req = urllib.request.Request(url, data=payload, headers=headers, method='PATCH')
    
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 204):
                success_count += 1
    except Exception as e:
        print(f"Error updating ID {eq_id}: {e}")

print(f"Successfully updated {success_count}/{len(l1)} Level 1 equipment records in Supabase!")
