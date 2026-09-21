"""Generic Deterministic Domain Validation Engine.

Infers mathematically and domain-safe boundaries from column names,
semantic types, and data properties without hardcoding dataset names.
Distinguishes statistical anomalies from domain rule violations.
"""
from __future__ import annotations

import re
from typing import Any
import numpy as np
import pandas as pd


class DomainValidator:
    """Validates records against inferred domain and mathematical constraints."""

    @classmethod
    def validate_sheet(
        cls,
        df: pd.DataFrame,
        date_column: str | None = None,
    ) -> dict[str, Any]:
        """Audit sheet records against generic domain and boundary rules."""
        if df.empty or "__error__" in df.columns:
            return {
                "total_violations": 0,
                "violations": [],
                "by_column": {},
                "by_rule": {},
                "by_severity": {"error": 0, "warning": 0},
                "status": "empty" if df.empty else "error",
            }

        violations: list[dict[str, Any]] = []
        by_column: dict[str, int] = {}
        by_rule: dict[str, int] = {}

        row_count = len(df)

        for col in df.columns:
            str_col = str(col)
            lower_col = str_col.lower().strip()
            raw_series = df[col]
            num_series = pd.to_numeric(raw_series, errors="coerce")

            # Rule 1: Non-negative Count/Quantity constraint
            # Columns representing discrete counts or physical inventory quantities cannot be negative.
            # Explicitly protects financial columns: profit, loss, margin, cash_flow, returns, adjustment, delta, balance.
            is_financial = any(
                token in lower_col
                for token in ["profit", "loss", "cash_flow", "revenue", "cost", "expense", "margin", "delta", "change", "diff", "adjustment", "balance"]
            )
            is_rate_pct = any(token in lower_col for token in ["rate", "pct", "%", "ratio"])

            is_count_like = any(
                token in lower_col
                for token in [
                    "orders", "order", "customers", "customer", "headcount", "units",
                    "quantity", "qty", "inventory", "stock", "items", "employees",
                    "visits", "transactions", "clicks", "users", "sessions"
                ]
            ) and not is_financial and not is_rate_pct

            if is_count_like:
                for idx, val in num_series.items():
                    if pd.notna(val) and val < 0:
                        v_rec = {
                            "column": str_col,
                            "row": int(idx) + 1,
                            "row_index": int(idx),
                            "value": float(val),
                            "rule": "non_negative_count",
                            "rule_id": "non_negative_count",
                            "semantic_type": "count",
                            "severity": "error",
                            "message": f"'{str_col}' cannot be negative under discrete count/inventory constraint (found {val}).",
                            "evidence": f"Column '{str_col}' inferred as non-negative count metric; observed negative value {val} at row {int(idx) + 1}.",
                        }
                        violations.append(v_rec)
                        by_column[str_col] = by_column.get(str_col, 0) + 1
                        by_rule["non_negative_count"] = by_rule.get("non_negative_count", 0) + 1

            # Rule 1b: Unit Price / Listing Price non-negativity constraint
            # Unit prices for products/items cannot be negative (unlike profit/loss/balance adjustments)
            is_unit_price = any(token in lower_col for token in ["unit_price", "unitprice", "list_price", "catalog_price"]) or (
                "price" in lower_col and not any(k in lower_col for k in ["change", "delta", "diff", "adjustment"])
            )
            if is_unit_price:
                for idx, val in num_series.items():
                    if pd.notna(val) and val < 0:
                        v_rec = {
                            "column": str_col,
                            "row": int(idx) + 1,
                            "row_index": int(idx),
                            "value": float(val),
                            "rule": "non_negative_price",
                            "rule_id": "non_negative_price",
                            "semantic_type": "price",
                            "severity": "error",
                            "message": f"'{str_col}' cannot be negative under standard product pricing constraint (found {val}).",
                            "evidence": f"Column '{str_col}' inferred as non-negative unit price; observed negative value {val} at row {int(idx) + 1}.",
                        }
                        violations.append(v_rec)
                        by_column[str_col] = by_column.get(str_col, 0) + 1
                        by_rule["non_negative_price"] = by_rule.get("non_negative_price", 0) + 1

            # Rule 2: Standard bounded percentage/rate constraints
            # Distinguishes 0–1 ratio scale from 0–100 percentage scale.
            # Excludes growth, cagr, delta which can legitimately exceed 100% or be negative.
            is_growth_delta = any(token in lower_col for token in ["growth", "increase", "cagr", "change", "delta", "variance"])
            is_percentage_or_rate = (
                any(token in lower_col for token in ["%", "percent", "percentage", "rate", "ratio", "share", "portion"])
                and not is_growth_delta
            )

            if is_percentage_or_rate:
                clean_num = num_series.dropna()
                if len(clean_num) > 0:
                    # Determine whether scale is 0–1 ratio or 0–100 percentage
                    max_val = clean_num.max()
                    has_pct_symbol = "%" in str_col or "percent" in lower_col
                    
                    # If named % or max > 1.0, scale is [0, 100]; if strictly bounded <= 1.0 and named ratio/rate, scale is [0, 1]
                    if has_pct_symbol or max_val > 1.0:
                        scale_min, scale_max = 0.0, 100.0
                        scale_name = "0–100% percentage"
                    else:
                        scale_min, scale_max = 0.0, 1.0
                        scale_name = "0–1.0 ratio"

                    for idx, val in num_series.items():
                        if pd.notna(val):
                            if val < scale_min or val > scale_max:
                                v_rec = {
                                    "column": str_col,
                                    "row": int(idx) + 1,
                                    "row_index": int(idx),
                                    "value": float(val),
                                    "rule": "percentage_range",
                                    "rule_id": "percentage_range",
                                    "semantic_type": "percentage" if scale_max == 100.0 else "ratio",
                                    "severity": "error",
                                    "message": f"'{str_col}' value {val} is outside valid {scale_name} range [{scale_min}, {scale_max}].",
                                    "evidence": f"Column '{str_col}' inferred as {scale_name}; observed value {val} outside bounds [{scale_min}, {scale_max}].",
                                }
                                violations.append(v_rec)
                                by_column[str_col] = by_column.get(str_col, 0) + 1
                                by_rule["percentage_range"] = by_rule.get("percentage_range", 0) + 1

        # Rule 3: Date Range Anomaly (e.g. solitary far future/past date outside dominant observation cluster)
        if date_column and date_column in df.columns:
            date_s = pd.to_datetime(df[date_column], errors="coerce")
            valid_dates = date_s.dropna()
            if len(valid_dates) >= 10:
                years = valid_dates.dt.year
                dominant_year = int(years.mode()[0])
                year_counts = years.value_counts()
                
                for idx, dt in date_s.items():
                    if pd.notna(dt):
                        yr = dt.year
                        if abs(yr - dominant_year) >= 5 and year_counts.get(yr, 0) <= 2:
                            v_rec = {
                                "column": str(date_column),
                                "row": int(idx) + 1,
                                "row_index": int(idx),
                                "value": str(dt.strftime("%Y-%m-%d")),
                                "rule": "date_range_anomaly",
                                "rule_id": "date_range_anomaly",
                                "semantic_type": "datetime",
                                "severity": "warning",
                                "message": f"Date {dt.strftime('%Y-%m-%d')} is far outside dominant observation cluster ({dominant_year}).",
                                "evidence": f"Observed year {yr} deviates by {abs(yr - dominant_year)} years from dominant cluster year {dominant_year}.",
                            }
                            violations.append(v_rec)
                            by_column[str(date_column)] = by_column.get(str(date_column), 0) + 1
                            by_rule["date_range_anomaly"] = by_rule.get("date_range_anomaly", 0) + 1

        error_count = sum(1 for v in violations if v["severity"] == "error")
        warning_count = sum(1 for v in violations if v["severity"] == "warning")

        return {
            "total_violations": len(violations),
            "error_count": error_count,
            "warning_count": warning_count,
            "violations": violations,
            "by_column": by_column,
            "by_rule": by_rule,
            "by_severity": {"error": error_count, "warning": warning_count},
        }


def detect_categorical_inconsistencies(df: pd.DataFrame) -> dict[str, Any]:
    """Detect casing, whitespace, and abbreviation inconsistencies across categorical columns."""
    inconsistencies = {}
    for col in df.columns:
        s = df[col].dropna()
        if pd.api.types.is_object_dtype(s) or pd.api.types.is_string_dtype(s):
            str_vals = s.astype(str).tolist()
            unique_raw = sorted(list(set(str_vals)))
            
            # Map normalized -> raw values
            norm_map: dict[str, list[str]] = {}
            for v in unique_raw:
                norm_key = re.sub(r"\s+", " ", v.strip().lower())
                norm_map.setdefault(norm_key, []).append(v)

            flagged_groups = {}
            for k, group in norm_map.items():
                if len(group) > 1:
                    # Pick most frequent as canonical candidate
                    canonical = max(group, key=lambda val: str_vals.count(val))
                    flagged_groups[canonical] = group

            if flagged_groups:
                inconsistencies[str(col)] = {
                    "column": str(col),
                    "canonical_candidates": flagged_groups,
                    "variant_count": sum(len(g) for g in flagged_groups.values()),
                }

    return inconsistencies
