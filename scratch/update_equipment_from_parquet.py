import pandas as pd
import json
import urllib.request

supabase_url = 'https://mtdvafucrlcbcdewhryy.supabase.co'
anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg'

parquet_path = r'C:\Users\M. Rifaldi\Downloads\equipment_master (1).parquet'
df = pd.read_parquet(parquet_path)

# Fill NaNs with None for JSON serialization
df = df.where(pd.notnull(df), None)

records = df.to_dict(orient='records')
print(f"Total records to upsert: {len(records)}")

batch_size = 300
headers = {
    'apikey': anon_key,
    'Authorization': f'Bearer {anon_key}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

for i in range(0, len(records), batch_size):
    batch = records[i:i + batch_size]
    # Clean records
    cleaned_batch = []
    for item in batch:
        cleaned_batch.append({
            'id': str(item['id']),
            'parent_id': str(item['parent_id']) if item['parent_id'] is not None else None,
            'level': int(item['level']) if item['level'] is not None else 1,
            'nomen': item.get('nomen'),
            'name': str(item['name']) if item['name'] is not None else '',
            'model_no': item.get('model_no'),
            'funct_loc_descrip': item.get('funct_loc_descrip')
        })
    
    data = json.dumps(cleaned_batch).encode('utf-8')
    req = urllib.request.Request(f"{supabase_url}/rest/v1/equipment_master", data=data, headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Batch {i//batch_size + 1}/{(len(records) + batch_size - 1)//batch_size} status: {resp.status}")
    except Exception as e:
        print(f"Error at batch {i}: {e}")

print("Upsert completed successfully!")
