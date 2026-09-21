"""Exploratory Data Analysis: descriptive statistics, distributions, outliers."""
from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd


def _json_safe(value):
    if value is None:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.strftime("%Y-%m-%d")
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def _as_float(value, default: float = 0.0) -> float:
    """Safely convert a pandas scalar to float (guards complex/None)."""
    try:
        result = float(value)
        if np.isnan(result) or np.isinf(result):
            return default
        return result
    except (TypeError, ValueError, OverflowError):
        return default


def _outlier_bounds(series: pd.Series) -> tuple:
    """IQR-based bounds."""
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return None, None
    return q1 - 1.5 * iqr, q3 + 1.5 * iqr


def numeric_summary(df: pd.DataFrame, numeric_columns: list[str]) -> dict:
    """Descriptive statistics for numeric columns.
    
    Guarantees canonical invariant: count + missing == total_rows.
    Calculates missing and count directly from the column series.
    """
    total_rows = len(df)
    result = {}
    for column in numeric_columns:
        col_series = df[column]
        missing_count = int(col_series.isna().sum())
        non_null_count = int(col_series.notna().sum())
        missing_pct = round((missing_count / total_rows * 100), 2) if total_rows > 0 else 0.0

        series = pd.to_numeric(col_series, errors="coerce").dropna()
        if series.empty:
            result[str(column)] = {
                "count": non_null_count,
                "mean": None,
                "median": None,
                "min": None,
                "max": None,
                "std": None,
                "q1": None,
                "q3": None,
                "skewness": None,
                "kurtosis": None,
                "unique": 0,
                "missing": missing_count,
                "missing_pct": missing_pct,
            }
            continue

        try:
            skew = _as_float(series.skew())
        except Exception:
            skew = None
        try:
            kurtosis = _as_float(series.kurt())
        except Exception:
            kurtosis = None

        result[str(column)] = {
            "count": non_null_count,
            "mean": _as_float(series.mean()),
            "median": _as_float(series.median()),
            "min": _as_float(series.min()),
            "max": _as_float(series.max()),
            "std": _as_float(series.std()) if series.count() > 1 else 0.0,
            "q1": _as_float(series.quantile(0.25)),
            "q3": _as_float(series.quantile(0.75)),
            "skewness": skew,
            "kurtosis": kurtosis,
            "unique": int(series.nunique()),
            "missing": missing_count,
            "missing_pct": missing_pct,
        }
    return result


def categorical_summary(df: pd.DataFrame, categorical_columns: list[str]) -> dict:
    """Descriptive statistics and top categories for categorical columns.
    
    Guarantees canonical invariant: count + missing == total_rows.
    """
    total_rows = len(df)
    result = {}
    for column in categorical_columns:
        col_series = df[column]
        missing_count = int(col_series.isna().sum())
        non_null_count = int(col_series.notna().sum())
        missing_pct = round((missing_count / total_rows * 100), 2) if total_rows > 0 else 0.0

        clean_series = col_series.dropna().astype(str)
        if clean_series.empty:
            result[str(column)] = {
                "count": non_null_count,
                "missing": missing_count,
                "missing_pct": missing_pct,
                "unique": 0,
                "top_value": None,
                "top_frequency": 0,
                "top_categories": [],
            }
            continue

        top_categories = []
        value_counts = clean_series.value_counts()
        for value, count in value_counts.head(8).items():
            top_categories.append({"value": str(value), "count": int(count)})

        top_val = str(value_counts.index[0]) if len(value_counts) else None
        top_freq = int(value_counts.iloc[0]) if len(value_counts) else 0

        result[str(column)] = {
            "count": non_null_count,
            "missing": missing_count,
            "missing_pct": missing_pct,
            "unique": int(clean_series.nunique()),
            "top_value": top_val,
            "top_frequency": top_freq,
            "top_categories": top_categories,
        }
    return result


def datetime_summary(df: pd.DataFrame, date_columns: list[str]) -> dict:
    """Descriptive statistics for datetime columns.
    
    Guarantees canonical invariant: count + missing == total_rows.
    """
    total_rows = len(df)
    result = {}
    for column in date_columns:
        col_series = df[column]
        missing_count = int(col_series.isna().sum())
        non_null_count = int(col_series.notna().sum())
        missing_pct = round((missing_count / total_rows * 100), 2) if total_rows > 0 else 0.0

        parsed = pd.to_datetime(col_series, errors="coerce").dropna()
        if parsed.empty:
            result[str(column)] = {
                "count": non_null_count,
                "missing": missing_count,
                "missing_pct": missing_pct,
                "unique": 0,
                "min_date": None,
                "max_date": None,
                "unique_dates": 0,
                "date_span_days": 0,
            }
            continue

        min_dt = parsed.min()
        max_dt = parsed.max()
        span_days = int((max_dt - min_dt).days) if pd.notna(min_dt) and pd.notna(max_dt) else 0

        result[str(column)] = {
            "count": non_null_count,
            "missing": missing_count,
            "missing_pct": missing_pct,
            "unique": int(parsed.nunique()),
            "unique_dates": int(parsed.nunique()),
            "min_date": min_dt.strftime("%Y-%m-%d"),
            "max_date": max_dt.strftime("%Y-%m-%d"),
            "date_span_days": span_days,
        }
    return result


