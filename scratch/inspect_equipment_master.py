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
    
    if not anon_key:
        print("Error anon key")
        return
        
    supabase = create_client(url, anon_key)
    res = supabase.table("equipment_master").select("*").limit(5).execute()
    print("Equipment Master Sample Rows:")
    for row in res.data:
        print(row)

if __name__ == "__main__":
    main()
