"""Pydantic request/response schemas for the API."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    workbook_id: str


class SheetSelectionRequest(BaseModel):
    workbook_id: str
    sheet_name: str


class CleanRequest(BaseModel):
    workbook_id: str
    sheet_name: Optional[str] = None
    trim_text: bool = True
    standardize_headers: bool = True
    remove_empty_rows: bool = False
    remove_empty_columns: bool = False
    remove_duplicates: bool = False
    coerce_numeric: bool = True
    fill_missing: str = "none"  # none | zero | mean | median | mode | forward | backward
    standardize_categories: bool = False
    standardize_dates: bool = False
    remove_outliers: bool = False
    clean_domain_anomalies: bool = False


class AskRequest(BaseModel):
    workbook_id: str
    question: str


class AISummaryRequest(BaseModel):
    workbook_id: str


class MetricChartRequest(BaseModel):
    workbook_id: str
    sheet_name: str
    metric: Optional[str] = None


class CleanedChartRequest(BaseModel):
    workbook_id: str
    sheet_name: str
    metric: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
