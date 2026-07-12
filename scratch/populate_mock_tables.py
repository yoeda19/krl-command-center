import json
import urllib.request

# Credentials for User's Supabase
USER_URL = "https://mtdvafucrlcbcdewhryy.supabase.co"
USER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZHZhZnVjcmxjYmNkZXdocnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTM4MjQsImV4cCI6MjA5OTI4OTgyNH0.IztzzoHRC0Csw_hWZ-tMbTTuo_b5NuwsvmzWVVlNSlg"

def get_headers(api_key):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def post_data(table_name, payload):
    url = f"{USER_URL}/rest/v1/{table_name}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={**get_headers(USER_KEY), "Prefer": "resolution=merge-duplicates"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            print(f"Successfully populated {len(payload)} rows in {table_name}.")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error seeding {table_name}: {e} - {e.read().decode()}")
        else:
            print(f"Error seeding {table_name}: {e}")

if __name__ == "__main__":
    # Current date is July 11, 2026.
    # We adjust all dates to be logically consistent.

    # 1. Maintenance Schedule (linked to WO)
    # - "Sedang Dirawat" should be happening now (e.g. planned July 8, 2026)
    # - "Rencana" should be in the future (e.g. mid July, August, September 2026)
    # - "Selesai" should be in the past (e.g. June 2026)
    schedule = [
        { "id": 1, "nomor_rangkaian": "Rangkaian 10", "jenis_kereta": "M1", "jenis_propulsi": "VVVF", "tipe_perawatan": "P48", "tanggal_rencana": "2026-07-08", "status_pelaksanaan": "Sedang Dirawat" },
        { "id": 2, "nomor_rangkaian": "Rangkaian 25", "jenis_kereta": "TC", "jenis_propulsi": "Rheostatik", "tipe_perawatan": "P12", "tanggal_rencana": "2026-07-25", "status_pelaksanaan": "Rencana" },
        { "id": 3, "nomor_rangkaian": "Rangkaian 47", "jenis_kereta": "M2", "jenis_propulsi": "VVVF", "tipe_perawatan": "P6", "tanggal_rencana": "2026-08-01", "status_pelaksanaan": "Rencana" },
        { "id": 4, "nomor_rangkaian": "Rangkaian 08", "jenis_kereta": "T", "jenis_propulsi": "Rheostatik", "tipe_perawatan": "P3", "tanggal_rencana": "2026-06-28", "status_pelaksanaan": "Selesai" },
        { "id": 5, "nomor_rangkaian": "Rangkaian 62", "jenis_kereta": "M1", "jenis_propulsi": "VVVF", "tipe_perawatan": "P24", "tanggal_rencana": "2026-08-15", "status_pelaksanaan": "Rencana" }
    ]
    post_data("maintenance_schedule", schedule)

    # 2. Work Orders (using active materials)
    work_orders = [
        { "id": 1, "nomor_wo": "WO-2026-001", "schedule_id": 1, "nomor_material": "6007130", "qty_reservasi": 4, "status_pemenuhan": "Outstanding" },
        { "id": 2, "nomor_wo": "WO-2026-001", "schedule_id": 1, "nomor_material": "6005530", "qty_reservasi": 4, "status_pemenuhan": "Fulfilled" },
        { "id": 3, "nomor_wo": "WO-2026-002", "schedule_id": 2, "nomor_material": "6000373", "qty_reservasi": 2, "status_pemenuhan": "Outstanding" },
        { "id": 4, "nomor_wo": "WO-2026-003", "schedule_id": 3, "nomor_material": "6007140", "qty_reservasi": 6, "status_pemenuhan": "Outstanding" },
        { "id": 5, "nomor_wo": "WO-2026-003", "schedule_id": 3, "nomor_material": "6007141", "qty_reservasi": 4, "status_pemenuhan": "Fulfilled" }
    ]
    post_data("work_orders", work_orders)

    # 3. Procurement Progress
    # - "Dalam Transit": PO May 15, 2026, Plan Lead Time = 90 days, Plan Delivery = August 15, 2026 (Future)
    # - "PO Diterbitkan": PO June 20, 2026, Plan Lead Time = 120 days, Plan Delivery = October 20, 2026 (Future)
    # - "Dalam Pengadaan": PO July 01, 2026, Plan Lead Time = 60 days, Plan Delivery = August 30, 2026 (Future)
    # - "Tiba di Depo": PO April 10, 2026, Plan Lead Time = 45 days, Plan Delivery = May 25, 2026, Actual Delivery = May 28, 2026, Actual Lead Time = 48 days (Past)
    # - "Dikirim Vendor": PO May 05, 2026, Plan Lead Time = 150 days, Plan Delivery = October 02, 2026 (Future)
    procurement = [
        {
            "id": 1, "nomor_material": "6007140", "uraian_material": "RESIN BRAKE SHOE;TYPE M NS-732", "satuan": "PCS",
            "sisa_stok": 1360, "harga_satuan": 612841.0, "jumlah_dipesan": 100, "total_harga": 61284100.0,
            "tanggal_po": "2026-05-15", "vendor": "PT Krakatau Steel", "kota_asal": "Cilegon",
            "status": "Dalam Transit", "plan_lead_time": 90, "actual_lead_time": None,
            "tanggal_rencana_pengiriman": "2026-08-15", "tanggal_penerimaan_barang": None, "risiko_keterlambatan": "Tinggi"
        },
        {
            "id": 2, "nomor_material": "6007024", "uraian_material": "Roda KRL Type KUR 12524", "satuan": "PCS",
            "sisa_stok": 176, "harga_satuan": 20895000.0, "jumlah_dipesan": 50, "total_harga": 1044750000.0,
            "tanggal_po": "2026-06-20", "vendor": "PT SKF Indonesia", "kota_asal": "Jakarta",
            "status": "PO Diterbitkan", "plan_lead_time": 120, "actual_lead_time": None,
            "tanggal_rencana_pengiriman": "2026-10-20", "tanggal_penerimaan_barang": None, "risiko_keterlambatan": "Tinggi"
        },
        {
            "id": 3, "nomor_material": "6007130", "uraian_material": "INTEGRATED CONTACT STRIP", "satuan": "PCS",
            "sisa_stok": 0, "harga_satuan": 3848266.0, "jumlah_dipesan": 200, "total_harga": 769653200.0,
            "tanggal_po": "2026-07-01", "vendor": "CV Sumber Jaya Teknik", "kota_asal": "Bandung",
            "status": "Dalam Pengadaan", "plan_lead_time": 60, "actual_lead_time": None,
            "tanggal_rencana_pengiriman": "2026-08-30", "tanggal_penerimaan_barang": None, "risiko_keterlambatan": "Sedang"
        },
        {
            "id": 4, "nomor_material": "6005530", "uraian_material": "Brake Pad Shoes KRL JR 205", "satuan": "PCS",
            "sisa_stok": 1256, "harga_satuan": 1470251.0, "jumlah_dipesan": 150, "total_harga": 220537650.0,
            "tanggal_po": "2026-04-10", "vendor": "PT Aditya Filter Nusantara", "kota_asal": "Surabaya",
            "status": "Tiba di Depo", "plan_lead_time": 45, "actual_lead_time": 48,
            "tanggal_rencana_pengiriman": "2026-05-25", "tanggal_penerimaan_barang": "2026-05-28", "risiko_keterlambatan": "Rendah"
        },
        {
            "id": 5, "nomor_material": "6000373", "uraian_material": "CARBON BRUSH TM KRL SERI JR 205", "satuan": "PCS",
            "sisa_stok": 5586, "harga_satuan": 420561.0, "jumlah_dipesan": 20, "total_harga": 8411220.0,
            "tanggal_po": "2026-05-05", "vendor": "PT Toshiba Systems Indonesia", "kota_asal": "Jakarta",
            "status": "Dikirim Vendor", "plan_lead_time": 150, "actual_lead_time": None,
            "tanggal_rencana_pengiriman": "2026-10-02", "tanggal_penerimaan_barang": None, "risiko_keterlambatan": "Tinggi"
        }
    ]
    post_data("procurement_progress", procurement)

    print("Populating mock data complete.")
