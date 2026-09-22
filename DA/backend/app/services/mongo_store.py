"""MongoDB Persistence Service layer for Excel Intelligence.

Handles GridFS binary file storage, chunked dataset row persistence,
analysis results, AI insights, conversation context, cleaning logs, and report metadata.
"""
from __future__ import annotations

import logging
import time
from typing import Any
import numpy as np
import pandas as pd
from bson import ObjectId

from app.db.mongo import (
    get_gridfs,
    get_users_collection,
    get_workbooks_collection,
    get_workbook_sheets_collection,
    get_sheet_data_collection,
    get_analysis_results_collection,
    get_ai_insights_collection,
    get_conversations_collection,
    get_cleaning_operations_collection,
    get_reports_collection,
    validate_mongo_connection,
)

logger = logging.getLogger(__name__)

DEFAULT_USER_ID = "default_user_1"
CHUNK_SIZE = 500  # Store dataset rows in 500-row documents to respect 16MB BSON limit


def get_or_create_default_user() -> dict:
    """Ensures a default system user document exists in the users collection."""
    col = get_users_collection()
    user = col.find_one({"user_id": DEFAULT_USER_ID})
    if not user:
        user_doc = {
            "user_id": DEFAULT_USER_ID,
            "name": "Default Analyst",
            "email": "analyst@excel-intelligence.local",
            "created_at": time.time(),
            "updated_at": time.time(),
        }
        col.insert_one(user_doc)
        return user_doc
    return user


def _sanitize_for_mongo(obj: Any) -> Any:
    """Recursively converts NumPy, Pandas, NaN, Inf, and Timestamp objects to BSON-safe types."""
    if obj is None:
        return None
    elif isinstance(obj, (list, tuple, set, np.ndarray, pd.Series)):
        return [_sanitize_for_mongo(v) for v in obj]
    elif isinstance(obj, dict):
        return {str(k): _sanitize_for_mongo(v) for k, v in obj.items()}
    elif isinstance(obj, (int, float, str, bool)):
        if isinstance(obj, float) and (np.isinf(obj) or np.isnan(obj)):
            return None
        return obj
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        val = float(obj)
        if np.isinf(val) or np.isnan(val):
            return None
        return val
    elif isinstance(obj, (pd.Timestamp, np.datetime64)):
        return str(obj)
    elif pd.isna(obj):
        return None
    return str(obj)


