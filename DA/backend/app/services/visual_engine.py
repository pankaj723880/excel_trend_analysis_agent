"""Visual Engine for Dynamic Dashboard Builder.

Provides schema introspection and deterministic, dataset-agnostic data aggregation
for 19 distinct visual types across 6 categories.
No hardcoded column/sheet names. AI is never used to fabricate chart data.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.utils.dates import detect_date_column, coerce_date_column, format_iso

# Geographic column naming heuristics
GEO_KEYWORDS = {
    "country", "state", "province", "city", "region", "zip", "zipcode", 
    "postal", "postcode", "county", "district", "territory", "location", 
    "lat", "latitude", "lon", "long", "longitude"
}

def detect_column_metadata(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Inspects DataFrame columns and returns rich, dynamic metadata."""
    metadata = []
    total_rows = len(df)

    for col in df.columns:
        col_str = str(col)
        series = df[col]
        null_count = int(series.isnull().sum())
        unique_count = int(series.nunique(dropna=True))

        # Check numeric
        is_num = bool(pd.api.types.is_numeric_dtype(series))
        
        # Check datetime
        is_dt = False
        if pd.api.types.is_datetime64_any_dtype(series):
            is_dt = True
        elif series.dtype == "object":
            samples = series.dropna().astype(str).head(10).tolist()
            if samples and any(
                re.search(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", s)
                for s in samples
            ):
                try:
                    parsed = pd.to_datetime(series.dropna().head(50), errors="coerce")
                    if parsed.notnull().sum() > len(parsed) * 0.7:
                        is_dt = True
                except Exception:
                    pass

        # Check geographic
        lower_col = col_str.strip().lower()
        is_geo = any(k in lower_col for k in GEO_KEYWORDS)
        geo_role = None
        if "lat" in lower_col:
            geo_role = "latitude"
        elif "lon" in lower_col or "lng" in lower_col:
            geo_role = "longitude"
        elif any(k in lower_col for k in ["country", "state", "city", "region", "province", "zip", "location"]):
            geo_role = "location"

        # Determine data_type & semantic_type
        if is_dt:
            data_type = "datetime"
            semantic_type = "temporal"
            role = "dimension"
        elif is_num:
            data_type = "numeric"
            semantic_type = "measure"
            role = "measure"
        else:
            data_type = "categorical"
            semantic_type = "geographic" if is_geo else "categorical"
            role = "dimension"

        sample_vals = [str(v) for v in series.dropna().head(5).tolist()]

        metadata.append({
            "column_name": col_str,
            "display_name": col_str.replace("_", " ").title(),
            "data_type": data_type,
            "semantic_type": semantic_type,
            "role": role,
            "unique_count": unique_count,
            "nullable": null_count > 0,
            "null_count": null_count,
            "numeric": is_num,
            "categorical": not is_num and not is_dt,
            "datetime": is_dt,
            "geographic": is_geo,
            "geo_role": geo_role,
            "sample_values": sample_vals,
        })

    return metadata


def apply_visual_filters(df: pd.DataFrame, filters: List[Dict[str, Any]]) -> pd.DataFrame:
    """Applies user-defined filters deterministically before aggregation."""
    if not filters or not isinstance(filters, list):
        return df

    filtered_df = df.copy()

    for flt in filters:
        if not isinstance(flt, dict):
            continue
        col = flt.get("column")
        if not col or col not in filtered_df.columns:
            continue

        op = str(flt.get("operator", "equals")).lower()
        val = flt.get("value")

        if val is None or val == "":
            continue

        series = filtered_df[col]

        if op in ("equals", "=="):
            filtered_df = filtered_df[series.astype(str) == str(val)]
        elif op in ("not_equals", "!="):
            filtered_df = filtered_df[series.astype(str) != str(val)]
        elif op in ("in", "includes"):
            if isinstance(val, (list, tuple, set)):
                val_set = {str(v) for v in val}
                filtered_df = filtered_df[series.astype(str).isin(val_set)]
            else:
                val_set = {v.strip() for v in str(val).split(",") if v.strip()}
                filtered_df = filtered_df[series.astype(str).isin(val_set)]
        elif op in (">", "gt"):
            num_val = pd.to_numeric(val, errors="coerce")
            if pd.notna(num_val):
                filtered_df = filtered_df[pd.to_numeric(series, errors="coerce") > num_val]
        elif op in (">=", "gte"):
            num_val = pd.to_numeric(val, errors="coerce")
            if pd.notna(num_val):
                filtered_df = filtered_df[pd.to_numeric(series, errors="coerce") >= num_val]
        elif op in ("<", "lt"):
            num_val = pd.to_numeric(val, errors="coerce")
            if pd.notna(num_val):
                filtered_df = filtered_df[pd.to_numeric(series, errors="coerce") < num_val]
        elif op in ("<=", "lte"):
            num_val = pd.to_numeric(val, errors="coerce")
            if pd.notna(num_val):
                filtered_df = filtered_df[pd.to_numeric(series, errors="coerce") <= num_val]
        elif op in ("between", "range") and isinstance(val, (list, tuple)) and len(val) == 2:
            low = pd.to_numeric(val[0], errors="coerce")
            high = pd.to_numeric(val[1], errors="coerce")
            if pd.notna(low) and pd.notna(high):
                s_num = pd.to_numeric(series, errors="coerce")
                filtered_df = filtered_df[(s_num >= low) & (s_num <= high)]
            else:
                # Try date range
                try:
                    dt_low = pd.to_datetime(val[0])
                    dt_high = pd.to_datetime(val[1])
                    s_dt = pd.to_datetime(series, errors="coerce")
                    filtered_df = filtered_df[(s_dt >= dt_low) & (s_dt <= dt_high)]
                except Exception:
                    pass

    return filtered_df


def _aggregate_series(series: pd.Series, agg_func: str) -> float:
    """Computes a single scalar aggregation safely."""
    agg = str(agg_func).lower()
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if agg in ("count", "count_rows"):
        return float(len(series.dropna()))
    if agg in ("distinct_count", "count_distinct"):
        return float(series.nunique(dropna=True))
    if clean.empty:
        return 0.0
    if agg in ("sum", "total"):
        return float(clean.sum())
    elif agg in ("avg", "average", "mean"):
        return float(clean.mean())
    elif agg in ("median",):
        return float(clean.median())
    elif agg in ("min", "minimum"):
        return float(clean.min())
    elif agg in ("max", "maximum"):
        return float(clean.max())
    return float(clean.sum())


def _apply_date_grain(series: pd.Series, grain: str) -> pd.Series:
    """Applies a temporal aggregation grain (Day, Week, Month, Quarter, Year)."""
    grain_lower = str(grain or "month").lower()
    dt_series = pd.to_datetime(series, errors="coerce")
    
    if grain_lower in ("year", "annual"):
        return dt_series.dt.strftime("%Y")
    elif grain_lower in ("quarter", "qtr"):
        return dt_series.dt.year.astype(str) + " Q" + dt_series.dt.quarter.astype(str)
    elif grain_lower in ("month",):
        return dt_series.dt.strftime("%Y-%m")
    elif grain_lower in ("week",):
        return dt_series.dt.strftime("%Y-W%U")
    elif grain_lower in ("day", "date"):
        return dt_series.dt.strftime("%Y-%m-%d")
    return dt_series.dt.strftime("%Y-%m")


def execute_visual_query(
    df: pd.DataFrame,
    visual_type: str,
    config: Dict[str, Any],
    filters: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Deterministically transforms DataFrame into visual response data."""
    v_type = str(visual_type or "bar").lower().replace(" ", "_")
    config = config or {}
    
    # Apply pre-aggregation filters
    work_df = apply_visual_filters(df, filters or [])
    rows_used = len(work_df)

    if work_df.empty:
        return {
            "visual_type": v_type,
            "title": config.get("title") or "Visualization",
            "data": [],
            "metadata": {"rows_used": 0, "aggregation": config.get("aggregation", "none"), "columns_used": []},
            "unsupported_reason": "No data matches the selected filters.",
        }

    # 1. BAR & COLUMN CHARTS
    if v_type in ("bar", "column", "bar_chart", "column_chart"):
        category = config.get("category") or config.get("x")
        measure = config.get("measure") or config.get("y")
        aggregation = str(config.get("aggregation", "auto")).lower()
        sort_order = str(config.get("sort", "desc")).lower()
        limit = int(config.get("limit") or 20)
        time_grain = config.get("time_grain")

        if not category or category not in work_df.columns:
            return {"error": f"Invalid category column '{category}'"}

        # Auto aggregation resolution
        if aggregation == "auto":
            if measure and measure in work_df.columns and pd.api.types.is_numeric_dtype(work_df[measure]):
                aggregation = "sum"
            else:
                aggregation = "count"

        # Check if category is datetime with grain
        cat_series = work_df[category]
        if time_grain and (pd.api.types.is_datetime64_any_dtype(cat_series) or config.get("is_date")):
            cat_series = _apply_date_grain(cat_series, time_grain)

        temp_df = pd.DataFrame({"category": cat_series})
        if measure and measure in work_df.columns and aggregation != "count":
            temp_df["measure"] = pd.to_numeric(work_df[measure], errors="coerce")
        else:
            temp_df["measure"] = 1

        if aggregation in ("count", "count_rows"):
            grouped = temp_df.groupby("category", as_index=False).size()
            grouped.columns = ["category", "value"]
        elif aggregation in ("count_distinct", "distinct_count") and measure and measure in work_df.columns:
            temp_df["raw_measure"] = work_df[measure]
            grouped = temp_df.groupby("category")["raw_measure"].nunique().reset_index()
            grouped.columns = ["category", "value"]
        elif aggregation == "avg":
            grouped = temp_df.groupby("category")["measure"].mean().reset_index()
            grouped.columns = ["category", "value"]
        elif aggregation == "median":
            grouped = temp_df.groupby("category")["measure"].median().reset_index()
            grouped.columns = ["category", "value"]
        elif aggregation == "min":
            grouped = temp_df.groupby("category")["measure"].min().reset_index()
            grouped.columns = ["category", "value"]
        elif aggregation == "max":
            grouped = temp_df.groupby("category")["measure"].max().reset_index()
            grouped.columns = ["category", "value"]
        else:  # sum
            grouped = temp_df.groupby("category")["measure"].sum().reset_index()
            grouped.columns = ["category", "value"]

        grouped["value"] = grouped["value"].fillna(0).round(2)

        if sort_order == "desc":
            grouped = grouped.sort_values("value", ascending=False)
        elif sort_order == "asc":
            grouped = grouped.sort_values("value", ascending=True)

        if limit > 0:
            grouped = grouped.head(limit)

        data = grouped.to_dict(orient="records")
        for item in data:
            item["category"] = str(item["category"])
            item["value"] = float(item["value"])

        title = config.get("title") or (f"{measure} by {category}" if measure and aggregation != 'count' else f"Count by {category}")
        return {
            "visual_type": "column" if "column" in v_type else "bar",
            "title": title,
            "data": data,
            "metadata": {
                "rows_used": rows_used,
                "aggregation": aggregation,
                "category_column": category,
                "measure_column": measure,
                "columns_used": [c for c in [category, measure] if c],
            },
        }

    # 2. LINE & AREA CHARTS
    if v_type in ("line", "area", "line_chart", "area_chart"):
        x_col = config.get("x") or config.get("time") or config.get("category")
        y_col = config.get("y") or config.get("metric") or config.get("measure")
        group_by = config.get("group_by")
        aggregation = str(config.get("aggregation", "sum")).lower()
        time_grain = config.get("time_grain")
        limit = int(config.get("limit") or 500)

        # Check if x_col exists, else fallback to observation order
        has_temporal = False
        if x_col and x_col in work_df.columns:
            dt_test = pd.to_datetime(work_df[x_col], errors="coerce")
            if dt_test.notnull().sum() > len(dt_test) * 0.5:
                has_temporal = True

        if not y_col or y_col not in work_df.columns:
            # Pick first numeric
            num_cols = work_df.select_dtypes(include="number").columns
            if not num_cols.empty:
                y_col = num_cols[0]
            else:
                return {"error": "Line and Area charts require a numeric measure."}

        if has_temporal:
            dates = _apply_date_grain(work_df[x_col], time_grain or "month") if time_grain else pd.to_datetime(work_df[x_col], errors="coerce").dt.strftime("%Y-%m-%d")
            temp_df = pd.DataFrame({"x": dates, "y": pd.to_numeric(work_df[y_col], errors="coerce")})
            if group_by and group_by in work_df.columns:
                temp_df["group"] = work_df[group_by].astype(str)
                # Pivot by group
                pivoted = temp_df.pivot_table(index="x", columns="group", values="y", aggfunc="mean" if aggregation == "avg" else "sum").fillna(0)
                pivoted = pivoted.tail(limit).reset_index()
                data = pivoted.to_dict(orient="records")
                groups = [c for c in pivoted.columns if c != "x"]
                return {
                    "visual_type": "area" if "area" in v_type else "line",
                    "title": config.get("title") or f"{y_col} over {x_col} by {group_by}",
                    "data": data,
                    "metadata": {
                        "rows_used": rows_used,
                        "has_groups": True,
                        "groups": groups,
                        "x_label": x_col,
                        "columns_used": [x_col, y_col, group_by],
                    },
                }
            else:
                grouped = temp_df.groupby("x")["y"].agg("mean" if aggregation == "avg" else "sum").reset_index()
                grouped = grouped.sort_values("x").tail(limit)
                data = [{"x": str(r["x"]), "y": round(float(r["y"]), 2)} for _, r in grouped.iterrows()]
                return {
                    "visual_type": "area" if "area" in v_type else "line",
                    "title": config.get("title") or f"{y_col} over {x_col}",
                    "data": data,
                    "metadata": {
                        "rows_used": rows_used,
                        "x_label": x_col,
                        "is_observation_order": False,
                        "columns_used": [x_col, y_col],
                    },
                }
        else:
            # Observation order fallback
            clean_y = pd.to_numeric(work_df[y_col], errors="coerce").dropna().tail(limit)
            data = [{"x": f"Obs {i+1}", "y": round(float(val), 2)} for i, val in enumerate(clean_y)]
            return {
                "visual_type": "area" if "area" in v_type else "line",
                "title": config.get("title") or f"{y_col} (Observation Order)",
                "data": data,
                "metadata": {
                    "rows_used": rows_used,
                    "x_label": "Observation Order",
                    "is_observation_order": True,
                    "note": "No temporal column detected; using Observation Order.",
                    "columns_used": [y_col],
                },
            }

    # 3. COMBO CHART (Bar + Line with dual metrics)
    if v_type in ("combo", "combo_chart"):
        x_col = config.get("x") or config.get("category")
        primary_metric = config.get("primary_metric") or config.get("measure")
        secondary_metric = config.get("secondary_metric")
        primary_agg = str(config.get("primary_agg", "sum")).lower()
        secondary_agg = str(config.get("secondary_agg", "avg")).lower()
        limit = int(config.get("limit") or 25)

        if not x_col or x_col not in work_df.columns:
            return {"error": "Combo chart requires an X-axis / category column."}
        if not primary_metric or primary_metric not in work_df.columns:
            return {"error": "Combo chart requires a primary metric."}
        if not secondary_metric or secondary_metric not in work_df.columns:
            return {"error": "Combo chart requires a secondary metric."}

        temp_df = pd.DataFrame({
            "x": work_df[x_col].astype(str),
            "m1": pd.to_numeric(work_df[primary_metric], errors="coerce"),
            "m2": pd.to_numeric(work_df[secondary_metric], errors="coerce"),
        })

        g1 = temp_df.groupby("x")["m1"].agg("mean" if primary_agg == "avg" else "sum")
        g2 = temp_df.groupby("x")["m2"].agg("mean" if secondary_agg == "avg" else "sum")
        merged = pd.DataFrame({"x": g1.index, "primary": g1.values, "secondary": g2.values}).dropna()
        merged = merged.head(limit)

        data = [
            {
                "x": str(r["x"]),
                "primary": round(float(r["primary"]), 2),
                "secondary": round(float(r["secondary"]), 2),
                "primary_name": primary_metric,
                "secondary_name": secondary_metric,
            }
            for _, r in merged.iterrows()
        ]

        return {
            "visual_type": "combo",
            "title": config.get("title") or f"{primary_metric} and {secondary_metric} by {x_col}",
            "data": data,
            "metadata": {
                "rows_used": rows_used,
                "x_label": x_col,
                "primary_metric": primary_metric,
                "secondary_metric": secondary_metric,
                "columns_used": [x_col, primary_metric, secondary_metric],
            },
        }

    # 4. PIE & DOUGHNUT CHARTS
    if v_type in ("pie", "doughnut", "donut", "pie_chart", "doughnut_chart"):
        category = config.get("category")
        measure = config.get("measure")
        aggregation = str(config.get("aggregation", "auto")).lower()
        top_n = int(config.get("top_n") or 7)

        if not category or category not in work_df.columns:
            return {"error": f"Invalid category column '{category}'"}

        if aggregation == "auto":
            aggregation = "sum" if (measure and measure in work_df.columns and pd.api.types.is_numeric_dtype(work_df[measure])) else "count"

        temp_df = pd.DataFrame({"category": work_df[category].astype(str)})
        if measure and measure in work_df.columns and aggregation != "count":
            temp_df["val"] = pd.to_numeric(work_df[measure], errors="coerce")
        else:
            temp_df["val"] = 1

        if aggregation == "count":
            grouped = temp_df.groupby("category")["val"].count().reset_index()
        elif aggregation == "avg":
            grouped = temp_df.groupby("category")["val"].mean().reset_index()
        else:
            grouped = temp_df.groupby("category")["val"].sum().reset_index()

        grouped.columns = ["name", "value"]
        grouped = grouped.dropna().sort_values("value", ascending=False)

        total_sum = float(grouped["value"].sum())

        # Enforce Top N + Other to prevent unreadable 50-slice pie charts
        if len(grouped) > top_n:
            top_part = grouped.head(top_n)
            other_val = float(grouped.iloc[top_n:]["value"].sum())
            other_row = pd.DataFrame([{"name": "Other", "value": other_val}])
            grouped = pd.concat([top_part, other_row], ignore_index=True)

        data = [
            {
                "name": str(r["name"]),
                "value": round(float(r["value"]), 2),
                "percent": round((float(r["value"]) / total_sum * 100), 1) if total_sum > 0 else 0,
            }
            for _, r in grouped.iterrows()
        ]

        title = config.get("title") or (f"{measure} Distribution by {category}" if measure and aggregation != 'count' else f"{category} Distribution")
        return {
            "visual_type": "doughnut" if "doughnut" in v_type or "donut" in v_type else "pie",
            "title": title,
            "data": data,
            "metadata": {
                "rows_used": rows_used,
                "total_value": round(total_sum, 2),
                "aggregation": aggregation,
                "category_column": category,
                "measure_column": measure,
                "columns_used": [c for c in [category, measure] if c],
            },
        }

    # 5. TREEMAP
    if v_type in ("treemap", "treemap_chart"):
        category = config.get("category")
        parent = config.get("parent")
        measure = config.get("measure")
        aggregation = str(config.get("aggregation", "sum")).lower()

        if not category or category not in work_df.columns:
            return {"error": "Treemap requires a category column."}

        cols_to_group = [parent, category] if parent and parent in work_df.columns and parent != category else [category]
        temp_df = work_df[cols_to_group].copy()
        if measure and measure in work_df.columns:
            temp_df["val"] = pd.to_numeric(work_df[measure], errors="coerce")
        else:
            temp_df["val"] = 1

        grouped = temp_df.groupby(cols_to_group)["val"].agg("mean" if aggregation == "avg" else "sum").reset_index()
        grouped = grouped.sort_values("val", ascending=False).head(40)

        data = []
        for _, r in grouped.iterrows():
            item = {
                "name": str(r[category]),
                "size": max(0.01, round(float(r["val"]), 2)),
            }
            if parent and parent in r:
                item["parent"] = str(r[parent])
            data.append(item)

        return {
            "visual_type": "treemap",
            "title": config.get("title") or f"{category} Treemap",
            "data": data,
            "metadata": {"rows_used": rows_used, "columns_used": cols_to_group + ([measure] if measure else [])},
        }

    # 6. SCORECARD / BIG NUMBER
    if v_type in ("scorecard", "big_number", "kpi_card"):
        measure = config.get("measure") or config.get("metric")
        aggregation = str(config.get("aggregation", "sum")).lower()
        target = pd.to_numeric(config.get("target"), errors="coerce")

        if not measure or measure not in work_df.columns:
            # Fallback to row count
            return {
                "visual_type": "scorecard",
                "title": config.get("title") or "Total Records",
                "data": [{
                    "value": rows_used,
                    "formatted_value": f"{rows_used:,}",
                    "metric": "Records",
                    "aggregation": "count",
                    "target": None,
                    "target_status": None,
                }],
                "metadata": {"rows_used": rows_used, "columns_used": []},
            }

        val = _aggregate_series(work_df[measure], aggregation)
        status = None
        pct_of_target = None
        if pd.notna(target) and target != 0:
            pct_of_target = round((val / float(target)) * 100, 1)
            status = "achieved" if val >= float(target) else "behind"

        return {
            "visual_type": "scorecard",
            "title": config.get("title") or f"{aggregation.title()} of {measure}",
            "data": [{
                "value": round(val, 2),
                "metric": measure,
                "aggregation": aggregation,
                "target": float(target) if pd.notna(target) else None,
                "pct_of_target": pct_of_target,
                "target_status": status,
            }],
            "metadata": {"rows_used": rows_used, "columns_used": [measure]},
        }

    # 7. GAUGE & BULLET CHARTS
    if v_type in ("gauge", "bullet", "bullet_chart"):
        measure = config.get("measure") or config.get("metric")
        aggregation = str(config.get("aggregation", "sum")).lower()
        val = _aggregate_series(work_df[measure], aggregation) if measure and measure in work_df.columns else float(rows_used)
        
        min_val = pd.to_numeric(config.get("min"), errors="coerce")
        max_val = pd.to_numeric(config.get("max"), errors="coerce")
        target = pd.to_numeric(config.get("target"), errors="coerce")

        if pd.isna(min_val):
            min_val = 0.0
        if pd.isna(max_val):
            max_val = max(val * 1.3, 100.0) if val > 0 else 100.0
        if pd.isna(target):
            target = max_val * 0.8

        pct = min(100.0, max(0.0, (val - min_val) / (max_val - min_val) * 100)) if max_val > min_val else 50.0

        return {
            "visual_type": v_type,
            "title": config.get("title") or f"{measure or 'Metric'} Progress",
            "data": [{
                "value": round(val, 2),
                "min": float(min_val),
                "max": float(max_val),
                "target": float(target),
                "percentage": round(pct, 1),
            }],
            "metadata": {"rows_used": rows_used, "columns_used": [measure] if measure else []},
        }

    # 8. SCATTER & BUBBLE CHARTS
    if v_type in ("scatter", "bubble", "scatter_plot", "bubble_chart"):
        x_col = config.get("x")
        y_col = config.get("y")
        size_col = config.get("size")
        color_col = config.get("color") or config.get("group")
        limit = int(config.get("limit") or 250)

        if not x_col or x_col not in work_df.columns or not pd.api.types.is_numeric_dtype(work_df[x_col]):
            return {"error": "Scatter and Bubble plots require a numeric X-axis column."}
        if not y_col or y_col not in work_df.columns or not pd.api.types.is_numeric_dtype(work_df[y_col]):
            return {"error": "Scatter and Bubble plots require a numeric Y-axis column."}

        cols_needed = [x_col, y_col]
        if size_col and size_col in work_df.columns:
            cols_needed.append(size_col)
        if color_col and color_col in work_df.columns:
            cols_needed.append(color_col)

        sub_df = work_df[cols_needed].dropna().head(limit)
        data = []
        for _, r in sub_df.iterrows():
            item = {
                "x": round(float(r[x_col]), 2),
                "y": round(float(r[y_col]), 2),
            }
            if size_col and size_col in r:
                item["size"] = max(1.0, round(float(r[size_col]), 2))
            if color_col and color_col in r:
                item["group"] = str(r[color_col])
            data.append(item)

        return {
            "visual_type": "bubble" if size_col else "scatter",
            "title": config.get("title") or f"{y_col} vs {x_col}",
            "data": data,
            "metadata": {
                "rows_used": len(sub_df),
                "x_label": x_col,
                "y_label": y_col,
                "columns_used": cols_needed,
            },
        }

    # 9. HISTOGRAM
    if v_type in ("histogram", "histogram_chart"):
        metric = config.get("metric") or config.get("measure") or config.get("x")
        bin_count = int(config.get("bins") or 20)

        if not metric or metric not in work_df.columns or not pd.api.types.is_numeric_dtype(work_df[metric]):
            return {"error": "Histogram requires a numeric column."}

        s_clean = pd.to_numeric(work_df[metric], errors="coerce").dropna()
        if s_clean.empty:
            return {"error": "No valid numeric observations available for histogram."}

        counts, bin_edges = np.histogram(s_clean, bins=min(max(bin_count, 5), 50))
        data = []
        for i in range(len(counts)):
            low = round(float(bin_edges[i]), 2)
            high = round(float(bin_edges[i+1]), 2)
            data.append({
                "bin": f"{low} - {high}",
                "count": int(counts[i]),
                "frequency": int(counts[i]),
            })

        return {
            "visual_type": "histogram",
            "title": config.get("title") or f"Distribution of {metric}",
            "data": data,
            "metadata": {
                "rows_used": len(s_clean),
                "metric": metric,
                "bin_count": len(counts),
                "columns_used": [metric],
            },
        }

    # 10. MAP / GEOGRAPHIC CHART
    if v_type in ("map", "geo_map", "geographic"):
        loc_col = config.get("location")
        lat_col = config.get("latitude")
        lon_col = config.get("longitude")
        measure = config.get("measure")
        aggregation = str(config.get("aggregation", "sum")).lower()

        # Find geo columns if not explicitly provided
        cols_lower = {str(c).lower(): c for c in work_df.columns}
        if not loc_col:
            for cand in ["country", "state", "city", "region", "province", "location"]:
                for cl in cols_lower:
                    if cand in cl:
                        loc_col = cols_lower[cl]
                        break
                if loc_col:
                    break

        if not (loc_col or (lat_col and lon_col)):
            return {
                "visual_type": "map",
                "title": config.get("title") or "Geographic Distribution",
                "data": [],
                "unsupported_reason": "No geographic column was detected in this dataset.",
                "metadata": {"columns_used": []},
            }

        if loc_col and loc_col in work_df.columns:
            temp_df = pd.DataFrame({"location": work_df[loc_col].astype(str)})
            if measure and measure in work_df.columns:
                temp_df["val"] = pd.to_numeric(work_df[measure], errors="coerce")
            else:
                temp_df["val"] = 1

            grouped = temp_df.groupby("location")["val"].agg("mean" if aggregation == "avg" else "sum").reset_index()
            grouped = grouped.sort_values("val", ascending=False).head(30)
            data = [{"location": str(r["location"]), "value": round(float(r["val"]), 2)} for _, r in grouped.iterrows()]
            return {
                "visual_type": "map",
                "title": config.get("title") or f"Geographic Map by {loc_col}",
                "data": data,
                "metadata": {"rows_used": rows_used, "location_column": loc_col, "columns_used": [loc_col] + ([measure] if measure else [])},
            }
        elif lat_col and lon_col and lat_col in work_df.columns and lon_col in work_df.columns:
            sub = work_df[[lat_col, lon_col]].dropna().head(100)
            data = [{"lat": float(r[lat_col]), "lon": float(r[lon_col]), "value": 1} for _, r in sub.iterrows()]
            return {
                "visual_type": "map",
                "title": config.get("title") or "Coordinates Map",
                "data": data,
                "metadata": {"rows_used": len(sub), "columns_used": [lat_col, lon_col]},
            }

    # 11. FUNNEL
    if v_type in ("funnel", "funnel_chart"):
        stage_col = config.get("stage") or config.get("category")
        val_col = config.get("value") or config.get("measure")
        aggregation = str(config.get("aggregation", "sum")).lower()

        if not stage_col or stage_col not in work_df.columns:
            return {"error": "Funnel chart requires a stage column."}

        temp_df = pd.DataFrame({"stage": work_df[stage_col].astype(str)})
        if val_col and val_col in work_df.columns:
            temp_df["val"] = pd.to_numeric(work_df[val_col], errors="coerce")
        else:
            temp_df["val"] = 1

        grouped = temp_df.groupby("stage")["val"].agg("mean" if aggregation == "avg" else "sum").reset_index()
        grouped = grouped.sort_values("val", ascending=False).head(10)
        data = [{"stage": str(r["stage"]), "value": round(float(r["val"]), 2)} for _, r in grouped.iterrows()]

        return {
            "visual_type": "funnel",
            "title": config.get("title") or f"Funnel by {stage_col}",
            "data": data,
            "metadata": {"rows_used": rows_used, "stage_column": stage_col, "columns_used": [stage_col] + ([val_col] if val_col else [])},
        }

    # 12. FLOW / SANKEY
    if v_type in ("sankey", "flow", "sankey_chart"):
        source_col = config.get("source")
        target_col = config.get("target")
        val_col = config.get("value") or config.get("measure")
        aggregation = str(config.get("aggregation", "sum")).lower()

        if not source_col or not target_col or source_col not in work_df.columns or target_col not in work_df.columns:
            # Check if there are at least 2 categorical columns
            cat_cols = [c for c in work_df.columns if not pd.api.types.is_numeric_dtype(work_df[c])]
            if len(cat_cols) >= 2:
                source_col = cat_cols[0]
                target_col = cat_cols[1]
            else:
                return {
                    "visual_type": "sankey",
                    "title": config.get("title") or "Flow / Sankey",
                    "data": [],
                    "unsupported_reason": "Sankey diagrams require at least two categorical dimensions for source and target relationships.",
                    "metadata": {"columns_used": []},
                }

        temp_df = pd.DataFrame({"source": work_df[source_col].astype(str), "target": work_df[target_col].astype(str)})
        if val_col and val_col in work_df.columns:
            temp_df["val"] = pd.to_numeric(work_df[val_col], errors="coerce")
        else:
            temp_df["val"] = 1

        grouped = temp_df.groupby(["source", "target"])["val"].agg("mean" if aggregation == "avg" else "sum").reset_index()
        grouped = grouped.sort_values("val", ascending=False).head(20)

        data = [
            {"source": str(r["source"]), "target": str(r["target"]), "value": round(float(r["val"]), 2)}
            for _, r in grouped.iterrows()
        ]

        return {
            "visual_type": "sankey",
            "title": config.get("title") or f"Flow from {source_col} to {target_col}",
            "data": data,
            "metadata": {"rows_used": rows_used, "source": source_col, "target": target_col, "columns_used": [source_col, target_col]},
        }

    # 13. TABLE
    if v_type in ("table", "data_table"):
        selected_cols = config.get("columns")
        if not selected_cols or not isinstance(selected_cols, list):
            selected_cols = [str(c) for c in work_df.columns[:8]]
        else:
            selected_cols = [c for c in selected_cols if c in work_df.columns]

        sort_col = config.get("sort_column")
        sort_order = str(config.get("sort_order", "asc")).lower()
        limit = int(config.get("limit") or 50)

        sub_df = work_df[selected_cols].copy()
        if sort_col and sort_col in sub_df.columns:
            sub_df = sub_df.sort_values(sort_col, ascending=(sort_order == "asc"))

        sub_df = sub_df.head(limit)
        records = []
        for _, r in sub_df.iterrows():
            row_dict = {}
            for col in selected_cols:
                v = r[col]
                row_dict[col] = None if pd.isna(v) else (round(float(v), 2) if isinstance(v, (int, float, np.floating)) else str(v))
            records.append(row_dict)

        return {
            "visual_type": "table",
            "title": config.get("title") or "Data Table",
            "data": records,
            "metadata": {"rows_used": len(records), "columns": selected_cols, "columns_used": selected_cols},
        }

    # 14. MATRIX
    if v_type in ("matrix", "pivot_table"):
        row_dim = config.get("rows")
        col_dim = config.get("columns")
        val_metric = config.get("values") or config.get("measure")
        aggregation = str(config.get("aggregation", "sum")).lower()

        if not row_dim or row_dim not in work_df.columns or not col_dim or col_dim not in work_df.columns:
            cat_cols = [c for c in work_df.columns if not pd.api.types.is_numeric_dtype(work_df[c])]
            if len(cat_cols) >= 2:
                row_dim = cat_cols[0]
                col_dim = cat_cols[1]
            else:
                return {"error": "Matrix visualization requires a row dimension and a column dimension."}

        temp_df = pd.DataFrame({"row": work_df[row_dim].astype(str), "col": work_df[col_dim].astype(str)})
        if val_metric and val_metric in work_df.columns:
            temp_df["val"] = pd.to_numeric(work_df[val_metric], errors="coerce")
        else:
            temp_df["val"] = 1

        pivoted = temp_df.pivot_table(index="row", columns="col", values="val", aggfunc="mean" if aggregation == "avg" else "sum", fill_value=0)
        pivoted = pivoted.iloc[:20, :15]  # Limit matrix size for clean display

        columns_list = [str(c) for c in pivoted.columns]
        rows_data = []
        for r_idx, row in pivoted.iterrows():
            r_obj = {"_row": str(r_idx)}
            for c_name in columns_list:
                r_obj[c_name] = round(float(row[c_name]), 2)
            rows_data.append(r_obj)

        return {
            "visual_type": "matrix",
            "title": config.get("title") or f"{val_metric or 'Count'} Matrix ({row_dim} x {col_dim})",
            "data": rows_data,
            "metadata": {
                "rows_used": rows_used,
                "row_dimension": row_dim,
                "column_dimension": col_dim,
                "column_headers": columns_list,
                "columns_used": [row_dim, col_dim] + ([val_metric] if val_metric else []),
            },
        }

    return {"error": f"Unsupported visualization type '{visual_type}'"}
