"""Data Normalization Layer with Non-Destructive Transformation Audit.

Preserves the original uploaded data intact. Creates a normalized working copy
for statistical engines with an audit log of every detected and applied transformation.
"""
from __future__ import annotations

import re
from typing import Any
import numpy as np
import pandas as pd

from app.utils.dates import try_parse_date_series
from app.utils.numbers import parse_numeric_text


def normalize_column_name(name: Any) -> str:
    """Standardize column names for internal clean referencing without losing original display label."""
    text = str(name).strip()
    text = text.replace("\n", " ").strip()
    text = re.sub(r"[\s\-\/\.]+", "_", text)
    text = re.sub(r"[^0-9A-Za-z_]+", "", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "column"


def deduplicate_column_names(columns: list[str]) -> list[str]:
    """Ensure all column names are unique by appending numeric suffixes where needed."""
    used: dict[str, int] = {}
    clean: list[str] = []
    for label in columns:
        base = label or "column"
        count = used.get(base, 0)
        used[base] = count + 1
        if count > 0:
            clean.append(f"{base}_{count + 1}")
        else:
            clean.append(base)
    return clean


class DataNormalizer:
    """Normalizes DataFrames safely while recording an audit log of all transformations."""

    @classmethod
    def normalize_dataframe(
        cls,
        df: pd.DataFrame,
        confidence_threshold: float = 0.70,
    ) -> tuple[pd.DataFrame, list[dict[str, Any]], dict[str, str]]:
        """Safely normalize a DataFrame.

        Returns:
            normalized_df: copy of df with normalized columns and values
            transformations: list of applied transformation records
            column_mapping: mapping of normalized_name -> original_name
        """
        if df.empty or "__error__" in df.columns:
            return df.copy(), [], {str(c): str(c) for c in df.columns}

        normalized = df.copy()
        transformations: list[dict[str, Any]] = []

        # 1. Map and preserve original column names
        original_cols = [str(c) for c in df.columns]
        norm_cols = deduplicate_column_names([normalize_column_name(c) for c in original_cols])
        col_mapping = dict(zip(norm_cols, original_cols))
        normalized.columns = norm_cols

        # 2. Per-column inspections & safe transformations
        for norm_col, orig_col in col_mapping.items():
            series = normalized[norm_col]
            non_null = series.dropna()
            if non_null.empty:
                continue

            orig_dtype_str = str(series.dtype)

            # A. If object/string: clean whitespace first
            if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
                cleaned_str = series.apply(lambda v: v.strip() if isinstance(v, str) else v)
                # Count whitespace fixes
                if (cleaned_str != series).any():
                    transformations.append({
                        "column": orig_col,
                        "normalized_column": norm_col,
                        "type": "whitespace_trim",
                        "description": "Trimmed leading and trailing whitespace",
                        "affected_rows": int((cleaned_str != series).sum()),
                    })
                series = cleaned_str
                normalized[norm_col] = series
                non_null = series.dropna()

            # B. Identifier Protection Check:
            # If string values have leading zeros (e.g., "00123", "0456"), DO NOT coerce to float/int!
            sample_str = non_null.astype(str).head(50)
            has_leading_zeros = sample_str.str.match(r"^0\d+$").any()
            if has_leading_zeros:
                transformations.append({
                    "column": orig_col,
                    "normalized_column": norm_col,
                    "type": "preserve_identifier",
                    "description": "Preserved leading zeros in alphanumeric/numeric identifier",
                    "affected_rows": len(non_null),
                })
                continue

            # C. Date parsing check for non-datetime columns (guard numeric series from accidental epoch coercion)
            if not pd.api.types.is_datetime64_any_dtype(series):
                is_num = pd.api.types.is_numeric_dtype(series)
                name_hints_date = any(k in orig_col.lower() for k in ["date", "time", "day", "month", "year", "quarter", "period", "created", "updated"])
                if not is_num or name_hints_date:
                    parsed_dates = try_parse_date_series(series)
                    valid_date_ratio = float(parsed_dates.notna().mean()) if len(parsed_dates) else 0.0

                    if valid_date_ratio >= confidence_threshold:
                        normalized[norm_col] = parsed_dates
                        transformations.append({
                            "column": orig_col,
                            "normalized_column": norm_col,
                            "type": "date_coercion",
                            "original_dtype": orig_dtype_str,
                            "new_dtype": "datetime64[ns]",
                            "confidence": round(valid_date_ratio, 2),
                            "description": f"Successfully parsed date strings ({valid_date_ratio:.0%} parseable)",
                        })
                        continue

            # D. Numeric parsing check for string columns (currency, percent, formatted numbers)
            if not pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_datetime64_any_dtype(series):
                parsed_num = parse_numeric_text(series)
                valid_num_ratio = float(parsed_num.notna().mean()) if len(parsed_num) else 0.0

                if valid_num_ratio >= confidence_threshold:
                    normalized[norm_col] = parsed_num
                    transformations.append({
                        "column": orig_col,
                        "normalized_column": norm_col,
                        "type": "numeric_coercion",
                        "original_dtype": orig_dtype_str,
                        "new_dtype": "float64",
                        "confidence": round(valid_num_ratio, 2),
                        "description": f"Coerced formatted numeric/currency strings ({valid_num_ratio:.0%} parseable)",
                    })
                    continue

        return normalized, transformations, col_mapping


def normalize_dataset(
    df: pd.DataFrame,
    confidence_threshold: float = 0.70,
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Convenience functional wrapper for DataNormalizer.normalize_dataframe."""
    norm_df, transformations, _ = DataNormalizer.normalize_dataframe(df, confidence_threshold=confidence_threshold)
    return norm_df, transformations
