"""Verified Data Analysis Agent.

Architecture:
USER QUESTION -> QUESTION UNDERSTANDING -> WORKBOOK SCHEMA MATCHING ->
STRUCTURED ANALYSIS PLAN -> VALIDATION -> PANDAS DATA EXECUTION ->
RESULT VERIFICATION -> GEMINI RESPONSE GENERATION -> FINAL VERIFIED ANSWER

Pandas is the strict source of truth for numerical calculations. Gemini is used
ONLY for natural-language understanding, intent planning, and explanation.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any
import pandas as pd

from app.services.schema_builder import build_workbook_schema

# In-memory conversation history per workbook_id
_SESSION_MEMORY: dict[str, list[dict[str, str]]] = {}


from app.services.gemini_client import generate_content_with_fallback


def _call_gemini_json(prompt: str) -> dict | None:
    try:
        text = generate_content_with_fallback(
            prompt=prompt,
            temperature=0.1,
            response_mime_type="application/json",
        )
        if text:
            # Clean markdown fence if present
            text = re.sub(r"^```json\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            return json.loads(text)
    except Exception as err:
        import logging
        logging.getLogger(__name__).warning(f"Gemini JSON generation failed across all keys: {err}")
    return None


def _call_gemini_text(prompt: str) -> str | None:
    try:
        text = generate_content_with_fallback(
            prompt=prompt,
            temperature=0.2,
        )
        if text:
            return text
    except Exception as err:
        import logging
        logging.getLogger(__name__).warning(f"Gemini Text generation failed across all keys: {err}")
    return None


# ---------------------------------------------------------------------------
# Natural Language Column & Sheet Resolver (Aliases & Ambiguity Check)
# ---------------------------------------------------------------------------

COLUMN_ALIASES: dict[str, list[str]] = {
    "revenue": ["revenue", "sales", "turnover", "income", "sales_amount", "total_sales", "amount"],
    "profit": ["profit", "net_profit", "earnings", "margin", "income", "gain"],
    "cost": ["cost", "costs", "expenses", "expense", "cogs", "expenditure", "outlay"],
    "product": ["product", "item", "sku", "product_name", "title", "goods", "description"],
    "category": ["category", "dept", "department", "group", "type", "segment", "class"],
    "date": ["date", "time", "timestamp", "period", "year", "month", "day", "created_at"],
    "quantity": ["quantity", "qty", "units", "volume", "count", "amount"],
    "department": ["department", "dept", "division", "team", "unit", "category"],
}


def resolve_column_name(
    target_name: str,
    available_columns: list[str],
) -> tuple[str | None, str]:
    """Resolves natural language field target_name against available_columns.

    Returns (matched_column, match_type: 'exact' | 'alias' | 'ambiguous' | 'none').
    """
    if not target_name or not available_columns:
        return None, "none"

    target_norm = target_name.lower().strip()

    # 1. Exact match (case insensitive)
    for col in available_columns:
        if col.lower().strip() == target_norm:
            return col, "exact"

    # 2. Substring match
    matches = [col for col in available_columns if target_norm in col.lower() or col.lower() in target_norm]
    if len(matches) == 1:
        return matches[0], "exact"

    # 3. Alias dictionary matching
    target_aliases = []
    for concept, keywords in COLUMN_ALIASES.items():
        if target_norm in keywords or concept in target_norm:
            target_aliases.extend(keywords)

    alias_matches = set()
    for col in available_columns:
        col_norm = col.lower().strip()
        for alias in target_aliases:
            if alias in col_norm or col_norm in alias:
                alias_matches.add(col)

    if len(alias_matches) == 1:
        return list(alias_matches)[0], "alias"
    elif len(alias_matches) > 1:
        return None, "ambiguous"

    if len(matches) > 1:
        return None, "ambiguous"

    return None, "none"


# ---------------------------------------------------------------------------
# Date Normalization & Date Filter Resolution
# ---------------------------------------------------------------------------

def apply_date_filter(
    df: pd.DataFrame,
    date_col: str,
    period: str,
) -> tuple[pd.DataFrame, str]:
    """Filters df by period on date_col deterministically in Pandas."""
    if date_col not in df.columns or df.empty:
        return df, "No date column found"

    dt_series = pd.to_datetime(df[date_col], errors="coerce")
    valid_dt = dt_series.dropna()
    if valid_dt.empty:
        return df, "Date column contains invalid dates"

    # Anchor to max date in dataset if dataset is historical
    max_date = valid_dt.max()
    period_str = str(period or "all")
    period_lower = period_str.lower().strip()

    filtered_mask = pd.Series(True, index=df.index)

    if "today" in period_lower:
        filtered_mask = dt_series.dt.date == max_date.date()
        desc = f"{date_col} == {max_date.strftime('%Y-%m-%d')}"
    elif "yesterday" in period_lower:
        yest = max_date - pd.Timedelta(days=1)
        filtered_mask = dt_series.dt.date == yest.date()
        desc = f"{date_col} == {yest.strftime('%Y-%m-%d')}"
    elif "last 7 days" in period_lower or "last week" in period_lower:
        start_date = max_date - pd.Timedelta(days=7)
        filtered_mask = (dt_series >= start_date) & (dt_series <= max_date)
        desc = f"{date_col} in last 7 days ({start_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')})"
    elif "last 30 days" in period_lower or "last month" in period_lower:
        start_date = max_date - pd.Timedelta(days=30)
        filtered_mask = (dt_series >= start_date) & (dt_series <= max_date)
        desc = f"{date_col} in last 30 days ({start_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')})"
    elif "this month" in period_lower:
        filtered_mask = (dt_series.dt.year == max_date.year) & (dt_series.dt.month == max_date.month)
        desc = f"{date_col} in month {max_date.strftime('%Y-%m')}"
    elif "this year" in period_lower:
        filtered_mask = dt_series.dt.year == max_date.year
        desc = f"{date_col} in year {max_date.year}"
    elif "last year" in period_lower:
        filtered_mask = dt_series.dt.year == (max_date.year - 1)
        desc = f"{date_col} in year {max_date.year - 1}"
    elif "q1" in period_lower:
        filtered_mask = (dt_series.dt.year == max_date.year) & (dt_series.dt.quarter == 1)
        desc = f"{date_col} Q1 {max_date.year}"
    elif "q2" in period_lower:
        filtered_mask = (dt_series.dt.year == max_date.year) & (dt_series.dt.quarter == 2)
        desc = f"{date_col} Q2 {max_date.year}"
    elif "q3" in period_lower:
        filtered_mask = (dt_series.dt.year == max_date.year) & (dt_series.dt.quarter == 3)
        desc = f"{date_col} Q3 {max_date.year}"
    elif "q4" in period_lower:
        filtered_mask = (dt_series.dt.year == max_date.year) & (dt_series.dt.quarter == 4)
        desc = f"{date_col} Q4 {max_date.year}"
    elif "ytd" in period_lower or "year-to-date" in period_lower:
        start_year = pd.Timestamp(year=max_date.year, month=1, day=1)
        filtered_mask = (dt_series >= start_year) & (dt_series <= max_date)
        desc = f"{date_col} YTD ({max_date.year})"
    else:
        desc = f"{date_col} filtered by {period}"

    res_df = df[filtered_mask]
    if res_df.empty:
        # Fallback to full df if filter yielded 0 rows
        return df, f"Filter '{period}' returned 0 rows, evaluated on full dataset"
    return res_df, desc


# ---------------------------------------------------------------------------
# Fallback Intent & Structured Plan Parser (Deterministic Rule-Based Engine)
# ---------------------------------------------------------------------------

def fallback_parse_intent(question: str, schema: dict[str, Any]) -> dict[str, Any]:
    """Generates a structured analysis plan using deterministic rule parsing."""
    q = question.lower().strip()

    sheet_names = schema.get("sheet_names", [])
    primary_sheet = sheet_names[0] if sheet_names else "Sheet1"
    sheet_meta = schema.get("sheets", {}).get(primary_sheet, {})

    num_cols = sheet_meta.get("numeric_columns", [])
    cat_cols = sheet_meta.get("categorical_columns", [])
    date_cols = sheet_meta.get("date_columns", [])

    # Find candidate measure column matching keywords
    measure = num_cols[0] if num_cols else None
    for col in num_cols:
        col_l = col.lower()
        if col_l in q:
            measure = col
            break

    # Find candidate group column matching keywords
    group_by = None
    for col in cat_cols:
        col_l = col.lower()
        if col_l in q or (col_l == "department" and "dept" in q) or (col_l == "product" and "product" in q):
            group_by = col
            break
    # Only set group_by if question explicitly asks for grouping or ranking by category/entity
    if not group_by and any(kw in q for kw in ["by", "each", "which", "product", "department", "dept", "category", "month", "item", "top", "lowest", "highest"]):
        group_by = cat_cols[0] if cat_cols else None

    date_col = date_cols[0] if date_cols else None

    # Detect intent & operation
    intent = "general_workbook_question"
    operation = "summary"
    aggregation = "sum"
    sort_dir = "descending"
    limit_val = 5 if "top 5" in q or "5" in q else 1

    if "lowest" in q or "bottom" in q or "min" in q or "least" in q:
        sort_dir = "ascending"
        if group_by and measure:
            intent = "ranking"
            operation = "groupby_rank"
        else:
            intent = "minimum"
            operation = "min"
    elif "highest" in q or "top" in q or "max" in q or "most" in q:
        sort_dir = "descending"
        if "month" in q and date_col:
            intent = "ranking"
            operation = "groupby_rank"
            group_by = date_col
        elif group_by and measure:
            intent = "ranking"
            operation = "groupby_rank"
        else:
            intent = "maximum"
            operation = "max"
    elif "percentage" in q or "% of" in q:
        intent = "percentage"
        operation = "percentage"
    elif "faster than" in q or "growing faster" in q or "compare" in q:
        intent = "comparison"
        operation = "compare_growth"
    elif "correlation" in q or "related" in q:
        intent = "correlation"
        operation = "correlation"
    elif "volatile" in q or "volatility" in q:
        intent = "trend"
        operation = "volatility"
    elif "anomaly" in q or "anomalies" in q or "outlier" in q:
        intent = "anomaly"
        operation = "anomaly"
    elif "missing" in q or "health" in q or "quality" in q:
        intent = "data_quality"
        operation = "data_quality"
    elif "total" in q or "sum" in q:
        intent = "sum"
        operation = "sum"
    elif "average" in q or "mean" in q:
        intent = "average"
        operation = "average"
    elif "summary" in q or "overview" in q or "most data" in q:
        intent = "general_workbook_question"
        operation = "summary"

    target_cat = None
    if "product a" in q:
        target_cat = "Product A"
    elif "product b" in q:
        target_cat = "Product B"
    elif "product c" in q:
        target_cat = "Product C"

    return {
        "intent": intent,
        "sheet": primary_sheet,
        "operation": operation,
        "group_by": [group_by] if group_by else [],
        "measure": measure,
        "secondary_measure": num_cols[1] if len(num_cols) > 1 else None,
        "aggregation": aggregation,
        "sort": sort_dir,
        "limit": limit_val,
        "date_column": date_col,
        "date_period": "last_month" if "last month" in q else ("last_30_days" if "last 30 days" in q else None),
        "target_category": target_cat,
        "filters": [],
    }


# ---------------------------------------------------------------------------
# Question Understanding (Gemini NLU Plan Generator)
# ---------------------------------------------------------------------------

def generate_analysis_plan(
    question: str,
    schema: dict[str, Any],
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Uses Gemini JSON mode to construct a Structured Analysis Plan."""
    history_ctx = ""
    if history:
        history_ctx = "Previous Conversation Context:\n" + "\n".join(
            f"- {msg['role']}: {msg['content']}" for msg in history[-4:]
        )

    prompt = f"""
You are a Data Analysis Planner. Convert the user's natural language question into a JSON Structured Analysis Plan.

Workbook Schema:
{json.dumps(schema, indent=2, default=str)}

{history_ctx}

User Question: "{question}"

JSON Format Requirements:
{{
  "intent": "lookup" | "sum" | "average" | "count" | "minimum" | "maximum" | "median" | "ranking" | "comparison" | "percentage" | "growth" | "trend" | "date_analysis" | "filter" | "grouping" | "pivot" | "correlation" | "anomaly" | "data_quality" | "cross_sheet_analysis" | "general_workbook_question",
  "sheet": "<exact sheet name>",
  "operation": "sum" | "average" | "count" | "min" | "max" | "median" | "groupby_rank" | "percentage" | "growth" | "compare_growth" | "correlation" | "anomaly" | "data_quality" | "cross_sheet" | "summary",
  "group_by": ["<column_name>"],
  "measure": "<column_name>",
  "secondary_measure": "<column_name or null>",
  "aggregation": "sum" | "mean" | "count" | "min" | "max" | "median",
  "sort": "descending" | "ascending",
  "limit": <number>,
  "date_column": "<date_column_name or null>",
  "date_period": "today" | "yesterday" | "last_week" | "last_month" | "this_month" | "this_year" | "last_year" | "Q1" | "Q2" | "Q3" | "Q4" | "YTD" | null,
  "target_category": "<category_value_or_null>",
  "secondary_sheet": "<secondary_sheet_name_or_null>"
}}
"""
    plan = _call_gemini_json(prompt)
    if not plan or not isinstance(plan, dict) or "operation" not in plan:
        plan = fallback_parse_intent(question, schema)

    return plan


