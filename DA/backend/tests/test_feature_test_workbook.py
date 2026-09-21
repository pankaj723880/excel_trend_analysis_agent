"""Comprehensive regression test suite for excel_intelligence_feature_test.xlsx.

Covers the 10 critical regression requirements:
TEST 1: 8 numeric columns -> 8x8 correlation matrix generated
TEST 2: 183 rows + 4 missing cells -> EDA reports exactly 4 missing cells
TEST 3: Revenue missing = 1 -> count = 182, missing = 1, missing % = 0.55%
TEST 4: Invalid domain values detected (e.g. Orders = -120, Customers = -30, Inventory_Units = -500, Unit_Price = -50, Conversion_Rate_% = -2.4 and 125)
TEST 5: Statistical outliers do not automatically reduce core data integrity
TEST 6: KPI trend score == Trend Analysis trend score (within tolerance)
TEST 7: Cleaning summary matches actual before/after row counts
TEST 8: Raw DataFrame remains unchanged after cleaning
TEST 9: Different sheets produce independent analysis results
TEST 10: No Sales-specific logic is required for HR_Data
"""
import unittest
import os
import pandas as pd
import numpy as np

from app.services.excel_loader import load_workbook_data
from app.services.correlations import compute_correlations
from app.services.eda import compute_eda_sheet
from app.services.data_normalizer import DataNormalizer
from app.services.structure_detector import classify_columns
from app.services.validation import DomainValidator
from app.services.data_quality import DataQualityEngine
from app.services.trends import analyze_trends
from app.services.kpi_engine import GenericKPIEngine
from app.services.data_cleaner import clean_dataframe, clean_workbook
from app.services.analysis_engine import run_full_analysis, analyze_sheet


WORKBOOK_PATH = r"C:\Users\panka\Downloads\excel_intelligence_feature_test.xlsx"


