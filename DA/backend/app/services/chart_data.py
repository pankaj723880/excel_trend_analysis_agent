"""Build JSON-safe chart series for the React frontend (Recharts)."""
from __future__ import annotations

import pandas as pd

from app.utils.dates import detect_date_column, coerce_date_column, format_iso


def build_chart_series(
    df: pd.DataFrame,
    metric: str | None = None,
    date_column: str | None = None,
    limit: int | None = 5000,
) -> dict:
    """Return {x, y} chart points for a metric, using the date column as x.

    Falls back to observation order when no temporal column exists.
    """
    if date_column is None:
        date_column = detect_date_column(df)

    if metric is None:
        numeric = df.select_dtypes(include="number").columns.tolist()
        if not numeric:
            return {"points": [], "has_date": False, "date_column": None, "metric": None}
        metric = numeric[0]

    if metric not in df.columns:
        return {"points": [], "has_date": False, "date_column": None, "metric": metric}

    y = pd.to_numeric(df[metric], errors="coerce")

    if date_column is not None and date_column in df.columns:
        dates = coerce_date_column(df, date_column)
        frame = pd.DataFrame({"date": dates, "value": y})
        frame = frame.dropna(subset=["date", "value"]).sort_values("date")
        if limit:
            frame = frame.tail(limit)
        points = [
            {
                "x": format_iso(row["date"]),
                "y": float(row["value"]),
            }
            for _, row in frame.iterrows()
        ]
        return {
            "points": points,
            "has_date": True,
            "date_column": date_column,
            "metric": metric,
            "x_label": date_column,
            "temporal_label": date_column,
        }

    # No date: observation order
    valid = y.dropna()
    if limit:
        valid = valid.tail(limit)
    points = [{"x": index, "y": float(value)} for index, value in valid.items()]
    return {
        "points": points,
        "has_date": False,
        "date_column": None,
        "metric": metric,
        "x_label": "Observation",
        "temporal_label": None,
        "note": "No temporal column detected.",
    }


def build_multiple_series(
    df: pd.DataFrame,
    metrics: list[str] | None = None,
    date_column: str | None = None,
    limit: int | None = 5000,
) -> dict:
    """Build chart series for several metrics (for multi-line comparisons)."""
    if date_column is None:
        date_column = detect_date_column(df)

    if not metrics:
        metrics = df.select_dtypes(include="number").columns.tolist()[:6]

    series = []
    for metric in metrics:
        if metric not in df.columns:
            continue
        result = build_chart_series(df, metric, date_column, limit)
        if result["points"]:
            series.append({"metric": metric, "points": result["points"]})

    has_date = date_column is not None

    return {
        "series": series,
        "has_date": has_date,
        "date_column": date_column,
        "metrics": [s["metric"] for s in series],
        "note": None if has_date else "No temporal column detected.",
    }
