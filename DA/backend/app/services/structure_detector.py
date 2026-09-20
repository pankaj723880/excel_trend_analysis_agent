"""Detect the structure of a worksheet: layout, data types, and quality signals."""
from __future__ import annotations

import pandas as pd

from app.utils.dates import detect_date_column
from app.utils.numbers import parse_numeric_text


def classify_columns(df: pd.DataFrame) -> dict:
    """Classify columns into numeric / categorical / date / mixed / text."""
    numeric = []
    categorical = []
    date = []
    mixed = []
    text = []

    date_col = detect_date_column(df)

    for column in df.columns:
        series = df[column]
        non_null = series.dropna()
        if non_null.empty:
            categorical.append(column)
            continue

        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            numeric.append(column)
            continue

        if column == date_col and pd.api.types.is_datetime64_any_dtype(series):
            date.append(column)
            continue

        if pd.api.types.is_datetime64_any_dtype(series):
            date.append(column)
            continue

        # String columns
        as_text = non_null.astype(str).str.strip()
        numeric_candidate = parse_numeric_text(non_null)
        numeric_ratio = numeric_candidate.notna().mean() if len(numeric_candidate) else 0.0

        if numeric_ratio >= 0.95:
            numeric.append(column)
        elif numeric_ratio >= 0.5:
            mixed.append(column)
        elif column == date_col:
            date.append(column)
        elif as_text.str.len().max() > 80 if len(as_text) else False:
            text.append(column)
        else:
            unique_ratio = non_null.nunique() / len(non_null) if len(non_null) else 0.0
            if unique_ratio > 0.95 and len(non_null) > 50:
                text.append(column)
            else:
                categorical.append(column)

    return {
        "numeric": numeric,
        "categorical": categorical,
        "date": date,
        "mixed": mixed,
        "text": text,
        "date_column": date_col,
    }


def detect_table_layout(df: pd.DataFrame) -> dict:
    """Describe the detected table layout of a sheet."""
    row_count = len(df)
    col_count = len(df.columns)

    if row_count >= 1000:
        size = "large"
    elif row_count >= 100:
        size = "medium"
    elif row_count >= 0:
        size = "small"

    return {
        "rows": row_count,
        "columns": col_count,
        "size": size,
    }
