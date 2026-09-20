"""Exploratory Data Analysis: descriptive statistics, distributions, outliers."""
from __future__ import annotations

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
    """Descriptive statistics for numeric columns."""
    result = {}
    for column in numeric_columns:
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if series.empty:
            result[str(column)] = None
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
            "count": int(series.count()),
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
            "missing": int(series.isna().sum()),
            "missing_pct": round(_as_float(series.isna().mean() * 100), 2),
        }
    return result


def categorical_summary(df: pd.DataFrame, categorical_columns: list[str]) -> dict:
    """Top categories per categorical column."""
    result = {}
    for column in categorical_columns:
        series = df[column].dropna().astype(str)
        if series.empty:
            result[str(column)] = {"top_categories": [], "unique": 0}
            continue

        top_categories = []
        for value, count in series.value_counts().head(8).items():
            top_categories.append({"value": str(value), "count": int(count)})

        result[str(column)] = {
            "top_categories": top_categories,
            "unique": int(series.nunique()),
        }
    return result


def compute_eda_sheet(df: pd.DataFrame, numeric_columns: list[str], categorical_columns: list[str]) -> dict:
    """Full EDA payload for one sheet."""
    numeric_stats = numeric_summary(df, numeric_columns)
    cat_stats = categorical_summary(df, categorical_columns)

    # Global outliers via IQR on each numeric column
    outlier_counts = {}
    for column in numeric_columns:
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if series.empty:
            continue
        lower, upper = _outlier_bounds(series)
        if lower is None or upper is None:
            outlier_counts[str(column)] = 0
            continue
        outlier_counts[str(column)] = int(((series < lower) | (series > upper)).sum())

    return {
        "numeric_statistics": numeric_stats,
        "categorical_statistics": cat_stats,
        "outlier_counts": outlier_counts,
        "total_outliers_iqr": int(sum(outlier_counts.values())),
        "columns": [str(c) for c in df.columns],
    }
