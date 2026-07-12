import urllib.request
import json
from datetime import datetime, date

USER_URL = "https://mtdvafucrlcbcdewhryy.supabase.co"
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

def get_headers():
    return {
        "apikey": USER_KEY,
        "Authorization": f"Bearer {USER_KEY}",
        "Content-Type": "application/json"
    }

def fetch_table(table_name):
    url = f"{USER_URL}/rest/v1/{table_name}?select=*"
    req = urllib.request.Request(url, headers=get_headers())
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        print(f"Error fetching {table_name}: {e}")
        return []

def analyze():
    print("--- ANALYSIS OF DATABASE DATA vs SERVICES IMPLEMENTATION ---")
    
    # 1. Fleet Metrics
    print("\n[1] Fleet Metrics Analysis:")
    eq = fetch_table("equipment_master")
    orders = fetch_table("orders")
    db_metrics = fetch_table("fleet_maintenance_metrics")
    
    print(f"Total equipment_master items: {len(eq)}")
    print(f"Total orders items: {len(orders)}")
    print(f"Rows in fleet_maintenance_metrics table: {db_metrics}")
    
    # Let's perform the getFleetMetrics logic
    trains = [e for e in eq if e.get("parent_id") is None or e.get("level") == 1]
    total_fleet = len(trains)
    
    active_statuses_to_exclude = {'Selesai', 'Closed', 'Completed', 'CLSD', 'TECO'}
    active_orders = [o for o in orders if o.get("status") not in active_statuses_to_exclude]
    active_eq_ids = {o.get("equipment_id") for o in active_orders if o.get("equipment_id")}
    
    in_maintenance = 0
    for t in trains:
        children = [e for e in eq if e.get("parent_id") == t.get("id")]
        has_active = (t.get("id") in active_eq_ids) or any(c.get("id") in active_eq_ids for c in children)
        if has_active:
            in_maintenance += 1
            
    tidak_beroperasi = round(total_fleet * 0.08)
    siap_dinas = max(0, total_fleet - in_maintenance - tidak_beroperasi)
    efisiensi = 98.0
    
    print("Calculated from equipment_master & orders:")
    print(f"  total_fleet: {total_fleet}")
    print(f"  siap_dinas: {siap_dinas}")
    print(f"  in_maintenance: {in_maintenance}")
    print(f"  tidak_beroperasi: {tidak_beroperasi}")
    print(f"  efisiensi_perawatan: {efisiensi}")
    
    # 2. Critical Stock Page & Warehouse sums
    print("\n[2] Master Materials Stock Analysis:")
    mats = fetch_table("master_materials")
    for m in mats:
        wh_pst = int(m.get("pst") or 0)
        wh_depok = int(m.get("dpk") or 0) + int(m.get("dpkt") or 0) + int(m.get("omri") or 0) + int(m.get("omrit") or 0)
        wh_bkd = int(m.get("dbkd") or 0) + int(m.get("dbkdt") or 0)
        wh_mri = int(m.get("dmri") or 0) + int(m.get("dmrit") or 0)
        wh_bgr = int(m.get("dbgr") or 0) + int(m.get("dbgrt") or 0)
        calculated_sum = wh_pst + wh_depok + wh_bkd + wh_mri + wh_bgr
        db_total_stock = int(m.get("total_stock") or 0)
        mismatch = "MISMATCH!" if calculated_sum != db_total_stock else "OK"
        print(f"  Mat {m['nomor_material']} ({m['nama_material'][:25]}...): DB Total={db_total_stock}, Sum Warehouses={calculated_sum} -> {mismatch}")
        
    # 3. Slow Moving & Aging Kategori checks
    print("\n[3] Slow-Moving / Dead Stock Categories:")
    recs = fetch_table("dead_stock_recommendations")
    history = fetch_table("recent_history")
    
    today = datetime(2026, 7, 11)
    
    mat_stats = {}
    for h in history:
        mat_no = h["nomor_material"]
        d = datetime.strptime(h["tanggal"], "%Y-%m-%d")
        price = float(h.get("harga_satuan") or 0)
        if mat_no not in mat_stats:
            mat_stats[mat_no] = {"lastDate": d, "harga": price}
        else:
            if d > mat_stats[mat_no]["lastDate"]:
                mat_stats[mat_no]["lastDate"] = d
            if price > 0:
                mat_stats[mat_no]["harga"] = price
                
    for m in mats:
        mat_no = m["nomor_material"]
        stats = mat_stats.get(mat_no)
        last_date = stats["lastDate"] if stats else datetime(2025, 6, 1)
        harga = stats["harga"] if stats else 45000.0
        
        diff = abs((today - last_date).days)
        
        if diff > 180:
            kategori = "Dead Stock"
        elif diff > 90:
            kategori = "At Risk"
        elif diff > 30:
            kategori = "Slow-Moving"
        else:
            kategori = "Fresh"
            
        rec = next((r for r in recs if r["nomor_material"] == mat_no), None)
        rec_text = rec["rekomendasi_ahli"] if rec else None
        
        print(f"  Mat {mat_no}: Usia={diff} days ({kategori}), Price={harga}, Rec in DB={rec_text}")

if __name__ == "__main__":
    analyze()
