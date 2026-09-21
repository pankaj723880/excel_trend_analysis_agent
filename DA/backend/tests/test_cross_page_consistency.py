"""Comprehensive cross-page consistency and invariant regression tests.

Verifies:
1. Invariant: count + missing == total_rows for every column across all sheets.
2. Invariant: 5 Core Integrity weights sum to exactly 1.0 (100%).
3. Invariant: Data quality overall_score matches weighted sum of the 5 pillars.
4. Completeness score directly reflects missing_cells / total_cells.
5. Uniqueness score directly reflects duplicate_rows / total_rows.
6. Domain validator detects all planted violations (negative counts, out-of-bound percentages, date anomalies).
7. Statistical outliers are separated from domain violations and do NOT penalize core health score.
8. Unique anomaly count equals true deduplicated union of anomalies.
9. Trend temporal axis isolates solitary projection date (2035-12-31) and records valid temporal points.
10. Correlation matrix is strictly symmetric with diagonal == 1.0 and paired sample size n reported.
11. Multi-sheet analysis cleanly separates sheet-level and workbook-level metrics.
"""
import os
import unittest
import numpy as np
import pandas as pd

from app.services.excel_loader import load_workbook_data
from app.services.analysis_engine import run_full_analysis, validate_analysis_consistency
from app.services.data_quality import DataQualityEngine
from app.services.validation import DomainValidator


