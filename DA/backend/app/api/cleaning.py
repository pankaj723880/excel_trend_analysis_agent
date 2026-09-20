"""Cleaning endpoints. Cleaning ALWAYS runs on a copy - the original uploaded
workbook is never modified."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import CleanRequest
from app.services.data_cleaner import clean_workbook
from app.services.store import get_workbook, set_cleaned_copy

router = APIRouter()


def _get_entry(workbook_id: str) -> dict:
    entry = get_workbook(workbook_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    return entry


@router.post("/clean")
async def clean_workbook_endpoint(request: CleanRequest):
    """Apply cleaning operations to a COPY of the workbook.

    Returns the cleaning report. The user must explicitly call this -
    analysis never triggers cleaning.
    """
    entry = _get_entry(request.workbook_id)
    source_workbook = entry["workbook"]

    options = {
        "trim_text": request.trim_text,
        "standardize_headers": request.standardize_headers,
        "remove_empty_rows": request.remove_empty_rows,
        "remove_empty_columns": request.remove_empty_columns,
        "remove_duplicates": request.remove_duplicates,
        "coerce_numeric": request.coerce_numeric,
        "fill_missing": request.fill_missing,
        "standardize_categories": request.standardize_categories,
        "standardize_dates": request.standardize_dates,
        "remove_outliers": request.remove_outliers,
        "clean_domain_anomalies": request.clean_domain_anomalies,
    }

    if request.sheet_name and request.sheet_name in source_workbook:
        original = source_workbook
        target = {request.sheet_name: source_workbook[request.sheet_name]}
        cleaned, report = clean_workbook(target, options)
        cleaned_workbook = dict(original)
        cleaned_workbook[request.sheet_name] = cleaned[request.sheet_name]
        report_list = report.to_dict(orient="records")
    else:
        cleaned_workbook, report = clean_workbook(source_workbook, options)
        report_list = report.to_dict(orient="records")

    cleaned_report = {
        "sheets": report_list,
        "source_workbook_id": request.workbook_id,
        "note": "Original workbook was not modified. This is a cleaned copy.",
    }

    # Store the cleaned copy (separate from the original analysis)
    set_cleaned_copy(request.workbook_id, cleaned_workbook, cleaned_report)

    return {
        "status": "ok",
        "cleaned": True,
        "report": cleaned_report,
        "workbook_id": request.workbook_id,
    }


@router.get("/workbook/{workbook_id}/cleaning-report")
async def get_cleaning_report(workbook_id: str):
    from app.services.store import get_cleaned_copy

    entry = _get_entry(workbook_id)
    cleaned_copy, cleaning_report = get_cleaned_copy(workbook_id)
    if cleaned_copy is None:
        return {"cleaned": False, "report": None}
    return {"cleaned": True, "report": cleaning_report}


@router.get("/workbook/{workbook_id}/cleaned/preview/{sheet_name}")
async def get_cleaned_preview(workbook_id: str, sheet_name: str):
    from app.services.store import get_cleaned_copy

    entry = _get_entry(workbook_id)
    cleaned_copy, _ = get_cleaned_copy(workbook_id)
    if cleaned_copy is None:
        raise HTTPException(status_code=404, detail="No cleaned copy exists yet")

    df = cleaned_copy.get(sheet_name)
    if df is None:
        raise HTTPException(status_code=404, detail="Sheet not found in cleaned copy")

    records = []
    for _, row in df.head(200).iterrows():
        record = {}
        for column, value in row.items():
            if hasattr(value, "strftime"):
                try:
                    record[str(column)] = value.strftime("%Y-%m-%d")
                    continue
                except Exception:
                    pass
            try:
                import pandas as pd

                if pd.isna(value):
                    record[str(column)] = None
                    continue
            except (TypeError, ValueError):
                pass
            record[str(column)] = value
        records.append(record)

    return {"sheet_name": sheet_name, "preview": records, "rows": int(len(df))}
