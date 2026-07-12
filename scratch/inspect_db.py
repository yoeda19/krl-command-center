import urllib.request
import json

USER_URL = "https://mtdvafucrlcbcdewhryy.supabase.co"
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

def get_headers():
    return {
        "apikey": USER_KEY,
        "Authorization": f"Bearer {USER_KEY}",
        "Content-Type": "application/json"
    }

def get_data(table_name):
    url = f"{USER_URL}/rest/v1/{table_name}?select=*"
    req = urllib.request.Request(url, headers=get_headers())
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode())
            print(f"Table '{table_name}' has {len(data)} rows.")
            if len(data) > 0:
                print("First row:", json.dumps(data[0], indent=2))
            return data
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error reading {table_name}: {e} - {e.read().decode()}")
        else:
            print(f"Error reading {table_name}: {e}")
        return None

if __name__ == "__main__":
    tables = [
        "equipment_master",
        "orders",
        "master_materials",
        "fleet_maintenance_metrics",
        "maintenance_schedule",
        "work_orders",
        "procurement_progress",
        "dead_stock_recommendations",
        "ideal_stock_configurations",
        "recent_history",
        "monthly_absorption_plans"
    ]
    for t in tables:
        get_data(t)
