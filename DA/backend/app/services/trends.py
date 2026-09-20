"""Trend engine: statistical trend detection with date-axis support.

Ported and enhanced from the original Streamlit analyzer/trends.py.
Handles chronological sorting when a date column exists, and provides
direction / score / slope / R² / change % / volatility / momentum / confidence.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import linregress

from app.utils.dates import detect_date_column, coerce_date_column


def _clean_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").dropna()


def classify_direction(score: float) -> str:
    if score >= 60:
        return "Strongly upward"
    if score >= 20:
        return "Upward"
    if score <= -60:
        return "Strongly downward"
    if score <= -20:
        return "Downward"
    return "Stable / sideways"


def analyze_trends(
    df: pd.DataFrame,
    date_column: str | None = None,
    min_observations: int = 5,
) -> dict:
    """Analyze trends for all suitable numeric columns in a sheet.

    Uses the date column as the time axis when available (chronological sort),
    otherwise observation order. Returns a dict keyed by metric name.
    """
    if date_column is None:
        date_column = detect_date_column(df)

    numeric_columns = df.select_dtypes(include="number").columns.tolist()

    result: dict[str, dict] = {}

    for col in numeric_columns:
        if str(col) == str(date_column) and pd.api.types.is_datetime64_any_dtype(df[col]):
            continue

        series = _clean_numeric(df[col])
        if len(series) < min_observations or series.nunique() < 2:
            continue

        if date_column is not None and date_column in df.columns:
            # Build a chronological frame: date + value
            dates = coerce_date_column(df, date_column)
            frame = pd.DataFrame({"date": dates, "value": series})
            frame = frame.dropna(subset=["date", "value"]).sort_values("date")
            y = frame["value"].to_numpy(dtype=float)
            has_date = True
            time_labels = frame["date"].astype(str).tolist()
        else:
            y = series.sort_index().to_numpy(dtype=float)
            has_date = False
            time_labels = None

        if len(y) < min_observations or np.unique(y).size < 2:
            continue

        x = np.arange(len(y), dtype=float)

        try:
            # Annotate as Any - scipy's LinregressResult has dynamically-computed attributes
            regression: Any = linregress(x, y)
            slope = float(regression.slope)
            r2 = float(regression.rvalue ** 2)
        except Exception:
            slope = 0.0
            r2 = 0.0

        first_n = max(1, len(y) // 5)
        last_n = max(1, len(y) // 5)
        first_mean = float(np.mean(y[:first_n]))
        last_mean = float(np.mean(y[-last_n:]))

        if first_mean == 0:
            change_pct = 0.0
        else:
            change_pct = float(((last_mean - first_mean) / abs(first_mean)) * 100)

        mean_abs = float(np.mean(np.abs(y))) if len(y) else 0.0
        if len(y) > 2 and mean_abs:
            volatility_pct = float(np.std(np.diff(y)) / mean_abs * 100)
        else:
            volatility_pct = 0.0

        normalized_slope = slope / (mean_abs if mean_abs else 1)
        score = float(np.clip(normalized_slope * 1000 * (0.5 + 0.5 * r2), -100, 100))

        # Momentum: compare recent half slope with overall slope
        midpoint = len(y) // 2
        recent = y[midpoint:]
        if len(recent) >= 3:
            try:
                recent_regression: Any = linregress(np.arange(len(recent), dtype=float), recent)
                recent_slope = float(recent_regression.slope)
            except Exception:
                recent_slope = slope
        else:
            recent_slope = slope

        if slope == 0:
            momentum = "steady"
        else:
            ratio = abs(recent_slope) / abs(slope)
            if ratio > 1.15:
                momentum = "accelerating"
            elif ratio < 0.85:
                momentum = "decelerating"
            else:
                momentum = "steady"

        confidence = "High" if r2 >= 0.70 else ("Medium" if r2 >= 0.35 else "Low")

        direction = classify_direction(score)
        if volatility_pct > 40 and abs(score) < 20:
            direction = "Highly volatile"

        result[str(col)] = {
            "metric": str(col),
            "direction": direction,
            "trend_score": round(score, 2),
            "slope": round(slope, 6),
            "r2": round(r2, 4),
            "change_pct": round(change_pct, 2),
            "volatility_pct": round(volatility_pct, 2),
            "confidence": confidence,
            "momentum": momentum,
            "observations": int(len(y)),
            "has_date": has_date,
            "date_column": date_column if has_date else None,
        }

    return result


def pick_best_metric(trends: dict) -> str | None:
    """Choose the metric with the strongest absolute trend score."""
    if not trends:
        return None
    return max(trends.items(), key=lambda item: abs(item[1].get("trend_score", 0)))[0]
