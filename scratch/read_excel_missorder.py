import pandas as pd

def main():
    path = r"C:\Users\M. Rifaldi\Downloads\missorder.xlsx"
    try:
        # Load excel file
        xl = pd.ExcelFile(path)
        print("Sheet names:", xl.sheet_names)
        
        # Read first sheet
        df = pd.read_excel(path, sheet_name=0)
        print("\nColumns:", df.columns.tolist())
        print("\nShape:", df.shape)
        print("\nFirst 10 rows:")
        print(df.head(10))
    except Exception as e:
        print("Error reading excel:", e)

if __name__ == "__main__":
    main()
