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
    orders = ["200002309134", "200002309266"]
    
    query_str = """
            order_no, 
            description,
            equipment_id,
            equipment_master (
              id,
              name,
              level,
              model_no,
              parent_id,
              parent:equipment_master!parent_id (
                id,
                name,
                model_no
              )
            )
    """
    try:
        res = supabase.table("orders").select(query_str).in_("order_no", orders).execute()
        print("Success:", res.data)
    except Exception as e:
        print("Error details:", e)

if __name__ == "__main__":
    main()
