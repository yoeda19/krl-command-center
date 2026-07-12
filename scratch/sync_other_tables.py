import os
import json
import urllib.request
from supabase import create_client

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
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6Mj95OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg" # (Fixing user key minor typo if any)
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

def get_headers(api_key):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def sync_table(table_name):
    print(f"Syncing table {table_name}...")
    c_emon_client = create_client(C_EMON_URL, C_EMON_KEY)
    try:
        response = c_emon_client.from_(table_name).select("*").execute()
        data = response.data
        print(f"Fetched {len(data)} rows from C-EMON for {table_name}.")
        
        if not data:
            return
            
        # Insert/Upsert into User Supabase
        url = f"{USER_URL}/rest/v1/{table_name}"
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode(),
            headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
        )
        with urllib.request.urlopen(req) as res:
            print(f"Successfully inserted {len(data)} rows into {table_name}.")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error syncing {table_name}: {e} - {e.read().decode()}")
        else:
            print(f"Error syncing {table_name}: {e}")

if __name__ == "__main__":
    tables = [
        "fleet_maintenance_metrics",
        "maintenance_schedule",
        "work_orders",
        "procurement_progress",
        "dead_stock_recommendations"
    ]
    for t in tables:
        sync_table(t)
    print("Sync of other tables complete.")
