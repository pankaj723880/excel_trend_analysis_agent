import pandas as pd
from analyzer.trends import analyze_trends
from analyzer.excel_loader import _coerce_numeric_like_columns

def test_upward_trend():
    df = pd.DataFrame({"Revenue": [10, 20, 30, 40, 50, 60]})
    result = analyze_trends(df)
    assert not result.empty
    assert result.iloc[0]["trend_score"] > 20

def test_downward_trend():
    df = pd.DataFrame({"Revenue": [60, 50, 40, 30, 20, 10]})
    result = analyze_trends(df)
    assert result.iloc[0]["trend_score"] < -20


def test_coerce_numeric_like_columns():
    df = pd.DataFrame(
        {
            "Label": ["Title", "Meta", "Row 1", "Row 2", "Row 3"],
            "FY'09": ["in million USD", "", 10, 20, 30],
            "FY'10": ["header", "", 11, 21, 31],
        }
    )

    converted = _coerce_numeric_like_columns(df.copy(), threshold=0.5)

    assert pd.api.types.is_numeric_dtype(converted["FY'09"])
    assert pd.api.types.is_numeric_dtype(converted["FY'10"])
    assert not pd.api.types.is_numeric_dtype(converted["Label"])
