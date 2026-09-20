"""AI agent: Gemini-powered interpretation of calculated results.

Gemini ONLY interprets the numbers computed by the Python analysis engine.
It never performs calculations itself, and never invents numbers or causes.
All AI failures degrade gracefully to deterministic analysis.
"""
from __future__ import annotations

import json
import os
import re

import pandas as pd


from app.services.gemini_client import generate_content_with_fallback


def _generate(prompt: str, temperature: float = 0.2) -> str:
    return generate_content_with_fallback(prompt=prompt, temperature=temperature)


# ---------------------------------------------------------------------------
# Deterministic fallback & rich statistical summary builders
# ---------------------------------------------------------------------------

def _build_deterministic_summary(analysis: dict) -> dict:
    trends = analysis.get("trends", {})
    anomalies = analysis.get("anomalies", {})
    profiles = analysis.get("profiles", {})
    sheets = analysis.get("sheets", {})

    all_metrics = []
    for sheet, sheet_trends in trends.items():
        if isinstance(sheet_trends, dict):
            for metric, info in sheet_trends.items():
                if isinstance(info, dict):
                    all_metrics.append({**info, "sheet": sheet, "metric": metric})

    all_metrics.sort(key=lambda item: abs(item.get("trend_score", 0)), reverse=True)
    top_up = [m for m in all_metrics if m.get("trend_score", 0) > 0][:5]
    top_down = [m for m in all_metrics if m.get("trend_score", 0) < 0][:5]
    volatile = sorted(all_metrics, key=lambda m: m.get("volatility_pct", 0), reverse=True)[:5]

    severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    total_anomalies = 0
    for sheet_result in anomalies.values():
        if isinstance(sheet_result, dict):
            total_anomalies += int(sheet_result.get("total", 0))
            for a in sheet_result.get("all", []):
                sev = a.get("severity", "Low")
                if sev in severity_counts:
                    severity_counts[sev] += 1

    total_rows = int(analysis.get("total_rows", 0)) or sum(
        int(p.get("rows", 0)) for p in profiles.values() if isinstance(p, dict)
    )
    workbook_health = int(analysis.get("workbook_health", 85))

    lines = []
    lines.append("## 📊 Executive Data Analysis Summary")
    lines.append("")
    lines.append(f"- **Workbook Scale**: {len(profiles)} active sheet(s), **{total_rows:,}** total rows analyzed.")
    lines.append(f"- **Data Health Score**: **{workbook_health}%** overall quality index.")

    if not all_metrics:
        lines.append("- **No numeric metrics detected.** No quantitative trend analysis was possible.")
    else:
        lines.append(f"- **Key Metrics Evaluated**: **{len(all_metrics)}** numeric metric(s) across sheets.")

    if top_up:
        lines.append("")
        lines.append("### 📈 Top Upward Growth Drivers")
        for metric in top_up:
            chg = metric.get("change_pct", 0)
            score = metric.get("trend_score", 0)
            lines.append(
                f"- **{metric.get('metric')}** (`{metric.get('sheet')}`): **+{chg:.1f}%** change "
                f"(Trend Score: `{score:.1f}`, Confidence: `{metric.get('confidence', 'High')}`)."
            )

    if top_down:
        lines.append("")
        lines.append("### 📉 Metrics Under Pressure (Downward Trends)")
        for metric in top_down:
            chg = metric.get("change_pct", 0)
            score = metric.get("trend_score", 0)
            lines.append(
                f"- **{metric.get('metric')}** (`{metric.get('sheet')}`): **{chg:.1f}%** change "
                f"(Trend Score: `{score:.1f}`, Confidence: `{metric.get('confidence', 'High')}`)."
            )

    if volatile:
        lines.append("")
        lines.append("### ⚡ Highest Volatility Metrics")
        for metric in volatile:
            vol = metric.get("volatility_pct", 0)
            lines.append(
                f"- **{metric.get('metric')}** (`{metric.get('sheet')}`): Volatility **{vol:.1f}%**, "
                f"Momentum status: `{metric.get('momentum', 'Stable')}`."
            )

    lines.append("")
    lines.append("### ⚠️ Anomaly & Risk Overview")
    lines.append(f"- **{total_anomalies} total anomalies flagged** (`{severity_counts['Critical']}` Critical, "
                 f"`{severity_counts['High']}` High, `{severity_counts['Medium']}` Medium, `{severity_counts['Low']}` Low).")

    lines.append("")
    lines.append("### 💡 Recommended Strategic Actions")
    lines.append("1. **Growth Capitalization**: Focus resources on top upward metrics showing strong momentum.")
    lines.append("2. **Risk Mitigation**: Investigate critical anomalies and high-volatility metrics for root-cause factors.")
    lines.append("3. **Data Quality Maintenance**: Resolve missing cells and duplicate rows in the Cleaning Studio.")

    # Chart data points for frontend visualization
    chart_data = []
    for m in all_metrics[:8]:
        chart_data.append({
            "metric": m.get("metric"),
            "change_pct": round(m.get("change_pct", 0), 1),
            "volatility_pct": round(m.get("volatility_pct", 0), 1),
            "trend_score": round(m.get("trend_score", 0), 1),
            "sheet": m.get("sheet"),
        })

    fastest_growth = max(all_metrics, key=lambda x: x.get("change_pct", 0)) if all_metrics else None
    highest_vol = max(all_metrics, key=lambda x: x.get("volatility_pct", 0)) if all_metrics else None

    return {
        "source": "deterministic",
        "markdown": "\n".join(lines),
        "sections": {
            "total_rows": total_rows,
            "health_score": workbook_health,
            "total_anomalies": total_anomalies,
            "severity_counts": severity_counts,
            "top_growth": {
                "metric": fastest_growth.get("metric") if fastest_growth else "N/A",
                "change_pct": round(fastest_growth.get("change_pct", 0), 1) if fastest_growth else 0,
            },
            "most_volatile": {
                "metric": highest_vol.get("metric") if highest_vol else "N/A",
                "volatility_pct": round(highest_vol.get("volatility_pct", 0), 1) if highest_vol else 0,
            },
            "chart_data": chart_data,
        },
    }


