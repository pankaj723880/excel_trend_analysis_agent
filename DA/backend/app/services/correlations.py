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


def compute_correlations(df: pd.DataFrame, method: str = "pearson") -> dict:
    """Compute a correlation matrix and highlight strongest relationships."""
    numeric = df.select_dtypes(include="number")
    numeric = numeric.dropna(axis=1, how="all")

    # Filter out zero variance / constant columns
    useful = []
    constant_columns = []
    for col in numeric.columns:
        non_null = numeric[col].dropna()
        if len(non_null) >= 3:
            if non_null.nunique() >= 2:
                useful.append(col)
            else:
                constant_columns.append(str(col))

    if len(useful) < 2:
        reason = (
            f"Only {len(useful)} usable numeric variable(s) detected. Pairwise correlation requires at least 2 numeric variables with non-zero variance."
            if not constant_columns
            else f"Only {len(useful)} usable numeric variable(s) detected ({', '.join(constant_columns)} has zero variance/constant values). Pairwise correlation requires at least 2 distinct variables."
        )
        return {
            "matrix": {},
            "columns": [str(c) for c in useful],
            "strongest_positive": [],
            "strongest_negative": [],
            "note": reason,
            "status": "insufficient_variables",
        }

    try:
        matrix = numeric[useful].corr(method=method)
    except Exception:
        matrix = numeric[useful].corr(method="pearson")

    cols = list(matrix.columns)
    # Ensure diagonal is exactly 1.0 for valid numeric columns
    for c in cols:
        matrix.loc[c, c] = 1.0

    # Calculate pairwise observation counts
    pairwise_counts = {}
    for c1 in cols:
        pairwise_counts[str(c1)] = {}
        for c2 in cols:
            count = int((numeric[c1].notna() & numeric[c2].notna()).sum())
            pairwise_counts[str(c1)][str(c2)] = count

    relationships = []
    for i, col_a in enumerate(cols):
        for col_b in cols[i + 1 :]:
            value = matrix.loc[col_a, col_b]
            if pd.isna(value):
                continue
            pair_n = pairwise_counts[str(col_a)][str(col_b)]
            relationships.append(
                {
                    "column_a": str(col_a),
                    "column_b": str(col_b),
                    "x": str(col_a),
                    "y": str(col_b),
                    "correlation": round(_as_float(value), 4),
                    "pearson_r": round(_as_float(value), 4),
                    "n": pair_n,
                    "strength": "strong" if abs(value) >= 0.7 else ("moderate" if abs(value) >= 0.4 else "weak"),
                }
            )

    relationships.sort(key=lambda item: abs(item["correlation"]), reverse=True)

    strongest_positive = [r for r in relationships if r["correlation"] > 0][:10]
    strongest_negative = [r for r in relationships if r["correlation"] < 0][:10]

    warnings = []
    if constant_columns:
        warnings.append(f"Excluded constant/zero-variance column(s): {', '.join(constant_columns)}")

    formatted_matrix = {
        str(col): {
            str(other): (1.0 if str(col) == str(other) else (round(_as_float(value), 4) if not pd.isna(value) else None))
            for other, value in row.items()
        }
        for col, row in matrix.iterrows()
    }

    return {
        "numeric_columns": [str(c) for c in cols],
        "columns": [str(c) for c in cols],
        "correlation_matrix": formatted_matrix,
        "matrix": formatted_matrix,
        "pairwise_observation_counts": pairwise_counts,
        "method": method,
        "warnings": warnings,
        "relationships": relationships,
        "strongest_positive": strongest_positive,
        "strongest_negative": strongest_negative,
        "note": "Statistical correlation indicates mathematical association, not causal direction (Correlation ≠ Causation).",
        "status": "ok",
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


def analyze_correlations(df: pd.DataFrame, method: str = "pearson") -> dict:
    """Convenience functional wrapper for compute_correlations."""
    res = compute_correlations(df, method=method)
    res["has_correlations"] = len(res.get("matrix", {})) > 0
    res["explanation"] = res.get("note", "")
    return res
