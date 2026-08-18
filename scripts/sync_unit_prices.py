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

excel_path = r'C:\Users\M. Rifaldi\Downloads\mb52180826.XLSX'

print('1. Calculating unit prices from MB52...', flush=True)
df = pd.read_excel(excel_path)
df = df[df['Material'].notna()].copy()
df['mat'] = df['Material'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.lstrip('0')
df['qty'] = pd.to_numeric(df['Unrestricted'], errors='coerce').fillna(0)
df['val'] = pd.to_numeric(df['Value Unrestricted'], errors='coerce').fillna(0)

grp = df.groupby('mat').agg({'qty':'sum', 'val':'sum', 'Material Description':'first', 'Base Unit of Measure':'first'})
grp['unit_price'] = grp.apply(lambda r: int(round(r['val']/r['qty'])) if r['qty']>0 else 0, axis=1)

prices = grp[grp['unit_price'] > 0].to_dict('index')
print(f'Computed unit prices for {len(prices)} materials.', flush=True)

# 2. Fetch existing procurement_progress
res_prog = requests.get(f'{SUPABASE_URL}/rest/v1/procurement_progress?select=nomor_material', headers=headers)
existing_progs = set([p['nomor_material'] for p in res_prog.json()]) if res_prog.status_code == 200 else set()

to_insert = []
for mat_no, data in prices.items():
    u_price = data['unit_price']
    desc = str(data['Material Description'])
    uom = str(data['Base Unit of Measure']) if pd.notna(data['Base Unit of Measure']) else 'PC'
    stock_qty = int(round(data['qty']))
    
    if mat_no in existing_progs:
        requests.patch(
            f'{SUPABASE_URL}/rest/v1/procurement_progress?nomor_material=eq.{mat_no}',
            headers=headers,
            json={'harga_satuan': u_price, 'sisa_stok': stock_qty}
        )
    else:
        to_insert.append({
            'nomor_material': mat_no,
            'uraian_material': desc,
            'satuan': uom,
            'harga_satuan': u_price,
            'sisa_stok': stock_qty,
            'jumlah_dipesan': 0,
            'status': 'Dalam Pengadaan'
        })

if to_insert:
    res_ins = requests.post(f'{SUPABASE_URL}/rest/v1/procurement_progress', headers=headers, json=to_insert)
    print(f'Inserted {len(to_insert)} new procurement items:', res_ins.status_code, flush=True)

print('SUKSES: Seluruh harga satuan per material berhasil diperbarui!', flush=True)