def boolean_summary(df: pd.DataFrame, boolean_columns: list[str]) -> dict:
    """Descriptive statistics for boolean columns.
    
    Guarantees canonical invariant: count + missing == total_rows.
    """
    total_rows = len(df)
    result = {}
    for column in boolean_columns:
        col_series = df[column]
        missing_count = int(col_series.isna().sum())
        non_null_count = int(col_series.notna().sum())
        missing_pct = round((missing_count / total_rows * 100), 2) if total_rows > 0 else 0.0

        clean = col_series.dropna()
        bool_s = clean.astype(bool)
        true_count = int(bool_s.sum())
        false_count = int((~bool_s).sum())
        true_pct = round((true_count / non_null_count * 100), 2) if non_null_count > 0 else 0.0

        result[str(column)] = {
            "count": non_null_count,
            "missing": missing_count,
            "missing_pct": missing_pct,
            "true_count": true_count,
            "false_count": false_count,
            "true_pct": true_pct,
        }
    return result


def text_summary(df: pd.DataFrame, text_columns: list[str]) -> dict:
    """Descriptive statistics for freeform text columns.
    
    Guarantees canonical invariant: count + missing == total_rows.
    """
    total_rows = len(df)
    result = {}
    for column in text_columns:
        col_series = df[column]
        missing_count = int(col_series.isna().sum())
        non_null_count = int(col_series.notna().sum())
        missing_pct = round((missing_count / total_rows * 100), 2) if total_rows > 0 else 0.0

        clean = col_series.dropna().astype(str)
        if clean.empty:
            result[str(column)] = {
                "count": non_null_count,
                "missing": missing_count,
                "missing_pct": missing_pct,
                "unique": 0,
                "avg_length": 0.0,
                "min_length": 0,
                "max_length": 0,
            }
            continue

        lengths = clean.str.len()
        result[str(column)] = {
            "count": non_null_count,
            "missing": missing_count,
            "missing_pct": missing_pct,
            "unique": int(clean.nunique()),
            "avg_length": round(float(lengths.mean()), 1),
            "min_length": int(lengths.min()),
            "max_length": int(lengths.max()),
        }
    return result


def compute_eda_sheet(
    df: pd.DataFrame,
    numeric_columns: list[str],
    categorical_columns: list[str],
    date_columns: list[str] | None = None,
    boolean_columns: list[str] | None = None,
    text_columns: list[str] | None = None,
) -> dict:
    # Safely filter column lists against df.columns
    existing_cols = set(df.columns)
    num_cols = [c for c in numeric_columns if c in existing_cols]
    cat_cols = [c for c in categorical_columns if c in existing_cols]
    date_cols = [c for c in (date_columns or []) if c in existing_cols]
    bool_cols = [c for c in (boolean_columns or []) if c in existing_cols]
    txt_cols = [c for c in (text_columns or []) if c in existing_cols]

    # Auto-detect boolean columns if not provided
    if not bool_cols:
        for col in df.columns:
            if pd.api.types.is_bool_dtype(df[col]):
                bool_cols.append(col)
                if col in cat_cols:
                    cat_cols.remove(col)
                if col in num_cols:
                    num_cols.remove(col)

    numeric_stats = numeric_summary(df, num_cols)
    cat_stats = categorical_summary(df, cat_cols)
    date_stats = datetime_summary(df, date_cols)
    bool_stats = boolean_summary(df, bool_cols)
    text_stats = text_summary(df, txt_cols)

    # Missing values summary per column across the entire sheet
    total_rows = len(df)
    missing_summary = {
        str(col): {
            "count": int(df[col].notna().sum()),
            "missing": int(df[col].isna().sum()),
            "missing_pct": round(int(df[col].isna().sum()) / total_rows * 100, 2) if total_rows > 0 else 0.0,
        }
        for col in df.columns
    }

    # Global outliers via IQR on each numeric column
    outlier_counts = {}
    for column in num_cols:
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if series.empty:
            continue
        lower, upper = _outlier_bounds(series)
        if lower is None or upper is None:
            outlier_counts[str(column)] = 0
            continue
        outlier_counts[str(column)] = int(((series < lower) | (series > upper)).sum())

    total_cells = total_rows * len(df.columns)
    total_missing_cells = sum(m["missing"] for m in missing_summary.values())

    metadata = {
        "row_count": total_rows,
        "column_count": len(df.columns),
        "total_cells": total_cells,
        "missing_cells": total_missing_cells,
        "missing_by_column": {
            col: {
                "count": info["missing"],
                "percentage": info["missing_pct"],
            }
            for col, info in missing_summary.items()
        },
    }

    return {
        "numeric_statistics": numeric_stats,
        "categorical_statistics": cat_stats,
        "datetime_statistics": date_stats,
        "boolean_statistics": bool_stats,
        "text_statistics": text_stats,
        "missing_summary": missing_summary,
        "metadata": metadata,
        "row_count": total_rows,
        "column_count": len(df.columns),
        "total_cells": total_cells,
        "missing_cells": total_missing_cells,
        "duplicate_count": int(df.duplicated().sum()),
        "outlier_counts": outlier_counts,
        "total_outliers_iqr": int(sum(outlier_counts.values())),
        "columns": [str(c) for c in df.columns],
    }
