import os
import re
from supabase import create_client

def main():
    url = "https://mtdvafucrlcbcdewhryy.supabase.co"
    # We can read the anon key from the project's .env file
    env_path = r"d:\EMON\procurement_project\krl-command-center\.env"
    anon_key = None
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            content = f.read()
            m = re.search(r"VITE_SUPABASE_ANON_KEY=(.+)", content)
            if m:
                anon_key = m.group(1).strip()
    
    if not anon_key:
        print("Error: Could not read VITE_SUPABASE_ANON_KEY from .env")
        return

    supabase = create_client(url, anon_key)

    # 1. Fetch all unique order_no from recent_history (paginated or in chunks if needed)
    # Let's fetch in chunks since recent_history can have many rows.
    all_history_orders = set()
    offset = 0
    limit = 1000
    while True:
        res = supabase.table("recent_history").select("order_no").range(offset, offset + limit - 1).execute()
        if not res.data:
            break
        for row in res.data:
            if row.get("order_no"):
                all_history_orders.add(str(row["order_no"]).strip())
        if len(res.data) < limit:
            break
        offset += limit
    
    print(f"Total unique orders found in history: {len(all_history_orders)}")

    # 2. Fetch all order_no from orders table
    registered_orders = set()
    offset = 0
    while True:
        res = supabase.table("orders").select("order_no").range(offset, offset + limit - 1).execute()
        if not res.data:
            break
        for row in res.data:
            if row.get("order_no"):
                registered_orders.add(str(row["order_no"]).strip())
        if len(res.data) < limit:
            break
        offset += limit

    print(f"Total orders found in orders table: {len(registered_orders)}")

    # 3. Find missing orders
    missing_orders = sorted(list(all_history_orders - registered_orders))
    print(f"Total missing orders: {len(missing_orders)}")

    # 4. Write to missing_orders.md
    output_path = r"d:\EMON\procurement_project\krl-command-center\scratch\missing_orders.md"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        f.write("# Daftar Nomor Order Tidak Terdaftar di Database (Perlu Dicari di Sistem)\n\n")
        f.write(f"Total: {len(missing_orders)} Nomor Order\n\n")
        f.write("```text\n")
        for order in missing_orders:
            f.write(f"{order}\n")
        f.write("```\n")

    print(f"Successfully wrote missing orders to {output_path}")

if __name__ == "__main__":
    main()
