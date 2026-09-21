"""Workbook / sheet profiler: structure, dtypes, quality signals, health score."""
from __future__ import annotations

import pandas as pd

from app.services.structure_detector import classify_columns
from app.utils.dates import detect_date_column, try_parse_date_series
from app.utils.numbers import parse_numeric_text


def _count_invalid_values(df: pd.DataFrame, date_column: str | None = None) -> dict:
    """Count values flagged as invalid per column using the canonical DomainValidator."""
    from app.services.validation import DomainValidator
    val_res = DomainValidator.validate_sheet(df, date_column=date_column)
    return {col: count for col, count in val_res.get("by_column", {}).items() if count > 0}


def profile_sheet(df: pd.DataFrame, sheet_name: str | None = None) -> dict:
    """Profile one sheet with structure + quality information."""
    classification = classify_columns(df)
    date_col = classification.get("date_column")

    duplicate_rows = int(df.duplicated().sum())
    missing_cells = int(df.isna().sum().sum())
    total_cells = int(df.shape[0] * df.shape[1])
    missing_pct = round((missing_cells / total_cells) * 100, 2) if total_cells else 0.0

    # Unique values per column (sampled for very large frames)
    unique_counts = {}
    for column in df.columns:
        if df.shape[0] > 5000:
            unique_counts[str(column)] = int(df[column].dropna().nunique())
        else:
            unique_counts[str(column)] = int(df[column].nunique(dropna=True))

    # Per-column missing
    missing_by_column = {
        str(column): int(count) for column, count in df.isna().sum().items() if count > 0
    }

    # Data types and inferred semantic schema per column
    columns_schema = classification.get("columns_schema", {})
    data_types = {}
    for column in df.columns:
        col_str = str(column)
        schema_info = columns_schema.get(col_str)
        if schema_info:
            data_types[col_str] = schema_info.get("inferred_type", str(df[column].dtype))
        else:
            data_types[col_str] = str(df[column].dtype)

    # Empty-string-as-missing counts
    empty_strings = {}
    for column in df.columns:
        if pd.api.types.is_object_dtype(df[column]) or pd.api.types.is_string_dtype(df[column]):
            count = int((df[column].astype("string").fillna("") == "").sum())
            if count > 0:
                empty_strings[str(column)] = count

    # Date issues: values that failed to parse in a column that is mostly dates
    date_issues = {}
    if date_col is not None:
        parsed = try_parse_date_series(df[date_col])
        failed = int(parsed.isna().sum())
        if failed > 0:
            date_issues[str(date_col)] = failed

    invalid_values = _count_invalid_values(df, date_column=date_col)

    # Canonical Health score from DataQualityEngine (guarantee 100% cross-page consistency)
    from app.services.data_quality import DataQualityEngine
    quality_audit = DataQualityEngine.audit_quality(df, date_column=date_col)
    health_score = quality_audit.get("overall_score", 100)

    return {
        "sheet_name": sheet_name,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "numeric_columns": classification["numeric"],
        "categorical_columns": classification["categorical"],
        "date_columns": classification["date"],
        "mixed_columns": classification["mixed"],
        "text_columns": classification["text"],
        "date_column": date_col,
        "has_date": date_col is not None,
        "missing_cells": missing_cells,
        "missing_pct": missing_pct,
        "missing_by_column": missing_by_column,
        "duplicate_rows": duplicate_rows,
        "empty_strings": empty_strings,
        "unique_counts": unique_counts,
        "data_types": data_types,
        "columns_schema": columns_schema,
        "invalid_values": invalid_values,
        "date_issues": date_issues,
        "health_score": health_score,
        "total_cells": total_cells,
        "layout": {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "size": "large" if len(df) >= 1000 else ("medium" if len(df) >= 100 else "small"),
        },
    }


def compute_health_score(
    missing_pct: float,
    duplicate_ratio: float,
    invalid_count: int,
    date_issue_count: int,
    total_cells: int,
    outlier_penalty: float = 0.0,
) -> int:
    """Data-health score from 0..100 based on actual quality signals."""
    score = 100.0

    # Missing values: 15% of the score
    missing_penalty = min(15.0, missing_pct * 0.5)
    score -= missing_penalty

    # Duplicates: 15% of the score
    score -= min(15.0, duplicate_ratio * 0.5)

    # Invalid values: 30% of the score
    invalid_ratio = (invalid_count / total_cells) if total_cells else 0.0
    score -= min(30.0, invalid_ratio * 100 * 3)

    # Date issues: 20% of the score
    date_ratio = (date_issue_count / total_cells) if total_cells else 0.0
    score -= min(20.0, date_ratio * 100 * 5)

    # Outliers: 20% of the score
    score -= min(20.0, outlier_penalty)

    return int(round(max(0, min(100, score))))


def profile_workbook(workbook: dict[str, pd.DataFrame]) -> dict:
    """Profile every sheet - a failing sheet must never break the rest."""
    out = {}
    for name, df in workbook.items():
        if "__error__" in df.columns:
            out[name] = {
                "error": str(df.attrs.get("load_error", "Sheet could not be read")),
                "rows": 0,
                "columns": 0,
            }
            continue
        try:
            out[name] = profile_sheet(df, sheet_name=name)
        except Exception as exc:
            out[name] = {"error": str(exc), "rows": int(len(df)), "columns": int(len(df.columns))}
    return out