def save_workbook_to_mongo(
    workbook_id: str,
    file_path: str | None,
    filename: str,
    workbook_dict: dict[str, pd.DataFrame],
    profile: dict[str, Any],
    analysis: dict[str, Any] | None = None,
    user_id: str = DEFAULT_USER_ID,
) -> dict[str, Any]:
    """Persists an uploaded workbook into MongoDB and GridFS.
    
    1. Stores original binary file in GridFS.
    2. Creates workbook metadata document in `workbooks`.
    3. Creates sheet metadata documents in `workbook_sheets`.
    4. Persists chunked dataset rows into `sheet_data`.
    5. Stores deterministic analysis results in `analysis_results`.
    """
    if not validate_mongo_connection():
        logger.warning("MongoDB unavailable, skipping persistent save.")
        return {}

    gridfs_file_id = None
    file_size = 0
    if file_path and pd.io.common.file_exists(file_path):
        try:
            fs = get_gridfs()
            with open(file_path, "rb") as f:
                content = f.read()
                file_size = len(content)
                gridfs_file_id = fs.put(
                    content,
                    filename=filename,
                    workbook_id=workbook_id,
                    user_id=user_id,
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
        except Exception as fs_err:
            logger.warning(f"Could not store binary file in GridFS: {fs_err}")

    # Calculate overall metrics
    sheet_count = len(workbook_dict)
    total_rows = sum(len(df) for df in workbook_dict.values())
    total_cols = sum(len(df.columns) for df in workbook_dict.values())
    data_health = profile.get("health_score", 85) if profile else 85

    now = time.time()
    workbook_doc = {
        "workbook_id": workbook_id,
        "user_id": user_id,
        "filename": filename,
        "original_filename": filename,
        "file_size": file_size,
        "upload_timestamp": now,
        "status": "active",
        "sheet_count": sheet_count,
        "total_rows": total_rows,
        "total_columns": total_cols,
        "data_health_score": data_health,
        "gridfs_file_id": str(gridfs_file_id) if gridfs_file_id else None,
        "created_at": now,
        "updated_at": now,
    }

    # Upsert workbook document
    get_workbooks_collection().replace_one(
        {"workbook_id": workbook_id},
        workbook_doc,
        upsert=True,
    )

    # Store Workbook Sheets metadata
    get_workbook_sheets_collection().delete_many({"workbook_id": workbook_id})
    sheets_docs = []
    for sheet_name, df in workbook_dict.items():
        columns_meta = []
        sheet_prof = profile.get("sheets", {}).get(sheet_name, {}) if profile else {}
        for col in df.columns:
            col_str = str(col)
            missing_count = int(df[col_str].isna().sum()) if col_str in df.columns else 0
            missing_pct = round((missing_count / (len(df) or 1)) * 100, 2)
            unique_cnt = int(df[col_str].nunique(dropna=True)) if col_str in df.columns else 0
            samples = [_sanitize_for_mongo(v) for v in df[col_str].dropna().head(3).tolist()] if col_str in df.columns else []

            dtype_str = str(df[col_str].dtype) if col_str in df.columns else "object"
            columns_meta.append({
                "name": col_str,
                "data_type": dtype_str,
                "missing_count": missing_count,
                "missing_percentage": missing_pct,
                "unique_count": unique_cnt,
                "sample_values": samples,
            })

        sheets_docs.append({
            "workbook_id": workbook_id,
            "name": sheet_name,
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": columns_meta,
            "created_at": now,
        })

    if sheets_docs:
        get_workbook_sheets_collection().insert_many(sheets_docs)

    # Store Sheet Data Rows in 500-row chunks
    get_sheet_data_collection().delete_many({"workbook_id": workbook_id})
    chunk_docs = []
    for sheet_name, df in workbook_dict.items():
        records = df.to_dict(orient="records")
        for chunk_idx in range(0, len(records), CHUNK_SIZE):
            chunk_slice = records[chunk_idx : chunk_idx + CHUNK_SIZE]
            sanitized_rows = [_sanitize_for_mongo(row) for row in chunk_slice]
            chunk_docs.append({
                "workbook_id": workbook_id,
                "sheet_name": sheet_name,
                "chunk_index": chunk_idx // CHUNK_SIZE,
                "start_row": chunk_idx,
                "end_row": chunk_idx + len(chunk_slice),
                "rows": sanitized_rows,
                "columns": [str(c) for c in df.columns],
                "created_at": now,
            })

    if chunk_docs:
        get_sheet_data_collection().insert_many(chunk_docs)

    # Store Analysis Results
    if analysis:
        save_analysis_to_mongo(workbook_id, analysis)

    logger.info(f"Successfully persisted workbook '{filename}' ({workbook_id}) to MongoDB.")
    return workbook_doc


def save_analysis_to_mongo(workbook_id: str, analysis: dict[str, Any]) -> None:
    """Stores deterministic analysis results in analysis_results collection."""
    if not validate_mongo_connection():
        return

    sanitized_analysis = _sanitize_for_mongo(analysis)
    doc = {
        "workbook_id": workbook_id,
        "analysis_version": analysis.get("analysis_version", "2.1"),
        "engine_version": analysis.get("engine_version", "2.1.0"),
        "schema_version": analysis.get("schema_version", "2.0"),
        "created_at": time.time(),
        "analysis": sanitized_analysis,
    }
    get_analysis_results_collection().replace_one(
        {"workbook_id": workbook_id},
        doc,
        upsert=True,
    )


def save_ai_insights_to_mongo(
    workbook_id: str,
    insights: dict[str, Any],
    analysis_id: str | None = None,
) -> None:
    """Stores AI-generated executive insights in ai_insights collection."""
    if not validate_mongo_connection():
        return

    sanitized = _sanitize_for_mongo(insights)
    doc = {
        "workbook_id": workbook_id,
        "analysis_id": analysis_id or workbook_id,
        "summary": sanitized.get("summary", ""),
        "key_findings": sanitized.get("key_findings", []),
        "positive_findings": sanitized.get("positive_findings", []),
        "negative_findings": sanitized.get("negative_findings", []),
        "anomalies": sanitized.get("anomalies", []),
        "areas_to_investigate": sanitized.get("areas_to_investigate", []),
        "recommendations": sanitized.get("recommendations", []),
        "confidence": sanitized.get("confidence", "High"),
        "full_response": sanitized,
        "generated_at": time.time(),
    }
    get_ai_insights_collection().replace_one(
        {"workbook_id": workbook_id},
        doc,
        upsert=True,
    )


def load_workbook_from_mongo(workbook_id: str) -> dict[str, Any] | None:
    """Restores a workbook and its DataFrames from MongoDB after server restart.
    
    Returns standard in-memory store dictionary entry.
    """
    if not validate_mongo_connection():
        return None

    wb_doc = get_workbooks_collection().find_one({"workbook_id": workbook_id})
    if not wb_doc:
        return None

    # Reconstruct sheet DataFrames from sheet_data chunks
    cursor = get_sheet_data_collection().find({"workbook_id": workbook_id}).sort([("sheet_name", 1), ("chunk_index", 1)])
    sheet_chunks: dict[str, list[dict]] = {}
    sheet_columns: dict[str, list[str]] = {}

    for doc in cursor:
        sname = doc.get("sheet_name", "Sheet1")
        if sname not in sheet_chunks:
            sheet_chunks[sname] = []
            sheet_columns[sname] = doc.get("columns", [])
        sheet_chunks[sname].extend(doc.get("rows", []))

    workbook_dict: dict[str, pd.DataFrame] = {}
    for sname, rows in sheet_chunks.items():
        if rows:
            df = pd.DataFrame(rows)
            # Retain column order if available
            cols = sheet_columns.get(sname)
            if cols:
                existing = [c for c in cols if c in df.columns]
                df = df[existing]
            workbook_dict[sname] = df
        else:
            workbook_dict[sname] = pd.DataFrame()

    if not workbook_dict:
        logger.warning(f"No sheet data rows found for workbook {workbook_id}.")
        return None

    # Load stored analysis or compute if missing/outdated
    analysis_doc = get_analysis_results_collection().find_one({"workbook_id": workbook_id})
    analysis = analysis_doc.get("analysis", {}) if (analysis_doc and isinstance(analysis_doc.get("analysis"), dict)) else {}

    # If analysis version is outdated (< 2.3.0) or missing key structures, re-run canonical analysis
    version = str(analysis.get("analysis_version", ""))
    needs_refresh = (
        not analysis
        or "sheets" not in analysis
        or not analysis.get("sheets")
        or version < "2.3.0"
    )

    if needs_refresh:
        try:
            from app.services.analysis_engine import run_full_analysis
            analysis = run_full_analysis(workbook_dict)
            save_analysis_to_mongo(workbook_id, analysis)
        except Exception as a_err:
            logger.warning(f"Could not re-run analysis for {workbook_id}: {a_err}")
            analysis = {}

    # Build full sheet profiles using profiler
    try:
        from app.services.profiler import profile_workbook
        profile = profile_workbook(workbook_dict)
    except Exception as p_err:
        logger.warning(f"Could not re-profile workbook {workbook_id}: {p_err}")
        profile = {}

    entry = {
        "id": workbook_id,
        "path": None,
        "filename": wb_doc.get("filename", "workbook.xlsx"),
        "workbook": workbook_dict,
        "profile": profile,
        "analysis": analysis,
        "cleaned_copy": None,
        "cleaning_report": None,
        "mis_mapping": {},
        "mis_exceptions": {},
        "mis_activity_log": [
            {"timestamp": time.strftime("%d %b %H:%M"), "event": "Restored from MongoDB persistence"}
        ],
        "mis_scheduled_reports": [],
        "mis_validation_rules": {},
        "created_at": wb_doc.get("created_at", time.time()),
        "last_access": time.time(),
    }

    return entry


def delete_workbook_from_mongo(workbook_id: str) -> bool:
    """Cascade deletes a workbook and all associated records from all 9 collections & GridFS."""
    if not validate_mongo_connection():
        return False

    wb_doc = get_workbooks_collection().find_one({"workbook_id": workbook_id})
    if wb_doc and wb_doc.get("gridfs_file_id"):
        try:
            fs = get_gridfs()
            fs.delete(ObjectId(wb_doc["gridfs_file_id"]))
        except Exception as fs_del_err:
            logger.warning(f"Could not delete GridFS file: {fs_del_err}")

    # Delete from all 9 collections
    get_workbooks_collection().delete_one({"workbook_id": workbook_id})
    get_workbook_sheets_collection().delete_many({"workbook_id": workbook_id})
    get_sheet_data_collection().delete_many({"workbook_id": workbook_id})
    get_analysis_results_collection().delete_one({"workbook_id": workbook_id})
    get_ai_insights_collection().delete_one({"workbook_id": workbook_id})
    get_conversations_collection().delete_many({"workbook_id": workbook_id})
    get_cleaning_operations_collection().delete_many({"workbook_id": workbook_id})
    get_reports_collection().delete_many({"workbook_id": workbook_id})

    logger.info(f"Cascade deleted all MongoDB records for workbook {workbook_id}.")
    return True


def save_conversation_to_mongo(
    workbook_id: str,
    question: str,
    structured_request: dict[str, Any],
    calculation_result: dict[str, Any],
    ai_answer: str,
    user_id: str = DEFAULT_USER_ID,
    session_id: str = "default_session",
) -> dict[str, Any]:
    """Stores Ask Your Data conversation context in conversations collection."""
    if not validate_mongo_connection():
        return {}

    doc = {
        "user_id": user_id,
        "workbook_id": workbook_id,
        "session_id": session_id,
        "question": question,
        "structured_analysis_request": _sanitize_for_mongo(structured_request),
        "calculation_result": _sanitize_for_mongo(calculation_result),
        "source_sheet": calculation_result.get("source_sheet", ""),
        "source_columns": calculation_result.get("columns_used", []),
        "rows_analyzed": calculation_result.get("rows_analyzed", 0),
        "AI_answer": ai_answer,
        "created_at": time.time(),
    }
    get_conversations_collection().insert_one(doc)
    return doc


def load_conversations_from_mongo(workbook_id: str) -> list[dict[str, Any]]:
    """Fetches Ask Your Data conversation history for a specific workbook."""
    if not validate_mongo_connection():
        return []

    cursor = get_conversations_collection().find({"workbook_id": workbook_id}).sort("created_at", 1)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results


def save_cleaning_operation_to_mongo(
    workbook_id: str,
    operation: str,
    affected_rows: int,
    sheet_id: str | None = None,
    column: str | None = None,
    method: str | None = None,
) -> None:
    """Stores data cleaning operation transformation history in cleaning_operations."""
    if not validate_mongo_connection():
        return

    doc = {
        "workbook_id": workbook_id,
        "sheet_id": sheet_id or "all",
        "operation": operation,
        "column": column or "all",
        "method": method or "standard",
        "affected_rows": affected_rows,
        "created_at": time.time(),
    }
    get_cleaning_operations_collection().insert_one(doc)


def save_report_to_mongo(
    workbook_id: str,
    report_dict: dict[str, Any],
    user_id: str = DEFAULT_USER_ID,
) -> dict[str, Any]:
    """Stores generated executive report metadata in reports collection."""
    if not validate_mongo_connection():
        return report_dict

    sanitized = _sanitize_for_mongo(report_dict)
    doc = {
        "user_id": user_id,
        "workbook_id": workbook_id,
        "report_type": sanitized.get("report_type", "Executive Summary"),
        "title": sanitized.get("title", "Excel Data Intelligence Report"),
        "summary": sanitized.get("summary", ""),
        "sections": sanitized.get("sections", []),
        "key_findings": sanitized.get("key_findings", []),
        "recommendations": sanitized.get("recommendations", []),
        "generated_at": time.time(),
    }
    res = get_reports_collection().insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    return doc


def load_reports_from_mongo(workbook_id: str) -> list[dict[str, Any]]:
    """Retrieves all generated reports for a workbook."""
    if not validate_mongo_connection():
        return []

    cursor = get_reports_collection().find({"workbook_id": workbook_id}).sort("generated_at", -1)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results


def load_all_reports_from_mongo(user_id: str = DEFAULT_USER_ID) -> list[dict[str, Any]]:
    """Retrieves all generated reports across all workbooks for a user."""
    if not validate_mongo_connection():
        return []

    cursor = get_reports_collection().find({"user_id": user_id}).sort("generated_at", -1)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results


def load_cleaning_operations_from_mongo(workbook_id: str | None = None) -> list[dict[str, Any]]:
    """Retrieves cleaning operations for a specific workbook or across all workbooks."""
    if not validate_mongo_connection():
        return []

    query = {"workbook_id": workbook_id} if workbook_id else {}
    cursor = get_cleaning_operations_collection().find(query).sort("created_at", -1)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results


def load_all_workbooks_from_mongo(user_id: str = DEFAULT_USER_ID) -> list[dict[str, Any]]:
    """Lists all workbooks belonging to a specific user."""
    if not validate_mongo_connection():
        return []

    cursor = get_workbooks_collection().find({"user_id": user_id}).sort("created_at", -1)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results


def save_dashboard_to_mongo(
    workbook_id: str,
    visuals: list[dict[str, Any]],
    layout: dict[str, Any] | None = None,
    user_id: str = DEFAULT_USER_ID,
) -> dict[str, Any]:
    """Persists customized dashboard visuals array to MongoDB dashboards collection."""
    try:
        from app.db.mongo import get_dashboards_collection
        if not validate_mongo_connection():
            return {"workbook_id": workbook_id, "visuals": visuals, "layout": layout}

        sanitized_visuals = _sanitize_for_mongo(visuals)
        sanitized_layout = _sanitize_for_mongo(layout or {})
        
        doc = {
            "workbook_id": workbook_id,
            "user_id": user_id,
            "visuals": sanitized_visuals,
            "layout": sanitized_layout,
            "updated_at": time.time(),
        }
        
        get_dashboards_collection().update_one(
            {"workbook_id": workbook_id, "user_id": user_id},
            {"$set": doc, "$setOnInsert": {"created_at": time.time()}},
            upsert=True,
        )
        return doc
    except Exception as exc:
        logger.warning(f"Failed to save dashboard to MongoDB: {exc}")
        return {"workbook_id": workbook_id, "visuals": visuals, "layout": layout}


def load_dashboard_from_mongo(
    workbook_id: str,
    user_id: str = DEFAULT_USER_ID,
) -> dict[str, Any] | None:
    """Loads customized dashboard visuals array from MongoDB dashboards collection."""
    try:
        from app.db.mongo import get_dashboards_collection
        if not validate_mongo_connection():
            return None

        doc = get_dashboards_collection().find_one({"workbook_id": workbook_id, "user_id": user_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return doc
        return None
    except Exception as exc:
        logger.warning(f"Failed to load dashboard from MongoDB: {exc}")
        return None

