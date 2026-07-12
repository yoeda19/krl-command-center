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
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

def get_headers(api_key):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def sync_equipment():
    print("Fetching equipment_master from C-EMON...")
    c_emon_client = create_client(C_EMON_URL, C_EMON_KEY)
    try:
        response = c_emon_client.from_("equipment_master").select("*").execute()
        data = response.data
        print(f"Fetched {len(data)} equipment rows.")
        
        if not data:
            return
            
        # Send to User Supabase
        # Chunk sizes of 200
        chunk_size = 200
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i+chunk_size]
            url = f"{USER_URL}/rest/v1/equipment_master"
            req = urllib.request.Request(
                url,
                data=json.dumps(chunk).encode(),
                headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
            )
            with urllib.request.urlopen(req) as res:
                print(f"Successfully inserted batch {i // chunk_size + 1} ({len(chunk)} rows).")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error: {e} - {e.read().decode()}")
        else:
            print(f"Error: {e}")

if __name__ == "__main__":
    sync_equipment()
