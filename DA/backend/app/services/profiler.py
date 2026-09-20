"""Workbook / sheet profiler: structure, dtypes, quality signals, health score."""
from __future__ import annotations

import pandas as pd

from app.services.structure_detector import classify_columns
from app.utils.dates import detect_date_column, try_parse_date_series
from app.utils.numbers import parse_numeric_text


def _count_invalid_values(df: pd.DataFrame) -> dict:
    """Count values flagged as invalid per column.

    Invalid = values that are clearly malformed for the column type:
    - numeric columns with NaN-only strings, percentages > 100 or < 0 for
      columns whose name implies percentage, negative values where impossible.
    """
    invalid = {}
    for column in df.columns:
        series = df[column]
        non_null = series.dropna()
        if non_null.empty:
            continue
        count = 0

        if pd.api.types.is_numeric_dtype(series):
            lower = str(column).lower()
            # Percent columns must be within 0..100 (or 0..1 heuristic avoided:
            # we treat the column label as authoritative)
            if any(token in lower for token in ("%", "percent", "rate", "ratio")):
                count += int((non_null < 0).sum() | (non_null > 100).sum())
            # Impossible negative values for count-like columns
            if any(token in lower for token in ("count", "quantity", "qty", "units", "sales", "revenue", "profit")):
                # Negative revenue/sales/counts are usually invalid, but leave
                # profit out of that rule. Sales/revenue/count flagged only.
                if any(token in lower for token in ("count", "quantity", "qty", "units", "sales", "revenue")):
                    count += int((non_null < 0).sum())
            invalid[column] = int(count)
            continue

        # Text columns: count values that look like numbers-with-garbage
        numeric_candidate = parse_numeric_text(non_null)
        parsed_mask = numeric_candidate.notna()
        if parsed_mask.mean() >= 0.5 and parsed_mask.mean() < 0.95:
            # Some values parse, some don't - the unparseable ones are invalid
            invalid[column] = int((~parsed_mask).sum())
        else:
            # Empty strings treated as missing are handled separately
            invalid[column] = 0

    return {col: v for col, v in invalid.items() if v > 0}


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

    # Data types per column
    data_types = {str(column): str(dtype) for column, dtype in df.dtypes.items()}

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

    invalid_values = _count_invalid_values(df)

    # Health score (0-100) from actual quality signals
    health_score = compute_health_score(
        missing_pct=missing_pct,
        duplicate_ratio=(duplicate_rows / len(df)) * 100 if len(df) else 0.0,
        invalid_count=sum(invalid_values.values()),
        date_issue_count=sum(date_issues.values()),
        total_cells=total_cells,
        outlier_penalty=0.0,
    )

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
