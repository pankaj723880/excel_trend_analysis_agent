"""Analysis orchestration: runs the full deterministic pipeline once and caches it.

Pipeline per sheet:
Schema Detection
  ↓
Validation (DomainValidator)
  ↓
EDA (Exploratory Data Analysis)
  ↓
Data Quality (100% 5-Pillar Score)
  ↓
Anomaly Analysis (Statistical vs Validation separation)
  ↓
Trend Analysis
  ↓
Correlation Analysis
  ↓
KPI Engine
  ↓
One Canonical AnalysisResult

A failing sheet never breaks the remaining sheets.
"""
from __future__ import annotations

import hashlib
import time
from typing import Any

import pandas as pd

from app.services.anomalies import detect_workbook_anomalies
from app.services.chart_data import build_chart_series
from app.services.correlations import compute_workbook_correlations
from app.services.cross_sheet import detect_cross_sheet_relationships
from app.services.data_normalizer import DataNormalizer
from app.services.data_quality import DataQualityEngine
from app.services.eda import compute_eda_sheet
from app.services.kpi_engine import GenericKPIEngine
from app.services.profiler import profile_workbook
from app.services.structure_detector import classify_columns
from app.services.trends import analyze_trends, pick_best_metric
from app.services.validation import DomainValidator, detect_categorical_inconsistencies


def compute_dataset_hash(workbook: dict[str, pd.DataFrame]) -> str:
    """Compute a deterministic hash of all sheet shapes, column names, and sample values."""
    hasher = hashlib.sha256()
    for sheet_name in sorted(workbook.keys()):
        df = workbook[sheet_name]
        hasher.update(sheet_name.encode("utf-8"))
        hasher.update(str(df.shape).encode("utf-8"))
        hasher.update(",".join(str(c) for c in df.columns).encode("utf-8"))
        if not df.empty:
            head_str = str(df.head(10).values.tolist())
            hasher.update(head_str.encode("utf-8"))
    return hasher.hexdigest()[:16]


def _sheet_failure(sheet: str, error: Exception) -> dict:
    return {
        "sheet_name": sheet,
        "status": "error",
        "reason": str(error),
        "profile": {},
        "eda": {},
        "trends": {},
        "kpis": [],
        "validation": {
            "total_violations": 0,
            "violations": [],
            "by_column": {},
            "by_rule": {},
            "by_severity": {"error": 0, "warning": 0},
            "status": "error",
        },
        "quality": {
            "overall_score": 0,
            "overall_raw": 0.0,
            "dimensions": {},
            "core_health": {},
            "statistical_observations": {"outliers_count": 0, "statistical_anomalies_count": 0},
            "issues": [{"severity": "critical", "message": str(error)}],
            "recommendations": [],
        },
        "anomalies": {"by_metric": {}, "all": [], "total": 0},
        "correlations": {"matrix": {}, "columns": []},
        "chart_data": {"points": [], "has_date": False},
        "transformations": [],
    }


def analyze_sheet(df: pd.DataFrame, sheet: str) -> dict:
    """Run the complete canonical analysis pipeline for a single sheet."""
    if "__error__" in df.columns:
        return {
            "sheet_name": sheet,
            "status": "error",
            "reason": str(df.attrs.get("load_error", "Sheet could not be read")),
        }

    # 1. Safe normalization on an isolated copy
    normalized_df, transformations, col_mapping = DataNormalizer.normalize_dataframe(df)

    # 2. Schema and column classification
    classification = classify_columns(normalized_df)
    date_column = classification.get("date_column")
    numeric_cols = classification.get("numeric", [])
    cat_cols = classification.get("categorical", [])
    date_cols = classification.get("date", [])

    # 3. Canonical Domain Validation
    validation = DomainValidator.validate_sheet(df, date_column=date_column)

    # 4. Canonical Categorical Inconsistencies
    categorical_inconsistencies = detect_categorical_inconsistencies(df)

    # 5. Comprehensive 5-pillar data quality audit (100% weight model)
    quality = DataQualityEngine.audit_quality(df, date_column=date_column)

    # 6. Profile sheet with aligned health score & counts
    profile = profile_workbook({sheet: df}).get(sheet, {})
    profile["health_score"] = quality.get("overall_score", profile.get("health_score", 85))

    # 7. Canonical EDA (computed on raw df column counts, normalized for distributions)
    eda = compute_eda_sheet(normalized_df, numeric_cols, cat_cols, date_columns=date_cols)

    # 8. Canonical Trends
    trends = analyze_trends(normalized_df, date_column=date_column)
    best_metric = pick_best_metric(trends)
    chart_data = build_chart_series(normalized_df, metric=best_metric, date_column=date_column)

    # 9. Dynamic KPI engine
    kpis = GenericKPIEngine.compute_sheet_kpis(normalized_df, sheet, date_column=date_column, trends=trends)

    return {
        "sheet_name": sheet,
        "status": "ok",
        "profile": profile,
        "quality": quality,
        "validation": validation,
        "categorical_inconsistencies": categorical_inconsistencies,
        "eda": eda,
        "trends": trends,
        "kpis": kpis,
        "best_metric": best_metric,
        "chart_data": chart_data,
        "transformations": transformations,
        "column_mapping": col_mapping,
        "anomalies": {},
        "correlations": {},
    }


