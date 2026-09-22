"""Unit and integration tests for the Dynamic Dashboard Visual Builder."""
import pytest
import pandas as pd
import numpy as np

from app.services.visual_engine import (
    detect_column_metadata,
    apply_visual_filters,
    execute_visual_query,
)

@pytest.fixture
def sample_sales_df():
    return pd.DataFrame({
        "order_date": pd.date_range("2026-01-01", periods=12, freq="ME"),
        "region": ["North", "South", "East", "West"] * 3,
        "revenue": [100.0, 150.0, 200.0, 120.0, 180.0, 210.0, 250.0, 190.0, 220.0, 280.0, 300.0, 260.0],
        "profit": [20.0, 30.0, 45.0, 15.0, 40.0, 50.0, 60.0, 35.0, 55.0, 70.0, 80.0, 65.0],
        "units": [10, 15, 20, 12, 18, 21, 25, 19, 22, 28, 30, 26],
    })

@pytest.fixture
def non_numeric_df():
    return pd.DataFrame({
        "department": ["Engineering", "Product", "Design", "Marketing", "Engineering"],
        "employee": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "status": ["Active", "Active", "Leave", "Active", "Active"],
    })


def test_detect_column_metadata(sample_sales_df):
    meta = detect_column_metadata(sample_sales_df)
    assert len(meta) == 5
    col_map = {m["column_name"]: m for m in meta}
    
    assert col_map["revenue"]["numeric"] is True
    assert col_map["region"]["categorical"] is True
    assert col_map["region"]["geographic"] is True  # Region keyword matches geo heuristic
    assert col_map["order_date"]["datetime"] is True


def test_bar_chart_aggregation(sample_sales_df):
    config = {
        "category": "region",
        "measure": "revenue",
        "aggregation": "sum",
        "sort": "desc",
    }
    result = execute_visual_query(sample_sales_df, "bar", config)
    assert "error" not in result
    assert result["visual_type"] == "bar"
    assert len(result["data"]) == 4
    # All 4 regions summed
    assert sum(d["value"] for d in result["data"]) == pytest.approx(sample_sales_df["revenue"].sum())


def test_count_based_bar_on_non_numeric_df(non_numeric_df):
    config = {
        "category": "department",
        "aggregation": "count",
    }
    result = execute_visual_query(non_numeric_df, "column", config)
    assert "error" not in result
    assert result["visual_type"] == "column"
    eng = next(d for d in result["data"] if d["category"] == "Engineering")
    assert eng["value"] == 2.0


def test_line_chart_with_date_grain(sample_sales_df):
    config = {
        "x": "order_date",
        "y": "revenue",
        "aggregation": "sum",
        "time_grain": "month",
    }
    result = execute_visual_query(sample_sales_df, "line", config)
    assert "error" not in result
    assert result["visual_type"] == "line"
    assert len(result["data"]) == 12


def test_combo_chart(sample_sales_df):
    config = {
        "x": "region",
        "primary_metric": "revenue",
        "secondary_metric": "profit",
        "primary_agg": "sum",
        "secondary_agg": "avg",
    }
    result = execute_visual_query(sample_sales_df, "combo", config)
    assert "error" not in result
    assert result["visual_type"] == "combo"
    assert "primary" in result["data"][0]
    assert "secondary" in result["data"][0]


def test_scatter_and_histogram(sample_sales_df):
    scatter_res = execute_visual_query(sample_sales_df, "scatter", {"x": "revenue", "y": "profit"})
    assert "error" not in scatter_res
    assert len(scatter_res["data"]) == 12

    hist_res = execute_visual_query(sample_sales_df, "histogram", {"metric": "revenue", "bins": 5})
    assert "error" not in hist_res
    assert len(hist_res["data"]) == 5


def test_filters(sample_sales_df):
    filters = [{"column": "region", "operator": "equals", "value": "North"}]
    config = {"category": "region", "measure": "revenue", "aggregation": "sum"}
    result = execute_visual_query(sample_sales_df, "bar", config, filters)
    assert len(result["data"]) == 1
    assert result["data"][0]["category"] == "North"
