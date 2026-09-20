import pytest
import pandas as pd
from app.services.mis_mapping import auto_detect_mapping, get_effective_mapping
from app.services.mis_engine import (
    compute_mis_overview,
    compute_daily_mis,
    compute_sales_mis,
    compute_purchase_mis,
    compute_inventory_mis,
    compute_finance_mis,
    compute_target_vs_actual,
    compute_reconciliation,
    compute_data_validation,
    compute_exception_center,
)

def test_mis_mapping_and_engine():
    sales_df = pd.DataFrame({
        "Transaction Date": pd.date_range("2026-09-01", periods=10, freq="D"),
        "Revenue": [1000, 1200, 1100, 1500, 1300, 1400, 1600, 1700, 1800, 2000],
        "Region": ["North", "South", "East", "West", "North", "South", "East", "West", "North", "South"],
        "Salesperson": ["Alice", "Bob", "Charlie", "David", "Alice", "Bob", "Charlie", "David", "Alice", "Bob"],
        "Customer": ["CustA", "CustB", "CustC", "CustD", "CustA", "CustB", "CustC", "CustD", "CustA", "CustB"],
        "Quantity": [10, 12, 11, 15, 13, 14, 16, 17, 18, 20],
    })

    wb = {"Sales": sales_df}
    mapping = get_effective_mapping(wb)

    assert mapping["revenue"]["column"] == "Revenue"
    assert mapping["date"]["column"] == "Transaction Date"
    assert mapping["region"]["column"] == "Region"

    overview = compute_mis_overview(wb, mapping, {}, [])
    assert overview["kpis"][0]["title"] == "Revenue"
    assert overview["kpis"][0]["value"] == 14600.0

    daily = compute_daily_mis(wb, mapping, None, {})
    assert daily["available"] is True

    sales = compute_sales_mis(wb, mapping, {})
    assert sales["available"] is True
    assert sales["kpis"]["total_revenue"] == 14600.0

    purchase = compute_purchase_mis(wb, mapping, {})
    assert purchase["available"] is False

    inventory = compute_inventory_mis(wb, mapping, {})
    assert inventory["available"] is True

    finance = compute_finance_mis(wb, mapping, {})
    assert finance["available"] is True
    assert finance["financials"]["revenue"] == 14600.0

    target = compute_target_vs_actual(wb, mapping, {})
    assert target["available"] is True

    recon = compute_reconciliation(wb, "Sales", "Sales", "Transaction Date", "Revenue")
    assert recon["available"] is True
    assert recon["summary"]["status"] == "Matched"

    validation = compute_data_validation(wb, mapping)
    assert validation["quality_score"] == 100

    exceptions = compute_exception_center(wb, mapping, {})
    assert len(exceptions) > 0
