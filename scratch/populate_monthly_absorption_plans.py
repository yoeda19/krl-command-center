import urllib.request
import json

# Credentials for User's New Supabase
USER_URL = "https://mtdvafucrlcbcdewhryy.supabase.co"
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

def get_headers(api_key):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

def populate_plans():
    # 8 active materials
    mats = ["6007140", "6007141", "6007130", "6000373", "6005530", "2001141", "6007025", "6007024"]
    years = [2026, 2027, 2028]
    payload = []
    
    # Generate default plans
    for mat in mats:
        base_qty = 10
        if mat == "6000373": base_qty = 500
        elif mat == "2001141": base_qty = 80
        elif mat == "6007140": base_qty = 120
        
        for yr in years:
            for mo in range(1, 13):
                # Add minor variation per month/year
                mult = 1.0
                if mo in [6, 7, 12]: mult = 1.2 # peak maintenance months
                elif mo in [1, 2]: mult = 0.8
                
                plan_qty = int(base_qty * mult)
                payload.append({
                    "nomor_material": mat,
                    "tahun": yr,
                    "bulan": mo,
                    "plan_qty": plan_qty
                })
                
    print(f"Uploading {len(payload)} monthly plans to Supabase...")
    url = f"{USER_URL}/rest/v1/monthly_absorption_plans"
    
    # Chunk uploading
    chunk_size = 100
    for i in range(0, len(payload), chunk_size):
        chunk = payload[i:i+chunk_size]
        req = urllib.request.Request(
            url,
            data=json.dumps(chunk).encode(),
            headers=get_headers(USER_KEY)
        )
        try:
            with urllib.request.urlopen(req) as res:
                pass
        except Exception as e:
            if hasattr(e, 'read'):
                print(f"Error on chunk {i}: {e} - {e.read().decode()}")
            else:
                print(f"Error on chunk {i}: {e}")
                
    print("Done populating monthly absorption plans.")

if __name__ == "__main__":
    populate_plans()
