"""MIS Column Mapping and Schema Detection Engine.

Automatically matches workbook sheet columns against standard MIS domain concepts
(Revenue, Date, Customer, Product, Region, Quantity, Stock, Reorder Level, Target,
Expenses, Invoice No, Due Date, Department, Vendor, Salesperson) with user override support.
"""
from __future__ import annotations

import re
import pandas as pd

# Standard MIS fields and their common column name aliases
MIS_FIELD_ALIASES = {
    "revenue": [
        "revenue", "sales", "sales amount", "net sales", "total sales", "amount",
        "sale_amount", "total_amount", "grand_total", "price_total", "billing_amount"
    ],
    "date": [
        "date", "transaction date", "invoice date", "order date", "trans_date",
        "sales_date", "posting_date", "created_at", "month", "period"
    ],
    "customer": [
        "customer", "customer name", "customer_id", "customer id", "client",
        "client name", "customer_name", "account_name"
    ],
    "product": [
        "product", "product name", "sku", "item", "item name", "product_id",
        "product_name", "item_code", "material"
    ],
    "category": [
        "category", "product category", "item category", "dept", "group", "class"
    ],
    "region": [
        "region", "zone", "area", "location", "territory", "state", "city", "branch"
    ],
    "quantity": [
        "quantity", "qty", "units", "units sold", "volume", "count", "qty_sold"
    ],
    "purchase_value": [
        "purchase value", "purchase_amount", "po amount", "cost", "cost price",
        "buying price", "purchase_cost", "vendor_amount", "po_value"
    ],
    "stock": [
        "stock", "current stock", "closing stock", "opening stock", "stock_qty",
        "inventory", "inventory_qty", "qty_on_hand", "available_stock"
    ],
    "reorder_level": [
        "reorder level", "reorder_point", "minimum_stock", "min_stock",
        "threshold", "reorder_qty"
    ],
    "target": [
        "target", "sales target", "target amount", "budget", "quota", "monthly_target"
    ],
    "expenses": [
        "expenses", "expense", "operating cost", "overhead", "expenses_amount", "cost_total"
    ],
    "invoice_no": [
        "invoice number", "invoice id", "invoice_no", "inv_no", "bill_no", "order_id", "po_number"
    ],
    "due_date": [
        "due date", "payment due date", "due_dt", "expiry_date", "payment_date"
    ],
    "department": [
        "department", "dept", "division", "section", "business_unit"
    ],
    "vendor": [
        "vendor", "vendor name", "supplier", "supplier name", "vendor_id", "supplier_id"
    ],
    "salesperson": [
        "salesperson", "sales rep", "rep", "agent", "executive", "employee", "sales_person"
    ]
}


def auto_detect_mapping(workbook_dict: dict[str, pd.DataFrame]) -> dict:
    """Analyze all sheets in the workbook to detect available columns for each MIS field.

    Returns a dict mapping field_name -> {"sheet": sheet_name, "column": col_name, "confidence": float}
    or None if missing.
    """
    detected = {}
    
    for field_name, aliases in MIS_FIELD_ALIASES.items():
        best_match = None
        best_score = 0.0

        for sheet_name, df in workbook_dict.items():
            if df is None or df.empty or "__error__" in df.columns:
                continue
            
            for col in df.columns:
                col_str = str(col).strip().lower()
                clean_col = re.sub(r"[_\-\s]+", " ", col_str)

                # Exact match
                if clean_col in aliases:
                    score = 1.0
                else:
                    # Partial substring match
                    match_scores = [0.8 for alias in aliases if alias in clean_col or clean_col in alias]
                    score = max(match_scores) if match_scores else 0.0
                
                # Check data type suitability
                if score > 0.5 and field_name in ["revenue", "quantity", "purchase_value", "stock", "target", "expenses"]:
                    if pd.api.types.is_numeric_dtype(df[col]):
                        score += 0.15

                if score > best_score:
                    best_score = score
                    best_match = {"sheet": sheet_name, "column": str(col), "confidence": round(score, 2)}

        if best_match and best_score >= 0.7:
            detected[field_name] = best_match
        else:
            detected[field_name] = None

    return detected


def get_effective_mapping(workbook_dict: dict[str, pd.DataFrame], custom_mapping: dict | None = None) -> dict:
    """Merge auto-detected column mappings with user-configured custom mappings."""
    auto = auto_detect_mapping(workbook_dict)
    if not custom_mapping:
        return auto
    
    effective = {}
    for field, auto_match in auto.items():
        if field in custom_mapping and custom_mapping[field]:
            user_val = custom_mapping[field]
            if isinstance(user_val, dict) and "sheet" in user_val and "column" in user_val:
                effective[field] = user_val
            elif isinstance(user_val, str):
                if "::" in user_val:
                    s, c = user_val.split("::", 1)
                    effective[field] = {"sheet": s, "column": c, "custom": True}
                else:
                    effective[field] = {"sheet": list(workbook_dict.keys())[0], "column": user_val, "custom": True}
        else:
            effective[field] = auto_match
            
    return effective
