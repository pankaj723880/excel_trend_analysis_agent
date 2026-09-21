"""AI Business Report Generator & Multi-Format Exporter.

Generates comprehensive, non-technical Executive Business Intelligence Reports
from pre-computed Pandas analysis results. Supports exporting to HTML/PDF and Excel.
"""
from __future__ import annotations

import io
import json
from typing import Any
import pandas as pd

from app.services.business_context import detect_business_context


def generate_full_ai_report(
    workbook_id: str,
    workbook_dict: dict[str, pd.DataFrame],
    analysis: dict[str, Any],
    schema: dict[str, Any],
) -> dict[str, Any]:
    """Generates a complete structured Executive Business Report.

    Strictly separates:
    1. VERIFIED FACTS (deterministic figures from Pandas)
    2. INTERPRETATIONS (contextual narratives explaining the facts)
    3. EVIDENCE-BASED RECOMMENDATIONS (only when issues exist)
    """
    context_info = detect_business_context(workbook_dict, schema)
    domain = context_info.get("domain", "General Analytics")

    trends = analysis.get("trends", {})
    anomalies = analysis.get("anomalies", {})
    profiles = analysis.get("profiles", {})
    quality = analysis.get("quality", {})
    all_kpis = analysis.get("all_kpis", [])
    workbook_health = int(analysis.get("workbook_health", 85))
    total_rows = int(analysis.get("total_rows", 0))

    all_metrics = []
    for sheet, sheet_trends in trends.items():
        if isinstance(sheet_trends, dict):
            for metric, info in sheet_trends.items():
                if isinstance(info, dict):
                    all_metrics.append({**info, "sheet": sheet, "metric": metric})

    all_metrics.sort(key=lambda item: abs(item.get("trend_score", 0)), reverse=True)
    top_growth = [m for m in all_metrics if m.get("change_pct", 0) > 0][:5]
    pressure_metrics = [m for m in all_metrics if m.get("change_pct", 0) < 0][:5]

    # Fact vs Explanation Split (Pure Evidence vs Analytical Insight)
    facts_and_explanations = []

    if top_growth:
        fastest = top_growth[0]
        facts_and_explanations.append({
            "fact": f"VERIFIED FACT: {fastest.get('metric')} in sheet '{fastest.get('sheet')}' demonstrated a first-to-last change of +{fastest.get('change_pct', 0):.1f}%.",
            "possible_explanation": (
                f"INTERPRETATION: Upward trajectory (Trend Score: {fastest.get('trend_score', 0):.1f}, Confidence: {fastest.get('confidence', 'Medium')}) "
                f"with {fastest.get('volatility_pct', 0):.1f}% relative volatility."
            ),
        })

    if pressure_metrics:
        lowest = pressure_metrics[0]
        facts_and_explanations.append({
            "fact": f"VERIFIED FACT: {lowest.get('metric')} in sheet '{lowest.get('sheet')}' declined by {lowest.get('change_pct', 0):.1f}%.",
            "possible_explanation": (
                f"INTERPRETATION: Downside movement identified (Trend Score: {lowest.get('trend_score', 0):.1f}) "
                f"under {lowest.get('volatility_pct', 0):.1f}% volatility."
            ),
        })

    # Evidence-based strategic recommendations
    recommendations: list[str] = []
    total_missing = int(analysis.get("total_missing", 0))
    total_duplicates = int(analysis.get("total_duplicates", 0))
    total_anomalies = sum(int(sheet_anom.get("total", 0)) for sheet_anom in anomalies.values() if isinstance(sheet_anom, dict))

    if total_missing > 0:
        recommendations.append(f"Investigate {total_missing:,} missing data points across sheets using the Cleaning Studio.")
    if total_duplicates > 0:
        recommendations.append(f"Audit {total_duplicates:,} duplicate rows to ensure uniqueness in statistical summaries.")
    if total_anomalies > 0:
        recommendations.append(f"Review {total_anomalies:,} statistical outliers flagged by IQR and Z-score methods.")

    # Growth & Volatility recommendations based strictly on available metrics
    if top_growth:
        top_names = ", ".join(m.get("metric") for m in top_growth[:2])
        recommendations.append(f"Evaluate positive expansion drivers in {top_names}.")
    if pressure_metrics:
        declining_names = ", ".join(m.get("metric") for m in pressure_metrics[:2])
        recommendations.append(f"Examine factors influencing contractions in {declining_names}.")

    if not recommendations:
        recommendations.append("Dataset maintains high consistency; continue periodic surveillance of key metrics.")

    report = {
        "title": f"Executive Intelligence Report - {schema.get('filename', 'Workbook')}",
        "domain": domain,
        "domain_confidence": context_info.get("confidence", "High"),
        "total_rows": total_rows,
        "sheet_count": len(workbook_dict),
        "health_score": workbook_health,
        "executive_summary": (
            f"This Executive Analysis evaluates {total_rows:,} records across {len(workbook_dict)} worksheet(s). "
            f"Identified business context aligns with '{domain}'. Overall Data Quality Index is rated at {workbook_health}%."
        ),
        "top_growth_drivers": top_growth,
        "metrics_under_pressure": pressure_metrics,
        "facts_and_explanations": facts_and_explanations,
        "recommendations": recommendations,
        "all_metrics": all_metrics[:10],
        "kpis": all_kpis[:10],
    }

    return report