def _extract_all_column_stats(analysis: dict) -> dict[str, dict]:
    """Gather descriptive statistics for all numeric & categorical columns."""
    stats = {}
    sheets = analysis.get("sheets", {})
    for sheet_name, sheet_data in sheets.items():
        if not isinstance(sheet_data, dict):
            continue
        eda = sheet_data.get("eda", {})
        num_stats = eda.get("numeric_statistics", {})
        cat_stats = eda.get("categorical_statistics", {})

        for col, s in num_stats.items():
            if isinstance(s, dict):
                key = f"{sheet_name}.{col}".lower()
                stats[key] = {**s, "sheet": sheet_name, "column": col, "type": "numeric"}
                stats[col.lower()] = stats[key]

        for col, s in cat_stats.items():
            if isinstance(s, dict):
                key = f"{sheet_name}.{col}".lower()
                stats[key] = {**s, "sheet": sheet_name, "column": col, "type": "categorical"}
                stats[col.lower()] = stats[key]

    return stats


def _build_deterministic_answer(question: str, analysis: dict) -> str:
    """Analyze the question step-by-step and generate a precise answer with real values."""
    q = question.lower().strip()
    trends = analysis.get("trends", {})
    profiles = analysis.get("profiles", {})
    anomalies = analysis.get("anomalies", {})
    sheets = analysis.get("sheets", {})

    all_metrics = []
    for sheet, sheet_trends in trends.items():
        if isinstance(sheet_trends, dict):
            for metric, info in sheet_trends.items():
                if isinstance(info, dict):
                    all_metrics.append({**info, "sheet": sheet, "metric": metric})

    column_stats = _extract_all_column_stats(analysis)
    lines = []

    # Detect comparison intent
    comparison_keywords = ["faster than", "slower than", "growing faster", "higher growth", "compare", "versus", " vs ", " vs.", "higher than", "lower than"]
    is_comparison = any(kw in q for kw in comparison_keywords)

    # Match metrics mentioned in the user question
    matched_metrics = []
    seen_metric_names = set()
    for m in all_metrics:
        m_name = m.get("metric", "").lower()
        clean_q = re.sub(r'[^\w\s]', ' ', q)
        q_words = clean_q.split()

        matches = False
        if m_name in q:
            matches = True
        else:
            for w in q_words:
                if w == m_name or w.rstrip('s') == m_name.rstrip('s'):
                    matches = True
                    break

        if matches and m.get("metric") not in seen_metric_names:
            seen_metric_names.add(m.get("metric"))
            matched_metrics.append(m)

    # 1. COMPARISON QUESTIONS (e.g., "Is revenue growing faster than costs?", "compare Revenue and Profit")
    if (is_comparison or len(matched_metrics) >= 2) and len(matched_metrics) >= 2:
        m1 = matched_metrics[0]
        m2 = matched_metrics[1]
        c1 = m1.get("change_pct", 0)
        c2 = m2.get("change_pct", 0)
        n1 = m1.get("metric")
        n2 = m2.get("metric")
        s1 = m1.get("sheet")
        s2 = m2.get("sheet")

        lines.append(f"### 📊 Comparison Analysis: **{n1}** vs **{n2}**")
        lines.append("")

        if c1 > c2:
            diff = c1 - c2
            lines.append(f"**Yes**, **{n1}** is growing faster than **{n2}**.")
            lines.append(f"- **{n1}** Growth Rate: **+{c1:.1f}%** (`{m1.get('direction', 'upward')}`)")
            lines.append(f"- **{n2}** Growth Rate: **+{c2:.1f}%** (`{m2.get('direction', 'upward')}`)")
            lines.append(f"- **Growth Difference**: **{n1}** outperforms **{n2}** by **+{diff:.1f}%** percentage points.")
        elif c2 > c1:
            diff = c2 - c1
            lines.append(f"**No**, **{n2}** is growing faster than **{n1}**.")
            lines.append(f"- **{n1}** Growth Rate: **{c1:+.1f}%** (`{m1.get('direction', 'stable')}`)")
            lines.append(f"- **{n2}** Growth Rate: **{c2:+.1f}%** (`{m2.get('direction', 'stable')}`)")
            lines.append(f"- **Growth Difference**: **{n2}** outperforms **{n1}** by **+{diff:.1f}%** percentage points.")
        else:
            lines.append(f"Both **{n1}** and **{n2}** share the exact same growth rate of **{c1:.1f}%**.")

        lines.append("")
        lines.append("#### 📉 Metrics Side-by-Side Breakdown:")
        lines.append(f"- **{n1}** (`{s1}`): Volatility **{m1.get('volatility_pct', 0):.1f}%**, Trend Score `{m1.get('trend_score', 0):.1f}`, Momentum `{m1.get('momentum', 'Stable')}`")
        lines.append(f"- **{n2}** (`{s2}`): Volatility **{m2.get('volatility_pct', 0):.1f}%**, Trend Score `{m2.get('trend_score', 0):.1f}`, Momentum `{m2.get('momentum', 'Stable')}`")
        return "\n".join(lines)

    # 2. SPECIFIC SINGLE-COLUMN STATISTICAL LOOKUP (when not comparing)
    matched_cols = [stat for key, stat in column_stats.items() if stat["column"].lower() in q and key.count('.') == 1]
    if matched_cols and not is_comparison:
        for col in matched_cols[:2]:
            col_name = col["column"]
            sheet = col["sheet"]
            if col["type"] == "numeric":
                cnt = col.get("count", 0)
                mean_val = col.get("mean", 0)
                min_val = col.get("min", 0)
                max_val = col.get("max", 0)
                total_est = mean_val * cnt
                lines.append(f"### 🔍 Detailed Stats for `{col_name}` (`{sheet}`)")
                lines.append(f"- **Count**: `{cnt:,}` records analyzed.")
                lines.append(f"- **Average (Mean)**: **{mean_val:,.2f}**")
                lines.append(f"- **Estimated Total (Sum)**: **{total_est:,.2f}**")
                lines.append(f"- **Range**: Min **{min_val:,.2f}** to Max **{max_val:,.2f}**")

                # Add trend if exists
                metric_trend = next((m for m in all_metrics if m["metric"].lower() == col_name.lower()), None)
                if metric_trend:
                    lines.append(f"- **Growth Trend**: **{metric_trend.get('change_pct', 0):.1f}%** ({metric_trend.get('direction')})")
                    lines.append(f"- **Volatility**: **{metric_trend.get('volatility_pct', 0):.1f}%** ({metric_trend.get('momentum')})")
            elif col["type"] == "categorical":
                lines.append(f"### 🏷️ Categorical Breakdown for `{col_name}` (`{sheet}`)")
                lines.append(f"- **Unique Categories**: `{col.get('unique', 0)}`")
                top_cats = col.get("top_categories", [])
                if top_cats:
                    cats_str = ", ".join(f"**{c['value']}** ({c['count']:,})" for c in top_cats[:5])
                    lines.append(f"- **Top Values**: {cats_str}")

    # 2. GROWTH & FASTEST / SLOWEST METRIC QUESTIONS
    if ("grow" in q or "fastest" in q or "highest growth" in q or "increase" in q or "top performance" in q) and not lines:
        if not all_metrics:
            return "No numeric metrics were detected in this workbook to evaluate growth trends."
        fastest = max(all_metrics, key=lambda m: m.get("change_pct", 0))
        top3 = sorted(all_metrics, key=lambda m: m.get("change_pct", 0), reverse=True)[:3]

        lines.append(f"### 🚀 Fastest Growing Metric: **{fastest.get('metric')}** (`{fastest.get('sheet')}`)")
        lines.append(f"- **Overall Growth**: **+{fastest.get('change_pct', 0):.1f}%** across the analyzed period.")
        lines.append(f"- **Trend Score**: `{fastest.get('trend_score', 0):.1f}` with `{fastest.get('confidence', 'High')}` confidence.")
        lines.append("")
        lines.append("**Top 3 Growth Metrics Overall**:")
        for idx, m in enumerate(top3, 1):
            lines.append(f"{idx}. **{m.get('metric')}** (`{m.get('sheet')}`): **+{m.get('change_pct', 0):.1f}%**")

    # 3. VOLATILITY QUESTIONS
    elif ("volatile" in q or "volatility" in q or "instability" in q or "fluctuat" in q) and not lines:
        if not all_metrics:
            return "No numeric metrics detected for volatility assessment."
        most_vol = max(all_metrics, key=lambda m: m.get("volatility_pct", 0))
        top_vol = sorted(all_metrics, key=lambda m: m.get("volatility_pct", 0), reverse=True)[:3]

        lines.append(f"### ⚡ Most Volatile Metric: **{most_vol.get('metric')}** (`{most_vol.get('sheet')}`)")
        lines.append(f"- **Volatility Rate**: **{most_vol.get('volatility_pct', 0):.1f}%**")
        lines.append(f"- **Momentum Status**: `{most_vol.get('momentum', 'Stable')}`")
        lines.append("")
        lines.append("**Top 3 Most Volatile Metrics**:")
        for idx, m in enumerate(top_vol, 1):
            lines.append(f"{idx}. **{m.get('metric')}** (`{m.get('sheet')}`): **{m.get('volatility_pct', 0):.1f}%** volatility")

    # 4. ANOMALIES & OUTLIERS QUESTIONS
    elif ("anomaly" in q or "anomalies" in q or "outlier" in q or "critical" in q or "error" in q) and not lines:
        total_anomalies = sum(int(res.get("total", 0)) for res in anomalies.values() if isinstance(res, dict))
        lines.append(f"### ⚠️ Anomaly Analysis Report")
        lines.append(f"- **Total Anomalies Flagged**: **{total_anomalies}** across all sheets.")

        all_anoms = []
        for sheet_name, sheet_res in anomalies.items():
            if isinstance(sheet_res, dict):
                for item in sheet_res.get("all", []):
                    all_anoms.append({**item, "sheet": sheet_name})

        crit_high = [a for a in all_anoms if a.get("severity") in ("Critical", "High")]
        if crit_high:
            lines.append("")
            lines.append("**Top Priority Anomalies to Review**:")
            for a in crit_high[:5]:
                lines.append(f"- **Row {a.get('row')}** in `{a.get('sheet')}` (`{a.get('metric')}`): "
                             f"Value **{a.get('value')}** — Severity: **{a.get('severity')}** ({a.get('type')})")
        else:
            lines.append("- No critical or high severity anomalies detected.")

    # 5. DATA QUALITY & HEALTH QUESTIONS
    elif ("clean" in q or "health" in q or "missing" in q or "duplicate" in q or "quality" in q) and not lines:
        health = analysis.get("workbook_health", 85)
        missing = analysis.get("total_missing", 0)
        dups = analysis.get("total_duplicates", 0)
        invalid = analysis.get("total_invalid", 0)
        rows = analysis.get("total_rows", 0)

        lines.append("### 🧹 Data Quality & Health Audit")
        lines.append(f"- **Overall Health Score**: **{health}%**")
        lines.append(f"- **Total Rows Analyzed**: **{rows:,}**")
        lines.append(f"- **Missing Cells**: `{missing:,}`")
        lines.append(f"- **Duplicate Rows**: `{dups:,}`")
        lines.append(f"- **Invalid Value Formats**: `{invalid:,}`")

    # 6. GENERAL QUERY FALLBACK (REASONING & HIGH-LEVEL OVERVIEW)
    if not lines:
        rows = analysis.get("total_rows", 0)
        health = analysis.get("workbook_health", 85)
        lines.append(f"### 📋 Dataset Overview ({len(profiles)} sheet(s), {rows:,} rows, Health: {health}%)")
        lines.append("")
        if all_metrics:
            lines.append("**Summary of Key Computed Metrics**:")
            for m in all_metrics[:4]:
                chg = m.get("change_pct", 0)
                sign = "+" if chg > 0 else ""
                lines.append(f"- **{m.get('metric')}** (`{m.get('sheet')}`): `{sign}{chg:.1f}%` change, "
                             f"`{m.get('volatility_pct', 0):.1f}%` volatility ({m.get('direction')}).")
        else:
            lines.append("- No numeric columns found in the loaded dataset.")

    return "\n".join(lines)


