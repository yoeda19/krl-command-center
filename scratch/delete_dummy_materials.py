import urllib.request
import json

# Credentials for User's New Supabase
USER_URL = "https://mtdvafucrlcbcdewhryy.supabase.co"
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

def get_headers(api_key):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

def delete_dummies():
    print("Deleting dummy materials starting with 1000...")
    # Delete from master_materials where nomor_material starts with '1000'
    # In Postgrest: nomor_material=like.1000*
    url = f"{USER_URL}/rest/v1/master_materials?nomor_material=like.1000*"
    req = urllib.request.Request(
        url,
        headers=get_headers(USER_KEY),
        method="DELETE"
    )
    try:
        with urllib.request.urlopen(req) as res:
            print("Successfully deleted dummy materials from master_materials.")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error: {e} - {e.read().decode()}")
        else:
            print(f"Error: {e}")

if __name__ == "__main__":
    delete_dummies()
