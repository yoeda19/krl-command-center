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
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

excel_path = r'C:\Users\M. Rifaldi\Downloads\mb52180826.XLSX'

print('1. Loading MB52 Excel file...')
df = pd.read_excel(excel_path)

# Filter valid materials
df = df[df['Material'].notna()].copy()
df['mat'] = df['Material'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.lstrip('0')
df = df[df['mat'].str.len() > 0].copy()
df = df[df['mat'] != 'nan'].copy()

df['desc'] = df['Material Description'].fillna('').astype(str).str.strip()
df['uom'] = df['Base Unit of Measure'].fillna('PC').astype(str).str.strip()
df['sloc'] = df['Storage Location'].fillna('').astype(str).str.strip().str.upper()
df['qty'] = pd.to_numeric(df['Unrestricted'], errors='coerce').fillna(0)
df['val'] = pd.to_numeric(df['Value Unrestricted'], errors='coerce').fillna(0)
df['transit'] = pd.to_numeric(df['Transit and Transfer'], errors='coerce').fillna(0)

# Group by material
mat_groups = {}
for idx, row in df.iterrows():
    mat = row['mat']
    if mat not in mat_groups:
        mat_groups[mat] = {
            'nomor_material': mat,
            'nama_material': row['desc'],
            'satuan': row['uom'] if row['uom'] and row['uom'] != 'nan' else 'PC',
            'pst': 0.0,
            'dpk': 0.0, 'dpkt': 0.0,
            'dbkd': 0.0, 'dbkdt': 0.0,
            'dmri': 0.0, 'dmrit': 0.0,
            'dbgr': 0.0, 'dbgrt': 0.0,
            'omri': 0.0, 'omrit': 0.0,
            'total_val': 0.0,
            'total_qty': 0.0
        }
    
    sloc = row['sloc']
    q = float(row['qty'])
    tr = float(row['transit'])
    v = float(row['val'])
    
    mat_groups[mat]['total_val'] += v
    mat_groups[mat]['total_qty'] += q
    
    if sloc == 'C013':
        mat_groups[mat]['pst'] += q
    elif sloc == 'C007':
        mat_groups[mat]['dpk'] += q
        mat_groups[mat]['dpkt'] += tr
    elif sloc == 'C006':
        mat_groups[mat]['dbkd'] += q
        mat_groups[mat]['dbkdt'] += tr
    elif sloc in ('C020', 'C002'):
        mat_groups[mat]['dmri'] += q
        mat_groups[mat]['dmrit'] += tr
    elif sloc == 'C008':
        mat_groups[mat]['dbgr'] += q
        mat_groups[mat]['dbgrt'] += tr
    elif sloc == 'C009':
        mat_groups[mat]['omri'] += q
        mat_groups[mat]['omrit'] += tr

payload = []
for mat, data in mat_groups.items():
    tot = int(round(data['pst'] + data['dpk'] + data['dpkt'] + data['dbkd'] + data['dbkdt'] +
                    data['dmri'] + data['dmrit'] + data['dbgr'] + data['dbgrt'] + data['omri'] + data['omrit']))
    
    payload.append({
        'nomor_material': data['nomor_material'],
        'nama_material': data['nama_material'],
        'satuan': data['satuan'],
        'total_stock': tot,
        'pst': int(round(data['pst'])),
        'dpk': int(round(data['dpk'])),
        'dpkt': int(round(data['dpkt'])),
        'dbkd': int(round(data['dbkd'])),
        'dbkdt': int(round(data['dbkdt'])),
        'dmri': int(round(data['dmri'])),
        'dmrit': int(round(data['dmrit'])),
        'dbgr': int(round(data['dbgr'])),
        'dbgrt': int(round(data['dbgrt'])),
        'omri': int(round(data['omri'])),
        'omrit': int(round(data['omrit']))
    })

print(f'2. Upserting stock balances for {len(payload)} materials into master_materials...')

# Upsert in chunks
chunk_size = 20
for i in range(0, len(payload), chunk_size):
    chunk = payload[i:i+chunk_size]
    res = requests.post(f'{SUPABASE_URL}/rest/v1/master_materials', headers=headers, json=chunk)
    if res.status_code in (200, 201):
        print(f'Chunk {i//chunk_size + 1}: OK')
    else:
        print(f'Chunk {i//chunk_size + 1} Error:', res.status_code, res.text[:200])

print('SUKSES: Saldo stok fisik (MB52 18/08/2026) berhasil disinkronkan ke Supabase!')
