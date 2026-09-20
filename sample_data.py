import pandas as pd
import numpy as np

rng = np.random.default_rng(42)
months = pd.date_range("2025-01-01", periods=18, freq="MS")

revenue = 100000 + np.arange(18) * 6500 + rng.normal(0, 3500, 18)
profit = 15000 + np.arange(18) * 1000 + rng.normal(0, 1000, 18)
customers = 1200 + np.arange(18) * 55 + rng.normal(0, 30, 18)
returns = 180 - np.arange(18) * 3 + rng.normal(0, 12, 18)

sales = pd.DataFrame({
    "Month": months,
    "Revenue": revenue.round(2),
    "Profit": profit.round(2),
    "Customers": customers.round().astype(int),
    "Returns": returns.round().astype(int),
})

regions = pd.DataFrame({
    "Region": ["North", "South", "East", "West"],
    "Revenue": [320000, 280000, 190000, 240000],
    "Profit": [48000, 42000, 27000, 36000],
})

with pd.ExcelWriter("sample_business_data.xlsx", engine="openpyxl") as writer:
    sales.to_excel(writer, sheet_name="Monthly KPIs", index=False)
    regions.to_excel(writer, sheet_name="Regional Summary", index=False)

print("Created sample_business_data.xlsx")
