import os
from supabase import create_client

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

if C_EMON_URL and C_EMON_KEY:
    c = create_client(C_EMON_URL, C_EMON_KEY)
    try:
        # Check what tables exist by querying common names or getting one row of equipment_master
        res = c.from_("equipment_master").select("*").limit(1).execute()
        print("Success fetching equipment_master:")
        print(res.data)
    except Exception as e:
        print("Error fetching equipment_master:", e)
else:
    print("Credentials not loaded.")
