"""Excel loading with robust dirty-data handling.

Handles:
- report titles / preamble rows above the header
- blank leading rows
- messy / duplicate headers
- blank rows inside the table
- workbook with a first row that is not the table header

The original file is only ever read - never modified.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable

import pandas as pd
from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

from app.utils.numbers import coerce_numeric_columns


def _iter_rows(sheet: Worksheet) -> Iterable[tuple]:
    """Yield non-empty tuples of cell values from a worksheet."""
    for row in sheet.iter_rows(values_only=True):
        if any(cell is not None and cell != "" for cell in row):
            yield row


def _guess_header_row(rows: list[tuple]) -> int:
    """Find the best header row.

    Heuristic: the row with the most unique, non-numeric, non-empty values.
    Prefers rows containing text labels (looking like column names) over
    data-like rows.
    """
    best_index = 0
    best_score = -1
    for index, row in enumerate(rows):
        unique_text = set()
        numeric_count = 0
        for cell in row:
            if cell is None:
                continue
            if isinstance(cell, (int, float)) and not isinstance(cell, bool):
                numeric_count += 1
                continue
            if isinstance(cell, (pd.Timestamp,)):
                numeric_count += 1
                continue
            text = str(cell).strip().lower()
            if text and text not in ("nan", "none"):
                unique_text.add(text)

        # Header rows usually have many text labels and few numbers
        score = len(unique_text) - numeric_count * 0.5
        # Strong bias toward the first informative row
        if score > best_score:
            best_score = score
            best_index = index

    return best_index


def _clean_column_names(columns) -> list[str]:
    """De-duplicate and sanitize column names."""
    used = {}
    clean = []
    for col in columns:
        label = str(col).strip() if col is not None else ""
        label = label.replace("\n", " ")
        if not label:
            label = "Unnamed"
        base = label
        count = used.get(base, 0)
        used[base] = count + 1
        if count > 0:
            label = f"{base} ({count + 1})"
        clean.append(label)
    return clean


def _sheet_to_dataframe(sheet: Worksheet) -> pd.DataFrame | None:
    rows = list(_iter_rows(sheet))

    if not rows:
        return None

    # Single-row sheet - treat as a notes sheet (one text row)
    if len(rows) < 2:
        values = [list(row) for row in rows]
        max_len = max(len(row) for row in rows)
        padded = [row + [None] * (max_len - len(row)) for row in values]
        return pd.DataFrame(padded)

    header_index = _guess_header_row(rows)
    header = rows.pop(header_index)

    values = []
    for row in rows:
        if len(row) < len(header):
            row = list(row) + [None] * (len(header) - len(row))
        values.append(list(row[: len(header)]))

    df = pd.DataFrame(values, columns=_clean_column_names(header))

    # Drop fully-empty rows and fully-empty columns (they carry no signal)
    df = df.dropna(how="all").dropna(axis=1, how="all")

    # Coerce numeric-like text columns (currency, percentages, plain numbers)
    df = coerce_numeric_columns(df)
    return df.reset_index(drop=True)


def load_workbook_data(path_or_file, data_only: bool = True) -> dict[str, pd.DataFrame]:
    """Load a workbook into a dict of sheet_name -> DataFrame.

    Accepts a file path (str/Path) or a file-like object. For file-like
    objects and legacy .xls files, falls back to pandas ExcelFile.
    """
    # Prefer openpyxl for .xlsx so we can do smart header detection.
    is_path = isinstance(path_or_file, (str, Path))
    suffix = Path(str(path_or_file)).suffix.lower() if is_path else ""

    if is_path and suffix in (".xlsx", ".xlsm"):
        workbook = load_workbook(filename=path_or_file, data_only=data_only, read_only=False)
        sheets: dict[str, pd.DataFrame] = {}
        for worksheet in workbook.worksheets:
            sheet_name = str(worksheet.title)
            try:
                df = _sheet_to_dataframe(worksheet)
                if df is not None and not df.empty:
                    sheets[sheet_name] = df
            except Exception as exc:
                sheets[sheet_name] = pd.DataFrame(columns=["__error__"])
                sheets[sheet_name].attrs["load_error"] = str(exc)
        workbook.close()
        return sheets

    # Fallback: pandas ExcelFile (handles file-like objects and .xls)
    xls = pd.ExcelFile(path_or_file)
    sheets = {}
    for raw_sheet_name in xls.sheet_names:
        sheet_name = str(raw_sheet_name)
        try:
            df = pd.read_excel(xls, sheet_name=sheet_name)
            df = df.dropna(how="all").dropna(axis=1, how="all")
            df = coerce_numeric_columns(df)
            sheets[sheet_name] = df.reset_index(drop=True)
        except Exception as exc:
            sheets[sheet_name] = pd.DataFrame(columns=["__error__"])
            sheets[sheet_name].attrs["load_error"] = str(exc)
    return sheets
