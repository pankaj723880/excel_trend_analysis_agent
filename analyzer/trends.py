import numpy as np
import pandas as pd
from scipy.stats import linregress

def _clean_numeric(series):
    return pd.to_numeric(series, errors="coerce").dropna()

def _direction(score):
    if score >= 60:
        return "Strongly upward"
    if score >= 20:
        return "Upward"
    if score <= -60:
        return "Strongly downward"
    if score <= -20:
        return "Downward"
    return "Stable / sideways"

def analyze_trends(df):
    rows = []

    for col in df.select_dtypes(include="number").columns:
        s = _clean_numeric(df[col])

        if len(s) < 5 or s.nunique() < 2:
            continue

        y = s.to_numpy(dtype=float)
        x = np.arange(len(y), dtype=float)

        regression = linregress(x, y)
        slope = regression.slope
        r2 = regression.rvalue ** 2

        first_n = max(1, len(y) // 5)
        last_n = max(1, len(y) // 5)
        first_mean = np.mean(y[:first_n])
        last_mean = np.mean(y[-last_n:])

        change_pct = 0.0 if first_mean == 0 else ((last_mean - first_mean) / abs(first_mean)) * 100

        mean_abs = np.mean(np.abs(y))
        volatility_pct = float(np.std(np.diff(y)) / mean_abs * 100) if len(y) > 2 and mean_abs else 0.0

        normalized_slope = slope / (mean_abs if mean_abs else 1)
        score = float(np.clip(normalized_slope * 1000 * (0.5 + 0.5 * r2), -100, 100))

        # Recent momentum is compared with historical slope.
        midpoint = len(y) // 2
        recent_slope = linregress(
            np.arange(len(y[midpoint:])), y[midpoint:]
        ).slope if len(y[midpoint:]) >= 3 else slope

        momentum = "accelerating" if abs(recent_slope) > abs(slope) * 1.15 else (
            "decelerating" if abs(recent_slope) < abs(slope) * 0.85 else "steady"
        )

        confidence = "High" if r2 >= 0.70 else ("Medium" if r2 >= 0.35 else "Low")

        rows.append({
            "column": col,
            "direction": _direction(score),
            "trend_score": score,
            "change_pct": change_pct,
            "volatility_pct": volatility_pct,
            "confidence": confidence,
            "r2": r2,
            "momentum": momentum,
            "observations": len(y),
        })

    return pd.DataFrame(rows)
