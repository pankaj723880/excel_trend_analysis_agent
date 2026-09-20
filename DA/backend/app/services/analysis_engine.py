"""Analysis orchestration: runs the full deterministic pipeline once and caches it.

Pipeline per sheet: profile → EDA → trends → anomalies → correlations → chart data.
A failing sheet never breaks the remaining sheets.
"""
from __future__ import annotations

import time

import pandas as pd

from app.services.anomalies import detect_workbook_anomalies
from app.services.chart_data import build_chart_series
from app.services.correlations import compute_workbook_correlations
from app.services.eda import compute_eda_sheet
from app.services.profiler import profile_workbook
from app.services.structure_detector import classify_columns
from app.services.trends import analyze_trends, pick_best_metric


def _sheet_failure(sheet: str, error: Exception) -> dict:
    return {
        "sheet_name": sheet,
        "status": "error",
        "reason": str(error),
        "profile": {},
        "eda": {},
        "trends": {},
        "anomalies": {"by_metric": {}, "all": [], "total": 0},
        "correlations": {"matrix": {}, "columns": []},
        "chart_data": {"points": [], "has_date": False},
    }


def analyze_sheet(df: pd.DataFrame, sheet: str) -> dict:
    """Run the complete analysis pipeline for a single sheet."""
    if "__error__" in df.columns:
        return {
            "sheet_name": sheet,
            "status": "error",
            "reason": str(df.attrs.get("load_error", "Sheet could not be read")),
        }

    classification = classify_columns(df)
    date_column = classification.get("date_column")
    numeric_cols = classification.get("numeric", [])

    profile = profile_workbook({sheet: df}).get(sheet, {})
    eda = compute_eda_sheet(df, numeric_cols, classification.get("categorical", []))
    trends = analyze_trends(df, date_column=date_column)
    best_metric = pick_best_metric(trends)
    chart_data = build_chart_series(df, metric=best_metric, date_column=date_column)

    return {
        "sheet_name": sheet,
        "status": "ok",
        "profile": profile,
        "eda": eda,
        "trends": trends,
        "best_metric": best_metric,
        "chart_data": chart_data,
        "anomalies": {},
        "correlations": {},
    }


def run_full_analysis(workbook: dict[str, pd.DataFrame]) -> dict:
    """Run the full analysis across the workbook and cache it.

    Anomalies and correlations run across all sheets in a second pass so a
    single sheet's failure does not abort the workbook analysis.
    """
    started = time.time()

    sheets: dict[str, dict] = {}
    for sheet_name, df in workbook.items():
        try:
            sheets[sheet_name] = analyze_sheet(df, sheet_name)
        except Exception as exc:
            sheets[sheet_name] = _sheet_failure(sheet_name, exc)

    # Cross-sheet engines with their own per-sheet isolation
    anomalies = detect_workbook_anomalies(workbook)
    correlations = compute_workbook_correlations(workbook)

    for sheet_name in sheets:
        if sheets[sheet_name].get("status") == "ok":
            sheets[sheet_name]["anomalies"] = anomalies.get(sheet_name, {})
            sheets[sheet_name]["correlations"] = correlations.get(sheet_name, {})

    # Workbook-level aggregates
    total_rows = 0
    total_missing = 0
    total_duplicates = 0
    total_invalid = 0
    health_scores = []
    failed_sheets = 0

    for sheet_name, result in sheets.items():
        profile = result.get("profile", {})
        if result.get("status") == "error" or not profile:
            failed_sheets += 1
            continue
        total_rows += int(profile.get("rows", 0))
        total_missing += int(profile.get("missing_cells", 0))
        total_duplicates += int(profile.get("duplicate_rows", 0))
        total_invalid += sum(int(v) for v in profile.get("invalid_values", {}).values())
        if profile.get("health_score") is not None:
            health_scores.append(int(profile["health_score"]))

    workbook_health = int(round(sum(health_scores) / len(health_scores))) if health_scores else 0

    return {
        "workbook_id": None,
        "generated_at": started,
        "sheet_count": len(sheets),
        "total_rows": total_rows,
        "total_missing": total_missing,
        "total_duplicates": total_duplicates,
        "total_invalid": total_invalid,
        "failed_sheets": failed_sheets,
        "workbook_health": workbook_health,
        "sheets": sheets,
        "profiles": {name: result.get("profile", {}) for name, result in sheets.items()},
        "trends": {name: result.get("trends", {}) for name, result in sheets.items()},
        "anomalies": anomalies,
        "correlations": correlations,
        "all_trends_flat": _flatten_trends(sheets),
    }


def _flatten_trends(sheets: dict) -> list[dict]:
    rows = []
    for sheet_name, result in sheets.items():
        for metric, info in result.get("trends", {}).items():
            if isinstance(info, dict):
                rows.append({"sheet": sheet_name, **info})
    rows.sort(key=lambda item: abs(item.get("trend_score", 0)), reverse=True)
    return rows


def analyze_workbook_summary(analysis: dict) -> dict:
    """Small convenience summary used by the upload endpoint."""
    return {
        "sheets": analysis.get("sheet_count", 0),
        "total_rows": analysis.get("total_rows", 0),
        "total_missing": analysis.get("total_missing", 0),
        "total_duplicates": analysis.get("total_duplicates", 0),
        "workbook_health": analysis.get("workbook_health", 0),
        "failed_sheets": analysis.get("failed_sheets", 0),
    }
