"""Workbook Schema Builder.

Constructs a rich, structured metadata schema for uploaded Excel workbooks.
Used by the Verified Data Analysis Agent for schema matching, natural language
column alias resolution, and cross-sheet relationship detection.
"""
from __future__ import annotations

import re
from typing import Any
import pandas as pd


def build_workbook_schema(
    workbook_dict: dict[str, pd.DataFrame],
    filename: str = "workbook.xlsx",
) -> dict[str, Any]:
    """Build a comprehensive schema representation of the entire workbook.

    Includes sheet structures, row/column counts, inferred dtypes, missing cell
    counts, unique counts, min/max ranges, basic statistics, and cross-sheet
    key relationships.
    """
    sheets_schema: dict[str, Any] = {}
    total_rows = 0
    total_missing = 0

    for sheet_name, df in workbook_dict.items():
        if not isinstance(df, pd.DataFrame) or df.empty:
            sheets_schema[sheet_name] = {
                "sheet_name": sheet_name,
                "row_count": 0,
                "column_count": 0,
                "column_names": [],
                "numeric_columns": [],
                "categorical_columns": [],
                "date_columns": [],
                "missing_counts": {},
                "unique_counts": {},
                "statistics": {},
                "sample_values": {},
            }
            continue

        rows, cols = df.shape
        total_rows += rows

        col_names = [str(c) for c in df.columns]

        numeric_cols = []
        categorical_cols = []
        date_cols = []

        missing_counts = {}
        unique_counts = {}
        statistics = {}
        sample_values = {}

        for col in df.columns:
            str_col = str(col)
            series = df[col]

            null_cnt = int(series.isnull().sum())
            missing_counts[str_col] = null_cnt
            total_missing += null_cnt

            uniq_cnt = int(series.nunique(dropna=True))
            unique_counts[str_col] = uniq_cnt

            # Attempt date conversion check
            is_date = False
            if pd.api.types.is_datetime64_any_dtype(series):
                is_date = True
            elif series.dtype == "object":
                # Sample non-null strings to see if they are dates
                non_null_samples = series.dropna().astype(str).head(10).tolist()
                if non_null_samples and any(
                    re.search(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", s)
                    for s in non_null_samples
                ):
                    try:
                        parsed = pd.to_datetime(series.dropna().head(100), errors="coerce")
                        if parsed.notnull().sum() > len(parsed) * 0.7:
                            is_date = True
                    except Exception:
                        pass

            if is_date:
                date_cols.append(str_col)
                dt_series = pd.to_datetime(series, errors="coerce").dropna()
                if not dt_series.empty:
                    statistics[str_col] = {
                        "type": "date",
                        "min": str(dt_series.min()),
                        "max": str(dt_series.max()),
                    }
            elif pd.api.types.is_numeric_dtype(series):
                numeric_cols.append(str_col)
                num_series = pd.to_numeric(series, errors="coerce").dropna()
                if not num_series.empty:
                    statistics[str_col] = {
                        "type": "numeric",
                        "min": float(num_series.min()),
                        "max": float(num_series.max()),
                        "mean": float(num_series.mean()),
                        "median": float(num_series.median()),
                        "std": float(num_series.std()) if len(num_series) > 1 else 0.0,
                        "sum": float(num_series.sum()),
                    }
            else:
                categorical_cols.append(str_col)
                top_vals = series.value_counts(dropna=True).head(5).to_dict()
                sample_values[str_col] = [str(k) for k in top_vals.keys()]
                statistics[str_col] = {
                    "type": "categorical",
                    "unique_count": uniq_cnt,
                    "top_values": {str(k): int(v) for k, v in top_vals.items()},
                }

        sheets_schema[sheet_name] = {
            "sheet_name": sheet_name,
            "row_count": rows,
            "column_count": cols,
            "column_names": col_names,
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "date_columns": date_cols,
            "missing_counts": missing_counts,
            "unique_counts": unique_counts,
            "statistics": statistics,
            "sample_values": sample_values,
        }

    # Cross-sheet relationship detection
    cross_sheet_relationships = []
    sheet_names_list = list(workbook_dict.keys())
    for i in range(len(sheet_names_list)):
        for j in range(i + 1, len(sheet_names_list)):
            s1 = sheet_names_list[i]
            s2 = sheet_names_list[j]
            cols1 = set(sheets_schema[s1]["column_names"])
            cols2 = set(sheets_schema[s2]["column_names"])
            common = list(cols1.intersection(cols2))
            if common:
                cross_sheet_relationships.append({
                    "sheet1": s1,
                    "sheet2": s2,
                    "common_columns": common,
                })

    return {
        "filename": filename,
        "sheet_names": list(workbook_dict.keys()),
        "sheet_count": len(workbook_dict),
        "total_rows": total_rows,
        "total_missing": total_missing,
        "sheets": sheets_schema,
        "cross_sheet_relationships": cross_sheet_relationships,
    }
