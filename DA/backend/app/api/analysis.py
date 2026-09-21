"""Analysis read endpoints: workbook overview, sheets, sheet detail, EDA,
trends, anomalies, correlations."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.analysis_engine import run_full_analysis
from app.services.chart_data import build_chart_series
from app.services.store import get_workbook, save_analysis

router = APIRouter()


def _get_entry(workbook_id: str) -> dict:
    entry = get_workbook(workbook_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    return entry


@router.post("/analyze")
async def analyze(workbook_id: str):
    entry = _get_entry(workbook_id)
    try:
        analysis = run_full_analysis(entry["workbook"])
        save_analysis(workbook_id, analysis)
        return {"status": "ok", "analysis": analysis}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")


@router.get("/workbook/{workbook_id}")
async def get_overview(workbook_id: str):
    entry = _get_entry(workbook_id)
    analysis = entry.get("analysis") or {}
    return {
        "workbook_id": workbook_id,
        "filename": entry["filename"],
        "file_size": _safe_file_size(entry),
        "sheets": list(entry["workbook"].keys()),
        "profile": entry["profile"],
        "analysis_ready": bool(analysis),
        "analysis_version": analysis.get("analysis_version", "2.2.0"),
        "dataset_hash": analysis.get("dataset_hash"),
        "analysis_summary": {
            "sheet_count": analysis.get("sheet_count") or len(entry.get("workbook", {})),
            "total_rows": analysis.get("total_rows") or sum(len(df) for df in (entry.get("workbook") or {}).values()),
            "total_missing": analysis.get("total_missing", 0),
            "total_duplicates": analysis.get("total_duplicates", 0),
            "workbook_health": analysis.get("workbook_health", 85) or 85,
            "failed_sheets": analysis.get("failed_sheets", 0),
        },
    }


def _safe_file_size(entry: dict) -> int:
    try:
        return int(entry.get("file_size", 0))
    except (TypeError, ValueError):
        return 0


@router.get("/workbook/{workbook_id}/sheets")
async def get_sheets(workbook_id: str):
    entry = _get_entry(workbook_id)
    sheets = []
    for name, df in entry["workbook"].items():
        profile = entry.get("profile", {}).get(name, {})
        sheets.append(
            {
                "name": name,
                "rows": int(len(df)),
                "columns": int(len(df.columns)),
                "numeric_columns": profile.get("numeric_columns", []),
                "categorical_columns": profile.get("categorical_columns", []),
                "date_column": profile.get("date_column"),
                "health_score": profile.get("health_score"),
                "status": "error" if "__error__" in df.columns else "ok",
            }
        )
    return {"sheets": sheets}


@router.get("/workbook/{workbook_id}/sheet/{sheet_name}")
async def get_sheet(workbook_id: str, sheet_name: str):
    entry = _get_entry(workbook_id)
    df = entry["workbook"].get(sheet_name)
    if df is None:
        raise HTTPException(status_code=404, detail="Sheet not found")

    analysis = entry.get("analysis", {})
    sheet_analysis = analysis.get("sheets", {}).get(sheet_name, {})
    preview = _json_safe_preview(df)

    return {
        "sheet_name": sheet_name,
        "rows": int(len(df)),
        "columns": [str(c) for c in df.columns],
        "preview": preview,
        "analysis": sheet_analysis,
    }


def _json_safe_preview(df, limit: int = 200) -> list[dict]:
    """Convert preview rows to JSON-safe records."""
    records = []
    for _, row in df.head(limit).iterrows():
        record = {}
        for column, value in row.items():
            if hasattr(value, "item") and hasattr(value, "shape") and getattr(value, "ndim", 0) == 0:
                try:
                    import numpy as np

                    scalar = value.item()
                except Exception:
                    scalar = value
            else:
                scalar = value
            if hasattr(scalar, "strftime"):
                try:
                    record[str(column)] = scalar.strftime("%Y-%m-%d")
                    continue
                except Exception:
                    pass
            try:
                import pandas as pd

                if pd.isna(scalar):
                    record[str(column)] = None
                    continue
            except (TypeError, ValueError):
                pass
            record[str(column)] = scalar
        records.append(record)
    return records


@router.get("/workbook/{workbook_id}/eda")
async def get_eda(workbook_id: str):
    entry = _get_entry(workbook_id)
    analysis = entry.get("analysis", {})
    eda = {}
    for sheet_name, result in analysis.get("sheets", {}).items():
        eda[sheet_name] = {
            "status": result.get("status", "ok"),
            "reason": result.get("reason"),
            "eda": result.get("eda", {}),
            "profile": result.get("profile", {}),
            "quality": result.get("quality", {}),
            "validation": result.get("validation", {}),
            "categorical_inconsistencies": result.get("categorical_inconsistencies", {}),
        }
    return {
        "eda": eda,
        "analysis_version": analysis.get("analysis_version", "2.2.0"),
        "dataset_hash": analysis.get("dataset_hash"),
    }


@router.get("/workbook/{workbook_id}/trends")
async def get_trends(workbook_id: str):
    entry = _get_entry(workbook_id)
    analysis = entry.get("analysis", {})
    return {
        "trends": analysis.get("trends", {}),
        "all_trends_flat": analysis.get("all_trends_flat", []),
    }


@router.get("/workbook/{workbook_id}/anomalies")
async def get_anomalies(workbook_id: str):
    entry = _get_entry(workbook_id)
    analysis = entry.get("analysis", {})
    return {"anomalies": analysis.get("anomalies", {})}


@router.get("/workbook/{workbook_id}/correlations")
async def get_correlations(workbook_id: str):
    entry = _get_entry(workbook_id)
    analysis = entry.get("analysis", {})
    return {"correlations": analysis.get("correlations", {})}


@router.get("/workbook/{workbook_id}/chart/{sheet_name}")
async def get_chart_series(workbook_id: str, sheet_name: str, metric: str | None = None):
    entry = _get_entry(workbook_id)
    df = entry["workbook"].get(sheet_name)
    if df is None:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return build_chart_series(df, metric=metric)
