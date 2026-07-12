import pandas as pd
import os
import json
import urllib.request

# Load credentials from user config
USER_URL = "https://mtdvafucrlcbcdewhryy.supabase.co"
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

parquet_path = r"d:\EMON\Backup4\riwayat2025.parquet"
target = ["6007140", "6007141", "6007130", "6000373", "6005530", "2001141", "6007025", "6007024"]

def get_headers(api_key):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

if os.path.exists(parquet_path):
    df = pd.read_parquet(parquet_path)
    df["nomorMaterial"] = df["nomorMaterial"].astype(str).str.strip()
    df["nomorMaterial"] = df["nomorMaterial"].apply(lambda x: x[:-2] if x.endswith(".0") else x)
    df_filtered = df[df["nomorMaterial"].isin(target)]
    
    grouped = df_filtered.groupby("nomorMaterial")["qty"].sum().reset_index()
    grouped["monthly_avg"] = grouped["qty"] / 12.0
    grouped["calculated_ideal"] = (grouped["monthly_avg"] * 5.0).round().astype(int) # Lead Time (4 months) + Safety (1 month)
    
    payload = []
    for _, row in grouped.iterrows():
        payload.append({
            "nomor_material": str(row["nomorMaterial"]),
            "ideal_qty_manual": int(row["calculated_ideal"]),
            "use_formula_calculation": False
        })
        
    url = f"{USER_URL}/rest/v1/ideal_stock_configurations"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            print(f"Successfully populated {len(payload)} ideal configurations in Supabase.")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error: {e} - {e.read().decode()}")
        else:
            print(f"Error: {e}")
else:
    print("riwayat2025.parquet not found.")
