"""Correlation engine: matrix + strongest positive/negative relationships."""
from __future__ import annotations

import numpy as np
import pandas as pd


def _as_float(value, default: float = 0.0) -> float:
    """Safely convert a pandas scalar to float (guards complex/None)."""
    try:
        result = float(value)
        if np.isnan(result) or np.isinf(result):
            return default
        return result
    except (TypeError, ValueError, OverflowError):
        return default


def compute_correlations(df: pd.DataFrame) -> dict:
    """Compute a correlation matrix and highlight strongest relationships."""
    numeric = df.select_dtypes(include="number")
    numeric = numeric.dropna(axis=1, how="all")

    # Keep only columns with enough non-null pairs for a stable correlation
    useful = []
    for col in numeric.columns:
        non_null = numeric[col].dropna()
        if len(non_null) >= 5 and non_null.nunique() >= 2:
            useful.append(col)

    if len(useful) < 2:
        return {
            "matrix": {},
            "columns": [],
            "strongest_positive": [],
            "strongest_negative": [],
            "note": "Not enough numeric columns to compute correlations.",
        }

    matrix = numeric[useful].corr()

    relationships = []
    cols = list(matrix.columns)
    for i, col_a in enumerate(cols):
        for col_b in cols[i + 1 :]:
            value = matrix.loc[col_a, col_b]
            if pd.isna(value):
                continue
            relationships.append(
                {
                    "x": str(col_a),
                    "y": str(col_b),
                    "correlation": round(_as_float(value), 4),
                }
            )

    relationships.sort(key=lambda item: abs(item["correlation"]), reverse=True)

    strongest_positive = [r for r in relationships if r["correlation"] > 0][:10]
    strongest_negative = [r for r in relationships if r["correlation"] < 0][:10]

    return {
        "matrix": {
            str(col): {
                str(other): round(_as_float(value), 4) if not pd.isna(value) else None
                for other, value in row.items()
            }
            for col, row in matrix.iterrows()
        },
        "columns": [str(c) for c in cols],
        "strongest_positive": strongest_positive,
        "strongest_negative": strongest_negative,
        "note": "Correlation does not imply causation.",
    }


def compute_workbook_correlations(workbook: dict[str, pd.DataFrame]) -> dict[str, dict]:
    """Compute correlations for every sheet - isolated failures per sheet."""
    out = {}
    for name, df in workbook.items():
        if "__error__" in df.columns:
            out[name] = {
                "matrix": {},
                "columns": [],
                "strongest_positive": [],
                "strongest_negative": [],
                "error": str(df.attrs.get("load_error", "Sheet could not be read")),
            }
            continue
        try:
            out[name] = compute_correlations(df)
        except Exception as exc:
            out[name] = {
                "matrix": {},
                "columns": [],
                "strongest_positive": [],
                "strongest_negative": [],
                "error": str(exc),
            }
    return out
