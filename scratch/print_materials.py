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

def print_table_data(table_name):
    url = f"{USER_URL}/rest/v1/{table_name}?select=*"
    req = urllib.request.Request(url, headers=get_headers())
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode())
            print(f"\n=== Table '{table_name}' ({len(data)} rows) ===")
            for row in data:
                print(row)
    except Exception as e:
        print(f"Error {table_name}: {e}")

if __name__ == "__main__":
    print_table_data("master_materials")
    print_table_data("dead_stock_recommendations")
    print_table_data("ideal_stock_configurations")
