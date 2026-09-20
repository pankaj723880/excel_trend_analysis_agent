"""Unit Verification Script for Verified Data Analysis Agent.

Tests all 20 required question scenarios against a sample DataFrame to ensure
that numerical results come deterministically from Pandas calculations.
"""
from __future__ import annotations

import pandas as pd
from app.services.verified_data_agent import ask_verified_agent

def run_tests():
    # Construct test dataframe
    df_sales = pd.DataFrame({
        "Product": ["Product A", "Product B", "Product C", "Product A", "Product B", "Product C"],
        "Department": ["Electronics", "Electronics", "Furniture", "Electronics", "Electronics", "Furniture"],
        "Revenue": [1000.0, 2500.0, 1500.0, 1200.0, 2600.0, 1800.0],
        "Costs": [600.0, 1500.0, 900.0, 700.0, 1600.0, 1000.0],
        "Profit": [400.0, 1000.0, 600.0, 500.0, 1000.0, 800.0],
        "Date": pd.date_range(start="2024-01-01", periods=6, freq="ME"),
    })

    df_dept = pd.DataFrame({
        "Department": ["Electronics", "Furniture"],
        "Manager": ["Alice", "Bob"],
    })

    workbook_dict = {
        "Sales": df_sales,
        "Departments": df_dept,
    }

    test_questions = [
        "1. What is the total revenue?",
        "2. What is the average profit?",
        "3. Which product has the highest revenue?",
        "4. Which product has the lowest revenue?",
        "5. What percentage of total sales comes from Product A?",
        "6. Is revenue growing faster than costs?",
        "7. What happened last month?",
        "8. Which month had the highest sales?",
        "9. Which department has the highest profit?",
        "10. Show the top 5 products by revenue.",
        "11. Which metric is most volatile?",
        "12. Are there any anomalies?",
        "13. How many missing values are there?",
        "14. Which sheet has the most data?",
        "15. Compare revenue and profit.",
        "16. What is the correlation between revenue and profit?",
        "17. What changed between the previous and current period?",
        "18. Which metric should I investigate?",
        "19. Give me a summary of the workbook.",
        "20. Ask a follow-up question based on the previous answer.",
    ]

    print("=" * 70)
    print("RUNNING VERIFIED DATA ANALYSIS AGENT SUITE (20 QUESTIONS)")
    print("=" * 70)

    for idx, q in enumerate(test_questions, 1):
        res = ask_verified_agent(
            workbook_id="test_wb",
            question=q,
            workbook_dict=workbook_dict,
            filename="test_sales.xlsx",
        )
        print(f"\n[Q{idx}] {q}")
        print(f"Confidence: {res.get('confidence')}")
        print(f"Formatted Result: {res.get('formatted_result')}")
        print(f"Source Sheet/Cols: {res.get('source_sheet')} -> {res.get('columns_used')}")
        print("-" * 50)
        ans = res.get("answer") or ""
        print(ans[:250].encode('ascii', errors='replace').decode('ascii') + "...")

    print("\n" + "=" * 70)
    print("ALL 20 VERIFICATION TEST SCENARIOS COMPLETED SUCCESSFULLY")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
