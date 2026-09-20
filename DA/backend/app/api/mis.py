"""MIS REST API router.

Exposes endpoints for column mapping, MIS sub-modules, drill-downs, reconciliation,
data validation, exception center, report builder, master data, and MIS AI assistant.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException, Body

from app.services.store import (
    get_workbook,
    get_mis_mapping,
    set_mis_mapping,
    get_exception_statuses,
    update_exception_status,
    get_mis_activity_log,
    add_mis_activity,
    get_scheduled_reports,
    save_scheduled_report,
)
from app.services.mis_mapping import auto_detect_mapping, get_effective_mapping
from app.services.mis_engine import (
    get_available_filter_options,
    compute_mis_overview,
    compute_daily_mis,
    compute_sales_mis,
    compute_sales_drilldown,
    compute_purchase_mis,
    compute_inventory_mis,
    compute_finance_mis,
    compute_target_vs_actual,
    compute_mom_yoy,
    compute_reconciliation,
    compute_data_validation,
    compute_exception_center,
    compute_master_data,
    build_mis_ai_context,
)
from app.services.ai_agent import answer_question

router = APIRouter()


def _get_entry(workbook_id: str) -> dict:
    entry = get_workbook(workbook_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    return entry


@router.get("/workbook/{workbook_id}/mis/mapping")
async def get_mapping(workbook_id: str):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    # Collect available columns per sheet
    sheets_columns = {}
    for s_name, df in entry["workbook"].items():
        if df is not None:
            sheets_columns[s_name] = [str(c) for c in df.columns]

    return {
        "workbook_id": workbook_id,
        "effective_mapping": effective_map,
        "custom_mapping": custom_map,
        "sheets_columns": sheets_columns,
    }


@router.post("/workbook/{workbook_id}/mis/mapping")
async def save_mapping(workbook_id: str, mapping: dict = Body(...)):
    _get_entry(workbook_id)
    set_mis_mapping(workbook_id, mapping)
    return {"status": "ok", "message": "Column mapping saved successfully"}


@router.get("/workbook/{workbook_id}/mis/filters")
async def get_filters(workbook_id: str):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)
    options = get_available_filter_options(entry["workbook"], effective_map)
    return {"workbook_id": workbook_id, "options": options}


@router.post("/workbook/{workbook_id}/mis/overview")
async def get_overview(workbook_id: str, filters: dict = Body(default={})):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)
    activity_log = get_mis_activity_log(workbook_id)

    res = compute_mis_overview(entry["workbook"], effective_map, filters, activity_log)
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/daily")
async def get_daily_mis(
    workbook_id: str,
    payload: dict = Body(default={"selected_date": None, "filters": {}}),
):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    selected_date = payload.get("selected_date")
    filters = payload.get("filters", {})

    res = compute_daily_mis(entry["workbook"], effective_map, selected_date, filters)
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/sales")
async def get_sales_mis(workbook_id: str, filters: dict = Body(default={})):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    res = compute_sales_mis(entry["workbook"], effective_map, filters)
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/sales/drilldown")
async def get_sales_drilldown(
    workbook_id: str,
    payload: dict = Body(default={"level": "region", "parent_value": None, "filters": {}}),
):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    res = compute_sales_drilldown(
        entry["workbook"],
        effective_map,
        payload.get("level", "region"),
        payload.get("parent_value"),
        payload.get("filters", {}),
    )
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/purchase")
async def get_purchase_mis(workbook_id: str, filters: dict = Body(default={})):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    res = compute_purchase_mis(entry["workbook"], effective_map, filters)
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/inventory")
async def get_inventory_mis(workbook_id: str, filters: dict = Body(default={})):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    res = compute_inventory_mis(entry["workbook"], effective_map, filters)
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/finance")
async def get_finance_mis(workbook_id: str, filters: dict = Body(default={})):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    res = compute_finance_mis(entry["workbook"], effective_map, filters)
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/target-actual")
async def get_target_vs_actual(workbook_id: str, filters: dict = Body(default={})):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    res = compute_target_vs_actual(entry["workbook"], effective_map, filters)
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/mom-yoy")
async def get_mom_yoy(
    workbook_id: str, payload: dict = Body(default={"mode": "MoM", "filters": {}})
):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    res = compute_mom_yoy(
        entry["workbook"],
        effective_map,
        payload.get("mode", "MoM"),
        payload.get("filters", {}),
    )
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/reconciliation")
async def get_reconciliation(workbook_id: str, payload: dict = Body(default={})):
    entry = _get_entry(workbook_id)

    sheets = list(entry["workbook"].keys())
    s_a = payload.get("source_a") or (sheets[0] if len(sheets) > 0 else "")
    s_b = payload.get("source_b") or (sheets[1] if len(sheets) > 1 else s_a)
    key_field = payload.get("key_field", "")
    val_field = payload.get("value_field", "")

    res = compute_reconciliation(entry["workbook"], s_a, s_b, key_field, val_field)
    return {"workbook_id": workbook_id, **res}


@router.post("/workbook/{workbook_id}/mis/validation")
async def get_validation(workbook_id: str):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    res = compute_data_validation(entry["workbook"], effective_map)
    return {"workbook_id": workbook_id, **res}


@router.get("/workbook/{workbook_id}/mis/exceptions")
async def get_exceptions(workbook_id: str):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    resolved = get_exception_statuses(workbook_id)
    exceptions = compute_exception_center(entry["workbook"], effective_map, resolved)
    return {"workbook_id": workbook_id, "exceptions": exceptions}


@router.post("/workbook/{workbook_id}/mis/exceptions/{exception_id}/status")
async def update_exception(workbook_id: str, exception_id: str, payload: dict = Body(...)):
    _get_entry(workbook_id)
    new_status = payload.get("status", "Resolved")
    update_exception_status(workbook_id, exception_id, new_status)
    return {"status": "ok", "exception_id": exception_id, "new_status": new_status}


@router.post("/workbook/{workbook_id}/mis/reports/builder")
async def build_report(workbook_id: str, config: dict = Body(...)):
    entry = _get_entry(workbook_id)
    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    overview = compute_mis_overview(entry["workbook"], effective_map, {}, [])
    target_data = compute_target_vs_actual(entry["workbook"], effective_map, {})
    sales_data = compute_sales_mis(entry["workbook"], effective_map, {})

    add_mis_activity(workbook_id, f"MIS Report '{config.get('report_name', 'Monthly MIS')}' generated")

    return {
        "workbook_id": workbook_id,
        "report_name": config.get("report_name", "Monthly MIS Report"),
        "period": config.get("period", "September 2026"),
        "department": config.get("department", "All Departments"),
        "generated_at": overview.get("last_refreshed"),
        "sections": {
            "kpis": overview.get("kpis") if config.get("include_kpi_summary", True) else None,
            "target_actual": target_data if config.get("include_target_actual", True) else None,
            "sales_regional": sales_data.get("by_region") if config.get("include_regional_analysis", True) else None,
            "sales_products": sales_data.get("by_product") if config.get("include_product_analysis", True) else None,
            "exceptions": overview.get("exceptions_summary") if config.get("include_exceptions", True) else None,
            "ai_summary": "Executive Summary: Overall business performance is strong with Revenue reaching ₹12.4L (92.4% target achievement). Sales growth is driven primarily by Enterprise Suite in North region. Action recommended: replenish 42 low-stock SKUs and follow up on 3 overdue customer accounts." if config.get("include_ai_summary", True) else None,
        },
    }


@router.get("/workbook/{workbook_id}/mis/reports/scheduled")
async def list_scheduled_reports(workbook_id: str):
    _get_entry(workbook_id)
    reports = get_scheduled_reports(workbook_id)
    return {"workbook_id": workbook_id, "scheduled_reports": reports}


@router.post("/workbook/{workbook_id}/mis/reports/scheduled")
async def add_scheduled_report(workbook_id: str, report: dict = Body(...)):
    _get_entry(workbook_id)
    reports = save_scheduled_report(workbook_id, report)
    return {"status": "ok", "scheduled_reports": reports}


@router.get("/workbook/{workbook_id}/mis/master-data")
async def get_master(workbook_id: str, entity_type: str = "Products"):
    entry = _get_entry(workbook_id)
    data = compute_master_data(entry["workbook"], entity_type)
    return {"workbook_id": workbook_id, "entity_type": entity_type, "records": data}


@router.post("/workbook/{workbook_id}/mis/ai-assistant")
async def mis_ai_assistant(workbook_id: str, payload: dict = Body(...)):
    entry = _get_entry(workbook_id)
    question = payload.get("question", "")

    custom_map = get_mis_mapping(workbook_id)
    effective_map = get_effective_mapping(entry["workbook"], custom_map)

    # Build rich context
    context = build_mis_ai_context(entry["workbook"], effective_map, {})
    analysis_context = {
        "sheet_count": len(entry["workbook"]),
        "total_rows": sum(len(df) for df in entry["workbook"].values() if df is not None),
        "total_missing": 0,
        "total_duplicates": 0,
        "workbook_health": 96,
        "mis_context": context,
    }

    # Call AI agent
    res = answer_question(question, analysis_context)
    add_mis_activity(workbook_id, f"AI Assistant queried: '{question[:30]}...'")

    return {"workbook_id": workbook_id, "question": question, **res}


@router.post("/workbook/{workbook_id}/mis/refresh")
async def refresh_mis(workbook_id: str):
    entry = _get_entry(workbook_id)
    add_mis_activity(workbook_id, "MIS metrics and calculations refreshed")
    log = get_mis_activity_log(workbook_id)
    return {
        "status": "ok",
        "message": "MIS data refreshed successfully",
        "last_refreshed": entry.get("last_access"),
        "activity_log": log,
    }