def generate_report_html(report: dict[str, Any]) -> str:
    """Generates an executive-grade printable HTML report."""
    domain = report.get("domain", "Business Analytics")
    title = report.get("title", "Executive Report")
    total_rows = report.get("total_rows", 0)
    health = report.get("health_score", 85)

    growth_html = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #202938;'><b>{m.get('metric')}</b> ({m.get('sheet')})</td>"
        f"<td style='padding:8px;border-bottom:1px solid #202938;color:#22C55E;font-weight:bold;'>+{m.get('change_pct', 0):.1f}%</td></tr>"
        for m in report.get("top_growth_drivers", [])
    ) or "<tr><td colspan='2' style='padding:8px;'>No upward growth metrics detected</td></tr>"

    pressure_html = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #202938;'><b>{m.get('metric')}</b> ({m.get('sheet')})</td>"
        f"<td style='padding:8px;border-bottom:1px solid #202938;color:#EF4444;font-weight:bold;'>{m.get('change_pct', 0):.1f}%</td></tr>"
        for m in report.get("metrics_under_pressure", [])
    ) or "<tr><td colspan='2' style='padding:8px;'>No metrics under pressure detected</td></tr>"

    facts_html = "".join(
        f"<div style='margin-bottom:12px;padding:12px;background:#111722;border-left:4px solid #5B7CFF;border-radius:6px;'>"
        f"<div style='color:#E2E8F0;font-weight:bold;margin-bottom:4px;'>{item['fact']}</div>"
        f"<div style='color:#94A3B8;font-size:13px;'>{item['possible_explanation']}</div>"
        f"</div>"
        for item in report.get("facts_and_explanations", [])
    )

    recs_html = "".join(
        f"<li style='margin-bottom:6px;color:#E2E8F0;'>{rec}</li>"
        for rec in report.get("recommendations", [])
    )

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #080B12; color: #E2E8F0; margin: 0; padding: 32px; }}
        .card {{ background: #0C1018; border: 1px solid #202938; border-radius: 12px; padding: 24px; margin-bottom: 24px; }}
        h1 {{ color: #FFFFFF; margin-top: 0; font-size: 24px; }}
        h2 {{ color: #5B7CFF; font-size: 16px; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #202938; padding-bottom: 8px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }}
        th {{ text-align: left; padding: 8px; background: #111722; color: #94A3B8; border-bottom: 2px solid #202938; }}
        .badge {{ background: rgba(91, 124, 255, 0.15); color: #5B7CFF; border: 1px solid rgba(91, 124, 255, 0.3); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; }}
        @media print {{ body {{ background: #FFFFFF; color: #000000; }} .card {{ border: 1px solid #DDD; background: #FFF; }} h1, h2 {{ color: #000; }} }}
    </style>
</head>
<body>
    <div className="card" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
            <h1>📊 {title}</h1>
            <div style="color:#94A3B8;font-size:13px;">Automated Executive Intelligence Report • Domain: <span className="badge">{domain}</span></div>
        </div>
        <button onclick="window.print()" style="background:#5B7CFF;color:#FFF;border:none;padding:10px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">Print / Save as PDF</button>
    </div>

    <div class="card">
        <h2>Executive Summary & Scale</h2>
        <p style="color:#CBD5E1;line-height:1.6;">{report.get('executive_summary')}</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
            <div><span style="color:#94A3B8;font-size:11px;">TOTAL ROWS:</span> <strong style="font-size:18px;">{total_rows:,}</strong></div>
            <div><span style="color:#94A3B8;font-size:11px;">HEALTH SCORE:</span> <strong style="font-size:18px;color:#22C55E;">{health}%</strong></div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
        <div class="card" style="margin-bottom:0;">
            <h2 style="color:#22C55E;">📈 Top Growth Drivers</h2>
            <table>
                <thead><tr><th>Metric</th><th>Growth</th></tr></thead>
                <tbody>{growth_html}</tbody>
            </table>
        </div>
        <div class="card" style="margin-bottom:0;">
            <h2 style="color:#EF4444;">📉 Metrics Under Pressure</h2>
            <table>
                <thead><tr><th>Metric</th><th>Change</th></tr></thead>
                <tbody>{pressure_html}</tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <h2>Verified Facts vs Possible Explanations</h2>
        {facts_html}
    </div>

    <div class="card">
        <h2>Strategic Recommendations</h2>
        <ul style="padding-left:20px;line-height:1.6;">{recs_html}</ul>
    </div>
</body>
</html>
"""


def generate_report_excel(report: dict[str, Any]) -> io.BytesIO:
    """Generates an Excel summary workbook containing executive insights."""
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        # Summary Sheet
        summary_df = pd.DataFrame([
            {"Metric": "Workbook Title", "Value": report.get("title")},
            {"Metric": "Inferred Domain", "Value": report.get("domain")},
            {"Metric": "Total Rows", "Value": report.get("total_rows")},
            {"Metric": "Data Health Score", "Value": f"{report.get('health_score')}%"},
        ])
        summary_df.to_excel(writer, sheet_name="Executive Summary", index=False)

        # Growth Drivers Sheet
        if report.get("top_growth_drivers"):
            growth_df = pd.DataFrame(report["top_growth_drivers"])
            growth_df.to_excel(writer, sheet_name="Growth Drivers", index=False)

        # Pressure Metrics Sheet
        if report.get("metrics_under_pressure"):
            pressure_df = pd.DataFrame(report["metrics_under_pressure"])
            pressure_df.to_excel(writer, sheet_name="Under Pressure", index=False)

    buffer.seek(0)
    return buffer
