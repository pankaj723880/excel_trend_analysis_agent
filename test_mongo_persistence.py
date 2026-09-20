"""End-to-end automated verification script for MongoDB Persistence."""
from __future__ import annotations

import sys
import time
import pandas as pd

sys.path.insert(0, "DA/backend")
from dotenv import load_dotenv
load_dotenv("DA/backend/.env")

from app.db.mongo import validate_mongo_connection, get_db
from app.services.store import store_workbook, get_workbook, clear_workbook, _STORE
from app.services.mongo_store import (
    save_conversation_to_mongo,
    load_conversations_from_mongo,
    save_report_to_mongo,
    load_reports_from_mongo,
    load_all_workbooks_from_mongo,
)
from app.services.verified_data_agent import ask_verified_agent


def run_tests():
    print("=" * 60)
    print("1. VALIDATING MONGODB CONNECTION")
    print("=" * 60)
    connected = validate_mongo_connection()
    print(f"MongoDB connection state: {connected}")
    if not connected:
        print("MongoDB is offline or URI is invalid. Start MongoDB or set MONGODB_URI.")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("2. TESTING WORKBOOK PERSISTENCE & PARSED DATA CHUNKING")
    print("=" * 60)

    test_id = "test_wb_" + str(int(time.time()))
    df_sales = pd.DataFrame({
        "Product": ["Laptop", "Smartphone", "Tablet", "Monitor", "Headphones"],
        "Revenue": [125000, 85000, 45000, 30000, 15000],
        "Units": [50, 120, 90, 40, 200],
    })
    df_costs = pd.DataFrame({
        "Category": ["Marketing", "R&D", "Logistics", "Salaries"],
        "Expense": [20000, 35000, 15000, 50000],
    })

    wb_dict = {"Sales": df_sales, "Costs": df_costs}
    profile = {"health_score": 92, "sheets": {"Sales": {}, "Costs": {}}}
    analysis = {"total_rows": 9, "workbook_health": 92, "trends": {}, "anomalies": {}}

    store_workbook(test_id, None, "test_file.xlsx", wb_dict, profile, analysis)
    print(f"Stored workbook '{test_id}' via store_workbook()")

    # Verify document exists in MongoDB `workbooks` collection
    db = get_db()
    wb_doc = db["workbooks"].find_one({"workbook_id": test_id})
    assert wb_doc is not None, "Workbook document missing from 'workbooks' collection!"
    print("[OK] Verified 'workbooks' collection document!")

    sheets_count = db["workbook_sheets"].count_documents({"workbook_id": test_id})
    assert sheets_count == 2, f"Expected 2 sheets, found {sheets_count}"
    print("[OK] Verified 'workbook_sheets' collection documents!")

    chunks_count = db["sheet_data"].count_documents({"workbook_id": test_id})
    assert chunks_count > 0, "No sheet_data chunks saved!"
    print("[OK] Verified 'sheet_data' collection documents!")

    analysis_doc = db["analysis_results"].find_one({"workbook_id": test_id})
    assert analysis_doc is not None, "Analysis document missing!"
    print("[OK] Verified 'analysis_results' collection document!")

    print("\n" + "=" * 60)
    print("3. TESTING SERVER RESTART RECOVERY (L1 CACHE EVICTION)")
    print("=" * 60)
    
    # Evict from in-memory cache
    _STORE.pop(test_id, None)
    assert test_id not in _STORE, "Failed to evict from L1 memory!"
    print("Evicted workbook from L1 memory cache.")

    # Call get_workbook to trigger L2 MongoDB restoration
    restored = get_workbook(test_id)
    assert restored is not None, "Failed to restore workbook from MongoDB!"
    assert "Sales" in restored["workbook"], "Missing 'Sales' sheet in restored DataFrames!"
    assert len(restored["workbook"]["Sales"]) == 5, "Restored DataFrame row count mismatch!"
    print("[OK] Server restart recovery verified! Restored DataFrames directly from MongoDB!")

    print("\n" + "=" * 60)
    print("4. TESTING CONVERSATION PERSISTENCE (ASK YOUR DATA)")
    print("=" * 60)
    
    q_result = ask_verified_agent(test_id, "Which product has the highest revenue?", restored["workbook"])
    save_conversation_to_mongo(
        workbook_id=test_id,
        question="Which product has the highest revenue?",
        structured_request=q_result.get("traceability", {}),
        calculation_result={
            "result_value": q_result.get("result_value"),
            "formatted_result": q_result.get("formatted_result"),
        },
        ai_answer=q_result.get("answer", ""),
    )

    convs = load_conversations_from_mongo(test_id)
    assert len(convs) == 1, f"Expected 1 conversation, got {len(convs)}"
    assert convs[0]["question"] == "Which product has the highest revenue?", "Question mismatch!"
    print("[OK] Verified 'conversations' collection persistence!")

    print("\n" + "=" * 60)
    print("5. TESTING AI REPORT METADATA PERSISTENCE")
    print("=" * 60)
    
    sample_report = {
        "report_type": "Executive Summary",
        "title": "Sales Performance Analysis",
        "summary": "Overall strong growth driven by Laptop sales.",
        "key_findings": ["Laptop leads with 125,000 revenue."],
        "recommendations": ["Expand inventory."],
    }
    save_report_to_mongo(test_id, sample_report)
    reports = load_reports_from_mongo(test_id)
    assert len(reports) == 1, "Report metadata missing!"
    print("[OK] Verified 'reports' collection persistence!")

    print("\n" + "=" * 60)
    print("6. TESTING CASCADE DELETE")
    print("=" * 60)
    
    clear_workbook(test_id)
    assert db["workbooks"].find_one({"workbook_id": test_id}) is None, "Workbook document not deleted!"
    assert db["workbook_sheets"].count_documents({"workbook_id": test_id}) == 0, "Sheets not deleted!"
    assert db["sheet_data"].count_documents({"workbook_id": test_id}) == 0, "Sheet data not deleted!"
    assert db["analysis_results"].find_one({"workbook_id": test_id}) is None, "Analysis not deleted!"
    assert db["conversations"].count_documents({"workbook_id": test_id}) == 0, "Conversations not deleted!"
    assert db["reports"].count_documents({"workbook_id": test_id}) == 0, "Reports not deleted!"
    print("[OK] Verified cascade delete across all MongoDB collections!")

    print("\n" + "=" * 60)
    print("ALL MONGODB PERSISTENCE TESTS PASSED CLEANLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