class TestFeatureTestWorkbook(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.exists(WORKBOOK_PATH):
            raise unittest.SkipTest(f"Workbook not found at {WORKBOOK_PATH}")
        cls.workbook = load_workbook_data(WORKBOOK_PATH)
        cls.sales_df = cls.workbook["Sales_Data"]
        cls.hr_df = cls.workbook["HR_Data"]
        cls.inv_df = cls.workbook["Inventory_Data"]
        cls.dict_df = cls.workbook["Data_Dictionary"]

    def test_1_correlations_8_numeric_columns(self):
        """TEST 1: 8 numeric columns in Sales_Data produces an 8x8 correlation matrix."""
        corr = compute_correlations(self.sales_df)
        self.assertEqual(corr["status"], "ok")
        self.assertEqual(len(corr["numeric_columns"]), 8)
        self.assertEqual(len(corr["matrix"]), 8)
        
        # Symmetrical and 1.0 on diagonal
        for col in corr["numeric_columns"]:
            self.assertEqual(corr["matrix"][col][col], 1.0)
            self.assertIn(col, corr["pairwise_observation_counts"])
            self.assertEqual(corr["pairwise_observation_counts"][col][col], int(self.sales_df[col].notna().sum()))

    def test_2_eda_missing_cells_calculation(self):
        """TEST 2: EDA correctly computes missing cells from the raw DataFrame."""
        norm_df, _, _ = DataNormalizer.normalize_dataframe(self.sales_df)
        classification = classify_columns(norm_df)
        eda = compute_eda_sheet(
            self.sales_df,
            classification["numeric"],
            classification["categorical"],
            classification["date"],
        )
        total_missing = int(self.sales_df.isna().sum().sum())
        self.assertEqual(eda["metadata"]["missing_cells"], total_missing)
        self.assertEqual(eda["metadata"]["row_count"], len(self.sales_df))
        self.assertEqual(eda["metadata"]["column_count"], len(self.sales_df.columns))

    def test_3_eda_per_column_missing_and_count(self):
        """TEST 3: Revenue has missing = 1, count = 182, missing % ≈ 0.55%."""
        norm_df, _, _ = DataNormalizer.normalize_dataframe(self.sales_df)
        classification = classify_columns(norm_df)
        eda = compute_eda_sheet(
            self.sales_df,
            classification["numeric"],
            classification["categorical"],
            classification["date"],
        )
        stats = eda["numeric_statistics"]
        self.assertIn("Revenue", stats)
        rev = stats["Revenue"]
        self.assertEqual(rev["missing"], 1)
        self.assertEqual(rev["count"], 182)
        self.assertAlmostEqual(rev["missing_pct"], 1 / 183 * 100, places=2)

    def test_4_domain_violations_detected(self):
        """TEST 4: Inferred domain rules flag invalid count, rate, and price values."""
        val = DomainValidator.validate_sheet(self.sales_df)
        violations = val.get("violations", [])
        self.assertGreaterEqual(len(violations), 5)

        violating_cols = {v["column"] for v in violations}
        self.assertIn("Orders", violating_cols)
        self.assertIn("Customers", violating_cols)
        self.assertIn("Inventory_Units", violating_cols)
        self.assertIn("Conversion_Rate_%", violating_cols)
        self.assertIn("Unit_Price", violating_cols)

    def test_5_statistical_outliers_do_not_reduce_core_quality(self):
        """TEST 5: Core quality measures data integrity and does not penalize for statistical outliers."""
        quality = DataQualityEngine.audit_quality(self.sales_df)
        self.assertIn("overall_score", quality)
        self.assertIn("pillars", quality)
        self.assertIn("statistical_observations", quality)

        # Ensure statistical observations are tracked separately
        self.assertIn("outliers_count", quality["statistical_observations"])
        # Core quality overall score is purely derived from 5 integrity pillars
        pillars = quality["pillars"]
        composite = sum(p["score"] * p["weight"] for p in pillars.values())
        self.assertEqual(quality["overall_score"], int(round(composite)))

    def test_6_kpi_trend_score_matches_trend_analysis(self):
        """TEST 6: KPI trend score matches Trend Analysis trend score for each metric."""
        norm_df, _, _ = DataNormalizer.normalize_dataframe(self.sales_df)
        classification = classify_columns(norm_df)
        date_col = classification.get("date_column")
        trends = analyze_trends(norm_df, date_column=date_col)
        kpis = GenericKPIEngine.compute_sheet_kpis(norm_df, "Sales_Data", date_column=date_col, trends=trends)

        self.assertGreater(len(kpis), 0)
        for kpi in kpis:
            metric = kpi["metric"]
            if metric in trends:
                t_score = trends[metric].get("trend_score")
                k_score = kpi.get("trend_score")
                self.assertAlmostEqual(t_score, k_score, places=2)

    def test_7_cleaning_summary_matches_row_counts(self):
        """TEST 7: Cleaning summary numbers match actual before/after transformation counts."""
        cleaned_wb, report_df = clean_workbook(
            {"Sales_Data": self.sales_df},
            options={"remove_duplicates": True, "remove_empty_rows": True, "clean_domain_anomalies": True},
        )
        cleaned_df = cleaned_wb["Sales_Data"]
        report = report_df.to_dict(orient="records")[0]

        self.assertEqual(report["rows_before"], len(self.sales_df))
        self.assertEqual(report["rows_after"], len(cleaned_df))
        self.assertEqual(report["rows_dropped"], len(self.sales_df) - len(cleaned_df))

    def test_8_raw_dataframe_remains_unchanged(self):
        """TEST 8: Raw DataFrame is never mutated during cleaning or analysis."""
        original_shape = self.sales_df.shape
        original_missing = int(self.sales_df.isna().sum().sum())

        _ = clean_dataframe(self.sales_df, remove_duplicates=True, fill_missing="median")
        _ = run_full_analysis({"Sales_Data": self.sales_df})

        self.assertEqual(self.sales_df.shape, original_shape)
        self.assertEqual(int(self.sales_df.isna().sum().sum()), original_missing)

    def test_9_multi_sheet_independent_results(self):
        """TEST 9: Multiple sheets produce distinct, independent analysis results."""
        analysis = run_full_analysis(self.workbook)
        self.assertIn("Sales_Data", analysis["sheets"])
        self.assertIn("HR_Data", analysis["sheets"])
        self.assertIn("Inventory_Data", analysis["sheets"])
        self.assertIn("Data_Dictionary", analysis["sheets"])

        self.assertEqual(analysis["sheets"]["Sales_Data"]["profile"]["rows"], 183)
        self.assertEqual(analysis["sheets"]["HR_Data"]["profile"]["rows"], 162)
        self.assertEqual(analysis["sheets"]["Inventory_Data"]["profile"]["rows"], 173)

    def test_10_hr_data_works_without_sales_assumptions(self):
        """TEST 10: HR_Data executes cleanly with its own KPIs and correlations without sales semantics."""
        sheet_res = analyze_sheet(self.hr_df, "HR_Data")
        self.assertEqual(sheet_res["status"], "ok")
        kpis = sheet_res["kpis"]
        kpi_metrics = [k["metric"] for k in kpis]
        # HR fields
        self.assertTrue(any(m in kpi_metrics for m in ["Salary", "Attendance_%", "Performance_Score"]))
        # No phantom sales columns
        self.assertNotIn("Revenue", kpi_metrics)
        self.assertNotIn("Orders", kpi_metrics)


if __name__ == "__main__":
    unittest.main()
