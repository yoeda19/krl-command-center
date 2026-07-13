import pandas as pd

def main():
    path = r"C:\Users\M. Rifaldi\Downloads\missorder.xlsx"
    df = pd.read_excel(path, sheet_name=0)
    for col in ['Order', 'Equipment', 'No. K A I', 'Description', 'Functional Loc.']:
        if col in df.columns:
            print(f"\n--- {col} sample values ---")
            print(df[col].dropna().head(10))

if __name__ == "__main__":
    main()
