import pandas as pd
import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://mtdvafucrlcbcdewhryy.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

excel_path = r'C:\Users\M. Rifaldi\Downloads\mb5120252026-180826.XLSX'

print('1. Loading MB51 Excel file (16,200 rows)...', flush=True)
df = pd.read_excel(excel_path)

df = df[df['Material'].notna()].copy()
df['mat'] = df['Material'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.lstrip('0')
df = df[df['mat'].str.len() > 0].copy()

# Date formatting
df['date_str'] = pd.to_datetime(df['Posting Date'], errors='coerce').dt.strftime('%Y-%m-%d')
df = df[df['date_str'].notna()].copy()

df['sloc'] = df['Storage Location'].fillna('').astype(str).str.strip().str.upper()
df['mvt'] = df['Movement Type'].fillna('').astype(str).str.strip().str.upper()
df['qty'] = pd.to_numeric(df['Qty in Un. of Entry'], errors='coerce').fillna(0)
df['order'] = df['Order'].fillna('').astype(str).str.replace(r'\.0$', '', regex=True).str.strip()

# 2. Price lookup from procurement_progress
print('2. Fetching price lookup from procurement_progress...', flush=True)
r_prog = requests.get(f'{SUPABASE_URL}/rest/v1/procurement_progress?select=nomor_material,harga_satuan', headers=headers)
price_map = {}
if r_prog.status_code == 200:
    for p in r_prog.json():
        if p.get('harga_satuan'):
            price_map[str(p['nomor_material']).strip().lstrip('0')] = float(p['harga_satuan'])

# 3. Build payload rows
print('3. Building batch records...', flush=True)
records = []
for idx, row in df.iterrows():
    mat_no = row['mat']
    qty = float(row['qty'])
    unit_price = price_map.get(mat_no, 0.0)
    amount = abs(qty * unit_price) if unit_price > 0 else 0.0
    order_val = row['order'] if row['order'] and row['order'] != 'nan' else None

    records.append({
        'tanggal': row['date_str'],
        'nomor_material': mat_no,
        'gudang': row['sloc'],
        'qty': qty,
        'amount': amount,
        'harga_satuan': unit_price if unit_price > 0 else None,
        'order_no': order_val,
        'movement_type': row['mvt']
    })

print(f'Total records ready for upload: {len(records)}', flush=True)

# 4. Upload in chunks of 1,000
chunk_size = 1000
total_chunks = (len(records) + chunk_size - 1) // chunk_size

for i in range(0, len(records), chunk_size):
    chunk = records[i:i+chunk_size]
    res = requests.post(f'{SUPABASE_URL}/rest/v1/recent_history', headers=headers, json=chunk)
    c_idx = (i // chunk_size) + 1
    if res.status_code in (200, 201):
        print(f'Uploaded batch {c_idx}/{total_chunks} ({len(chunk)} rows): OK', flush=True)
    else:
        print(f'Batch {c_idx}/{total_chunks} Error:', res.status_code, res.text[:200], flush=True)

print('SUKSES: Seluruh 16.200 data mutasi riwayat (2025-2026) berhasil diunggah ke recent_history!', flush=True)
