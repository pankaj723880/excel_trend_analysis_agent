"""Workbooks API router: complete persistent workbook lifecycle & MongoDB operations."""
from __future__ import annotations

import os
from uuid import uuid4
from typing import Any, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.models.schemas import CleanRequest, AskRequest
from app.services.analysis_engine import analyze_workbook_summary, run_full_analysis
from app.services.excel_loader import load_workbook_data
from app.services.profiler import profile_workbook
from app.services.store import store_workbook, get_workbook, clear_workbook, list_stored_workbooks
from app.services.mongo_store import (
    load_all_workbooks_from_mongo,
    delete_workbook_from_mongo,
    save_conversation_to_mongo,
    load_conversations_from_mongo,
    save_ai_insights_to_mongo,
    save_report_to_mongo,
    load_reports_from_mongo,
    load_all_reports_from_mongo,
    load_cleaning_operations_from_mongo,
)
from app.services.verified_data_agent import ask_verified_agent
from app.services.ai_report_generator import generate_full_ai_report
from app.services.data_cleaner import clean_workbook
from app.services.schema_builder import build_workbook_schema
from app.utils.validators import is_allowed_filename, safe_filename, validate_file_size

router = APIRouter(prefix="/workbooks", tags=["workbooks"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_active_entry(workbook_id: str) -> dict:
    entry = get_workbook(workbook_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Workbook '{workbook_id}' not found.")
    return entry


@router.post("/upload")
async def upload_workbook_endpoint(file: UploadFile = File(...)):
    """Upload workbook, store original in GridFS, profile, analyze & persist to MongoDB."""
    if not is_allowed_filename(file.filename):
        raise HTTPException(status_code=400, detail="Only .xlsx and .xls files are supported.")

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

    try:
        workbook = load_workbook_data(dest)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read workbook: {exc}")

    if not workbook:
        raise HTTPException(status_code=400, detail="Workbook contains no readable sheets.")

    profile = profile_workbook(workbook)

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
        "persisted": True,
    }


@router.get("")
async def list_workbooks():
    """Returns list of all workbooks: merges MongoDB records and in-memory store seamlessly."""
    mongo_wbs = load_all_workbooks_from_mongo()
    mem_wbs = list_stored_workbooks()

    # Merge by workbook_id, preferring mongo if present or mem if fresher
    seen_ids = set()
    combined = []

    for wb in mongo_wbs:
        wid = wb.get("workbook_id")
        if wid:
            seen_ids.add(wid)
            combined.append(wb)

    for wb in mem_wbs:
        wid = wb.get("workbook_id")
        if wid and wid not in seen_ids:
            seen_ids.add(wid)
            combined.append(wb)

    combined.sort(key=lambda x: x.get("created_at") or 0, reverse=True)
    return {"workbooks": combined, "count": len(combined)}


@router.get("/history/all")
async def get_workspace_history(workbook_id: Optional[str] = None):
    """Returns unified chronologically-ordered events across workbooks, queries, reports, and cleaning passes."""
    mongo_wbs = load_all_workbooks_from_mongo()
    mem_wbs = list_stored_workbooks()

    seen_ids = set()
    workbooks = []
    for wb in mongo_wbs:
        wid = wb.get("workbook_id")
        if wid:
            seen_ids.add(wid)
            workbooks.append(wb)
    for wb in mem_wbs:
        wid = wb.get("workbook_id")
        if wid and wid not in seen_ids:
            seen_ids.add(wid)
            workbooks.append(wb)

    items = []

    # 1. Workbook Uploads & Analysis Runs
    for wb in workbooks:
        wid = wb.get("workbook_id")
        if workbook_id and wid != workbook_id:
            continue
        fname = wb.get("filename", "workbook.xlsx")
        sheet_count = wb.get("sheet_count", 1)
        total_rows = wb.get("total_rows", 0)
        health = wb.get("data_health_score", 90)
        created_at = wb.get("created_at") or wb.get("upload_timestamp") or 0

        items.append({
            "id": f"wb_{wid}",
            "workbook_id": wid,
            "filename": fname,
            "type": "workbook",
            "title": f"Workbook Audited: {fname}",
            "timestamp": created_at,
            "details": f"Analyzed {sheet_count} sheet(s) with {total_rows:,} rows. Health score: {health}%. Full EDA, anomalies & trends calculated.",
            "badge": "Analysis Run",
            "badgeColor": "text-primary bg-primary/10 border-primary/20",
        })

    # 2. Conversational Queries
    target_wids = [workbook_id] if workbook_id else list(seen_ids)
    for wid in target_wids:
        convs = load_conversations_from_mongo(wid)
        for c_idx, conv in enumerate(convs):
            q = conv.get("question", "")
            ans = conv.get("AI_answer", "")
            calc = conv.get("calculation_result") or {}
            op = calc.get("operation") or "calculation"
            sheet = conv.get("source_sheet") or calc.get("source_sheet") or "sheet"
            c_time = conv.get("created_at") or 0

            snippet = ans[:160] + ("..." if len(ans) > 160 else "") if ans else "Grounded Pandas computation verified."
            items.append({
                "id": f"conv_{wid}_{c_idx}_{conv.get('_id', c_idx)}",
                "workbook_id": wid,
                "type": "query",
                "title": f"Question: \"{q}\"",
                "timestamp": c_time,
                "details": f"[{op.upper()} on {sheet}] {snippet}",
                "badge": "Ask Your Data",
                "badgeColor": "text-ai bg-ai/10 border-ai/20",
            })

    # 3. Generated Reports
    for wid in target_wids:
        reports = load_reports_from_mongo(wid)
        for r_idx, rep in enumerate(reports):
            title = rep.get("title") or "Executive Intelligence & Performance Audit"
            summary = rep.get("summary") or "Synthesized management brief covering momentum, completeness, and recommended actions."
            r_time = rep.get("generated_at") or 0
            items.append({
                "id": f"rep_{wid}_{r_idx}_{rep.get('_id', r_idx)}",
                "workbook_id": wid,
                "type": "report",
                "title": title,
                "timestamp": r_time,
                "details": summary[:180] + ("..." if len(summary) > 180 else ""),
                "badge": "Report Generated",
                "badgeColor": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            })

    # 4. Cleaning Passes
    cleanings = load_cleaning_operations_from_mongo(workbook_id)
    for cl_idx, cl in enumerate(cleanings):
        wid = cl.get("workbook_id")
        op = cl.get("operation", "data_cleaning")
        aff = cl.get("affected_rows", 0)
        c_time = cl.get("created_at") or 0
        items.append({
            "id": f"cl_{wid}_{cl_idx}_{cl.get('_id', cl_idx)}",
            "workbook_id": wid,
            "type": "cleaning",
            "title": f"Cleaning Pass: {op.replace('_', ' ').capitalize()}",
            "timestamp": c_time,
            "details": f"Processed dataset transformations safely; {aff} cell/row modification(s) applied to copy.",
            "badge": "Cleaning Pass",
            "badgeColor": "text-amber-400 bg-amber-500/10 border-amber-500/20",
        })

    # Sort all items newest first
    items.sort(key=lambda x: x.get("timestamp") or 0, reverse=True)
    return {"items": items, "count": len(items)}



@router.get("/{workbook_id}")
async def get_workbook_details(workbook_id: str):
    """Fetch metadata, sheet profiles, and health score for a specific workbook."""
    entry = _get_active_entry(workbook_id)
    wb_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    profile = entry.get("profile") or {}
    
    return {
        "workbook_id": workbook_id,
        "filename": entry.get("filename"),
        "created_at": entry.get("created_at"),
        "sheet_count": len(wb_dict),
        "total_rows": sum(len(df) for df in wb_dict.values()),
        "profile": profile,
    }


@router.delete("/{workbook_id}")
async def delete_workbook_endpoint(workbook_id: str):
    """Cascade delete workbook document, sheets, sheet data, analysis, insights, conversations & GridFS file."""
    _get_active_entry(workbook_id)
    clear_workbook(workbook_id)
    return {"status": "success", "message": f"Workbook '{workbook_id}' and all associated records deleted."}


@router.get("/{workbook_id}/sheets")
async def get_workbook_sheets(workbook_id: str):
    """Fetch sheet names and column stats."""
    entry = _get_active_entry(workbook_id)
    wb_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    
    result = {}
    for name, df in wb_dict.items():
        result[name] = {
            "name": name,
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": [str(c) for c in df.columns],
        }
    return {"sheets": result}


@router.get("/{workbook_id}/analysis")
async def get_workbook_analysis(workbook_id: str):
    """Retrieve stored deterministic analysis results."""
    entry = _get_active_entry(workbook_id)
    return {
        "workbook_id": workbook_id,
        "analysis": entry.get("analysis") or {},
        "summary": analyze_workbook_summary(entry.get("analysis") or {}),
    }


@router.get("/{workbook_id}/insights")
async def get_workbook_insights(workbook_id: str):
    """Retrieve stored AI insights."""
    from app.services.mongo_store import get_ai_insights_collection
    
    _get_active_entry(workbook_id)
    doc = get_ai_insights_collection().find_one({"workbook_id": workbook_id})
    if doc:
        doc["_id"] = str(doc["_id"])
        return doc
    return {"workbook_id": workbook_id, "insights": None}


@router.get("/{workbook_id}/conversations")
async def get_workbook_conversations(workbook_id: str):
    """Retrieve conversation history for Ask Your Data."""
    _get_active_entry(workbook_id)
    conversations = load_conversations_from_mongo(workbook_id)
    return {"workbook_id": workbook_id, "conversations": conversations, "count": len(conversations)}


class AskQuestionBody(BaseModel):
    question: str


@router.post("/{workbook_id}/ask")
async def ask_workbook_question(workbook_id: str, body: AskQuestionBody):
    """Answer question using Verified Data Agent & store conversation context in MongoDB."""
    entry = _get_active_entry(workbook_id)
    wb_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    filename = entry.get("filename", "workbook.xlsx")

    res = ask_verified_agent(
        workbook_id=workbook_id,
        question=body.question,
        workbook_dict=wb_dict,
        filename=filename,
    )

    # Persist in MongoDB conversations collection
    save_conversation_to_mongo(
        workbook_id=workbook_id,
        question=body.question,
        structured_request=res.get("traceability", {}),
        calculation_result={
            "result_value": res.get("result_value"),
            "formatted_result": res.get("formatted_result"),
            "operation": res.get("operation"),
            "source_sheet": res.get("source_sheet"),
            "columns_used": res.get("columns_used", []),
            "rows_analyzed": res.get("rows_analyzed", 0),
        },
        ai_answer=res.get("answer", ""),
    )

    return {
        "workbook_id": workbook_id,
        "question": body.question,
        **res,
    }


@router.post("/{workbook_id}/generate-report")
async def generate_workbook_report(workbook_id: str):
    """Generate executive report and persist metadata in reports collection."""
    entry = _get_active_entry(workbook_id)
    wb_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    analysis = entry.get("analysis") or {}
    filename = entry.get("filename", "workbook.xlsx")

    schema = build_workbook_schema(wb_dict, filename)
    report_dict = generate_full_ai_report(workbook_id, wb_dict, analysis, schema)
    
    saved_doc = save_report_to_mongo(workbook_id, report_dict)
    return saved_doc


@router.get("/{workbook_id}/reports")
async def list_workbook_reports(workbook_id: str):
    """Get all saved report metadata for a workbook."""
    _get_active_entry(workbook_id)
    reports = load_reports_from_mongo(workbook_id)
    return {"workbook_id": workbook_id, "reports": reports, "count": len(reports)}


@router.post("/{workbook_id}/clean")
async def clean_workbook_endpoint(workbook_id: str, request: CleanRequest):
    """Execute data cleaning pipeline and log transformation operation in cleaning_operations."""
    entry = _get_active_entry(workbook_id)
    raw_wb = entry.get("workbook") or {}

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

    cleaned_dict, report = clean_workbook(raw_wb, options)
    report_dict = report.to_dict(orient="records") if hasattr(report, "to_dict") else report
    from app.services.store import set_cleaned_copy
    set_cleaned_copy(workbook_id, cleaned_dict, report_dict)

    return {
        "workbook_id": workbook_id,
        "status": "cleaned",
        "cleaning_report": report_dict,
    }
