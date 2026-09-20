import pandas as pd

def profile_dataframe(df):
    numeric = df.select_dtypes(include="number").columns.tolist()
    categorical = df.select_dtypes(exclude="number").columns.tolist()

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "missing_cells": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "numeric_columns": numeric,
        "categorical_columns": categorical,
        "geo_columns": [c for c in categorical if str(c).lower() in ["country", "state", "city", "region"]],
        "kpi_columns": [c for c in numeric if any(kw in str(c).lower() for kw in ["revenue", "sales", "profit", "amount", "total", "cost", "value"])],
        "missing_by_column": {
            c: int(v) for c, v in df.isna().sum().items() if v > 0
        },
        "summary_statistics": df[numeric].describe().to_dict() if numeric else {},
    }
