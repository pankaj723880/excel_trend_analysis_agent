import re

import pandas as pd


def _normalize_column_name(name):
    text = str(name).strip()
    text = re.sub(r"[\s\-\/]+", "_", text)
    text = re.sub(r"[^0-9A-Za-z_]+", "", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "column"


def _coerce_numeric_like_columns(df, threshold=0.6):
    cleaned = df.copy()

    for column in cleaned.columns:
        if pd.api.types.is_numeric_dtype(cleaned[column]):
            continue

        coerced = pd.to_numeric(cleaned[column], errors="coerce")
        valid_values = int(coerced.notna().sum())

        if valid_values and (valid_values / len(cleaned[column])) >= threshold:
            cleaned[column] = coerced

    return cleaned


def _extract_currency_like_values(series):
    text = series.astype("string")
    extracted = text.str.replace(r"[,$€£₹]", "", regex=True)
    extracted = extracted.str.replace(r"\s+", "", regex=True)
    return pd.to_numeric(extracted, errors="coerce")


def clean_dataframe(
    df,
    trim_text=True,
    normalize_headers=True,
    drop_empty_rows=False,
    drop_empty_columns=False,
    remove_duplicates=False,
    coerce_numeric=False,
    fill_strategy="none",
    preserve_shape=True,
    **_ignored,
):
    cleaned = df.copy()

    if trim_text:
        object_columns = [
            column
            for column in cleaned.columns
            if pd.api.types.is_object_dtype(cleaned[column]) or pd.api.types.is_string_dtype(cleaned[column])
        ]
        for column in object_columns:
            cleaned[column] = cleaned[column].apply(
                lambda value: value.strip() if isinstance(value, str) else value
            )
            cleaned[column] = cleaned[column].replace("", pd.NA)

    if normalize_headers:
        cleaned.columns = [_normalize_column_name(column) for column in cleaned.columns]

    if drop_empty_rows and not preserve_shape:
        cleaned = cleaned.dropna(how="all")

    if drop_empty_columns and not preserve_shape:
        cleaned = cleaned.dropna(axis=1, how="all")

    if remove_duplicates and not preserve_shape:
        cleaned = cleaned.drop_duplicates()

    if coerce_numeric:
        cleaned = _coerce_numeric_like_columns(cleaned)

    if coerce_numeric:
        for column in cleaned.columns:
            if pd.api.types.is_object_dtype(cleaned[column]) or pd.api.types.is_string_dtype(cleaned[column]):
                numeric_candidate = _extract_currency_like_values(cleaned[column])
                valid_values = int(numeric_candidate.notna().sum())
                if valid_values and (valid_values / len(cleaned[column])) >= 0.6:
                    cleaned[column] = numeric_candidate

    fill_strategy = (fill_strategy or "none").lower()
    if fill_strategy == "forward fill":
        cleaned = cleaned.ffill()
    elif fill_strategy == "backward fill":
        cleaned = cleaned.bfill()
    elif fill_strategy == "zero":
        numeric_columns = cleaned.select_dtypes(include="number").columns
        cleaned[numeric_columns] = cleaned[numeric_columns].fillna(0)
    elif fill_strategy == "median":
        numeric_columns = cleaned.select_dtypes(include="number").columns
        for column in numeric_columns:
            cleaned[column] = cleaned[column].fillna(cleaned[column].median())
    elif fill_strategy == "mode":
        for column in cleaned.columns:
            if cleaned[column].isna().any():
                mode = cleaned[column].mode(dropna=True)
                if not mode.empty:
                    cleaned[column] = cleaned[column].fillna(mode.iloc[0])

    if preserve_shape:
        cleaned = cleaned.reindex(index=df.index, columns=cleaned.columns)

    return cleaned


def clean_workbook(workbook, options):
    cleaned_workbook = {}
    report = []

    for sheet_name, df in workbook.items():
        cleaned_df = clean_dataframe(df, **options)
        cleaned_workbook[sheet_name] = cleaned_df
        report.append(
            {
                "Sheet": sheet_name,
                "Rows before": len(df),
                "Rows after": len(cleaned_df),
                "Columns before": len(df.columns),
                "Columns after": len(cleaned_df.columns),
                "Missing before": int(df.isna().sum().sum()),
                "Missing after": int(cleaned_df.isna().sum().sum()),
                "Duplicates removed": int(df.duplicated().sum() - cleaned_df.duplicated().sum()),
                "Cells changed": int(df.astype("string").ne(cleaned_df.reindex_like(df).astype("string")).sum().sum()) if df.shape == cleaned_df.reindex_like(df).shape else 0,
            }
        )

    return cleaned_workbook, pd.DataFrame(report)