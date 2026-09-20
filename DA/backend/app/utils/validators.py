"""Helpers for validating uploads and file handling."""
import os
import re
from pathlib import Path

ALLOWED_EXTENSIONS = {".xlsx", ".xls"}
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "50"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def is_allowed_filename(filename: str | None) -> bool:
    if not filename:
        return False
    suffix = Path(filename).suffix.lower()
    return suffix in ALLOWED_EXTENSIONS


def safe_filename(filename: str) -> str:
    """Sanitize an uploaded filename to a safe basename."""
    name = Path(filename or "workbook.xlsx").name
    name = re.sub(r"[^0-9A-Za-z._-]", "_", name)
    name = name.strip("._")
    if not name:
        name = "workbook.xlsx"
    return name[:120]


def validate_file_size(content_length: int | None) -> None:
    if content_length is None:
        return
    if content_length > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File exceeds the {MAX_FILE_SIZE_MB} MB size limit."
        )
