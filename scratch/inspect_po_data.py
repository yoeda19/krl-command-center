import os
import re
from supabase import create_client

def main():
    url = "https://mtdvafucrlcbcdewhryy.supabase.co"
    env_path = r"d:\EMON\procurement_project\krl-command-center\.env"
    anon_key = None
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            content = f.read()
            m = re.search(r"VITE_SUPABASE_ANON_KEY=(.+)", content)
            if m:
                anon_key = m.group(1).strip()
                
    supabase = create_client(url, anon_key)
    res = supabase.table("procurement_progress").select("id, approval_sap_status, goods_inspection_status").execute()
    for row in res.data[:10]:
        print(row)

if __name__ == "__main__":
    main()
