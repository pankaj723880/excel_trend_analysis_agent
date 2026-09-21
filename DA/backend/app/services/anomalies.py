"""Anomaly engine: multi-method detection (IQR, Z-score, modified Z-score,
sudden-change, domain validation, missing clusters, date anomalies).

Never deletes anything - only flags.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.utils.dates import detect_date_column, coerce_date_column, format_iso
from app.services.validation import DomainValidator


def _iqr_flags(series: pd.Series) -> np.ndarray:
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return np.zeros(len(series), dtype=bool)
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    return ((series < lower) | (series > upper)).to_numpy(dtype=bool)


def _zscore_flags(series: pd.Series, threshold: float = 3.0) -> np.ndarray:
    if series.std(ddof=0) == 0 or series.count() < 4:
        return np.zeros(len(series), dtype=bool)
    z = (series - series.mean()) / series.std(ddof=0)
    return z.abs().gt(threshold).to_numpy(dtype=bool)


def _modified_zscore_flags(series: pd.Series, threshold: float = 3.5) -> np.ndarray:
    if series.count() < 4:
        return np.zeros(len(series), dtype=bool)
    median = series.median()
    mad = (series - median).abs().median()
    if mad == 0:
        # Fall back to std-based MAD substitute
        mad = series.std(ddof=0)
        if mad == 0:
            return np.zeros(len(series), dtype=bool)
    modified_z = 0.6745 * (series - median) / mad
    return modified_z.abs().gt(threshold).to_numpy(dtype=bool)


def _severity(value: float, series: pd.Series, is_domain_violation: bool = False, methods_count: int = 1) -> str:
    """Classify anomaly severity deterministically based on domain violation status,
    multi-method consensus, and standardized deviation magnitude.
    
    Deterministic Severity Logic:
    1. DOMAIN VIOLATIONS:
       - Direct domain/integrity violations (impossible negative counts, invalid percentage >100 or <0)
         are evaluated with higher operational severity:
         - Severe violations or multi-method flagged violations -> 'Critical'
         - Standard domain violations -> 'High'
    2. STATISTICAL OUTLIERS (no domain violation):
       - z > 6.0 or (z > 4.5 and multi-method flagged) -> 'Critical'
       - z > 4.5 or (z > 3.0 and multi-method flagged) -> 'High'
       - z > 2.5 -> 'Medium'
       - Otherwise -> 'Low'
    """
    std_val = series.std(ddof=0)
    mean_val = series.mean()
    z = (abs(value - mean_val) / std_val) if (std_val and not np.isnan(std_val)) else 0.0

    if is_domain_violation:
        if methods_count >= 2 or z > 4.0:
            return "Critical"
        return "High"

    if z > 6.0 or (z > 4.5 and methods_count >= 2):
        return "Critical"
    if z > 4.5 or (z > 3.0 and methods_count >= 2):
        return "High"
    if z > 2.5:
        return "Medium"
    return "Low"


def _row_dates(df: pd.DataFrame, date_column: str | None, index: int):
    if date_column is None or date_column not in df.columns:
        return None
    try:
        return format_iso(df[date_column].iloc[index])
    except Exception:
        return None


def detect_sheet_anomalies(
    df: pd.DataFrame,
    date_column: str | None = None,
    max_anomalies: int = 200,
) -> dict:
    """Detect anomalies across all numeric columns using multiple methods."""
    if date_column is None:
        date_column = detect_date_column(df)

    numeric_columns = df.select_dtypes(include="number").columns.tolist()
    rows_per_column: dict[str, list] = {}
    methods_used: set[str] = set()

    for col in numeric_columns:
        if str(col) == str(date_column) and pd.api.types.is_datetime64_any_dtype(df[col]):
            continue

        series = pd.to_numeric(df[col], errors="coerce")
        cleaned = series.dropna()
        if cleaned.count() < 4:
            rows_per_column[str(col)] = []
            continue

        iqr_flags = _iqr_flags(cleaned)
        z_flags = _zscore_flags(cleaned)
        mz_flags = _modified_zscore_flags(cleaned)

        # Sudden change detection: |diff| > 4 * median(|diff|)
        diffs = cleaned.diff().abs().dropna()
        sudden = np.zeros(len(cleaned), dtype=bool)
        if len(diffs) >= 3 and diffs.median() > 0:
            threshold = 4.0 * diffs.median()
            sudden_values = diffs > threshold
            sudden_idx = np.flatnonzero(sudden_values.to_numpy()) + 1
            sudden[sudden_idx] = True

        # Domain validation via canonical DomainValidator
        val_audit = DomainValidator.validate_sheet(df[[col]])
        violating_indices = set()
        violation_messages = {}
        for v in val_audit.get("violations", []):
            violating_indices.add(v.get("row_index"))
            violation_messages[v.get("row_index")] = v.get("message")

        domain_flags = np.array([idx in violating_indices for idx in cleaned.index], dtype=bool)

        combined = iqr_flags | z_flags | mz_flags | sudden | domain_flags

        if combined.any():
            methods_used.update(["IQR", "Z-score", "Modified Z-score", "Sudden change", "Domain validation"])
            flags_for_col = combined
        else:
            flags_for_col = np.zeros(len(cleaned), dtype=bool)

        col_rows = []
        original_positions = cleaned.index
        for position, flag in enumerate(flags_for_col):
            if not flag:
                continue
            original_idx = original_positions[position]
            value = float(cleaned.iloc[position])
            anomaly_type = _classify_anomaly_type(
                position, iqr_flags, z_flags, mz_flags, sudden, domain_flags, value, cleaned
            )
            # Record which exact methods detected this point
            detected_by = []
            is_statistical = bool(iqr_flags[position] or z_flags[position] or mz_flags[position] or sudden[position])
            is_violation = bool(domain_flags[position])

            if iqr_flags[position]:
                detected_by.append("IQR")
            if z_flags[position] or mz_flags[position]:
                detected_by.append("Z-score")
            if sudden[position]:
                detected_by.append("Sudden change")
            if domain_flags[position]:
                detected_by.append("Domain validation")

            severity = _severity(value, cleaned, is_domain_violation=is_violation, methods_count=len(detected_by))

            category = "invalid_value" if is_violation else "statistical_outlier"
            reason = violation_messages.get(original_idx) if is_violation else f"Deviates from statistical distribution ({', '.join(detected_by)})"

            col_rows.append(
                {
                    "column": str(col),
                    "metric": str(col),
                    "row": int(original_idx) + 1,  # 1-based for display
                    "row_index": int(original_idx),
                    "date": _row_dates(df, date_column, int(original_idx)),
                    "value": value,
                    "type": anomaly_type,
                    "category": category,
                    "severity": severity,
                    "methods": detected_by,
                    "statistical_anomaly": is_statistical,
                    "validation_violation": is_violation,
                    "reason": reason,
                    "primary_method": detected_by[0] if detected_by else "IQR",
                }
            )
            if len(col_rows) >= max_anomalies:
                break
        rows_per_column[str(col)] = col_rows

    all_rows = [row for rows in rows_per_column.values() for row in rows]
    total_detections = len(all_rows)
    unique_rows = len({(r["column"], r["row_index"]) for r in all_rows})

    # Method-specific breakdown counts
    iqr_count = sum(1 for r in all_rows if "IQR" in r.get("methods", []))
    zscore_count = sum(1 for r in all_rows if "Z-score" in r.get("methods", []))
    sudden_count = sum(1 for r in all_rows if "Sudden change" in r.get("methods", []))
    domain_count = sum(1 for r in all_rows if "Domain validation" in r.get("methods", []))

    return {
        "by_metric": rows_per_column,
        "all": all_rows,
        "total": unique_rows,
        "total_detections": total_detections,
        "unique_anomalous_observations": unique_rows,
        "unique_anomaly_count": unique_rows,
        "method_counts": {
            "iqr_outliers": iqr_count,
            "zscore_outliers": zscore_count,
            "sudden_changes": sudden_count,
            "domain_violations": domain_count,
        },
        "iqr_count": iqr_count,
        "zscore_count": zscore_count,
        "sudden_change_count": sudden_count,
        "domain_violations_count": domain_count,
        "methods_used": sorted(methods_used),
        "has_date": date_column is not None,
        "date_column": date_column,
        "note": "No temporal column detected." if date_column is None else None,
    }


def _classify_anomaly_type(
    position: int,
    iqr_flags: np.ndarray,
    z_flags: np.ndarray,
    mz_flags: np.ndarray,
    sudden: np.ndarray,
    domain_flags: np.ndarray,
    value: float,
    cleaned: pd.Series,
) -> str:
    mean = float(cleaned.mean())
    if domain_flags[position]:
        return "Invalid value"
    if sudden[position]:
        diff = value - float(cleaned.iloc[max(0, position - 1)])
        return "Sudden spike" if diff > 0 else "Sudden drop"
    extreme = z_flags[position] or mz_flags[position] or iqr_flags[position]
    if extreme:
        return "Extreme high" if value > mean else "Extreme low"
    return "Outlier"


def detect_missing_clusters(df: pd.DataFrame, date_column: str | None = None) -> list[dict]:
    """Flag consecutive runs of missing values in numeric columns."""
    if date_column is None:
        date_column = detect_date_column(df)

    findings = []
    numeric_columns = df.select_dtypes(include="number").columns.tolist()
    for col in numeric_columns:
        series = pd.to_numeric(df[col], errors="coerce")
        missing = series.isna().to_numpy(dtype=bool)
        run_start = None
        run_length = 0
        for i, is_missing in enumerate(missing):
            if is_missing:
                if run_start is None:
                    run_start = i
                run_length += 1
            else:
                if run_length >= 3 and run_start is not None:
                    findings.append(
                        {
                            "metric": str(col),
                            "type": "Missing cluster",
                            "start_row": run_start + 1,
                            "end_row": i,
                            "count": run_length,
                            "date_start": _row_dates(df, date_column, run_start),
                            "severity": "Medium" if run_length < 10 else "High",
                        }
                    )
                run_start = None
                run_length = 0
        if run_length >= 3 and run_start is not None:
            findings.append(
                {
                    "metric": str(col),
                    "type": "Missing cluster",
                    "start_row": run_start + 1,
                    "end_row": len(missing),
                    "count": run_length,
                    "date_start": _row_dates(df, date_column, run_start),
                    "severity": "Medium" if run_length < 10 else "High",
                }
            )
    return findings


def detect_date_anomalies(df: pd.DataFrame, date_column: str | None = None) -> list[dict]:
    """Flag unparseable dates in a detected date column."""
    if date_column is None:
        date_column = detect_date_column(df)
    if date_column is None:
        return []

    parsed = coerce_date_column(df, date_column)
    findings = []
    for idx, value in enumerate(parsed):
        if pd.isna(value) and pd.notna(df[date_column].iloc[idx]):
            findings.append(
                {
                    "metric": str(date_column),
                    "type": "Date anomaly",
                    "row": int(idx) + 1,
                    "value": str(df[date_column].iloc[idx])[:50],
                    "date": None,
                    "severity": "Low",
                }
            )
    return findings[:100]


def detect_workbook_anomalies(workbook: dict[str, pd.DataFrame]) -> dict[str, dict]:
    """Run anomaly detection on every sheet - never crash the whole run."""
    out = {}
    for name, df in workbook.items():
        if "__error__" in df.columns:
            out[name] = {
                "by_metric": {},
                "all": [],
                "total": 0,
                "methods_used": [],
                "error": str(df.attrs.get("load_error", "Sheet could not be read")),
            }
            continue
        try:
            sheet_anomalies = detect_sheet_anomalies(df)
            sheet_anomalies["missing_clusters"] = detect_missing_clusters(df, sheet_anomalies.get("date_column"))
            sheet_anomalies["date_anomalies"] = detect_date_anomalies(df, sheet_anomalies.get("date_column"))
            out[name] = sheet_anomalies
        except Exception as exc:
            out[name] = {
                "by_metric": {},
                "all": [],
                "total": 0,
                "methods_used": [],
                "error": str(exc),
            }
    return out


def detect_anomalies(df: pd.DataFrame, date_column: str | None = None) -> dict:
    """Convenience functional wrapper for detect_sheet_anomalies."""
    raw = detect_sheet_anomalies(df, date_column=date_column)
    all_anomalies = raw.get("all", [])
    return {
        "summary": {
            "total_outliers": raw.get("total", len(all_anomalies)),
            "methods_used": raw.get("methods_used", []),
        },
        "anomalies": all_anomalies,
        "by_metric": raw.get("by_metric", {}),
    }
