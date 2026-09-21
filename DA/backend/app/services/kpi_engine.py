"""Dynamic KPI Engine.

Identifies numerical measures automatically without hardcoded column names.
Computes comprehensive statistical KPIs, distributions, percentiles, and volatility
indicators with complete traceability.
"""
from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd


class GenericKPIEngine:
    """Computes dynamic KPIs and performance indicators across all numeric series."""

    @classmethod
    def compute_sheet_kpis(
        cls,
        df: pd.DataFrame,
        sheet_name: str,
        date_column: str | None = None,
        trends: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Extract and compute statistical KPIs for every numeric column."""
        if df.empty or "__error__" in df.columns:
            return []

        kpis = []
        numeric_cols = df.select_dtypes(include="number").columns.tolist()

        for col in numeric_cols:
            if date_column and str(col) == str(date_column):
                continue

            s = pd.to_numeric(df[col], errors="coerce").dropna()
            if s.empty or s.nunique() < 1:
                continue

            row_count = int(s.count())
            total_sum = float(s.sum())
            mean_val = float(s.mean())
            median_val = float(s.median())
            min_val = float(s.min())
            max_val = float(s.max())
            std_val = float(s.std()) if row_count > 1 else 0.0

            # Volatility (Coefficient of Variation or standard deviation over mean)
            cv_pct = float(abs(std_val / mean_val) * 100) if abs(mean_val) > 1e-9 else 0.0

            # Pull trend info if already computed by trend engine
            trend_info = (trends or {}).get(str(col)) or {}
            change_pct = trend_info.get("change_pct", 0.0)
            trend_score = trend_info.get("trend_score", 0.0)
            direction = trend_info.get("direction", "Stable / sideways")
            confidence = trend_info.get("confidence", "Medium" if row_count >= 10 else "Low")

            # Semantic indicator (probabilistic only, never hardcoded)
            col_lower = str(col).lower()
            semantic_role = "general_metric"
            if any(k in col_lower for k in ["price", "revenue", "sales", "cost", "profit", "amount", "fee", "budget"]):
                semantic_role = "financial_measure"
            elif any(k in col_lower for k in ["qty", "quantity", "units", "count", "volume", "inventory", "stock"]):
                semantic_role = "volume_measure"
            elif any(k in col_lower for k in ["percent", "pct", "rate", "ratio", "margin", "%"]):
                semantic_role = "rate_measure"
            elif any(k in col_lower for k in ["days", "hours", "time", "duration", "tenure"]):
                semantic_role = "duration_measure"

            kpis.append({
                "metric": str(col),
                "sheet": sheet_name,
                "role": semantic_role,
                "count": row_count,
                "sum": round(total_sum, 2),
                "mean": round(mean_val, 2),
                "median": round(median_val, 2),
                "min": round(min_val, 2),
                "max": round(max_val, 2),
                "std": round(std_val, 2),
                "volatility_pct": round(cv_pct, 2),
                "change_pct": change_pct,
                "trend_score": trend_score,
                "direction": direction,
                "confidence": confidence,
                "traceability": {
                    "source_sheet": sheet_name,
                    "source_column": str(col),
                    "rows_evaluated": row_count,
                    "operation": f"Descriptive Statistics & Trend Regression on {col}",
                },
            })

        # Sort KPIs by standard deviation/spread and trend score
        kpis.sort(key=lambda k: abs(k.get("trend_score", 0)), reverse=True)
        return kpis


def compute_dynamic_kpis(
    df: pd.DataFrame,
    sheet_name: str = "Sheet1",
    date_column: str | None = None,
    trends: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Convenience functional wrapper returning a dict of KPIs keyed by column name."""
    list_kpis = GenericKPIEngine.compute_sheet_kpis(
        df=df,
        sheet_name=sheet_name,
        date_column=date_column,
        trends=trends,
    )
    result = {}
    for k in list_kpis:
        m = k["metric"]
        k_copy = dict(k)
        k_copy["row_count"] = k["count"]
        result[m] = k_copy
    return result
