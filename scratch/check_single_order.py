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
    res = supabase.table("orders").select("*").eq("order_no", "200002309134").execute()
    print("Order 200002309134 in orders table:", res.data)
    
    # Let's also check if it's in recent_history
    res2 = supabase.table("recent_history").select("*").eq("order_no", "200002309134").execute()
    print("Order 200002309134 in recent_history:", res2.data)

if __name__ == "__main__":
    main()
