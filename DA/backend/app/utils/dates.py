"""Utilities for detecting and parsing date columns across many formats."""
import re

import pandas as pd
import numpy as np

# Formats tried in order, covering the formats required by the spec.
DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%m-%d-%Y",
    "%d/%m/%y",
    "%m/%d/%y",
    "%d-%b-%Y",
    "%d-%B-%Y",
    "%b-%Y",
    "%B-%Y",
    "%b %Y",
    "%B %Y",
    "%d-%b-%y",
    "%d %b %Y",
    "%d %B %Y",
    "%m/%Y",
    "%Y-%m",
]

# Patterns that hint a column is a date even before parsing.
DATE_HINT_PATTERNS = [
    r"date",
    r"time",
    r"day",
    r"month",
    r"year",
    r"period",
    r"fiscal",
    r"quarter",
]


def _looks_like_date_name(name: str) -> bool:
    lower = str(name).lower().strip()
    return any(re.search(pattern, lower) for pattern in DATE_HINT_PATTERNS)


def _try_parse_series(series: pd.Series, dayfirst: bool) -> pd.Series:
    return pd.to_datetime(series, errors="coerce", dayfirst=dayfirst)


def try_parse_date_series(series: pd.Series) -> pd.Series:
    """Parse a series of date-like values with fast pre-checking and fallback strategies.

    Returns a datetime series (NaT where unparseable).
    """
    # Already datetime
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(series, errors="coerce")

    non_null_sample = series.dropna()
    if len(non_null_sample) == 0:
        return pd.Series(pd.NaT, index=series.index)

    # Fast skip for purely numeric series where median is small (e.g. IDs, prices, quantities)
    if pd.api.types.is_numeric_dtype(series):
        num_clean = series.dropna()
        if len(num_clean) > 0 and num_clean.abs().median() < 20000:
            return pd.Series(pd.NaT, index=series.index)

    sample = non_null_sample.astype(str).head(100)

    # All values look like numbers (potential Excel serial dates)
    if len(sample) > 0:
        numeric_mask = sample.str.fullmatch(r"-?\d+(\.\d+)?")
        if numeric_mask.all():
            try:
                numeric = pd.to_numeric(series, errors="coerce")
                if numeric.dropna().abs().median() > 20000:
                    return pd.to_datetime(numeric, unit="D", origin="1899-12-30", errors="coerce")
                else:
                    return pd.Series(pd.NaT, index=series.index)
            except Exception:
                pass

    # Pre-check sample to avoid running full date parsing on non-date columns
    try:
        sample_parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
        if sample_parsed.notna().mean() < 0.2:
            return pd.Series(pd.NaT, index=series.index)
    except Exception:
        pass

    # Try default parser with format="mixed" first (handles ISO and standard dates fast)
    try:
        parsed = pd.to_datetime(series, errors="coerce", format="mixed")
        if parsed.notna().mean() >= 0.7:
            return parsed
    except Exception:
        pass

    # Try explicit format list on sample first to find best format
    best_fmt = None
    best_ratio = 0.0
    for fmt in DATE_FORMATS:
        try:
            cand_sample = pd.to_datetime(sample, errors="coerce", format=fmt)
            ratio = cand_sample.notna().mean()
            if ratio > best_ratio:
                best_ratio = ratio
                best_fmt = fmt
            if best_ratio >= 0.7:
                break
        except (ValueError, TypeError):
            continue

    if best_fmt and best_ratio >= 0.4:
        try:
            return pd.to_datetime(series, errors="coerce", format=best_fmt)
        except Exception:
            pass

    return pd.Series(pd.NaT, index=series.index)


def detect_date_column(df: pd.DataFrame) -> str | None:
    """Find the best temporal column in a DataFrame.

    Priority:
    1. Columns already holding datetime dtype.
    2. Columns whose name suggests a date and that parse successfully.
    3. Any column that parses successfully at high ratio.
    """
    # 1. Explicit datetime dtype
    for column in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[column]):
            non_null = df[column].dropna()
            if len(non_null) >= 2:
                return column

    # 2. Name hints
    for column in df.columns:
        if _looks_like_date_name(column):
            parsed = try_parse_date_series(df[column])
            if parsed.notna().sum() >= 2:
                return column

    # 3. General parsing, preferring object/string columns with parseable data
    best_column = None
    best_score = 0
    for column in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[column]):
            continue
        if pd.api.types.is_numeric_dtype(df[column]):
            continue

        sample_size = min(200, df[column].notna().sum())
        if sample_size < 2:
            continue

        sample_parsed = try_parse_date_series(df[column].dropna().head(30))
        if sample_parsed.notna().mean() < 0.5:
            continue

        try:
            parsed = try_parse_date_series(df[column])
        except Exception:
            continue
        ratio = parsed.notna().mean()
        if ratio >= 0.7 and ratio > best_score:
            best_score = ratio
            best_column = column

    return best_column


def coerce_date_column(df: pd.DataFrame, column: str) -> pd.Series:
    """Return a cleaned datetime series for the given column."""
    return try_parse_date_series(df[column])


def format_iso(value) -> str | None:
    """Format a date-ish value to ISO string for JSON."""
    if value is None:
        return None
    try:
        if isinstance(value, pd.Timestamp):
            return value.strftime("%Y-%m-%d")
        ts = pd.Timestamp(value)
        return ts.strftime("%Y-%m-%d")
    except (ValueError, TypeError, OverflowError):
        return None


def json_safe_datetime(series: pd.Series) -> list:
    """Convert a datetime series to a list of ISO strings safe for JSON."""
    out = []
    for value in series:
        out.append(format_iso(value))
    return out
