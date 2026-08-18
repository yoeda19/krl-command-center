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

excel_path = r'C:\Users\M. Rifaldi\Downloads\Bahan Plan Aplikasi.xlsx'

print('1. Loading Excel sheet SKCD-Siklus (PLAN)...')
xl = pd.ExcelFile(excel_path)
df_plan = xl.parse('SKCD-Siklus (PLAN)', header=None)

materials = []
for idx, row in df_plan.iterrows():
    if idx >= 17 and pd.notna(row[1]):
        mat_no = str(row[1]).replace('.0', '').strip()
        mat_name = str(row[2]).strip()
        uom = str(row[3]).strip() if pd.notna(row[3]) else 'PC'
        
        # Col 109 is EST. PLAN PER TAHUN (TANPA BUFFER)
        annual_val = float(row[109]) if pd.notna(row[109]) else 0.0
        monthly_val = int(round(annual_val / 12.0))
        
        materials.append({
            'nomor_material': mat_no,
            'nama_material': mat_name,
            'satuan': uom,
            'annual_plan': annual_val,
            'monthly_plan': monthly_val
        })

print(f'Extracted {len(materials)} materials from Plan sheet.')

# 2. Fetch existing master_materials
res_existing = requests.get(f'{SUPABASE_URL}/rest/v1/master_materials?select=nomor_material', headers=headers)
existing_nos = set([m['nomor_material'] for m in res_existing.json()]) if res_existing.status_code == 200 else set()
print(f'Existing materials in DB: {len(existing_nos)}')

# 3. Upsert master_materials
new_materials_to_insert = []
for m in materials:
    if m['nomor_material'] not in existing_nos:
        new_materials_to_insert.append({
            'nomor_material': m['nomor_material'],
            'nama_material': m['nama_material'],
            'satuan': m['satuan'],
            'total_stock': 0,
            'pst': 0,
            'dpk': 0,
            'dpkt': 0,
            'dbkd': 0,
            'dbkdt': 0,
            'dmri': 0,
            'dmrit': 0,
            'dbgr': 0,
            'dbgrt': 0,
            'omri': 0,
            'omrit': 0
        })

if new_materials_to_insert:
    print(f'Inserting {len(new_materials_to_insert)} new master materials...')
    res_ins = requests.post(f'{SUPABASE_URL}/rest/v1/master_materials', headers=headers, json=new_materials_to_insert)
    print('Master materials insert status:', res_ins.status_code)
else:
    print('All materials already exist in master_materials.')

# 4. Clear existing monthly_absorption_plans for these materials (to avoid duplicates)
print('\n4. Syncing monthly_absorption_plans...')
for m in materials:
    requests.delete(f'{SUPABASE_URL}/rest/v1/monthly_absorption_plans?nomor_material=eq.{m["nomor_material"]}', headers=headers)

# 5. Generate & Upsert monthly_plans for 2025 to 2030 (6 years x 12 months = 72 entries per material)
plans_payload = []
years = [2025, 2026, 2027, 2028, 2029, 2030]

for m in materials:
    for yr in years:
        for mo in range(1, 13):
            plans_payload.append({
                'nomor_material': m['nomor_material'],
                'tahun': yr,
                'bulan': mo,
                'plan_qty': m['monthly_plan'],
                'gudang': 'GLOBAL'
            })

print(f'Total monthly plan records to insert: {len(plans_payload)}')

# Batch post in chunks of 500
chunk_size = 500
for i in range(0, len(plans_payload), chunk_size):
    chunk = plans_payload[i:i+chunk_size]
    res_plan = requests.post(
        f'{SUPABASE_URL}/rest/v1/monthly_absorption_plans',
        headers=headers,
        json=chunk
    )
    if res_plan.status_code not in (200, 201):
        print(f'Error chunk {i//chunk_size}:', res_plan.status_code, res_plan.text[:200])

print('SUKSES: Seluruh data material dan monthly_absorption_plans (2025-2030) berhasil disinkronkan ke Supabase!')