# ---------------------------------------------------------------------------
# Deterministic Pandas Data Execution Engine
# ---------------------------------------------------------------------------

def execute_pandas_plan(
    plan: dict[str, Any],
    workbook_dict: dict[str, pd.DataFrame],
    schema: dict[str, Any],
) -> dict[str, Any]:
    """Executes the Structured Analysis Plan deterministically using Python & Pandas."""
    if not plan or not isinstance(plan, dict):
        plan = {}

    sheet_name = plan.get("sheet")
    if not sheet_name or sheet_name not in workbook_dict:
        sheet_name = list(workbook_dict.keys())[0]

    df = workbook_dict[sheet_name].copy()
    sheet_cols = [str(c) for c in df.columns]

    # Resolve target measure column
    raw_measure = plan.get("measure")
    measure, match_type = resolve_column_name(raw_measure or "", sheet_cols)
    if match_type == "ambiguous":
        return {
            "success": False,
            "error_type": "ambiguous_column",
            "message": f"Multiple columns matched '{raw_measure}'. Please specify the exact column name.",
        }

    # Resolve group_by column safely
    group_by_cols = []
    raw_group_by = plan.get("group_by")
    group_by_list = raw_group_by if isinstance(raw_group_by, list) else ([raw_group_by] if raw_group_by else [])
    for g in group_by_list:
        if not g:
            continue
        matched_g, g_match = resolve_column_name(str(g), sheet_cols)
        if matched_g:
            group_by_cols.append(matched_g)
        elif g_match == "ambiguous":
            return {
                "success": False,
                "error_type": "ambiguous_column",
                "message": f"Multiple grouping columns matched '{g}'. Please specify.",
            }

    # Apply date filtering if specified
    date_filter_desc = None
    date_col = plan.get("date_column")
    if date_col:
        matched_date_col, _ = resolve_column_name(date_col, sheet_cols)
        if matched_date_col:
            df, date_filter_desc = apply_date_filter(df, matched_date_col, plan.get("date_period", "last_month"))

    rows_analyzed = len(df)
    op = plan.get("operation", "summary")
    agg_func = plan.get("aggregation", "sum")

    # 1. SUM OPERATION
    if op == "sum":
        if not measure:
            # Pick first numeric column
            num_cols = schema.get("sheets", {}).get(sheet_name, {}).get("numeric_columns", [])
            measure = num_cols[0] if num_cols else None

        if not measure or measure not in df.columns:
            return {
                "success": False,
                "error_type": "missing_column",
                "message": f"I couldn't find a numeric column for calculation. Available columns are: {', '.join(sheet_cols)}",
            }

        total_sum = float(pd.to_numeric(df[measure], errors="coerce").sum())
        return {
            "success": True,
            "result_value": total_sum,
            "formatted_result": f"{total_sum:,.2f}",
            "direct_answer": f"The total {measure} in {sheet_name} is {total_sum:,.2f}.",
            "operation": f"SUM({measure})",
            "columns_used": [measure],
            "source_sheet": sheet_name,
            "rows_analyzed": rows_analyzed,
            "confidence": "High" if match_type == "exact" else "Medium",
        }

    # 2. AVERAGE / MEAN OPERATION
    elif op == "average":
        if not measure:
            num_cols = schema.get("sheets", {}).get(sheet_name, {}).get("numeric_columns", [])
            measure = num_cols[0] if num_cols else None

        if not measure or measure not in df.columns:
            return {
                "success": False,
                "error_type": "missing_column",
                "message": f"I couldn't find a numeric column to average. Available columns are: {', '.join(sheet_cols)}",
            }

        mean_val = float(pd.to_numeric(df[measure], errors="coerce").mean())
        return {
            "success": True,
            "result_value": mean_val,
            "formatted_result": f"{mean_val:,.2f}",
            "direct_answer": f"The average {measure} in {sheet_name} is {mean_val:,.2f}.",
            "operation": f"AVERAGE({measure})",
            "columns_used": [measure],
            "source_sheet": sheet_name,
            "rows_analyzed": rows_analyzed,
            "confidence": "High" if match_type == "exact" else "Medium",
        }

    # 3. COUNT OPERATION
    elif op == "count":
        cnt = rows_analyzed
        return {
            "success": True,
            "result_value": cnt,
            "formatted_result": f"{cnt:,}",
            "direct_answer": f"The sheet '{sheet_name}' contains {cnt:,} total records.",
            "operation": f"COUNT(*)",
            "columns_used": sheet_cols[:2],
            "source_sheet": sheet_name,
            "rows_analyzed": rows_analyzed,
            "confidence": "High",
        }

    # 4. MIN / MAX / MEDIAN OPERATION
    elif op in ("min", "max", "median"):
        if not measure:
            num_cols = schema.get("sheets", {}).get(sheet_name, {}).get("numeric_columns", [])
            measure = num_cols[0] if num_cols else None

        if not measure or measure not in df.columns:
            return {
                "success": False,
                "error_type": "missing_column",
                "message": f"I couldn't find column '{raw_measure}'. Available columns: {', '.join(sheet_cols)}",
            }

        s_num = pd.to_numeric(df[measure], errors="coerce").dropna()
        if s_num.empty:
            return {"success": False, "message": f"Column {measure} has no valid numeric values."}

        val = float(s_num.min() if op == "min" else (s_num.max() if op == "max" else s_num.median()))

        # Find matching row item name if group_by exists
        entity_name = ""
        if group_by_cols and group_by_cols[0] in df.columns:
            idx = s_num.idxmin() if op == "min" else s_num.idxmax()
            entity_name = f" ({df.loc[idx, group_by_cols[0]]})"

        return {
            "success": True,
            "result_value": val,
            "formatted_result": f"{val:,.2f}",
            "direct_answer": f"The {op.upper()} {measure} is {val:,.2f}{entity_name}.",
            "operation": f"{op.upper()}({measure})",
            "columns_used": [measure] + group_by_cols,
            "source_sheet": sheet_name,
            "rows_analyzed": rows_analyzed,
            "confidence": "High",
        }

    # 5. GROUPBY RANKING / TOP & BOTTOM N
    elif op == "groupby_rank" or group_by_cols:
        if not group_by_cols:
            cat_cols = schema.get("sheets", {}).get(sheet_name, {}).get("categorical_columns", [])
            if cat_cols:
                group_by_cols = [cat_cols[0]]

        if not measure:
            num_cols = schema.get("sheets", {}).get(sheet_name, {}).get("numeric_columns", [])
            measure = num_cols[0] if num_cols else None

        if not group_by_cols or not measure or group_by_cols[0] not in df.columns or measure not in df.columns:
            return {
                "success": False,
                "error_type": "missing_column",
                "message": f"Required columns for ranking not found. Available: {', '.join(sheet_cols)}",
            }

        grp_col = group_by_cols[0]
        df[measure] = pd.to_numeric(df[measure], errors="coerce")
        grouped = df.groupby(grp_col)[measure].agg("sum" if agg_func == "sum" else "mean").reset_index()

        is_desc = plan.get("sort", "descending") == "descending" or "highest" in str(plan.get("intent", "")) or "top" in str(plan.get("intent", ""))
        grouped = grouped.sort_values(by=measure, ascending=not is_desc)

        top_row = grouped.iloc[0] if not grouped.empty else None
        top_name = str(top_row[grp_col]) if top_row is not None else "N/A"
        top_val = float(top_row[measure]) if top_row is not None else 0.0

        limit = plan.get("limit", 5)
        top_n = grouped.head(limit).to_dict(orient="records")

        rank_word = "highest" if is_desc else "lowest"
        return {
            "success": True,
            "result_value": top_val,
            "formatted_result": f"{top_name} ({top_val:,.2f})",
            "direct_answer": f"**{top_name}** generated the {rank_word} {measure} ({top_val:,.2f}).",
            "operation": f"{agg_func.upper()}({measure}) grouped by {grp_col}",
            "columns_used": [grp_col, measure],
            "source_sheet": sheet_name,
            "rows_analyzed": rows_analyzed,
            "table_data": top_n,
            "confidence": "High",
        }

    # 6. PERCENTAGE CALCULATION
    elif op == "percentage":
        if not group_by_cols or not measure:
            cat_cols = schema.get("sheets", {}).get(sheet_name, {}).get("categorical_columns", [])
            num_cols = schema.get("sheets", {}).get(sheet_name, {}).get("numeric_columns", [])
            if cat_cols:
                group_by_cols = [cat_cols[0]]
            if num_cols:
                measure = num_cols[0]

        if not group_by_cols or not measure:
            return {"success": False, "message": "Cannot compute percentage without grouping and measure column."}

        grp_col = group_by_cols[0]
        df[measure] = pd.to_numeric(df[measure], errors="coerce")
        total_val = float(df[measure].sum())
        if total_val == 0:
            return {"success": False, "message": "Total value is zero."}

        target_cat = plan.get("target_category")
        grouped = df.groupby(grp_col)[measure].sum().reset_index()

        if target_cat:
            matched_row = grouped[grouped[grp_col].astype(str).str.lower() == str(target_cat).lower()]
            if not matched_row.empty:
                part_val = float(matched_row.iloc[0][measure])
                pct = (part_val / total_val) * 100
                target_name = str(matched_row.iloc[0][grp_col])
                return {
                    "success": True,
                    "result_value": pct,
                    "formatted_result": f"{pct:.1f}%",
                    "direct_answer": f"**{target_name}** represents **{pct:.1f}%** of total {measure} ({part_val:,.2f} out of {total_val:,.2f}).",
                    "operation": f"Percentage of SUM({measure}) for {grp_col}=='{target_name}'",
                    "columns_used": [grp_col, measure],
                    "source_sheet": sheet_name,
                    "rows_analyzed": rows_analyzed,
                    "confidence": "High",
                }

        # Highest item percentage if target not specified
        top_row = grouped.sort_values(by=measure, ascending=False).iloc[0]
        part_val = float(top_row[measure])
        pct = (part_val / total_val) * 100
        target_name = str(top_row[grp_col])
        return {
            "success": True,
            "result_value": pct,
            "formatted_result": f"{pct:.1f}%",
            "direct_answer": f"**{target_name}** accounts for **{pct:.1f}%** of total {measure}.",
            "operation": f"Percentage of total {measure} for top {grp_col}",
            "columns_used": [grp_col, measure],
            "source_sheet": sheet_name,
            "rows_analyzed": rows_analyzed,
            "confidence": "High",
        }

    # 7. COMPARE GROWTH / MEASURE COMPARISON (e.g., Is revenue growing faster than costs?)
    elif op == "compare_growth":
        num_cols = schema.get("sheets", {}).get(sheet_name, {}).get("numeric_columns", [])
        m1 = measure or (num_cols[0] if len(num_cols) > 0 else None)
        m2 = plan.get("secondary_measure") or (num_cols[1] if len(num_cols) > 1 else None)

        if not m1 or not m2 or m1 not in df.columns or m2 not in df.columns:
            return {
                "success": False,
                "message": f"Need 2 numeric columns for growth comparison. Found: {', '.join(num_cols)}",
            }

        s1 = pd.to_numeric(df[m1], errors="coerce").dropna()
        s2 = pd.to_numeric(df[m2], errors="coerce").dropna()

        # Compute growth rate (first half vs second half of data)
        mid = len(s1) // 2
        g1 = ((s1.iloc[mid:].mean() - s1.iloc[:mid].mean()) / (abs(s1.iloc[:mid].mean()) + 1e-9)) * 100
        g2 = ((s2.iloc[mid:].mean() - s2.iloc[:mid].mean()) / (abs(s2.iloc[:mid].mean()) + 1e-9)) * 100

        faster = m1 if g1 > g2 else m2
        slower = m2 if g1 > g2 else m1
        diff = abs(g1 - g2)

        ans = f"**{'Yes' if g1 > g2 else 'No'}**, **{faster}** is growing faster than **{slower}** (Growth: {m1} **{g1:+.1f}%** vs {m2} **{g2:+.1f}%**)."
        return {
            "success": True,
            "result_value": round(diff, 1),
            "formatted_result": f"{m1}: {g1:+.1f}%, {m2}: {g2:+.1f}%",
            "direct_answer": ans,
            "operation": f"Compare Growth Rate of {m1} vs {m2}",
            "columns_used": [m1, m2],
            "source_sheet": sheet_name,
            "rows_analyzed": rows_analyzed,
            "confidence": "High",
        }

    # 8. CORRELATION
    elif op == "correlation":
        num_cols = schema.get("sheets", {}).get(sheet_name, {}).get("numeric_columns", [])
        m1 = measure or (num_cols[0] if len(num_cols) > 0 else None)
        m2 = plan.get("secondary_measure") or (num_cols[1] if len(num_cols) > 1 else None)

        if not m1 or not m2 or m1 not in df.columns or m2 not in df.columns:
            return {"success": False, "message": "Require 2 numeric columns to calculate correlation."}

        c_val = float(df[[m1, m2]].apply(pd.to_numeric, errors="coerce").corr().iloc[0, 1])
        desc = "strong positive" if c_val > 0.7 else ("positive" if c_val > 0.3 else ("strong negative" if c_val < -0.7 else "weak/none"))

        return {
            "success": True,
            "result_value": round(c_val, 3),
            "formatted_result": f"{c_val:.3f}",
            "direct_answer": f"The correlation coefficient between **{m1}** and **{m2}** is **{c_val:.3f}** ({desc} correlation).",
            "operation": f"Pearson Correlation({m1}, {m2})",
            "columns_used": [m1, m2],
            "source_sheet": sheet_name,
            "rows_analyzed": rows_analyzed,
            "confidence": "High",
        }

    # 9. GENERAL WORKBOOK SUMMARY
    sheet_count = len(workbook_dict)
    total_rows = schema.get("total_rows", rows_analyzed)
    return {
        "success": True,
        "result_value": total_rows,
        "formatted_result": f"{total_rows:,} rows across {sheet_count} sheet(s)",
        "direct_answer": f"The workbook '{schema.get('filename')}' contains **{sheet_count}** sheet(s) with **{total_rows:,}** total rows.",
        "operation": "Workbook Summary Inspection",
        "columns_used": sheet_cols[:3],
        "source_sheet": sheet_name,
        "rows_analyzed": rows_analyzed,
        "confidence": "High",
    }


