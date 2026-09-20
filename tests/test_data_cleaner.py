import pandas as pd

from analyzer.data_cleaner import clean_dataframe, clean_workbook


def test_clean_dataframe_normalizes_and_trims():
    df = pd.DataFrame(
        {
            " Revenue ": [" 10 ", "20", None, "20"],
            "Region Name": [" North ", "North", "", "North"],
            "Blank": [None, None, None, None],
        }
    )

    cleaned = clean_dataframe(df)

    assert list(cleaned.columns) == ["Revenue", "Region_Name", "Blank"]
    assert cleaned.iloc[0]["Revenue"] == "10"
    assert cleaned.iloc[1]["Revenue"] == "20"
    assert pd.isna(cleaned.iloc[2]["Revenue"])
    assert cleaned.iloc[3]["Revenue"] == "20"
    assert cleaned.shape == (4, 3)


def test_clean_workbook_returns_report():
    workbook = {
        "Sheet1": pd.DataFrame({"A": [1, 1, None], "B": [" x ", "x", None]}),
    }

    cleaned_workbook, report = clean_workbook(
        workbook,
        {
            "trim_text": True,
            "normalize_headers": True,
            "drop_empty_rows": True,
            "drop_empty_columns": True,
            "remove_duplicates": True,
            "coerce_numeric": True,
            "fill_strategy": "None",
        },
    )

    assert "Sheet1" in cleaned_workbook
    assert report.loc[0, "Rows after"] == report.loc[0, "Rows before"]
    assert report.loc[0, "Columns after"] == report.loc[0, "Columns before"]


def test_clean_dataframe_normalizes_dates_and_categories():
    df = pd.DataFrame(
        {
            "Order Date": ["2021-01-08 00:00:00", "2021-01-09 00:00:00"],
            "Region": [" south ", "EAST"],
            "Revenue": ["$39,002.58", "178,991.54"],
        }
    )

    cleaned = clean_dataframe(df)

    assert list(cleaned.columns) == ["Order_Date", "Region", "Revenue"]
    assert list(cleaned["Order_Date"]) == ["2021-01-08 00:00:00", "2021-01-09 00:00:00"]
    assert list(cleaned["Region"]) == ["south", "EAST"]
    assert list(cleaned["Revenue"]) == ["$39,002.58", "178,991.54"]