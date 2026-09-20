"""Export endpoints: downloadable JSON reports, printable HTML executive reports,
and cleaned Excel workbooks.
"""
from __future__ import annotations

import io
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse

from app.services.ai_report_generator import generate_full_ai_report, generate_report_excel, generate_report_html
from app.services.schema_builder import build_workbook_schema
from app.services.store import get_cleaned_copy, get_workbook

router = APIRouter()


def _get_entry(workbook_id: str) -> dict:
    entry = get_workbook(workbook_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    return entry


@router.get("/export/{workbook_id}")
async def export_analysis(workbook_id: str):
    """Export the full analysis as a JSON report."""
    entry = _get_entry(workbook_id)
    report = {
        "workbook_id": workbook_id,
        "filename": entry["filename"],
        "exported_at": _now_iso(),
        "analysis": entry.get("analysis") or {},
        "profile": entry.get("profile") or {},
    }

    payload = json.dumps(report, default=str, indent=2)
    safe_name = "".join(c for c in entry["filename"] if c.isalnum() or c in "._-").replace(".xlsx", "").replace(".xls", "") or "workbook"

    return StreamingResponse(
        io.BytesIO(payload.encode("utf-8")),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_analysis_report.json"'},
    )


@router.get("/export/{workbook_id}/report-html")
async def export_report_html(workbook_id: str):
    """Generate printable HTML Executive Business Intelligence Report."""
    entry = _get_entry(workbook_id)
    workbook_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    analysis = entry.get("analysis") or {}
    filename = entry.get("filename", "workbook.xlsx")

    schema = build_workbook_schema(workbook_dict, filename)
    report_data = generate_full_ai_report(workbook_id, workbook_dict, analysis, schema)
    html_content = generate_report_html(report_data)

    return HTMLResponse(content=html_content)


@router.get("/export/{workbook_id}/report-excel")
async def export_report_excel(workbook_id: str):
    """Export Executive Report summary as a formatted Excel workbook."""
    entry = _get_entry(workbook_id)
    workbook_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    analysis = entry.get("analysis") or {}
    filename = entry.get("filename", "workbook.xlsx")

    schema = build_workbook_schema(workbook_dict, filename)
    report_data = generate_full_ai_report(workbook_id, workbook_dict, analysis, schema)
    excel_buffer = generate_report_excel(report_data)

    safe_name = "".join(c for c in filename if c.isalnum() or c in "._-").replace(".xlsx", "").replace(".xls", "") or "workbook"

    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_executive_report.xlsx"'},
    )


@router.get("/export/{workbook_id}/cleaned-workbook")
async def export_cleaned_workbook(workbook_id: str):
    """Export the cleaned copy as a new .xlsx workbook."""
    entry = _get_entry(workbook_id)
    cleaned_copy, _ = get_cleaned_copy(workbook_id)
    if cleaned_copy is None:
        raise HTTPException(status_code=404, detail="No cleaned copy exists yet. Run cleaning first.")

    buffer = io.BytesIO()
    try:
        import pandas as pd

        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            for sheet_name, df in cleaned_copy.items():
                if "__error__" in df.columns:
                    continue
                safe_sheet = sheet_name[:31] or "Sheet"
                df.to_excel(writer, sheet_name=safe_sheet, index=False)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not build cleaned workbook: {exc}")

    buffer.seek(0)
    safe_name = "".join(c for c in entry["filename"] if c.isalnum() or c in "._-").replace(".xlsx", "").replace(".xls", "") or "workbook"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_cleaned.xlsx"'},
    )


def _now_iso() -> str:
    from datetime import datetime

    return datetime.utcnow().isoformat()
