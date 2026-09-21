"""Multi-Dimensional Data Quality & Health Score Engine.

Evaluates datasets across 5 core integrity dimensions (100% total weight):
1. Completeness (25% weight)
2. Uniqueness (20% weight)
3. Validity (25% weight)
4. Consistency (20% weight)
5. Structural Integrity (10% weight)

Separately isolates Statistical Observations (Outliers via IQR, Statistical Anomalies)
so that mathematical variance does NOT penalize the core data integrity score.
"""
from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd

from app.services.validation import DomainValidator, detect_categorical_inconsistencies


class DataQualityEngine:
    """Computes transparent data quality scores across 5 core integrity dimensions."""

    WEIGHTS = {
        "completeness": 0.25,
        "uniqueness": 0.20,
        "validity": 0.25,
        "consistency": 0.20,
        "structural_integrity": 0.10,
    }

    @classmethod
    def audit_quality(
        cls,
        df: pd.DataFrame,
        semantic_schema: dict[str, Any] | None = None,
        date_column: str | None = None,
    ) -> dict[str, Any]:
        """Perform comprehensive data quality audit on a sheet."""
        if df.empty or "__error__" in df.columns:
            return {
                "overall_score": 0,
                "overall_raw": 0.0,
                "status": "error" if "__error__" in df.columns else "empty",
                "dimensions": {
                    "completeness": {"score": 0.0, "weight": 0.25},
                    "uniqueness": {"score": 0.0, "weight": 0.20},
                    "validity": {"score": 0.0, "weight": 0.25},
                    "consistency": {"score": 0.0, "weight": 0.20},
                    "structural_integrity": {"score": 0.0, "weight": 0.10},
                },
                "core_health": {
                    "completeness": 0,
                    "uniqueness": 0,
                    "validity": 0,
                    "consistency": 0,
                    "structural_integrity": 0,
                },
                "statistical_observations": {
                    "outliers_count": 0,
                    "statistical_anomalies_count": 0,
                    "explanation": "No data available to observe statistical distributions.",
                },
                "issues": [{"severity": "critical", "message": "Worksheet is empty or could not be loaded."}],
                "recommendations": [],
                "details": {},
            }

        row_count = len(df)
        col_count = len(df.columns)
        total_cells = row_count * col_count

        issues: list[dict[str, Any]] = []
        recommendations: list[str] = []

        # 1. COMPLETENESS (25% weight)
        # completeness_score = max(0, 100 * (1 - missing_cells / total_cells))
        missing_count = int(df.isna().sum().sum())
        empty_str_count = 0
        for col in df.columns:
            if pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_string_dtype(df[col]):
                empty_str_count += int((df[col].astype(str).str.strip() == "").sum())

        total_empty = missing_count + empty_str_count
        missing_pct = (total_empty / total_cells * 100) if total_cells else 0.0
        completeness_score = round(max(0.0, 100.0 * (1.0 - (total_empty / max(1, total_cells)))), 2)

        if total_empty > 0:
            issues.append({
                "dimension": "completeness",
                "severity": "high" if missing_pct > 20 else "medium",
                "message": f"Detected {total_empty:,} missing or empty cells ({missing_pct:.2f}% of total data points).",
            })
            recommendations.append(
                f"Review {missing_pct:.2f}% missing values across affected columns using median imputation or record filtering."
            )

        # 2. UNIQUENESS (20% weight)
        # uniqueness_score = max(0, 100 * (1 - duplicate_rows / total_rows))
        duplicate_rows = int(df.duplicated().sum())
        dup_pct = (duplicate_rows / row_count * 100) if row_count else 0.0
        uniqueness_score = round(max(0.0, 100.0 * (1.0 - (duplicate_rows / max(1, row_count)))), 2)

        if duplicate_rows > 0:
            issues.append({
                "dimension": "uniqueness",
                "severity": "medium" if dup_pct < 10 else "high",
                "message": f"Found {duplicate_rows:,} duplicate records ({dup_pct:.2f}% of total rows).",
            })
            recommendations.append(
                f"Investigate and deduplicate {duplicate_rows:,} identical rows to avoid skewing sums and averages."
            )

        # 3. VALIDITY (25% weight)
        # Evaluated via deterministic DomainValidator: validity_score = max(0, 100 * (1 - violations / total_cells))
        val_audit = DomainValidator.validate_sheet(df, date_column=date_column)
        total_violations = val_audit.get("total_violations", 0)
        error_violations = val_audit.get("error_count", 0)
        warning_violations = val_audit.get("warning_count", 0)

        # Errors carry 3x weight of warnings
        effective_violations = (error_violations * 1.0) + (warning_violations * 0.33)
        validity_score = round(max(0.0, 100.0 * (1.0 - min(1.0, (effective_violations * 5.0) / max(1, row_count)))), 2)

        if total_violations > 0:
            issues.append({
                "dimension": "validity",
                "severity": "high" if error_violations > 0 else "medium",
                "message": f"Found {total_violations:,} domain boundary violations ({error_violations} errors, {warning_violations} warnings).",
            })
            recommendations.append(
                f"Audit {total_violations:,} domain rule violations (e.g. negative counts or out-of-bound percentages)."
            )

        # 4. CONSISTENCY (20% weight)
        # Evaluated via detect_categorical_inconsistencies
        cat_inconsistencies = detect_categorical_inconsistencies(df)
        total_variants = sum(item.get("variant_count", 0) for item in cat_inconsistencies.values())
        consistency_penalty = min(50.0, total_variants * 4.0)
        consistency_score = round(max(0.0, 100.0 - consistency_penalty), 2)

        if total_variants > 0:
            issues.append({
                "dimension": "consistency",
                "severity": "low",
                "message": f"Detected {total_variants} casing or whitespace variants across {len(cat_inconsistencies)} categorical columns.",
            })
            recommendations.append(
                "Standardize text casing and whitespace across categorical columns to unify groupings."
            )

        # 5. STRUCTURAL INTEGRITY (10% weight)
        constant_cols = []
        high_card_cols = []
        for col in df.columns:
            non_null = df[col].dropna()
            if non_null.nunique() <= 1 and len(non_null) > 1:
                constant_cols.append(str(col))
            elif len(non_null) > 50 and (non_null.nunique() / len(non_null)) > 0.98:
                if not pd.api.types.is_numeric_dtype(non_null):
                    high_card_cols.append(str(col))

        structure_penalty = (len(constant_cols) * 20.0) + (min(len(high_card_cols), 2) * 5.0)
        structural_score = round(max(0.0, 100.0 - min(60.0, structure_penalty)), 2)

        if constant_cols:
            issues.append({
                "dimension": "structural_integrity",
                "severity": "low",
                "message": f"Column(s) with zero variance (constant single value): {', '.join(constant_cols)}.",
            })
            recommendations.append(
                f"Consider verifying constant columns ({', '.join(constant_cols)}) as they offer zero variance."
            )

        # Verify weights sum exactly to 1.0
        assert abs(sum(cls.WEIGHTS.values()) - 1.0) < 1e-9, "Quality weights must sum exactly to 1.0"

        # Calculate exact 100-point weighted score
        overall_raw = (
            (completeness_score * cls.WEIGHTS["completeness"])
            + (uniqueness_score * cls.WEIGHTS["uniqueness"])
            + (validity_score * cls.WEIGHTS["validity"])
            + (consistency_score * cls.WEIGHTS["consistency"])
            + (structural_score * cls.WEIGHTS["structural_integrity"])
        )
        overall_int = int(round(max(0.0, min(100.0, overall_raw))))

        # STATISTICAL OBSERVATIONS (Separated from core data integrity)
        outlier_count = 0
        for col in df.columns:
            s = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(s) >= 5:
                q1 = s.quantile(0.25)
                q3 = s.quantile(0.75)
                iqr = q3 - q1
                if iqr > 0:
                    outlier_count += int(((s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)).sum())

        statistical_observations = {
            "outliers_count": outlier_count,
            "statistical_anomalies_count": outlier_count,  # will be synced with anomaly engine
            "explanation": "Statistical outliers indicate unusual observations. They are not automatically invalid data.",
        }

        if not recommendations:
            recommendations.append("Dataset demonstrates high fidelity across completeness, uniqueness, validity, and structural standards.")

        pillars = {
            "completeness": {
                "score": int(round(completeness_score)),
                "raw_score": completeness_score,
                "weight": 0.25,
                "issue_count": total_empty,
                "issue_rate": round(missing_pct, 2),
                "explanation": "Evaluates missing or null cells relative to total dataset capacity.",
            },
            "uniqueness": {
                "score": int(round(uniqueness_score)),
                "raw_score": uniqueness_score,
                "weight": 0.20,
                "issue_count": duplicate_rows,
                "issue_rate": round((duplicate_rows / row_count * 100), 2) if row_count > 0 else 0.0,
                "explanation": "Measures record uniqueness and penalizes duplicate records.",
            },
            "validity": {
                "score": int(round(validity_score)),
                "raw_score": validity_score,
                "weight": 0.25,
                "issue_count": total_violations,
                "issue_rate": round((total_violations / row_count * 100), 2) if row_count > 0 else 0.0,
                "explanation": "Enforces semantic domain constraints (non-negative counts, bounded percentages, unit prices).",
            },
            "consistency": {
                "score": int(round(consistency_score)),
                "raw_score": consistency_score,
                "weight": 0.20,
                "issue_count": sum(c.get("variant_count", 0) for c in cat_inconsistencies.values()),
                "issue_rate": round(len(cat_inconsistencies) / max(col_count, 1) * 100, 2),
                "explanation": "Audits casing and whitespace variants across categorical features.",
            },
            "structural": {
                "score": int(round(structural_score)),
                "raw_score": structural_score,
                "weight": 0.10,
                "issue_count": len(constant_cols),
                "issue_rate": round(len(constant_cols) / max(col_count, 1) * 100, 2),
                "explanation": "Checks column stability and absence of single-value / constant columns.",
            },
        }

        return {
            "overall_score": overall_int,
            "overall_raw": round(overall_raw, 2),
            "status": "healthy" if overall_int >= 80 else ("moderate" if overall_int >= 55 else "attention_needed"),
            "pillars": pillars,
            "dimensions": {
                "completeness": int(round(completeness_score)),
                "uniqueness": int(round(uniqueness_score)),
                "validity": int(round(validity_score)),
                "consistency": int(round(consistency_score)),
                "structural_integrity": int(round(structural_score)),
            },
            "dimensions_detail": {
                "completeness": {"score": completeness_score, "weight": 0.25},
                "uniqueness": {"score": uniqueness_score, "weight": 0.20},
                "validity": {"score": validity_score, "weight": 0.25},
                "consistency": {"score": consistency_score, "weight": 0.20},
                "structural_integrity": {"score": structural_score, "weight": 0.10},
            },
            "core_health": {
                "completeness": int(round(completeness_score)),
                "uniqueness": int(round(uniqueness_score)),
                "validity": int(round(validity_score)),
                "consistency": int(round(consistency_score)),
                "structural_integrity": int(round(structural_score)),
            },
            "statistical_observations": statistical_observations,
            "validation_summary": {
                "total_violations": total_violations,
                "by_column": val_audit.get("by_column", {}),
                "by_rule": val_audit.get("by_rule", {}),
            },
            "categorical_inconsistencies": cat_inconsistencies,
            "issues": issues,
            "recommendations": recommendations,
            "details": {
                "total_rows": row_count,
                "total_columns": col_count,
                "missing_cells": total_empty,
                "missing_percentage": round(missing_pct, 2),
                "duplicate_rows": duplicate_rows,
                "constant_columns": constant_cols,
                "outlier_count": outlier_count,
                "calculation_basis": "100-point documented composite: Completeness (25%), Uniqueness (20%), Validity (25%), Consistency (20%), Structural Integrity (10%). Statistical outliers are separated as observations and do not penalize core health.",
            },
        }


def compute_data_quality(
    df: pd.DataFrame,
    semantic_schema: dict[str, Any] | None = None,
    date_column: str | None = None,
) -> dict[str, Any]:
    """Convenience functional wrapper for DataQualityEngine.audit_quality."""
    res = DataQualityEngine.audit_quality(df, semantic_schema=semantic_schema, date_column=date_column)
    res["metrics"] = {
        "missing_cells": res["details"].get("missing_cells", 0),
        "missing_pct": res["details"].get("missing_percentage", 0.0),
        "duplicate_row_count": res["details"].get("duplicate_rows", 0),
        "constant_columns": res["details"].get("constant_columns", []),
    }
    formatted_recs = []
    for r in res.get("recommendations", []):
        if isinstance(r, dict):
            formatted_recs.append(r)
        else:
            formatted_recs.append({"message": str(r)})
    res["recommendations_list"] = formatted_recs
    return res