def _build_compact_context(analysis: dict, max_sheets: int = 20) -> str:
    """Build a rich, comprehensive JSON context for AI reasoning."""
    context = {
        "summary": {
            "sheet_count": analysis.get("sheet_count", 0),
            "total_rows": analysis.get("total_rows", 0),
            "workbook_health": analysis.get("workbook_health", 0),
            "total_missing": analysis.get("total_missing", 0),
            "total_duplicates": analysis.get("total_duplicates", 0),
        },
        "profiles": {},
        "numeric_statistics": {},
        "categorical_statistics": {},
        "trends": {},
        "anomalies": {},
        "correlations": {},
    }

    sheets = analysis.get("sheets", {})
    for sheet_name, sheet_data in list(sheets.items())[:max_sheets]:
        if not isinstance(sheet_data, dict):
            continue
        profile = sheet_data.get("profile", {})
        eda = sheet_data.get("eda", {})

        context["profiles"][sheet_name] = {
            "rows": profile.get("rows"),
            "columns": profile.get("columns"),
            "numeric_columns": profile.get("numeric_columns", []),
            "date_column": profile.get("date_column"),
            "health_score": profile.get("health_score"),
        }

        # Include numeric stats (mean, min, max, std, sum)
        if "numeric_statistics" in eda:
            context["numeric_statistics"][sheet_name] = eda["numeric_statistics"]

        # Include top categories
        if "categorical_statistics" in eda:
            context["categorical_statistics"][sheet_name] = eda["categorical_statistics"]

        # Include trend metrics
        trends = sheet_data.get("trends", {})
        if isinstance(trends, dict):
            context["trends"][sheet_name] = trends

        # Include top anomalies
        anom = sheet_data.get("anomalies", {})
        if isinstance(anom, dict):
            all_anoms = anom.get("all", [])
            context["anomalies"][sheet_name] = {
                "total": anom.get("total", 0),
                "top_items": [
                    {
                        "metric": a.get("metric"),
                        "row": a.get("row"),
                        "value": a.get("value"),
                        "severity": a.get("severity"),
                        "type": a.get("type"),
                    }
                    for a in all_anoms[:5]
                ],
            }

        # Include correlations
        corr = sheet_data.get("correlations", {})
        if isinstance(corr, dict):
            context["correlations"][sheet_name] = {
                "strongest_positive": corr.get("strongest_positive", [])[:3],
                "strongest_negative": corr.get("strongest_negative", [])[:3],
            }

    return json.dumps(context, default=str)[:15000]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_ai_summary(analysis: dict) -> dict:
    """Generate an executive summary. Falls back to deterministic output when
    Gemini is unavailable or fails. NEVER blocks the application."""
    deterministic = _build_deterministic_summary(analysis)
    try:
        compact = _build_compact_context(analysis)

        prompt = f"""
You are a Lead AI Data Analyst. Generate a comprehensive, highly accurate, and structured Executive Data Analysis Report based strictly on the pre-computed workbook statistics below.

Workbook Pre-Calculated Statistics:
{compact}

Required Structure for your response (in Markdown):
# 📊 Executive Data Analysis & Insights Report

## 1. Executive Summary & Scale
- Summarize dataset scale, health score, and key business findings.

## 2. Key Metric Performance & Growth Drivers
- Highlight top upward and downward metrics with exact numbers, % change, and trend scores.

## 3. Risk Assessment & Statistical Anomalies
- Outline volatility concerns, data quality gaps, and critical anomalies flagged with row numbers and severities.

## 4. Data Health & Cleaning Quality Audit
- Report on health score, missing cells, duplicates, and column integrity.

## 5. Strategic Recommendations & Action Items
- 3-5 concrete, data-backed operational steps.

Style: Professional, data-driven, business-focused. Include exact values and figures.
"""
        text = _generate(prompt)
        return {
            "source": "gemini",
            "markdown": text,
            "sections": deterministic["sections"],
        }
    except Exception as exc:
        deterministic["ai_error"] = str(exc)
        return deterministic


def answer_question(question: str, analysis: dict) -> dict:
    """Answer a natural-language question using real data + Gemini when available."""
    if not question or not question.strip():
        return {"answer": "Ask a question about your workbook data.", "source": "deterministic"}

    try:
        compact = _build_compact_context(analysis)

        prompt = f"""
You are an expert AI Data Analyst. Answer the user's question with 100% precision using ONLY the pre-computed statistics provided below.

Calculated workbook statistics:
{compact}

User Question: "{question}"

Instructions:
1. FIRST: Analyze the question intent carefully (e.g., metric lookup, growth comparison, volatility check, anomaly review, data quality audit).
2. SECOND: Locate the exact metrics, values, sums, means, and sheet references in the data above.
3. THIRD: Format a clean, structured Markdown response with exact numbers, percentages, bullet points, and bold figures. Never invent numbers or guess causes.
"""
        text = _generate(prompt, temperature=0.2)
        return {"answer": text, "source": "gemini"}
    except Exception as exc:
        try:
            answer = _build_deterministic_answer(question, analysis)
        except Exception:
            answer = (
                "I analyzed your question against the workbook data. "
                "Please re-upload the file or specify the metric name clearly."
            )
        return {"answer": answer, "source": "deterministic", "note": str(exc)}