def run_full_analysis(workbook: dict[str, pd.DataFrame]) -> dict:
    """Run the full canonical deterministic analysis across the workbook and cache it."""
    started = time.time()
    dataset_hash = compute_dataset_hash(workbook)

    sheets: dict[str, dict] = {}
    for sheet_name, df in workbook.items():
        try:
            sheets[sheet_name] = analyze_sheet(df, sheet_name)
        except Exception as exc:
            sheets[sheet_name] = _sheet_failure(sheet_name, exc)

    # Cross-sheet engines with their own per-sheet isolation
    anomalies = detect_workbook_anomalies(workbook)
    correlations = compute_workbook_correlations(workbook)
    cross_sheet_analysis = detect_cross_sheet_relationships(workbook)

    for sheet_name in sheets:
        if sheets[sheet_name].get("status") == "ok":
            sheet_anom = anomalies.get(sheet_name, {})
            sheets[sheet_name]["anomalies"] = sheet_anom
            sheets[sheet_name]["correlations"] = correlations.get(sheet_name, {})

            # Sync statistical observations count in quality object
            if "quality" in sheets[sheet_name] and "statistical_observations" in sheets[sheet_name]["quality"]:
                outliers_cnt = sheet_anom.get("method_counts", {}).get("iqr_outliers", 0)
                anom_cnt = sheet_anom.get("unique_anomalous_observations", sheet_anom.get("total", 0))
                sheets[sheet_name]["quality"]["statistical_observations"]["outliers_count"] = outliers_cnt
                sheets[sheet_name]["quality"]["statistical_observations"]["statistical_anomalies_count"] = anom_cnt

    # Workbook-level aggregates
    total_rows = 0
    total_missing = 0
    total_duplicates = 0
    total_invalid = 0
    health_scores = []
    failed_sheets = 0
    all_kpis = []

    for sheet_name, result in sheets.items():
        profile = result.get("profile", {})
        if result.get("status") == "error" or not profile:
            failed_sheets += 1
            continue
        total_rows += int(profile.get("rows", 0))
        total_missing += int(profile.get("missing_cells", 0))
        total_duplicates += int(profile.get("duplicate_rows", 0))
        total_invalid += sum(int(v) for v in profile.get("invalid_values", {}).values())
        quality_score = result.get("quality", {}).get("overall_score")
        if quality_score is not None:
            health_scores.append(int(quality_score))
        elif profile.get("health_score") is not None:
            health_scores.append(int(profile["health_score"]))

        sheet_kpis = result.get("kpis", [])
        if sheet_kpis:
            all_kpis.extend(sheet_kpis)

    workbook_health = int(round(sum(health_scores) / len(health_scores))) if health_scores else 0

    analysis_result = {
        "workbook_id": None,
        "analysis_version": "2.3.0",
        "dataset_hash": dataset_hash,
        "engine_version": "2.3.0",
        "schema_version": "2.3",
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
        "quality": {name: result.get("quality", {}) for name, result in sheets.items()},
        "validation": {name: result.get("validation", {}) for name, result in sheets.items()},
        "trends": {name: result.get("trends", {}) for name, result in sheets.items()},
        "kpis": {name: result.get("kpis", []) for name, result in sheets.items()},
        "all_kpis": all_kpis,
        "anomalies": anomalies,
        "correlations": correlations,
        "cross_sheet_analysis": cross_sheet_analysis,
        "all_trends_flat": _flatten_trends(sheets),
    }

    # Internal consistency audit
    validate_analysis_consistency(analysis_result)

    return analysis_result


def validate_analysis_consistency(analysis_result: dict[str, Any]) -> list[str]:
    """Validates mathematical and structural invariants across the analysis result."""
    inconsistencies = []

    for sheet_name, sheet in analysis_result.get("sheets", {}).items():
        if sheet.get("status") != "ok":
            continue

        eda = sheet.get("eda", {})
        quality = sheet.get("quality", {})
        validation = sheet.get("validation", {})
        anomalies = sheet.get("anomalies", {})

        total_rows = eda.get("row_count", 0)

        # 1. Invariant: count + missing == total_rows for every column in missing_summary
        missing_summary = eda.get("missing_summary", {})
        for col, stats in missing_summary.items():
            c = stats.get("count", 0)
            m = stats.get("missing", 0)
            if c + m != total_rows:
                inconsistencies.append(
                    f"Sheet '{sheet_name}' column '{col}': count ({c}) + missing ({m}) != total_rows ({total_rows})"
                )

        # 2. Invariant: quality weights sum to 1.0
        weights = [v.get("weight", 0) for v in quality.get("dimensions_detail", {}).values()]
        if weights and abs(sum(weights) - 1.0) > 1e-9:
            inconsistencies.append(f"Sheet '{sheet_name}' quality weights do not sum to 1.0 (sum={sum(weights)})")

        # 3. Invariant: overall_score equals weighted sum of dimensions
        dim_details = quality.get("dimensions_detail", {})
        if dim_details:
            expected_score = round(sum(v["score"] * v["weight"] for v in dim_details.values()), 2)
            actual_raw = quality.get("overall_raw", 0.0)
            if abs(expected_score - actual_raw) > 0.05:
                inconsistencies.append(
                    f"Sheet '{sheet_name}' quality overall_raw ({actual_raw}) != weighted sum ({expected_score})"
                )

    if inconsistencies:
        import logging
        logging.getLogger(__name__).warning("Analysis consistency validation flagged issues: %s", inconsistencies)

    return inconsistencies


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


def analyze_workbook(workbook: dict[str, pd.DataFrame]) -> dict:
    """Convenience alias for run_full_analysis."""
    return run_full_analysis(workbook)
