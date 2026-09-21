"""In-memory store for uploaded workbooks and analysis results.

The original workbook is stored read-only. Cleaning operations create a NEW
entry (`cleaned_copy`) that never touches the original data.
"""
from __future__ import annotations

import threading
import time

_STORE: dict[str, dict] = {}
_LOCK = threading.Lock()


def store_workbook(
    workbook_id: str,
    path: str,
    filename: str,
    workbook_dict: dict,
    profile: dict,
    analysis: dict | None = None,
) -> None:
    with _LOCK:
        file_size = 0
        if path:
            try:
                import os
                if os.path.exists(path):
                    file_size = os.path.getsize(path)
            except Exception:
                pass

        _STORE[workbook_id] = {
            "id": workbook_id,
            "path": path,
            "filename": filename,
            "file_size": file_size,
            "workbook": workbook_dict,
            "profile": profile,
            "analysis": analysis or {},
            "cleaned_copy": None,
            "cleaning_report": None,
            "mis_mapping": {},
            "mis_exceptions": {},
            "mis_activity_log": [
                {"timestamp": time.strftime("%d %b %H:%M"), "event": "Workbook imported and analyzed"}
            ],
            "mis_scheduled_reports": [],
            "mis_validation_rules": {},
            "created_at": time.time(),
            "last_access": time.time(),
        }

    # Persist asynchronously / safely to MongoDB
    try:
        from app.services.mongo_store import save_workbook_to_mongo
        save_workbook_to_mongo(
            workbook_id=workbook_id,
            file_path=path,
            filename=filename,
            workbook_dict=workbook_dict,
            profile=profile,
            analysis=analysis,
        )
    except Exception as err:
        import logging
        logging.getLogger(__name__).warning(f"Failed to save workbook {workbook_id} to MongoDB: {err}")


def get_workbook(workbook_id: str) -> dict | None:
    with _LOCK:
        entry = _STORE.get(workbook_id)
        if entry:
            entry["last_access"] = time.time()
            return entry

    # Fallback to MongoDB persistence if missing from L1 cache (e.g. server restart)
    try:
        from app.services.mongo_store import load_workbook_from_mongo
        mongo_entry = load_workbook_from_mongo(workbook_id)
        if mongo_entry:
            with _LOCK:
                _STORE[workbook_id] = mongo_entry
            return mongo_entry
    except Exception as err:
        import logging
        logging.getLogger(__name__).warning(f"Failed to restore workbook {workbook_id} from MongoDB: {err}")

    return None


def save_analysis(workbook_id: str, analysis: dict) -> None:
    with _LOCK:
        if workbook_id in _STORE:
            _STORE[workbook_id]["analysis"] = analysis

    try:
        from app.services.mongo_store import save_analysis_to_mongo
        save_analysis_to_mongo(workbook_id, analysis)
    except Exception:
        pass


def set_cleaned_copy(
    workbook_id: str,
    cleaned_workbook: dict,
    cleaning_report: dict,
) -> None:
    with _LOCK:
        if workbook_id in _STORE:
            _STORE[workbook_id]["cleaned_copy"] = cleaned_workbook
            _STORE[workbook_id]["cleaning_report"] = cleaning_report

    try:
        from app.services.mongo_store import save_cleaning_operation_to_mongo
        affected = cleaning_report.get("total_modifications", 0) if isinstance(cleaning_report, dict) else 0
        save_cleaning_operation_to_mongo(
            workbook_id=workbook_id,
            operation="data_cleaning",
            affected_rows=affected,
        )
    except Exception:
        pass


def get_cleaned_copy(workbook_id: str) -> tuple[dict | None, dict | None]:
    with _LOCK:
        entry = _STORE.get(workbook_id)
        if not entry:
            return None, None
        return entry.get("cleaned_copy"), entry.get("cleaning_report")


