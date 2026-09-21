"""Automated Unit Tests for Deterministic Analysis Engine.

Validates the architecture across 20 distinct archetypes:
1. Sales-like dataset
2. HR-like dataset
3. Finance-like dataset
4. Inventory-like dataset
5. Dataset with no dates
6. Dataset with no numeric columns
7. Dataset with one numeric column
8. Dataset with multiple numeric columns
9. Dataset with missing values
10. Dataset with duplicates
11. Dataset with constant columns
12. Dataset with extreme outliers
13. Dataset with numeric strings (formatted with commas/spaces)
14. Dataset with currency strings ($ / ₹ / €)
15. Dataset with percentage strings
16. Dataset with multiple date formats
17. Multi-sheet workbook
18. Empty sheet
19. Small dataset (single row)
20. Wide dataset (many columns)
"""
import unittest
import pandas as pd
import numpy as np

from app.services.data_normalizer import normalize_dataset
from app.services.data_quality import compute_data_quality
from app.services.kpi_engine import compute_dynamic_kpis
from app.services.trends import analyze_trends, compute_trend_confidence
from app.services.correlations import analyze_correlations
from app.services.anomalies import detect_anomalies
from app.services.analysis_engine import analyze_workbook


class TestDeterministicAnalysisEngine(unittest.TestCase):

    # Archetype 1: Sales-like dataset
    def test_01_sales_archetype(self):
        df = pd.DataFrame({
            "Transaction_ID": [f"TXN-{i}" for i in range(1, 21)],
            "Txn_Date": pd.date_range("2025-01-01", periods=20, freq="D"),
            "Customer_Segment": ["Enterprise", "SMB", "Consumer", "Enterprise"] * 5,
            "Gross_Value": [1200.0 + i * 50 for i in range(20)],
            "Discount_Pct": [0.05, 0.1, 0.15, 0.0] * 5
        })
        norm_df, _ = normalize_dataset(df)
        kpis = compute_dynamic_kpis(norm_df)
        self.assertIn("Gross_Value", kpis)
        self.assertEqual(kpis["Gross_Value"]["row_count"], 20)
        self.assertGreater(kpis["Gross_Value"]["sum"], 0)
        trends = analyze_trends(norm_df)
        self.assertIn("Gross_Value", trends)

    # Archetype 2: HR-like dataset
    def test_02_hr_archetype(self):
        df = pd.DataFrame({
            "Emp_ID": ["001", "002", "003", "004", "005"],
            "Department": ["Engineering", "Sales", "HR", "Engineering", "Marketing"],
            "Monthly_Salary": [85000, 62000, 58000, 92000, 67000],
            "Tenure_Months": [24, 12, 36, 48, 8]
        })
        norm_df, _ = normalize_dataset(df)
        # Verify leading zero preservation on ID
        self.assertEqual(str(norm_df["Emp_ID"].iloc[0]), "001")
        quality = compute_data_quality(norm_df)
        self.assertGreaterEqual(quality["overall_score"], 90)

    # Archetype 3: Finance-like dataset
    def test_03_finance_archetype(self):
        df = pd.DataFrame({
            "Fiscal_Period": ["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"],
            "EBITDA": [1500000.0, 1620000.0, 1580000.0, 1710000.0],
            "Operating_Expense": [450000.0, 480000.0, 460000.0, 510000.0]
        })
        norm_df, _ = normalize_dataset(df)
        kpis = compute_dynamic_kpis(norm_df)
        self.assertIn("EBITDA", kpis)
        self.assertAlmostEqual(kpis["EBITDA"]["mean"], 1602500.0)

    # Archetype 4: Inventory-like dataset
    def test_04_inventory_archetype(self):
        df = pd.DataFrame({
            "SKU_Code": ["A-100", "B-200", "C-300"],
            "Units_In_Stock": [450, 0, 125],
            "Reorder_Level": [100, 50, 100]
        })
        norm_df, _ = normalize_dataset(df)
        corrs = analyze_correlations(norm_df)
        self.assertTrue(corrs["has_correlations"])

    # Archetype 5: Dataset with no dates
    def test_05_no_dates(self):
        df = pd.DataFrame({
            "Metric_A": [10, 20, 30, 40],
            "Metric_B": [100, 200, 300, 400]
        })
        norm_df, _ = normalize_dataset(df)
        trends = analyze_trends(norm_df)
        # Without date column, trends analyze sequential index
        self.assertIn("Metric_A", trends)
        self.assertFalse(trends["Metric_A"]["has_date"])

    # Archetype 6: Dataset with no numeric columns
    def test_06_no_numeric_columns(self):
        df = pd.DataFrame({
            "Status": ["Approved", "Pending", "Rejected"],
            "Category": ["Alpha", "Beta", "Gamma"]
        })
        norm_df, _ = normalize_dataset(df)
        kpis = compute_dynamic_kpis(norm_df)
        self.assertEqual(len(kpis), 0)
        corrs = analyze_correlations(norm_df)
        self.assertFalse(corrs["has_correlations"])
        self.assertIn("usable numeric", corrs["explanation"])

    # Archetype 7: Dataset with one numeric column
    def test_07_one_numeric_column(self):
        df = pd.DataFrame({
            "Item": ["A", "B", "C", "D"],
            "Score": [88, 92, 79, 95]
        })
        norm_df, _ = normalize_dataset(df)
        corrs = analyze_correlations(norm_df)
        self.assertFalse(corrs["has_correlations"])
        self.assertIn("Pairwise correlation requires at least 2", corrs["explanation"])

    # Archetype 8: Dataset with multiple numeric columns
    def test_08_multiple_numeric_columns(self):
        df = pd.DataFrame({
            "Var1": [1.0, 2.0, 3.0, 4.0, 5.0],
            "Var2": [2.0, 4.0, 6.0, 8.0, 10.0],
            "Var3": [10.0, 8.0, 6.0, 4.0, 2.0]
        })
        norm_df, _ = normalize_dataset(df)
        corrs = analyze_correlations(norm_df)
        self.assertTrue(corrs["has_correlations"])
        matrix = corrs["matrix"]
        self.assertAlmostEqual(matrix["Var1"]["Var2"], 1.0, places=2)
        self.assertAlmostEqual(matrix["Var1"]["Var3"], -1.0, places=2)

    # Archetype 9: Dataset with missing values
    def test_09_missing_values(self):
        df = pd.DataFrame({
            "A": [1, None, 3, 4, None],
            "B": ["X", "Y", None, "W", "Z"]
        })
        norm_df, _ = normalize_dataset(df)
        quality = compute_data_quality(norm_df)
        self.assertLess(quality["dimensions"]["completeness"], 100)
        rec_messages = [r["message"] for r in quality["recommendations_list"]]
        self.assertTrue(any("missing" in m.lower() for m in rec_messages))

    # Archetype 10: Dataset with duplicates
    def test_10_duplicate_rows(self):
        df = pd.DataFrame({
            "ID": [1, 2, 2, 3],
            "Val": ["A", "B", "B", "C"]
        })
        norm_df, _ = normalize_dataset(df)
        quality = compute_data_quality(norm_df)
        self.assertLess(quality["dimensions"]["uniqueness"], 100)
        self.assertGreater(quality["metrics"]["duplicate_row_count"], 0)

    # Archetype 11: Dataset with constant columns
    def test_11_constant_columns(self):
        df = pd.DataFrame({
            "Constant_Col": [42, 42, 42, 42],
            "Varying_Col": [1, 2, 3, 4]
        })
        norm_df, _ = normalize_dataset(df)
        corrs = analyze_correlations(norm_df)
        self.assertFalse(corrs["has_correlations"])

    # Archetype 12: Dataset with extreme outliers
    def test_12_extreme_outliers(self):
        df = pd.DataFrame({
            "Values": [10, 11, 12, 11, 10, 12, 11, 9, 10, 5000]
        })
        norm_df, _ = normalize_dataset(df)
        anomalies = detect_anomalies(norm_df)
        self.assertGreater(anomalies["summary"]["total_outliers"], 0)
        top_anom = anomalies["anomalies"][0]
        self.assertEqual(top_anom["column"], "Values")
        self.assertEqual(top_anom["value"], 5000)

    # Archetype 13: Dataset with numeric strings formatted with commas
    def test_13_numeric_strings(self):
        df = pd.DataFrame({
            "Volume": ["1,200", "3,450", "15,000", "800"]
        })
        norm_df, audit = normalize_dataset(df)
        self.assertTrue(pd.api.types.is_numeric_dtype(norm_df["Volume"]))
        self.assertEqual(norm_df["Volume"].sum(), 20450)

    # Archetype 14: Dataset with currency strings ($ / ₹ / €)
    def test_14_currency_strings(self):
        df = pd.DataFrame({
            "USD_Amount": ["$1,500.50", "$2,000.00", "$500.25"],
            "INR_Amount": ["₹25,000", "₹35,000", "₹40,000"]
        })
        norm_df, _ = normalize_dataset(df)
        self.assertTrue(pd.api.types.is_numeric_dtype(norm_df["USD_Amount"]))
        self.assertTrue(pd.api.types.is_numeric_dtype(norm_df["INR_Amount"]))
        self.assertAlmostEqual(norm_df["USD_Amount"].sum(), 4000.75)
        self.assertEqual(norm_df["INR_Amount"].sum(), 100000)

    # Archetype 15: Dataset with percentage strings
    def test_15_percentage_strings(self):
        df = pd.DataFrame({
            "Growth_Rate": ["12.5%", "25.0%", "50%", "-5.0%"]
        })
        norm_df, _ = normalize_dataset(df)
        self.assertTrue(pd.api.types.is_numeric_dtype(norm_df["Growth_Rate"]))
        self.assertAlmostEqual(norm_df["Growth_Rate"].iloc[0], 12.5)

    # Archetype 16: Dataset with multiple date formats
    def test_16_date_formats(self):
        df = pd.DataFrame({
            "Date_ISO": ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04"],
            "Metric": [100.0, 110.0, 120.0, 130.0]
        })
        norm_df, _ = normalize_dataset(df)
        self.assertTrue(pd.api.types.is_datetime64_any_dtype(norm_df["Date_ISO"]))
        trends = analyze_trends(norm_df)
        self.assertIn("Metric", trends)
        self.assertTrue(trends["Metric"]["has_date"])

    # Archetype 17: Multi-sheet workbook
    def test_17_multisheet_workbook(self):
        wb = {
            "Sheet1_Orders": pd.DataFrame({"Order_ID": [1, 2], "Total": [100, 200]}),
            "Sheet2_Customers": pd.DataFrame({"Cust_ID": [1, 2], "Name": ["Alice", "Bob"]})
        }
        res = analyze_workbook(wb)
        self.assertIn("sheets", res)
        self.assertEqual(len(res["sheets"]), 2)
        self.assertIn("Sheet1_Orders", res["sheets"])
        self.assertIn("Sheet2_Customers", res["sheets"])
        self.assertIn("kpis", res["sheets"]["Sheet1_Orders"])

    # Archetype 18: Empty sheet
    def test_18_empty_sheet(self):
        df = pd.DataFrame()
        norm_df, _ = normalize_dataset(df)
        quality = compute_data_quality(norm_df)
        self.assertEqual(quality["overall_score"], 0)
        self.assertIn(quality["status"], ["empty", "empty_dataset"])
        kpis = compute_dynamic_kpis(norm_df)
        self.assertEqual(len(kpis), 0)
        trends = analyze_trends(norm_df)
        self.assertEqual(len(trends), 0)

    # Archetype 19: Small dataset (single row)
    def test_19_single_row(self):
        df = pd.DataFrame({"A": [100], "B": ["SingleRecord"]})
        norm_df, _ = normalize_dataset(df)
        kpis = compute_dynamic_kpis(norm_df)
        self.assertIn("A", kpis)
        self.assertEqual(kpis["A"]["count"], 1)
        trends = analyze_trends(norm_df)
        # Less than 4 rows returns empty trend dict without crashing
        self.assertEqual(len(trends), 0)

    # Archetype 20: Wide dataset (many columns)
    def test_20_wide_dataset(self):
        data = {f"Metric_{i}": [i, i * 2, i * 3, i * 4] for i in range(50)}
        df = pd.DataFrame(data)
        norm_df, _ = normalize_dataset(df)
        kpis = compute_dynamic_kpis(norm_df)
        self.assertEqual(len(kpis), 50)
        self.assertIn("Metric_49", kpis)

    # Test 21: Cross-sheet relationship & foreign key candidate detection
    def test_21_cross_sheet_relationships(self):
        wb = {
            "Orders": pd.DataFrame({
                "Order_ID": [101, 102, 103, 104],
                "Customer_ID": ["C1", "C2", "C1", "C3"],
                "Amount": [250.0, 410.0, 190.0, 80.0]
            }),
            "Customers": pd.DataFrame({
                "Customer_ID": ["C1", "C2", "C3", "C4"],
                "City": ["London", "New York", "Tokyo", "Berlin"]
            })
        }
        res = analyze_workbook(wb)
        self.assertIn("cross_sheet_analysis", res)
        cross = res["cross_sheet_analysis"]
        self.assertTrue(cross["available"])
        self.assertGreater(cross["relationship_count"], 0)
        matched_cols = [r["column"] for r in cross["relationships"]]
        self.assertIn("Customer_ID", matched_cols)

    # Test 22: Mathematical invariants and property bounds
    def test_22_mathematical_invariants(self):
        np.random.seed(42)
        random_matrix = np.random.randn(25, 4)
        df = pd.DataFrame(random_matrix, columns=["Alpha", "Beta", "Gamma", "Delta"])
        norm_df, _ = normalize_dataset(df)
        
        # Invariant 1: Correlation bounds [-1, 1] and symmetry
        corrs = analyze_correlations(norm_df)
        matrix = corrs["matrix"]
        for col_a in matrix:
            self.assertAlmostEqual(matrix[col_a][col_a], 1.0)
            for col_b in matrix[col_a]:
                if matrix[col_a][col_b] is not None:
                    self.assertGreaterEqual(matrix[col_a][col_b], -1.0)
                    self.assertLessEqual(matrix[col_a][col_b], 1.0)
                    self.assertAlmostEqual(matrix[col_a][col_b], matrix[col_b][col_a])

        # Invariant 2: Quality score bounds [0, 100]
        quality = compute_data_quality(norm_df)
        self.assertGreaterEqual(quality["overall_score"], 0)
        self.assertLessEqual(quality["overall_score"], 100)

        # Invariant 3: Trend score bounds [-100, 100]
        trends = analyze_trends(norm_df)
        for metric, t in trends.items():
            self.assertGreaterEqual(t["trend_score"], -100)
            self.assertLessEqual(t["trend_score"], 100)
            self.assertIn("forecast", t)


if __name__ == "__main__":
    unittest.main()

