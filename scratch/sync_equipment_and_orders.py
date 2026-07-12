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

def get_headers(api_key):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def sync_data():
    c_emon_client = create_client(C_EMON_URL, C_EMON_KEY)
    
    # 1. Sync equipment_master
    print("Fetching equipment_master from C-EMON...")
    try:
        response = c_emon_client.from_("equipment_master").select("*").execute()
        eq_data = response.data
        print(f"Fetched {len(eq_data)} equipment rows.")
        
        # Insert into User Supabase
        chunk_size = 200
        for i in range(0, len(eq_data), chunk_size):
            chunk = eq_data[i:i+chunk_size]
            url = f"{USER_URL}/rest/v1/equipment_master"
            req = urllib.request.Request(
                url,
                data=json.dumps(chunk).encode(),
                headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
            )
            with urllib.request.urlopen(req) as res:
                pass
        print("Successfully synced equipment_master.")
    except Exception as e:
        print(f"Error syncing equipment_master: {e}")

    # 2. Sync orders from parquet file
    print("Reading orders2026.parquet...")
    parquet_path = r"d:\EMON\Backup4\orders2026.parquet"
    if os.path.exists(parquet_path):
        try:
            df = pd.read_parquet(parquet_path)
            
            # Clean values: convert NaN to None
            df["order_no"] = df["order_no"].astype(str).str.strip()
            df["order_no"] = df["order_no"].apply(lambda x: x[:-2] if x.endswith(".0") else x)
            
            df["equipment_id"] = df["equipment_id"].astype(str).str.strip()
            df["equipment_id"] = df["equipment_id"].apply(lambda x: x[:-2] if x.endswith(".0") else x)
            
            # Replace NaNs
            df = df.where(pd.notnull(df), None)
            
            orders_payload = []
            # Make sure equipment_ids exist in equipment_master to prevent foreign key issues
            # Get valid equipment ids we just synced
            valid_eq_ids = {item["id"] for item in eq_data}
            
            for _, row in df.iterrows():
                eq_id = row["equipment_id"]
                if eq_id not in valid_eq_ids:
                    # Skip or set to None to prevent foreign key violations
                    eq_id = None
                
                orders_payload.append({
                    "order_no": row["order_no"],
                    "equipment_id": eq_id,
                    "description": row["description"],
                    "description2": row["description2"],
                    "order_type": row["order_type"],
                    "actual_cost": float(row["actual_cost"]) if row["actual_cost"] is not None else None,
                    "plan_cost": float(row["plan_cost"]) if row["plan_cost"] is not None else None,
                    "order_date": str(row["order_date"]) if row["order_date"] is not None else None,
                    "status": row["status"]
                })
                
            print(f"Uploading {len(orders_payload)} orders to User Supabase...")
            chunk_size = 500
            for i in range(0, len(orders_payload), chunk_size):
                chunk = orders_payload[i:i+chunk_size]
                url = f"{USER_URL}/rest/v1/orders"
                req = urllib.request.Request(
                    url,
                    data=json.dumps(chunk).encode(),
                    headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
                )
                with urllib.request.urlopen(req) as res:
                    pass
            print("Successfully synced orders.")
        except Exception as e:
            if hasattr(e, 'read'):
                print(f"Error syncing orders: {e} - {e.read().decode()}")
            else:
                print(f"Error syncing orders: {e}")
    else:
        print("orders2026.parquet not found.")

if __name__ == "__main__":
    sync_data()