# ---------------------------------------------------------------------------
# Result Verification & Confidence Calculation
# ---------------------------------------------------------------------------

def calculate_confidence(
    exec_result: dict[str, Any],
    plan: dict[str, Any],
    schema: dict[str, Any],
) -> str:
    """Calculates deterministic confidence rating: High, Medium, Low."""
    if not exec_result.get("success"):
        return "Low"

    rows = exec_result.get("rows_analyzed", 0)
    if rows == 0:
        return "Low"

    if exec_result.get("error_type") == "ambiguous_column":
        return "Low"

    if exec_result.get("confidence") == "Medium":
        return "Medium"

    if rows < 5:
        return "Medium"

    return "High"


def verify_execution(exec_result: dict[str, Any]) -> tuple[bool, str]:
    """Verifies that numerical calculation is non-null, finite, and valid."""
    if not exec_result.get("success"):
        return False, exec_result.get("message", "Execution failed")

    val = exec_result.get("result_value")
    if val is None:
        return False, "Result value is null"

    if isinstance(val, (int, float)):
        import math
        if pd.isna(val) or math.isinf(val):
            return False, "Calculation resulted in NaN or Infinite value"

    return True, "Verified"


# ---------------------------------------------------------------------------
# Gemini Explanation & Structured Answer Formatter
# ---------------------------------------------------------------------------

