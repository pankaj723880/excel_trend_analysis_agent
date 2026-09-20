import pandas as pd

def _coerce_numeric_like_columns(df, threshold=0.6):
    for column in df.columns:
        if pd.api.types.is_numeric_dtype(df[column]):
            continue

        coerced = pd.to_numeric(df[column], errors="coerce")
        valid_values = coerced.notna().sum()

        if valid_values and (valid_values / len(df[column])) >= threshold:
            df[column] = coerced

    return df

def load_workbook_data(uploaded_file):
    xls = pd.ExcelFile(uploaded_file)
    sheets = {}
    for sheet in xls.sheet_names:
        df = pd.read_excel(uploaded_file, sheet_name=sheet)
        df = df.dropna(how="all").dropna(axis=1, how="all")
        df = _coerce_numeric_like_columns(df)
        sheets[sheet] = df
    return sheets