def get_mis_mapping(workbook_id: str) -> dict:
    with _LOCK:
        entry = _STORE.get(workbook_id)
        if entry:
            return entry.get("mis_mapping") or {}
        return {}


def set_mis_mapping(workbook_id: str, mapping: dict) -> None:
    with _LOCK:
        if workbook_id in _STORE:
            _STORE[workbook_id]["mis_mapping"] = mapping
            add_mis_activity(workbook_id, "Data mapping updated")


def update_exception_status(workbook_id: str, exception_id: str, status: str) -> None:
    with _LOCK:
        if workbook_id in _STORE:
            if "mis_exceptions" not in _STORE[workbook_id]:
                _STORE[workbook_id]["mis_exceptions"] = {}
            _STORE[workbook_id]["mis_exceptions"][exception_id] = status
            add_mis_activity(workbook_id, f"Exception {exception_id[:8]} marked as {status}")


def get_exception_statuses(workbook_id: str) -> dict:
    with _LOCK:
        entry = _STORE.get(workbook_id)
        if entry:
            return entry.get("mis_exceptions") or {}
        return {}


def add_mis_activity(workbook_id: str, event: str) -> None:
    with _LOCK:
        if workbook_id in _STORE:
            if "mis_activity_log" not in _STORE[workbook_id]:
                _STORE[workbook_id]["mis_activity_log"] = []
            _STORE[workbook_id]["mis_activity_log"].insert(
                0, {"timestamp": time.strftime("%d %b %H:%M"), "event": event}
            )


def get_mis_activity_log(workbook_id: str) -> list[dict]:
    with _LOCK:
        entry = _STORE.get(workbook_id)
        if entry:
            return entry.get("mis_activity_log") or []
        return []


def save_scheduled_report(workbook_id: str, report: dict) -> list[dict]:
    with _LOCK:
        if workbook_id in _STORE:
            if "mis_scheduled_reports" not in _STORE[workbook_id]:
                _STORE[workbook_id]["mis_scheduled_reports"] = []
            _STORE[workbook_id]["mis_scheduled_reports"].append(report)
            add_mis_activity(workbook_id, f"Scheduled report '{report.get('name')}' saved")
            return _STORE[workbook_id]["mis_scheduled_reports"]
        return []


def get_scheduled_reports(workbook_id: str) -> list[dict]:
    with _LOCK:
        entry = _STORE.get(workbook_id)
        if entry:
            return entry.get("mis_scheduled_reports") or []
        return []


def clear_workbook(workbook_id: str) -> None:
    with _LOCK:
        _STORE.pop(workbook_id, None)

    try:
        from app.services.mongo_store import delete_workbook_from_mongo
        delete_workbook_from_mongo(workbook_id)
    except Exception:
        pass


def clear() -> None:
    with _LOCK:
        _STORE.clear()


def stats() -> dict:
    with _LOCK:
        return {"count": len(_STORE), "ids": list(_STORE.keys())}


def list_stored_workbooks() -> list[dict]:
    """Returns metadata list of all workbooks currently in memory."""
    with _LOCK:
        results = []
        for wid, entry in _STORE.items():
            wb_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
            profile = entry.get("profile") or {}
            analysis = entry.get("analysis") or {}
            
            # Compute summary stats
            sheet_count = len(wb_dict)
            total_rows = sum(len(df) for df in wb_dict.values())
            total_cols = sum(len(df.columns) for df in wb_dict.values())
            health_score = analysis.get("workbook_health") or profile.get("health_score", 85)
            
            results.append({
                "workbook_id": wid,
                "filename": entry.get("filename", "workbook.xlsx"),
                "file_size": entry.get("file_size", 0),
                "created_at": entry.get("created_at", time.time()),
                "sheet_count": sheet_count,
                "total_rows": total_rows,
                "total_columns": total_cols,
                "data_health_score": health_score,
                "status": "active",
            })
        # Sort by created_at descending
        results.sort(key=lambda x: x.get("created_at", 0), reverse=True)
        return results


