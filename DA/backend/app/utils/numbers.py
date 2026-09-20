"""Utilities for numeric coercion and parsing of money/percent strings."""
import re

import pandas as pd

# Characters stripped from money strings: currency symbols, commas, spaces, parentheses handling
MONEY_SYMBOLS = r"[$€£₹¥, ]"
PERCENT_SYMBOL = "%"


def parse_numeric_text(series: pd.Series) -> pd.Series:
    """Convert text that looks like money, percent, or plain numbers to numeric.

    Handles:
    - "1,234.56" / "1 234,56"
    - "$5,000" / "€2.500"
    - "45%" / "-12%"
    - "(1,000)" negative parentheses accounting style
    """
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")

    text = series.astype("string").fillna("")
    cleaned = text.str.strip()

    # Accounting parentheses -> negative
    cleaned = cleaned.str.replace(r"^\((.+)\)$", r"-\1", regex=True)
    # Strip currency symbols and spaces
    cleaned = cleaned.str.replace(r"[$€£₹¥\s]", "", regex=True)

    # Percent: strip % (keep the value as-is, e.g. 45 -> 45)
    cleaned = cleaned.str.replace("%", "", regex=False)

    # European thousands: "1.234,56" -> "1,234.56"
    def _european(match):
        return match.group(1) + match.group(2).replace(",", ".")

    cleaned = cleaned.str.replace(r"^(\d{1,3})\.(\d{3}(?:,\d{3})*)(\.\d+)?$", _european, regex=True)

    # Remove ordinary thousands commas
    cleaned = cleaned.str.replace(r",(?=\d{3})", "", regex=True)

    # Tolerate trailing dots
    cleaned = cleaned.str.replace(r"\.$", "", regex=True)

    return pd.to_numeric(cleaned, errors="coerce")


def coerce_numeric_columns(df: pd.DataFrame, threshold: float = 0.6) -> pd.DataFrame:
    """Coerce string columns that are predominantly numeric into float values."""
    out = df.copy()
    for column in out.columns:
        if pd.api.types.is_numeric_dtype(out[column]):
            continue
        converted = parse_numeric_text(out[column])
        valid_fraction = converted.notna().mean() if len(converted) else 0.0
        if valid_fraction >= threshold:
            out[column] = converted
    return out


def safe_divide(numerator, denominator, default: float = 0.0) -> float:
    try:
        if denominator == 0:
            return default
        return float(numerator / denominator)
    except (TypeError, ValueError, ZeroDivisionError):
        return default


def to_float(value, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        if pd.isna(parsed):
            return default
        return parsed
    except (TypeError, ValueError):
        return default
