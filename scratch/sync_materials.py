import os
import json
import urllib.request
from supabase import create_client
import pandas as pd

# Load credentials from C-EMON env
C_EMON_URL = ""
C_EMON_KEY = ""

env_path = r"d:\EMON\Backup4\.env.local"
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                val = val.strip('"\'')
                if key == "VITE_SUPABASE_URL":
                    C_EMON_URL = val
                elif key == "SUPABASE_SERVICE_ROLE_KEY":
                    C_EMON_KEY = val

# Credentials for User's New Supabase
USER_URL = "https://mtdvafucrlcbcdewhryy.supabase.co"
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

TARGET_MATERIALS = ["6007140", "6007141", "6007130", "6000373", "6005530", "2001141", "6007025", "6007024"]

def get_headers(api_key):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def fetch_c_emon_materials():
    c_emon_client = create_client(C_EMON_URL, C_EMON_KEY)
    response = c_emon_client.from_("materials").select("*").in_("nomor_material", TARGET_MATERIALS).execute()
    return response.data

def fetch_c_emon_history_parquet():
    print("Downloading riwayat2026.parquet from C-EMON storage...")
    c_emon_client = create_client(C_EMON_URL, C_EMON_KEY)
    try:
        bin_data = c_emon_client.storage.from_("history-data").download("riwayat2026.parquet")
        temp_parquet = "temp_riwayat2026.parquet"
        with open(temp_parquet, "wb") as f:
            f.write(bin_data)
        
        print("Reading parquet data...")
        df = pd.read_parquet(temp_parquet)
        
        print("Filtering for target materials...")
        # Clean string formats to match
        df["nomorMaterial"] = df["nomorMaterial"].astype(str).str.strip()
        df_filtered = df[df["nomorMaterial"].isin(TARGET_MATERIALS)]
        
        if os.path.exists(temp_parquet):
            os.remove(temp_parquet)
            
        print(f"Found {len(df_filtered)} history rows for target materials.")
        return df_filtered.to_dict(orient="records")
    except Exception as e:
        print(f"Error downloading or processing parquet: {e}")
        return []

def insert_user_materials(mats):
    payload = []
    ideal_payload = []
    for m in mats:
        # Calculate total stock
        omri = int(float(m.get('omri') or 0))
        omrit = int(float(m.get('omrit') or 0))
        pst = int(float(m.get('pst') or 0))
        dpk = int(float(m.get('dpk') or 0))
        dpkt = int(float(m.get('dpkt') or 0))
        dbkd = int(float(m.get('dbkd') or 0))
        dbkdt = int(float(m.get('dbkdt') or 0))
        dmri = int(float(m.get('dmri') or 0))
        dmrit = int(float(m.get('dmrit') or 0))
        dbgr = int(float(m.get('dbgr') or 0))
        dbgrt = int(float(m.get('dbgrt') or 0))

        total_stock = omri + omrit + pst + dpk + dpkt + dbkd + dbkdt + dmri + dmrit + dbgr + dbgrt
        
        payload.append({
            "nomor_material": m["nomor_material"],
            "nama_material": m["nama_material"],
            "satuan": m["satuan"],
            "total_stock": total_stock,
            "omri": omri,
            "omrit": omrit,
            "pst": pst,
            "dpk": dpk,
            "dpkt": dpkt,
            "dbkd": dbkd,
            "dbkdt": dbkdt,
            "dmri": dmri,
            "dmrit": dmrit,
            "dbgr": dbgr,
            "dbgrt": dbgrt
        })
        ideal_payload.append({
            "nomor_material": m["nomor_material"],
            "ideal_qty_manual": int(m.get('threshold') or 50),
            "use_formula_calculation": False
        })
    
    # Insert materials
    url = f"{USER_URL}/rest/v1/master_materials"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            print(f"Successfully inserted {len(payload)} master materials.")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error inserting master materials: {e} - {e.read().decode()}")
        else:
            print(f"Error inserting master materials: {e}")

    # Insert ideal stock configurations
    url = f"{USER_URL}/rest/v1/ideal_stock_configurations"
    req = urllib.request.Request(
        url,
        data=json.dumps(ideal_payload).encode(),
        headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            print(f"Successfully inserted {len(ideal_payload)} ideal configurations.")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error inserting configurations: {e} - {e.read().decode()}")
        else:
            print(f"Error inserting configurations: {e}")

def insert_user_history(hist):
    payload = []
    for h in hist:
        qty = h.get("qty")
        amount = h.get("amount")
        harga_satuan = h.get("harga_satuan")
        
        qty = float(qty) if pd.notna(qty) else 0.0
        amount = float(amount) if pd.notna(amount) else 0.0
        harga_satuan = float(harga_satuan) if pd.notna(harga_satuan) else 0.0
        order_no = str(h.get("orderNo")) if pd.notna(h.get("orderNo")) else None

        payload.append({
            "tanggal": str(h["tanggal"]),
            "nomor_material": str(h["nomorMaterial"]),
            "gudang": str(h["gudang"]),
            "qty": qty,
            "amount": amount,
            "harga_satuan": harga_satuan,
            "order_no": order_no
        })
    
    # Send in chunks of 500
    chunk_size = 500
    for i in range(0, len(payload), chunk_size):
        chunk = payload[i:i+chunk_size]
        url = f"{USER_URL}/rest/v1/recent_history"
        req = urllib.request.Request(
            url,
            data=json.dumps(chunk).encode(),
            headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
        )
        try:
            with urllib.request.urlopen(req) as res:
                print(f"Successfully inserted batch {i // chunk_size + 1} ({len(chunk)} entries).")
        except Exception as e:
            if hasattr(e, 'read'):
                print(f"Error inserting history batch: {e} - {e.read().decode()}")
            else:
                print(f"Error inserting history batch: {e}")

if __name__ == "__main__":
    print("Starting sync...")
    mats = fetch_c_emon_materials()
    print(f"Fetched {len(mats)} materials.")
    if mats:
        insert_user_materials(mats)
    
    hist = fetch_c_emon_history_parquet()
    print(f"Fetched {len(hist)} history entries from parquet.")
    if hist:
        insert_user_history(hist)
    print("Sync complete.")
