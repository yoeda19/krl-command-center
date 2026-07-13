import os
import re
import math
import pandas as pd
from supabase import create_client

def get_supabase_client():
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
        raise ValueError("Cannot find Supabase anon key")
    return create_client(url, anon_key)

def clean_cost(val):
    if pd.isna(val):
        return 0
    try:
        return int(float(val))
    except:
        return 0

def format_date(val):
    if pd.isna(val):
        return None
    val_str = str(val).split('.')[0].strip()
    if len(val_str) == 8 and val_str.isdigit():
        return f"{val_str[:4]}-{val_str[4:6]}-{val_str[6:8]}"
    return None

def main():
    print("Initializing Supabase client...")
    supabase = get_supabase_client()
    
    # 1. Fetch valid equipment IDs to enforce foreign key integrity
    print("Fetching valid equipment IDs from database...")
    valid_equip_ids = set()
    offset = 0
    limit = 1000
    while True:
        res = supabase.table("equipment_master").select("id").range(offset, offset + limit - 1).execute()
        if not res.data:
            break
        for row in res.data:
            valid_equip_ids.add(str(row["id"]))
        if len(res.data) < limit:
            break
        offset += limit
    print(f"Loaded {len(valid_equip_ids)} valid equipment IDs.")

    # 2. Read Excel file
    excel_path = r"C:\Users\M. Rifaldi\Downloads\missorder.xlsx"
    print(f"Reading Excel file from {excel_path}...")
    df = pd.read_excel(excel_path, sheet_name=0)
    print(f"Excel file loaded: {df.shape[0]} rows.")

    # 3. Process and prepare upsert payload
    upsert_data = []
    for idx, row in df.iterrows():
        # Order
        order_no = str(row.get("Order", "")).split('.')[0].strip()
        if not order_no or order_no == "nan":
            continue
            
        # Equipment ID validation
        eq_raw = str(row.get("Equipment", "")).split('.')[0].strip()
        equipment_id = eq_raw if eq_raw in valid_equip_ids else None
        
        # Date
        order_date = format_date(row.get("Bas. start date"))
        
        # Costs
        actual_cost = clean_cost(row.get("Total act.costs"))
        plan_cost = clean_cost(row.get("TotalPlnndCosts"))
        
        # Status mapping
        sys_status = str(row.get("System status", ""))
        status = "Completed" if ("TECO" in sys_status or "CLSD" in sys_status) else "Outstanding"
        
        item = {
            "order_no": order_no,
            "equipment_id": equipment_id,
            "description": str(row.get("Description", ""))[:255] if pd.notna(row.get("Description")) else "",
            "description2": "",
            "order_type": str(row.get("Order Type", ""))[:50] if pd.notna(row.get("Order Type")) else "PREV",
            "actual_cost": actual_cost,
            "plan_cost": plan_cost,
            "order_date": order_date,
            "status": status
        }
        upsert_data.append(item)

    print(f"Prepared {len(upsert_data)} items for upsert.")

    # 4. Perform upsert in chunks of 500
    chunk_size = 500
    total_inserted = 0
    for i in range(0, len(upsert_data), chunk_size):
        chunk = upsert_data[i:i+chunk_size]
        try:
            res = supabase.table("orders").upsert(chunk).execute()
            total_inserted += len(chunk)
            print(f"Upserted chunk {i//chunk_size + 1}: {total_inserted}/{len(upsert_data)} rows completed.")
        except Exception as e:
            print(f"Error upserting chunk starting at index {i}: {e}")

    print("\nImport process completed successfully!")

if __name__ == "__main__":
    main()