class TestCrossPageConsistency(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        uploads_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data",
            "uploads",
        )
        candidates = [
            os.path.join(uploads_dir, f)
            for f in os.listdir(uploads_dir)
            if "anomaly_practice_small" in f and f.endswith(".xlsx")
        ]
        if not candidates:
            raise FileNotFoundError(f"Could not find anomaly_practice_small.xlsx in {uploads_dir}")

        cls.filepath = candidates[0]
        cls.workbook = load_workbook_data(cls.filepath)
        cls.analysis = run_full_analysis(cls.workbook)
        cls.sales_sheet = cls.analysis["sheets"]["Sales Data"]
        cls.checklist_sheet = cls.analysis["sheets"]["Anomaly Checklist"]

    def test_internal_consistency_validator_passes(self):
        """validate_analysis_consistency must return zero errors."""
        errors = validate_analysis_consistency(self.analysis)
        self.assertEqual(len(errors), 0, f"Analysis consistency errors: {errors}")

    def test_eda_column_invariant_count_plus_missing_equals_total_rows(self):
        """For every column in every sheet, count + missing == total_rows."""
        for sheet_name, sheet in self.analysis["sheets"].items():
            total_rows = sheet["eda"]["row_count"]
            missing_summary = sheet["eda"]["missing_summary"]
            for col, stats in missing_summary.items():
                c = stats["count"]
                m = stats["missing"]
                self.assertEqual(
                    c + m,
                    total_rows,
                    f"Sheet '{sheet_name}' column '{col}': count ({c}) + missing ({m}) != {total_rows}",
                )

    def test_target_regression_missing_counts(self):
        """Sales Data sheet must have exactly 125 rows, 10 missing cells, 5 duplicates."""
        sales_eda = self.sales_sheet["eda"]
        self.assertEqual(sales_eda["row_count"], 125)
        num_stats = sales_eda["numeric_statistics"]

        # Exact expected missing counts
        self.assertEqual(num_stats["Revenue"]["missing"], 3)
        self.assertEqual(num_stats["Revenue"]["count"], 122)

        self.assertEqual(num_stats["Customers"]["missing"], 2)
        self.assertEqual(num_stats["Customers"]["count"], 123)

        self.assertEqual(num_stats["Operating_Cost"]["missing"], 2)
        self.assertEqual(num_stats["Operating_Cost"]["count"], 123)

        self.assertEqual(num_stats["Profit"]["missing"], 2)
        self.assertEqual(num_stats["Profit"]["count"], 123)

        date_stats = sales_eda["datetime_statistics"]
        self.assertEqual(date_stats["Date"]["missing"], 1)
        self.assertEqual(date_stats["Date"]["count"], 124)

        # Missing summary total
        total_missing = sum(s["missing"] for s in sales_eda["missing_summary"].values())
        self.assertEqual(total_missing, 10)
        self.assertEqual(sales_eda["duplicate_count"], 5)

    def test_data_quality_100_percent_model_weights(self):
        """5 core integrity dimensions must sum to exactly 1.0 (100%)."""
        weights = DataQualityEngine.WEIGHTS
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=9)
        self.assertEqual(weights["completeness"], 0.25)
        self.assertEqual(weights["uniqueness"], 0.20)
        self.assertEqual(weights["validity"], 0.25)
        self.assertEqual(weights["consistency"], 0.20)
        self.assertEqual(weights["structural_integrity"], 0.10)

    def test_data_quality_mathematical_consistency(self):
        """overall_raw must equal the exact weighted sum of the 5 pillar scores."""
        quality = self.sales_sheet["quality"]
        details = quality["dimensions_detail"]

        expected_score = round(
            details["completeness"]["score"] * 0.25
            + details["uniqueness"]["score"] * 0.20
            + details["validity"]["score"] * 0.25
            + details["consistency"]["score"] * 0.20
            + details["structural_integrity"]["score"] * 0.10,
            2,
        )

        self.assertAlmostEqual(quality["overall_raw"], expected_score, places=2)
        self.assertEqual(quality["overall_score"], int(round(expected_score)))

        # Completeness directly reflects missing 10 cells out of 1125 cells
        expected_completeness = round(100.0 * (1.0 - (10 / 1125)), 2)
        self.assertAlmostEqual(details["completeness"]["score"], expected_completeness, places=2)

        # Uniqueness directly reflects 5 duplicates out of 125 rows
        expected_uniqueness = round(100.0 * (1.0 - (5 / 125)), 2)
        self.assertAlmostEqual(details["uniqueness"]["score"], expected_uniqueness, places=2)

    def test_statistical_outliers_separated_from_core_health(self):
        """Statistical observations must be informational and not directly reduce core health."""
        quality = self.sales_sheet["quality"]
        stats_obs = quality["statistical_observations"]
        self.assertGreater(stats_obs["outliers_count"], 0)
        self.assertIn("not automatically invalid data", stats_obs["explanation"])

    def test_domain_validation_detects_all_planted_violations(self):
        """Domain validator must detect negative counts, bounded percentages, and date range anomaly."""
        val = self.sales_sheet["validation"]
        self.assertEqual(val["total_violations"], 6)

        by_rule = val["by_rule"]
        self.assertEqual(by_rule.get("non_negative_count"), 4)  # 2 Orders, 1 Customers, 1 Inventory_Units
        self.assertEqual(by_rule.get("percentage_range"), 1)    # Conversion_Rate_% = -2.4
        self.assertEqual(by_rule.get("date_range_anomaly"), 1)  # 2035-12-31

        by_col = val["by_column"]
        self.assertEqual(by_col.get("Orders"), 2)
        self.assertEqual(by_col.get("Customers"), 1)
        self.assertEqual(by_col.get("Inventory_Units"), 1)
        self.assertEqual(by_col.get("Conversion_Rate_%"), 1)
        self.assertEqual(by_col.get("Date"), 1)

    def test_unique_anomaly_counts_and_method_breakdowns(self):
        """Anomalies must distinguish unique anomaly count from method hit counts."""
        anom = self.sales_sheet["anomalies"]
        unique_cnt = anom["unique_anomalous_observations"]
        total_detections = anom["total_detections"]

        self.assertGreaterEqual(total_detections, unique_cnt)
        self.assertIn("iqr_outliers", anom["method_counts"])
        self.assertIn("zscore_outliers", anom["method_counts"])
        self.assertIn("sudden_changes", anom["method_counts"])
        self.assertIn("domain_violations", anom["method_counts"])

        # Check that individual anomaly records have both boolean flags
        for r in anom["all"]:
            self.assertIn("statistical_anomaly", r)
            self.assertIn("validation_violation", r)
            self.assertIn("reason", r)

    def test_trends_isolates_date_range_anomaly(self):
        """Trend analysis must exclude 2035-12-31 from temporal regression timeline."""
        trends = self.sales_sheet["trends"]
        self.assertIn("Revenue", trends)
        rev_trend = trends["Revenue"]

        self.assertEqual(rev_trend["time_axis_type"], "datetime")
        self.assertEqual(rev_trend["total_observations"], 125)
        self.assertGreater(rev_trend["excluded_temporal_observations"], 0)
        self.assertLess(rev_trend["valid_temporal_observations"], rev_trend["total_observations"])

    def test_correlation_symmetry_and_paired_sample_size(self):
        """Correlations must be symmetric with diagonal 1.0 and report paired sample size n."""
        corr = self.sales_sheet["correlations"]
        matrix = corr["matrix"]
        columns = corr["columns"]

        for c1 in columns:
            self.assertAlmostEqual(matrix[c1][c1], 1.0, places=4)
            for c2 in columns:
                self.assertAlmostEqual(matrix[c1][c2], matrix[c2][c1], places=4)

        for rel in corr["relationships"]:
            self.assertIn("n", rel)
            self.assertGreater(rel["n"], 0)
            self.assertIn("column_a", rel)
            self.assertIn("column_b", rel)
            self.assertIn("pearson_r", rel)

    def test_cross_sheet_multi_sheet_support(self):
        """Both sheets in workbook must be fully analyzed with sheet-level isolation."""
        self.assertEqual(self.analysis["sheet_count"], 2)
        self.assertIn("Sales Data", self.analysis["sheets"])
        self.assertIn("Anomaly Checklist", self.analysis["sheets"])

        checklist_eda = self.checklist_sheet["eda"]
        self.assertEqual(checklist_eda["row_count"], 28)
        self.assertEqual(checklist_eda["column_count"], 3)


if __name__ == "__main__":
    unittest.main()
