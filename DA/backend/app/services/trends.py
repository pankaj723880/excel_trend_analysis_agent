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
    """Classify geometric direction independently from confidence."""
    if score >= 20:
        return "Upward"
    elif score <= -20:
        return "Downward"
    return "Stable / sideways"


def classify_strength(score: float) -> str:
    """Classify mathematical slope magnitude."""
    abs_score = abs(score)
    if abs_score >= 60:
        return "Strong"
    elif abs_score >= 25:
        return "Moderate"
    elif abs_score >= 10:
        return "Mild"
    return "Flat"


def compute_trend_confidence(
    observations: int,
    r2: float,
    volatility_pct: float,
    has_date: bool,
) -> str:
    """Multi-factor trend confidence evaluation.

    Considers sample size, goodness-of-fit (R²), relative volatility, and temporal presence.
    """
    if observations < 4:
        return "INSUFFICIENT_DATA"

    # High volatility or very low R² reduces confidence
    if r2 >= 0.70 and volatility_pct < 30 and observations >= 8:
        return "High"
    elif r2 >= 0.30 and volatility_pct < 60 and observations >= 5:
        return "Medium"
    else:
        return "Low"


def analyze_trends(
    df: pd.DataFrame,
    date_column: str | None = None,
    min_observations: int = 4,
) -> dict[str, dict]:
    """Analyze statistical trends across all suitable numeric variables.

    Never assumes specific column names. Sorts chronologically when a date axis
    exists and distinguishes first_to_last_change from regression slope.
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

        exclusions = []
        if date_column is not None and date_column in df.columns:
            dates = coerce_date_column(df, date_column)
            frame = pd.DataFrame({"date": dates, "value": series})
            
            # Detect dominant year cluster if sample is sufficient
            valid_dates = frame["date"].dropna()
            excluded_mask = pd.Series(False, index=frame.index)
            if len(valid_dates) >= 10:
                years = valid_dates.dt.year
                dominant_year = int(years.mode()[0])
                year_counts = years.value_counts()
                for idx, dt in frame["date"].items():
                    if pd.notna(dt):
                        yr = dt.year
                        if abs(yr - dominant_year) >= 5 and year_counts.get(yr, 0) <= 2:
                            excluded_mask[idx] = True
                            exclusions.append({
                                "row_index": int(idx),
                                "date": dt.strftime("%Y-%m-%d"),
                                "value": float(frame.loc[idx, "value"]) if pd.notna(frame.loc[idx, "value"]) else None,
                                "reason": f"Date {dt.strftime('%Y-%m-%d')} is far outside dominant observation timeline ({dominant_year}).",
                            })

            # Exclude anomalous date rows from temporal regression
            temporal_frame = frame[~excluded_mask].dropna(subset=["date", "value"]).sort_values("date")
            y = temporal_frame["value"].to_numpy(dtype=float)
            has_date = True
            time_axis_type = "datetime"
            total_obs = len(frame)
            valid_temporal_obs = len(y)
            excluded_temporal_obs = len(exclusions)
            # Use chronological time delta in days if valid dates exist, or integer steps
            if len(temporal_frame) >= 2:
                d0 = temporal_frame["date"].iloc[0]
                x = (temporal_frame["date"] - d0).dt.total_seconds().to_numpy(dtype=float) / 86400.0
                # If all dates are identical, fall back to step index
                if np.all(x == x[0]):
                    x = np.arange(len(y), dtype=float)
            else:
                x = np.arange(len(y), dtype=float)
        else:
            y = series.sort_index().to_numpy(dtype=float)
            has_date = False
            time_axis_type = "observation_order"
            total_obs = len(series)
            valid_temporal_obs = len(y)
            excluded_temporal_obs = 0
            x = np.arange(len(y), dtype=float)

        try:
            if len(y) >= 2 and np.std(x) > 0 and np.std(y) > 0:
                regression: Any = linregress(x, y)
                slope = float(regression.slope)
                r2 = float(regression.rvalue ** 2)
            else:
                slope = 0.0
                r2 = 0.0
        except Exception:
            slope = 0.0
            r2 = 0.0

        # Distinct: first vs last observations change
        first_n = max(1, len(y) // 5)
        last_n = max(1, len(y) // 5)
        first_mean = float(np.mean(y[:first_n]))
        last_mean = float(np.mean(y[-last_n:]))

        if abs(first_mean) > 1e-9:
            first_to_last_pct = float(((last_mean - first_mean) / abs(first_mean)) * 100)
        else:
            first_to_last_pct = 0.0

        mean_abs = float(np.mean(np.abs(y))) if len(y) else 0.0
        if len(y) > 2 and mean_abs > 1e-9:
            volatility_pct = float(np.std(np.diff(y)) / mean_abs * 100)
        else:
            volatility_pct = 0.0

        normalized_slope = slope / (mean_abs if mean_abs > 1e-9 else 1.0)
        score = float(np.clip(normalized_slope * 1000 * (0.5 + 0.5 * r2), -100, 100))

        confidence = compute_trend_confidence(len(y), r2, volatility_pct, has_date)

        # Robust trend calculation: evaluate trend with and without extreme IQR outliers
        q1 = np.percentile(y, 25)
        q3 = np.percentile(y, 75)
        iqr = q3 - q1
        is_outlier = (y < q1 - 1.5 * iqr) | (y > q3 + 1.5 * iqr) if iqr > 0 else np.zeros(len(y), dtype=bool)
        outlier_count = int(is_outlier.sum())
        robust_slope = slope
        robust_r2 = r2
        slope_diff_pct = 0.0

        if outlier_count > 0 and len(y) - outlier_count >= min_observations:
            y_clean = y[~is_outlier]
            x_clean = x[~is_outlier] if len(x) == len(y) else np.arange(len(y_clean), dtype=float)
            try:
                if len(y_clean) >= 2 and np.std(x_clean) > 0 and np.std(y_clean) > 0:
                    clean_reg: Any = linregress(x_clean, y_clean)
                    robust_slope = float(clean_reg.slope)
                    robust_r2 = float(clean_reg.rvalue ** 2)
                    if abs(slope) > 1e-9:
                        slope_diff_pct = float(abs(robust_slope - slope) / abs(slope) * 100)
                    else:
                        slope_diff_pct = float(abs(robust_slope) * 100)
            except Exception:
                pass

        if slope_diff_pct > 50.0 or (robust_slope * slope < 0 and abs(robust_slope - slope) > 1e-5):
            outlier_sensitivity = "High"
            outlier_sensitive = True
        elif slope_diff_pct > 20.0:
            outlier_sensitivity = "Moderate"
            outlier_sensitive = True
        else:
            outlier_sensitivity = "Low"
            outlier_sensitive = False

        # Momentum: compare second half slope with total slope
        midpoint = len(y) // 2
        recent = y[midpoint:]
        if len(recent) >= 3:
            try:
                recent_reg: Any = linregress(np.arange(len(recent), dtype=float), recent)
                recent_slope = float(recent_reg.slope)
            except Exception:
                recent_slope = slope
        else:
            recent_slope = slope

        if abs(slope) < 1e-9:
            momentum = "steady"
        else:
            ratio = abs(recent_slope) / abs(slope)
            if ratio > 1.20:
                momentum = "accelerating"
            elif ratio < 0.80:
                momentum = "decelerating"
            else:
                momentum = "steady"

        direction = classify_direction(score)
        strength = classify_strength(score)

        # Baseline forecasting with small-sample protection
        forecast_data = _compute_baseline_forecast(y, has_date=has_date)

        result[str(col)] = {
            "metric": str(col),
            "direction": direction,
            "strength": strength,
            "display_direction": f"{direction} ({strength})" if strength != "Flat" else direction,
            "trend_score": round(score, 2),
            "slope": round(slope, 6),
            "r2": round(r2, 4),
            "ordinary_trend": {
                "slope": round(slope, 6),
                "r2": round(r2, 4),
            },
            "robust_trend": {
                "slope": round(robust_slope, 6),
                "r2": round(robust_r2, 4),
            },
            "change_pct": round(first_to_last_pct, 2),
            "first_to_last_change_pct": round(first_to_last_pct, 2),
            "volatility_pct": round(volatility_pct, 2),
            "confidence": confidence,
            "momentum": momentum,
            "outlier_count": outlier_count,
            "outlier_sensitive": outlier_sensitive,
            "outlier_sensitivity": outlier_sensitivity,
            "robust_vs_ordinary_slope_difference": round(slope_diff_pct, 2),
            "outlier_sensitivity_note": f"Trend trajectory has {outlier_sensitivity} sensitivity to statistical outliers." if outlier_sensitive else "Trend trajectory is robust to distribution outliers.",
            "observations": int(len(y)),
            "total_observations": total_obs,
            "valid_temporal_observations": valid_temporal_obs,
            "excluded_temporal_observations": excluded_temporal_obs,
            "temporal_exclusions": exclusions,
            "time_axis_type": time_axis_type,
            "has_date": has_date,
            "date_column": str(date_column) if has_date else None,
            "forecast": forecast_data,
            "traceability": {
                "metric": str(col),
                "r2": round(r2, 4),
                "regression_slope": round(slope, 6),
                "robust_slope": round(robust_slope, 6),
                "observations": int(len(y)),
                "confidence_basis": f"R²={r2:.2f}, Volatility={volatility_pct:.1f}%, N={len(y)}",
            },
        }

    return result


def _compute_baseline_forecast(y: np.ndarray, has_date: bool, steps: int = 3) -> dict[str, Any]:
    """Calculate baseline forecasting (naive, moving average, linear extrapolation) with prediction intervals.
    
    Adheres to small-sample protection rules:
    - N < 5: Descriptive only (forecasting unavailable).
    - 5 <= N < 10: Limited exploratory forecast with wide intervals and strong warning.
    - N >= 10: Standard baseline forecast comparison.
    """
    n = len(y)
    if n < 5:
        return {
            "available": False,
            "reason": f"Sample size (N={n}) is too small for statistical forecasting. Minimum N=5 required for baseline projections.",
            "predictions": [],
            "model_used": None,
        }

    # Baseline models
    last_val = float(y[-1])
    std_val = float(np.std(y, ddof=1)) if n > 1 else float(np.std(y))
    
    # 3-period moving average
    window = min(3, n)
    ma_val = float(np.mean(y[-window:]))
    
    # Linear projection
    x = np.arange(n, dtype=float)
    try:
        reg: Any = linregress(x, y)
        slope = float(reg.slope)
        intercept = float(reg.intercept)
        r2 = float(reg.rvalue ** 2)
    except Exception:
        slope = 0.0
        intercept = last_val
        r2 = 0.0

    predictions = []
    for step in range(1, steps + 1):
        target_x = n + step - 1
        linear_val = intercept + slope * target_x
        
        # Weighted blend: when R² is high and N >= 10, trust linear trend; otherwise anchor to MA
        if n >= 10 and r2 > 0.40:
            pred_point = float(linear_val)
            model_name = "Linear Trend Extrapolation"
        else:
            pred_point = float(0.5 * ma_val + 0.5 * last_val)
            model_name = "Exponential/Moving Average Baseline"

        # 80% prediction interval approximation: z ~ 1.28
        interval_margin = 1.28 * std_val * np.sqrt(1 + step / n)
        predictions.append({
            "step": step,
            "projected_value": round(pred_point, 2),
            "lower_bound": round(pred_point - interval_margin, 2),
            "upper_bound": round(pred_point + interval_margin, 2),
        })

    warning = None
    if n < 10:
        warning = f"Exploratory projection based on limited sample (N={n}). Prediction intervals are wide."

    return {
        "available": True,
        "model_used": model_name,
        "sample_size": n,
        "has_date_axis": has_date,
        "warning": warning,
        "predictions": predictions,
    }


def pick_best_metric(trends: dict) -> str | None:
    """Choose the metric with the strongest absolute trend score."""
    if not trends:
        return None
    return max(trends.items(), key=lambda item: abs(item[1].get("trend_score", 0)))[0]

