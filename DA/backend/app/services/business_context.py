"""Business Domain & Context Inference Engine.

Infers the business domain (Sales, Finance, Inventory, HR, Operations, Marketing,
Customers, Orders, Products, General Analytics) from workbook sheets, column
names, data types, and values. Generates domain-aware suggested user questions.
"""
from __future__ import annotations

from typing import Any
import pandas as pd

DOMAIN_SIGNATURES: dict[str, list[str]] = {
    "Sales Analytics": [
        "revenue", "sales", "turnover", "order", "units", "quantity", "price",
        "discount", "commission", "region", "territory", "rep", "salesperson",
        "deal", "lead", "pipeline", "gross_sales", "net_sales"
    ],
    "Financial Intelligence": [
        "income", "expense", "profit", "ebitda", "asset", "liability", "equity",
        "cash_flow", "budget", "variance", "account", "gl", "ledger", "cost_center",
        "tax", "audit", "margin", "balance"
    ],
    "Inventory & Supply Chain": [
        "sku", "stock", "inventory", "warehouse", "reorder", "supplier", "vendor",
        "lead_time", "shelf_life", "stockout", "on_hand", "batch", "serial"
    ],
    "HR & Workforce Analytics": [
        "employee", "salary", "headcount", "department", "hire_date", "termination",
        "attrition", "payroll", "job_title", "tenure", "performance", "overtime",
        "benefits", "leave", "absenteeism"
    ],
    "Operations & Logistics": [
        "sla", "turnaround", "defect", "cycle_time", "capacity", "fulfillment",
        "shipping", "carrier", "tracking", "efficiency", "downtime", "maintenance"
    ],
    "Marketing & Digital Growth": [
        "campaign", "impression", "click", "ctr", "conversion", "cac", "roas",
        "cpc", "lead", "channel", "ad", "spend", "bounce_rate", "session"
    ],
    "Customer Relationship & Churn": [
        "customer", "client", "mrr", "arr", "churn", "nps", "ltv", "support",
        "ticket", "retention", "subscription", "account_name"
    ],
}


def detect_business_context(
    workbook_dict: dict[str, pd.DataFrame],
    schema: dict[str, Any],
) -> dict[str, Any]:
    """Infers business context from workbook structure without guessing."""
    domain_scores: dict[str, int] = {domain: 0 for domain in DOMAIN_SIGNATURES}

    all_col_names: list[str] = []
    all_sheet_names: list[str] = list(workbook_dict.keys())

    for sheet_name, df in workbook_dict.items():
        if isinstance(df, pd.DataFrame):
            all_col_names.extend([str(c).lower().strip() for c in df.columns])

    # Score sheet names & column names against domain signatures
    all_terms = [s.lower().strip() for s in all_sheet_names] + all_col_names

    for term in all_terms:
        for domain, keywords in DOMAIN_SIGNATURES.items():
            for kw in keywords:
                if kw in term:
                    domain_scores[domain] += 2 if term in all_sheet_names else 1

    best_domain = max(domain_scores, key=domain_scores.get)
    max_score = domain_scores[best_domain]

    if max_score < 2:
        best_domain = "General Data Analytics"
        confidence = "Medium"
        reasoning = "Generic numerical and categorical dataset detected across sheets."
    else:
        confidence = "High" if max_score >= 5 else "Medium"
        matched_kws = [
            kw for kw in DOMAIN_SIGNATURES.get(best_domain, [])
            if any(kw in term for term in all_terms)
        ][:4]
        reasoning = f"Detected key signatures ({', '.join(matched_kws)}) in workbook columns/sheets."

    # Generate domain-aware suggested user questions based on actual columns
    suggested_questions = generate_schema_suggested_questions(schema, best_domain)

    return {
        "domain": best_domain,
        "confidence": confidence,
        "score": max_score,
        "reasoning": reasoning,
        "suggested_questions": suggested_questions,
    }


def generate_schema_suggested_questions(
    schema: dict[str, Any],
    domain: str,
) -> list[str]:
    """Generates 5-6 natural language prompts using exact column names from schema."""
    sheets = schema.get("sheets", {})
    if not sheets:
        return [
            "What is happening in my data?",
            "What is growing?",
            "What is declining?",
            "Are there any unusual values?",
            "Give me a simple summary.",
        ]

    first_sheet_name = list(sheets.keys())[0]
    first_sheet = sheets[first_sheet_name]

    num_cols = first_sheet.get("numeric_columns", [])
    cat_cols = first_sheet.get("categorical_columns", [])
    date_cols = first_sheet.get("date_columns", [])

    m1 = num_cols[0] if num_cols else "Value"
    m2 = num_cols[1] if len(num_cols) > 1 else (num_cols[0] if num_cols else "Cost")
    c1 = cat_cols[0] if cat_cols else "Category"

    prompts = []

    if domain == "Sales Analytics":
        prompts.append(f"What is the total {m1}?")
        prompts.append(f"Which {c1} generated the highest {m1}?")
        prompts.append(f"Which {c1} has the lowest {m1}?")
        if len(num_cols) > 1:
            prompts.append(f"Is {m1} growing faster than {m2}?")
        prompts.append(f"Which month had the highest {m1}?")
        prompts.append("Are there any unusual sales values?")

    elif domain == "Financial Intelligence":
        prompts.append(f"What is the total {m1}?")
        prompts.append(f"Which {c1} has the highest {m1}?")
        if len(num_cols) > 1:
            prompts.append(f"Compare {m1} and {m2}.")
        prompts.append(f"Which metric is most volatile?")
        prompts.append("What changed recently in financials?")

    elif domain == "HR & Workforce Analytics":
        prompts.append(f"What is the average {m1}?")
        prompts.append(f"Which {c1} has the highest {m1}?")
        prompts.append(f"Which {c1} has the largest headcount?")
        prompts.append("Are there any salary anomalies?")

    elif domain == "Inventory & Supply Chain":
        prompts.append(f"What is the total {m1} in stock?")
        prompts.append(f"Which {c1} has the lowest inventory?")
        prompts.append(f"Which items are moving slowest?")
        prompts.append("Are there any out-of-stock anomalies?")

    else:
        prompts.append(f"What is the total {m1}?")
        prompts.append(f"Which {c1} has the highest {m1}?")
        prompts.append(f"Which {c1} has the lowest {m1}?")
        if len(num_cols) > 1:
            prompts.append(f"Is {m1} growing faster than {m2}?")
        prompts.append("What changed in the dataset?")
        prompts.append("Give me an executive summary.")

    return prompts
