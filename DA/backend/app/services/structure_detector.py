"""Canonical Column Classification and Semantic Typing Engine.

Determines exact semantic roles, confidence scores, and data types
across arbitrary Excel workbooks without hardcoded assumptions.
"""
from __future__ import annotations

import re
from typing import Any
import pandas as pd

from app.utils.dates import detect_date_column, try_parse_date_series
from app.utils.numbers import parse_numeric_text


def classify_columns(df: pd.DataFrame) -> dict[str, Any]:
    """Classify columns into numeric / categorical / date / mixed / text and generate rich schema metadata."""
    numeric = []
    categorical = []
    date = []
    mixed = []
    text = []
    columns_schema: dict[str, dict[str, Any]] = {}

    date_col = detect_date_column(df)

    for column in df.columns:
        col_name = str(column)
        series = df[column]
        non_null = series.dropna()
        total_count = len(series)
        non_null_count = len(non_null)
        null_count = total_count - non_null_count
        missing_pct = round((null_count / total_count * 100), 2) if total_count else 0.0
        unique_cnt = int(non_null.nunique())

        # 1. Empty column
        if non_null.empty:
            categorical.append(col_name)
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": "empty",
                "semantic_type": "empty",
                "confidence": 1.0,
                "unique_count": 0,
                "missing_pct": 100.0,
                "is_nullable": True,
            }
            continue

        # 2. Already parsed datetime or identified date column
        if pd.api.types.is_datetime64_any_dtype(series):
            date.append(col_name)
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": "datetime64[ns]",
                "semantic_type": "datetime",
                "confidence": 1.0,
                "unique_count": unique_cnt,
                "missing_pct": missing_pct,
                "is_nullable": null_count > 0,
            }
            continue

        # 3. Native numeric columns
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            # Check if identifier with high unique ratio and integer type
            is_id_candidate = False
            col_lower = col_name.lower()
            if any(k in col_lower for k in ["id", "code", "sku", "key", "number", "num"]) and unique_cnt == non_null_count:
                is_id_candidate = True

            numeric.append(col_name)
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": str(series.dtype),
                "semantic_type": "identifier" if is_id_candidate else "numeric",
                "confidence": 0.99,
                "unique_count": unique_cnt,
                "missing_pct": missing_pct,
                "is_nullable": null_count > 0,
            }
            continue

        # 4. String / Object columns - test date inference first
        parsed_dates = try_parse_date_series(series)
        date_valid_ratio = float(parsed_dates.notna().mean()) if len(parsed_dates) else 0.0

        if date_valid_ratio >= 0.70 or col_name == date_col:
            date.append(col_name)
            if not date_col:
                date_col = col_name
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": "datetime",
                "semantic_type": "datetime",
                "confidence": round(date_valid_ratio, 2),
                "unique_count": unique_cnt,
                "missing_pct": missing_pct,
                "is_nullable": null_count > 0,
            }
            continue

        # 5. Test numeric strings (currency, percentage, formatted commas)
        numeric_candidate = parse_numeric_text(non_null)
        numeric_ratio = float(numeric_candidate.notna().mean()) if len(numeric_candidate) else 0.0

        if numeric_ratio >= 0.85:
            col_lower = col_name.lower()
            semantic = "percentage" if "%" in col_lower else ("currency" if any(c in str(non_null.iloc[0]) for c in "$₹€£¥") else "numeric")
            numeric.append(col_name)
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": "numeric (coerced)",
                "semantic_type": semantic,
                "confidence": round(numeric_ratio, 2),
                "unique_count": unique_cnt,
                "missing_pct": missing_pct,
                "is_nullable": null_count > 0,
            }
            continue
        elif numeric_ratio >= 0.40:
            mixed.append(col_name)
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": "mixed",
                "semantic_type": "mixed",
                "confidence": 0.60,
                "unique_count": unique_cnt,
                "missing_pct": missing_pct,
                "is_nullable": null_count > 0,
            }
            continue

        # 6. Categorical vs Text vs Identifier
        as_text = non_null.astype(str).str.strip()
        max_len = as_text.str.len().max() if len(as_text) else 0

        # Identifier preservation (e.g. leading zero strings like "00123")
        is_identifier = any(k in col_name.lower() for k in ["id", "code", "sku", "key", "account", "ref"]) and (unique_cnt >= non_null_count * 0.90)

        if is_identifier:
            text.append(col_name)
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": "string",
                "semantic_type": "identifier",
                "confidence": 0.95,
                "unique_count": unique_cnt,
                "missing_pct": missing_pct,
                "is_nullable": null_count > 0,
            }
        elif max_len > 80:
            text.append(col_name)
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": "text",
                "semantic_type": "text",
                "confidence": 0.90,
                "unique_count": unique_cnt,
                "missing_pct": missing_pct,
                "is_nullable": null_count > 0,
            }
        else:
            categorical.append(col_name)
            columns_schema[col_name] = {
                "column": col_name,
                "original_dtype": str(series.dtype),
                "inferred_type": "categorical",
                "semantic_type": "categorical",
                "confidence": 0.95,
                "unique_count": unique_cnt,
                "missing_pct": missing_pct,
                "is_nullable": null_count > 0,
            }

    return {
        "numeric": numeric,
        "categorical": categorical,
        "date": date,
        "mixed": mixed,
        "text": text,
        "date_column": date_col,
        "columns_schema": columns_schema,
    }


def detect_table_layout(df: pd.DataFrame) -> dict[str, Any]:
    """Describe the detected table layout of a sheet."""
    row_count = len(df)
    col_count = len(df.columns)

    if row_count >= 1000:
        size = "large"
    elif row_count >= 100:
        size = "medium"
    else:
        size = "small"

    return {
        "rows": row_count,
        "columns": col_count,
        "size": size,
    }
