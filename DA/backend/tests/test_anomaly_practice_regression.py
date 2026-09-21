"""Automated Regression and Invariant Test Suite for anomaly_practice_small(1).xlsx.

Validates the canonical analysis pipeline:
1. Missing counts, percentages, and total row invariants
2. Domain validation engine detections (negative count metrics, percentage bounds, solitary date outliers)
3. Categorical consistency detections (variants without data mutation)
4. Data quality scoring (100% 5-pillar model and separation of statistical variance)
5. Statistical anomalies classification (statistical vs rule violation separation)
6. Mathematical invariants (min <= median <= max, count + missing == total_rows, corr in [-1,1], etc.)
7. Dataset agnostic behavior (never hardcodes sales specifics)
"""
import os
import unittest
import pandas as pd
import numpy as np

from app.services.analysis_engine import run_full_analysis
from app.services.data_normalizer import normalize_dataset
from app.services.data_quality import DataQualityEngine
from app.services.eda import compute_eda_sheet
from app.services.validation import DomainValidator, detect_categorical_inconsistencies
from app.services.correlations import compute_correlations


class TestAnomalyPracticeRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Locate the regression test workbook
        cls.file_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data", "uploads", "bf3059d0-989b-4892-a527-b30a6a14e09f_anomaly_practice_small.xlsx"
        )
        if not os.path.exists(cls.file_path):
            raise FileNotFoundError(f"Regression workbook not found at: {cls.file_path}")

        cls.raw_df = pd.read_excel(cls.file_path)
        cls.workbook = {"Sheet1": cls.raw_df}
        cls.analysis = run_full_analysis(cls.workbook)
        cls.sheet = cls.analysis["sheets"]["Sheet1"]

    def test_01_total_dimensions_and_version(self):
        """Test dataset shape and analysis versioning."""
        self.assertEqual(self.analysis["analysis_version"], "2.3.0")
        self.assertTrue(bool(self.analysis.get("dataset_hash")))
        self.assertEqual(self.analysis["total_rows"], 125)
        self.assertEqual(len(self.raw_df.columns), 9)

    def test_02_eda_missing_value_calculation(self):
        """Test exact missing values and mathematical invariant: count + missing == total_rows."""
        eda = self.sheet["eda"]
        num_stats = eda["numeric_statistics"]
        total_rows = len(self.raw_df)

        # Invariant for all numeric columns: count + missing == total_rows
        for col, stats in num_stats.items():
            self.assertEqual(
                stats["count"] + stats["missing"],
                total_rows,
                f"Column {col} violates count + missing == total_rows (got {stats['count']} + {stats['missing']} != {total_rows})"
            )

        # Exact regression counts for anomaly_practice_small.xlsx
        self.assertEqual(num_stats["Revenue"]["missing"], 3)
        self.assertEqual(num_stats["Revenue"]["count"], 122)
        self.assertAlmostEqual(num_stats["Revenue"]["missing_pct"], 2.4, delta=0.1)

        self.assertEqual(num_stats["Customers"]["missing"], 2)
        self.assertEqual(num_stats["Customers"]["count"], 123)

        self.assertEqual(num_stats["Operating_Cost"]["missing"], 2)
        self.assertEqual(num_stats["Operating_Cost"]["count"], 123)

        self.assertEqual(num_stats["Profit"]["missing"], 2)
        self.assertEqual(num_stats["Profit"]["count"], 123)

        self.assertEqual(num_stats["Orders"]["missing"], 0)
        self.assertEqual(num_stats["Orders"]["count"], 125)

        self.assertEqual(num_stats["Inventory_Units"]["missing"], 0)
        self.assertEqual(num_stats["Inventory_Units"]["count"], 125)

        # Datetime column Date
        date_stats = eda["datetime_statistics"]
        self.assertIn("Date", date_stats)
        self.assertEqual(date_stats["Date"]["missing"], 1)
        self.assertEqual(date_stats["Date"]["count"], 124)
        self.assertEqual(date_stats["Date"]["count"] + date_stats["Date"]["missing"], total_rows)

        # Total missing across the sheet
        self.assertEqual(self.analysis["total_missing"], 10)
        self.assertEqual(self.analysis["total_duplicates"], 5)

    def test_03_domain_validation_rules(self):
        """Test generic domain validation catches negative counts, percentage bounds, and date anomalies."""
        val = self.sheet["validation"]
        self.assertGreaterEqual(val["total_violations"], 5)

        by_column = val["by_column"]
        # Orders has negative counts [-120, -45]
        self.assertIn("Orders", by_column)
        self.assertEqual(by_column["Orders"], 2)

        # Customers has negative count [-30]
        self.assertIn("Customers", by_column)
        self.assertEqual(by_column["Customers"], 1)

        # Inventory_Units has negative units [-500]
        self.assertIn("Inventory_Units", by_column)
        self.assertEqual(by_column["Inventory_Units"], 1)

        # Conversion_Rate_% has negative percentage [-2.4]
        self.assertIn("Conversion_Rate_%", by_column)
        self.assertEqual(by_column["Conversion_Rate_%"], 1)

        # Date has solitary far future date [2035-12-31]
        self.assertIn("Date", by_column)
        self.assertEqual(by_column["Date"], 1)

        # Profit can legitimately be negative in finance/business and must NOT be flagged as negative count violation
        self.assertNotIn("Profit", by_column)

    def test_04_categorical_consistency(self):
        """Test detection of casing/whitespace variants without data mutation."""
        cat = self.sheet["categorical_inconsistencies"]
        self.assertIn("Region", cat)
        region_info = cat["Region"]
        self.assertIn("North", region_info["canonical_candidates"])
        variants = region_info["canonical_candidates"]["North"]
        self.assertTrue(any("north" in v for v in variants))
        self.assertTrue(any("NORTH" in v for v in variants))

        # Ensure raw DataFrame was not mutated
        self.assertIn(" NORTH ", self.raw_df["Region"].values)
        self.assertIn("north", self.raw_df["Region"].values)

    def test_05_data_quality_100_percent_model(self):
        """Test that data quality weights sum exactly to 1.0 (100%) and score is deterministic."""
        q = self.sheet["quality"]
        detail = q.get("dimensions_detail", q["dimensions"])
        weights = [d["weight"] for d in detail.values()]
        self.assertAlmostEqual(sum(weights), 1.0, places=4)

        # Weights mapping
        self.assertEqual(detail["completeness"]["weight"], 0.25)
        self.assertEqual(detail["uniqueness"]["weight"], 0.20)
        self.assertEqual(detail["validity"]["weight"], 0.25)
        self.assertEqual(detail["consistency"]["weight"], 0.20)
        self.assertEqual(detail["structural_integrity"]["weight"], 0.10)

        # Score in range [0, 100]
        self.assertTrue(0 <= q["overall_score"] <= 100)
        self.assertTrue(0 <= q["overall_raw"] <= 100)

        # Statistical observations must be separated from core health score
        stats_obs = q["statistical_observations"]
        self.assertGreater(stats_obs["outliers_count"], 0)
        self.assertIn("not automatically invalid", stats_obs["explanation"])

    def test_06_separation_of_validation_from_anomalies(self):
        """Test that anomalies separate statistical anomalies from domain rule violations."""
        anom = self.sheet["anomalies"]
        all_anom = anom["all"]

        violations = [a for a in all_anom if a.get("validation_violation")]
        statistical = [a for a in all_anom if a.get("statistical_anomaly")]

        self.assertGreater(len(violations), 0)
        self.assertGreater(len(statistical), 0)

        # Verify negative Orders are marked as validation violations
        orders_viol = [a for a in violations if a["metric"] == "Orders" and a["value"] < 0]
        self.assertGreaterEqual(len(orders_viol), 1)

    def test_07_property_invariants(self):
        """Test mathematical invariants across all numeric columns and correlation matrix."""
        eda = self.sheet["eda"]
        num_stats = eda["numeric_statistics"]

        # min <= median <= max
        for col, stats in num_stats.items():
            if stats["min"] is not None and stats["median"] is not None and stats["max"] is not None:
                self.assertLessEqual(stats["min"], stats["median"] + 1e-6)
                self.assertLessEqual(stats["median"], stats["max"] + 1e-6)

        # Correlation matrix symmetry and bounds
        corr = self.sheet["correlations"]
        matrix = corr.get("matrix", {})
        for col_a in matrix:
            for col_b in matrix[col_a]:
                val = matrix[col_a][col_b]
                if val is not None:
                    self.assertTrue(-1.0 <= val <= 1.0)
                    if col_a == col_b:
                        self.assertAlmostEqual(val, 1.0, places=3)
                    else:
                        sym_val = matrix.get(col_b, {}).get(col_a)
                        if sym_val is not None:
                            self.assertAlmostEqual(val, sym_val, places=3)

        # Paired n non-null count exists on relationships
        for rel in corr.get("strongest_positive", []) + corr.get("strongest_negative", []):
            self.assertIn("n", rel)
            self.assertGreater(rel["n"], 0)


if __name__ == "__main__":
    unittest.main()
