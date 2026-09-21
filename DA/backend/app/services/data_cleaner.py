"""Cleaning service. ALWAYS operates on a copy - the original workbook is
never modified. The user must explicitly request cleaning."""
from __future__ import annotations

import re

import pandas as pd

from app.utils.dates import try_parse_date_series
from app.utils.numbers import parse_numeric_text


def _normalize_column_name(name) -> str:
    text = str(name).strip()
    text = text.replace("\n", " ").strip()
    text = re.sub(r"[\s\-\/]+", "_", text)
    text = re.sub(r"[^0-9A-Za-z_]+", "", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "column"


def _dedupe_column_names(columns: list[str]) -> list[str]:
    used = {}
    clean = []
    for label in columns:
        base = label
        count = used.get(base, 0)
        used[base] = count + 1
        if count > 0:
            label = f"{base}_{count + 1}"
        clean.append(label)
    return clean


def _coerce_numeric_like_columns(df: pd.DataFrame, threshold: float = 0.6) -> pd.DataFrame:
    cleaned = df.copy()
    for column in cleaned.columns:
        if pd.api.types.is_numeric_dtype(cleaned[column]):
            continue
        converted = parse_numeric_text(cleaned[column])
        valid_fraction = converted.notna().mean() if len(converted) else 0.0
        if valid_fraction >= threshold:
            cleaned[column] = converted
    return cleaned


def clean_dataframe(
    df: pd.DataFrame,
    trim_text: bool = True,
    standardize_headers: bool = True,
    remove_empty_rows: bool = False,
    remove_empty_columns: bool = False,
    remove_duplicates: bool = False,
    coerce_numeric: bool = True,
    fill_missing: str = "none",  # none | zero | mean | median | mode | forward | backward
    standardize_categories: bool = False,
    standardize_dates: bool = False,
    remove_outliers: bool = False,
    clean_domain_anomalies: bool = False,
    **_ignored,
) -> pd.DataFrame:
    """Clean a COPY of the dataframe with the requested operations."""
    cleaned = df.copy()

    if trim_text:
        object_columns = [
            column
            for column in cleaned.columns
            if pd.api.types.is_object_dtype(cleaned[column])
            or pd.api.types.is_string_dtype(cleaned[column])
        ]
        for column in object_columns:
            cleaned[column] = cleaned[column].apply(
                lambda value: value.strip() if isinstance(value, str) else value
            )
            cleaned[column] = cleaned[column].replace("", pd.NA)

    if standardize_headers:
        cleaned.columns = _dedupe_column_names(
            [_normalize_column_name(column) for column in cleaned.columns]
        )

    if remove_empty_rows:
        cleaned = cleaned.dropna(how="all")

    if remove_empty_columns:
        cleaned = cleaned.dropna(axis=1, how="all")

    if remove_duplicates:
        cleaned = cleaned.drop_duplicates()

    if coerce_numeric:
        cleaned = _coerce_numeric_like_columns(cleaned)

    if standardize_dates:
        for column in cleaned.columns:
            if pd.api.types.is_object_dtype(cleaned[column]) or pd.api.types.is_string_dtype(cleaned[column]):
                parsed = try_parse_date_series(cleaned[column])
                if parsed.notna().mean() >= 0.7:
                    cleaned[column] = parsed

    if standardize_categories:
        for column in cleaned.columns:
            if pd.api.types.is_object_dtype(cleaned[column]) or pd.api.types.is_string_dtype(cleaned[column]):
                cleaned[column] = cleaned[column].astype("string").str.strip().str.title()

    strategy = (fill_missing or "none").lower()
    numeric_columns = cleaned.select_dtypes(include="number").columns

    if strategy == "recommend":
        # Context-aware recommendation: median if skewed or has outliers, else mean
        for column in numeric_columns:
            s = cleaned[column].dropna()
            if len(s) >= 4 and abs(s.skew()) > 1.0:
                cleaned[column] = cleaned[column].fillna(s.median())
            else:
                cleaned[column] = cleaned[column].fillna(s.mean() if len(s) else 0)
    elif strategy in ("forward", "ffill"):
        cleaned = cleaned.ffill()
    elif strategy in ("backward", "bfill"):
        cleaned = cleaned.bfill()
    elif strategy == "zero":
        cleaned[numeric_columns] = cleaned[numeric_columns].fillna(0)
    elif strategy == "mean":
        for column in numeric_columns:
            cleaned[column] = cleaned[column].fillna(cleaned[column].mean())
    elif strategy == "median":
        for column in numeric_columns:
            cleaned[column] = cleaned[column].fillna(cleaned[column].median())
    elif strategy == "mode":
        for column in cleaned.columns:
            if cleaned[column].isna().any():
                mode = cleaned[column].mode(dropna=True)
                if not mode.empty:
                    cleaned[column] = cleaned[column].fillna(mode.iloc[0])

    if remove_outliers:
        # Replace extreme IQR & Z-score outliers with column median
        for column in numeric_columns:
            series = cleaned[column].dropna()
            if len(series) < 4:
                continue
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            med = series.median()
            cleaned[column] = cleaned[column].astype(float)
            cleaned.loc[(cleaned[column] < lower) | (cleaned[column] > upper), column] = med

    if clean_domain_anomalies:
        # Fix detected domain violations using DomainValidator (never clip profit or financial balances)
        from app.services.validation import DomainValidator
        val_audit = DomainValidator.validate_sheet(cleaned)
        for v in val_audit.get("violations", []):
            col = v.get("column")
            row_idx = v.get("row_index")
            rule = v.get("rule")
            if col in cleaned.columns and row_idx in cleaned.index:
                if rule in ("non_negative_count", "non_negative_price"):
                    # Discrete counts and unit prices cannot be negative: set to NaN or 0 if count
                    cleaned.loc[row_idx, col] = 0
                elif rule == "percentage_range":
                    # Cap percentage within valid [0, 100]
                    val = float(cleaned.loc[row_idx, col])
                    cleaned.loc[row_idx, col] = max(0.0, min(100.0, val))

    return cleaned.reset_index(drop=True)


def clean_workbook(workbook, options: dict) -> tuple[dict, pd.DataFrame]:
    """Clean every sheet, returning (cleaned_workbook, report)."""
    cleaned_workbook = {}
    report = []

    for sheet_name, df in workbook.items():
        if "__error__" in df.columns:
            cleaned_workbook[sheet_name] = df
            report.append(
                {
                    "Sheet": sheet_name,
                    "Rows before": 0,
                    "Rows after": 0,
                    "Columns before": 0,
                    "Columns after": 0,
                    "Missing before": 0,
                    "Missing after": 0,
                    "Duplicates removed": 0,
                    "Cells changed": 0,
                    "Error": str(df.attrs.get("load_error", "Sheet could not be read")),
                }
            )
            continue

        before = df
        after = clean_dataframe(df, **options)

        rows_before = len(before)
        rows_after = len(after)
        rows_dropped = max(0, rows_before - rows_after)
        cols_before = len(before.columns)
        cols_after = len(after.columns)
        missing_before = int(before.isna().sum().sum())
        missing_after = int(after.isna().sum().sum())
        missing_filled = max(0, missing_before - missing_after)
        duplicates_removed = int(max(0, before.duplicated().sum() - after.duplicated().sum()))
        cells_changed = int(_count_cell_changes(before, after))

        cleaned_workbook[sheet_name] = after
        report.append(
            {
                "Sheet": sheet_name,
                "sheet": sheet_name,
                "Rows before": rows_before,
                "Rows after": rows_after,
                "rows_before": rows_before,
                "rows_after": rows_after,
                "rows_dropped": rows_dropped,
                "input_rows": rows_before,
                "output_rows": rows_after,
                "Columns before": cols_before,
                "Columns after": cols_after,
                "columns_before": cols_before,
                "columns_after": cols_after,
                "columns_renamed": int(sum(1 for a, b in zip(before.columns, after.columns) if str(a) != str(b))),
                "Missing before": missing_before,
                "Missing after": missing_after,
                "missing_before": missing_before,
                "missing_after": missing_after,
                "missing_filled": missing_filled,
                "missing_values_filled": missing_filled,
                "Duplicates removed": duplicates_removed,
                "duplicates_removed": duplicates_removed,
                "Cells changed": cells_changed,
                "cells_changed": cells_changed,
                "Error": None,
            }
        )

    return cleaned_workbook, pd.DataFrame(report)


def _count_cell_changes(before: pd.DataFrame, after: pd.DataFrame) -> int:
    try:
        common_rows = min(len(before), len(after))
        if common_rows == 0:
            return 0
        a = before.iloc[:common_rows].astype("string").fillna("")
        b = after.iloc[:common_rows].astype("string").fillna("")
        shared = [col for col in a.columns if col in b.columns]
        if not shared:
            return 0
        return int((a[shared] != b[shared]).sum().sum())
    except Exception:
        return 0