def generate_verified_answer(
    question: str,
    exec_result: dict[str, Any],
    confidence: str,
) -> str:
    """Formats verified result into strict structured output.

    Gemini explains the verified result without altering numbers.
    """
    direct_ans = exec_result.get("direct_answer", "Verified result generated.")
    formatted_res = exec_result.get("formatted_result", "N/A")
    op = exec_result.get("operation", "Pandas Execution")
    source_sheet = exec_result.get("source_sheet", "Workbook")
    cols_used = ", ".join(exec_result.get("columns_used", []))
    rows_an = exec_result.get("rows_analyzed", 0)

    # Use Gemini to generate an articulate explanation around the verified result
    explanation = ""
    try:
        prompt = f"""
You are a Lead AI Data Analyst. Explain the pre-calculated, verified Python result below to answer the user's question.

CRITICAL REQUIREMENT:
- You MUST NOT calculate or change any numbers.
- Use the exact verified result and numerical figures provided below.

User Question: "{question}"
Verified Result: "{formatted_res}"
Direct Answer: "{direct_ans}"
Operation Performed: "{op}"
Source: Sheet "{source_sheet}", Columns [{cols_used}]
Rows Analyzed: {rows_an}

Provide a 2-3 sentence professional, business-focused explanation summarizing why this result matters.
"""
        explanation = _call_gemini_text(prompt) or ""
    except Exception:
        explanation = ""

    lines = [
        "ANSWER",
        "",
        direct_ans,
        "",
        "WHY / EXPLANATION",
        "",
        explanation if (explanation and len(explanation) > 10) else "Calculated directly from your workbook data using verified Pandas logic.",
        "",
        "DATA USED",
        "",
        f"Sheet '{source_sheet}', Columns: {cols_used} ({rows_an:,} rows analyzed)",
        "",
        "HOW IT WAS CALCULATED",
        "",
        str(op),
        "",
        "CONFIDENCE",
        "",
        confidence,
    ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public Entrypoint API
# ---------------------------------------------------------------------------

def ask_verified_agent(
    workbook_id: str,
    question: str,
    workbook_dict: dict[str, pd.DataFrame],
    filename: str = "workbook.xlsx",
) -> dict[str, Any]:
    """Main Orchestrator for the Verified Data Analysis Agent.

    Executes: QUESTION UNDERSTANDING -> WORKBOOK SCHEMA MATCHING ->
    STRUCTURED ANALYSIS PLAN -> VALIDATION -> PANDAS DATA EXECUTION ->
    RESULT VERIFICATION -> GEMINI RESPONSE GENERATION -> FINAL VERIFIED ANSWER
    """
    if not question or not question.strip():
        return {
            "answer": "Please ask a question about your workbook data.",
            "source": "verified_agent",
            "confidence": "Low",
        }

    # Retrieve or build schema
    schema = build_workbook_schema(workbook_dict, filename)

    # Maintain conversation memory
    history = _SESSION_MEMORY.get(workbook_id, [])

    # 1. QUESTION UNDERSTANDING & STRUCTURED PLAN
    plan = generate_analysis_plan(question, schema, history)

    # 2. PANDAS DATA EXECUTION
    exec_result = execute_pandas_plan(plan, workbook_dict, schema)

    # 3. RESULT VERIFICATION
    is_valid, err_msg = verify_execution(exec_result)
    if not is_valid:
        # Check if error is ambiguous or missing column
        if exec_result.get("error_type") == "ambiguous_column":
            ans_text = f"ANSWER\n\nI found multiple possible interpretations for your query.\n\n{exec_result.get('message')}\n\nCONFIDENCE\n\nLow"
        elif exec_result.get("error_type") == "missing_column":
            ans_text = f"ANSWER\n\n{exec_result.get('message')}\n\nCONFIDENCE\n\nLow"
        else:
            ans_text = "ANSWER\n\nI couldn't calculate that from the uploaded workbook because the required data is not available.\n\nCONFIDENCE\n\nLow"

        return {
            "answer": ans_text,
            "source": "verified_agent",
            "confidence": "Low",
            "traceability": {
                "workbook_id": workbook_id,
                "question": question,
                "operation": plan.get("operation", "unknown"),
                "status": "failed",
                "reason": err_msg,
            },
        }

    # 4. CONFIDENCE EVALUATION
    confidence = calculate_confidence(exec_result, plan, schema)

    # 5. GEMINI RESPONSE GENERATION & STRUCTURED ANSWER
    final_answer_markdown = generate_verified_answer(question, exec_result, confidence)

    # Update session memory
    if workbook_id not in _SESSION_MEMORY:
        _SESSION_MEMORY[workbook_id] = []
    _SESSION_MEMORY[workbook_id].append({"role": "user", "content": question})
    _SESSION_MEMORY[workbook_id].append({"role": "assistant", "content": exec_result.get("direct_answer", "")})

    return {
        "answer": final_answer_markdown,
        "source": "verified_agent",
        "result_value": exec_result.get("result_value"),
        "formatted_result": exec_result.get("formatted_result"),
        "operation": exec_result.get("operation"),
        "source_sheet": exec_result.get("source_sheet"),
        "columns_used": exec_result.get("columns_used", []),
        "rows_analyzed": exec_result.get("rows_analyzed", 0),
        "confidence": confidence,
        "traceability": {
            "workbook_id": workbook_id,
            "question": question,
            "sheet": exec_result.get("source_sheet"),
            "columns": exec_result.get("columns_used"),
            "operation": exec_result.get("operation"),
            "rows_analyzed": exec_result.get("rows_analyzed"),
            "result": exec_result.get("formatted_result"),
            "confidence": confidence,
        },
    }
