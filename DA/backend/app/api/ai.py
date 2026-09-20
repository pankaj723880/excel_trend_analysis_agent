"""AI endpoints: executive summary, business domain context, report generation, and Ask Your Data Q&A."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import AskRequest, AISummaryRequest
from app.services.ai_agent import generate_ai_summary
from app.services.verified_data_agent import ask_verified_agent
from app.services.business_context import detect_business_context
from app.services.ai_report_generator import generate_full_ai_report
from app.services.schema_builder import build_workbook_schema
from app.services.store import get_workbook

router = APIRouter()


def _get_workbook_entry(workbook_id: str) -> dict:
    entry = get_workbook(workbook_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    return entry


@router.get("/domain-context/{workbook_id}")
async def get_domain_context(workbook_id: str):
    """Infer business domain context & generate schema-aware prompt suggestions."""
    entry = _get_workbook_entry(workbook_id)
    workbook_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    filename = entry.get("filename", "workbook.xlsx")

    schema = build_workbook_schema(workbook_dict, filename)
    context = detect_business_context(workbook_dict, schema)

    return {
        "workbook_id": workbook_id,
        "filename": filename,
        **context,
    }


@router.post("/ask")
async def ask_question(request: AskRequest):
    """Answer a natural-language question using the Verified Data Agent."""
    entry = _get_workbook_entry(request.workbook_id)
    workbook_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    filename = entry.get("filename", "workbook.xlsx")

    if not workbook_dict:
        return {
            "answer": "No readable sheets were found for this workbook.",
            "source": "verified_agent",
            "confidence": "Low",
        }

    result = ask_verified_agent(
        workbook_id=request.workbook_id,
        question=request.question,
        workbook_dict=workbook_dict,
        filename=filename,
    )

    # Persist conversation to MongoDB
    try:
        from app.services.mongo_store import save_conversation_to_mongo
        save_conversation_to_mongo(
            workbook_id=request.workbook_id,
            question=request.question,
            structured_request=result.get("traceability", {}),
            calculation_result={
                "result_value": result.get("result_value"),
                "formatted_result": result.get("formatted_result"),
                "operation": result.get("operation"),
                "source_sheet": result.get("source_sheet"),
                "columns_used": result.get("columns_used", []),
                "rows_analyzed": result.get("rows_analyzed", 0),
            },
            ai_answer=result.get("answer", ""),
        )
    except Exception:
        pass

    return {
        "workbook_id": request.workbook_id,
        "question": request.question,
        **result,
    }


@router.post("/ai-summary")
async def ai_summary(request: AISummaryRequest):
    """Generate an executive AI summary with business context."""
    entry = _get_workbook_entry(request.workbook_id)
    analysis = entry.get("analysis") or {}
    workbook_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    filename = entry.get("filename", "workbook.xlsx")

    schema = build_workbook_schema(workbook_dict, filename)
    context_info = detect_business_context(workbook_dict, schema)

    result = generate_ai_summary(analysis)
    
    response_payload = {
        "workbook_id": request.workbook_id,
        "domain": context_info.get("domain"),
        "domain_confidence": context_info.get("confidence"),
        "domain_reasoning": context_info.get("reasoning"),
        "suggested_questions": context_info.get("suggested_questions"),
        **result,
    }

    # Persist complete insights to MongoDB
    try:
        from app.services.mongo_store import save_ai_insights_to_mongo
        save_ai_insights_to_mongo(request.workbook_id, response_payload)
    except Exception:
        pass

    return response_payload


@router.get("/report/{workbook_id}")
async def get_ai_report(workbook_id: str):
    """Get full structured executive AI report."""
    entry = _get_workbook_entry(workbook_id)
    workbook_dict = entry.get("cleaned_copy") or entry.get("workbook") or {}
    analysis = entry.get("analysis") or {}
    filename = entry.get("filename", "workbook.xlsx")

    schema = build_workbook_schema(workbook_dict, filename)
    report = generate_full_ai_report(workbook_id, workbook_dict, analysis, schema)
    
    # Persist report metadata to MongoDB
    try:
        from app.services.mongo_store import save_report_to_mongo
        save_report_to_mongo(workbook_id, report)
    except Exception:
        pass

    return report
