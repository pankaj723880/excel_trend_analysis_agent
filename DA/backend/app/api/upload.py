"""Upload endpoint: validate, persist read-only copy, profile + analyze."""
from __future__ import annotations

import os
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.analysis_engine import analyze_workbook_summary, run_full_analysis
from app.services.excel_loader import load_workbook_data
from app.services.profiler import profile_workbook
from app.services.store import store_workbook
from app.utils.validators import is_allowed_filename, safe_filename, validate_file_size

router = APIRouter()

UPLOAD_DIR = os.environ.get("UPLOAD_DIR") or os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_workbook(file: UploadFile = File(...)):
    if not is_allowed_filename(file.filename):
        raise HTTPException(
            status_code=400,
            detail="Only .xlsx and .xls files are supported.",
        )

    workbook_id = str(uuid4())
    safe_name = safe_filename(file.filename or "workbook.xlsx")
    dest = os.path.join(UPLOAD_DIR, f"{workbook_id}_{safe_name}")

    try:
        content = await file.read()
        validate_file_size(len(content))
        with open(dest, "wb") as handle:
            handle.write(content)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not store upload: {exc}")

    # Read-only load - the original file on disk is never modified
    try:
        workbook = load_workbook_data(dest)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read workbook: {exc}")

    if not workbook:
        raise HTTPException(status_code=400, detail="Workbook contains no readable sheets.")

    profile = profile_workbook(workbook)

    # Full deterministic analysis runs automatically on upload
    try:
        analysis = run_full_analysis(workbook)
    except Exception as exc:
        analysis = {"error": str(exc), "sheets": {}}

    store_workbook(workbook_id, dest, safe_name, workbook, profile, analysis)

    return {
        "workbook_id": workbook_id,
        "filename": safe_name,
        "file_size": len(content),
        "sheets": list(workbook.keys()),
        "profile": profile,
        "analysis_summary": analyze_workbook_summary(analysis),
        "analysis_ready": True,
    }
