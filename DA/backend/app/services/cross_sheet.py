"""Cross-sheet relationship and schema linking engine.

Detects relationships between sheets:
- Shared / overlapping columns
- Candidate primary keys per sheet
- Candidate foreign key relationships
- Match rate and row coverage
- Multi-sheet join feasibility
"""
from __future__ import annotations

from typing import Any
import pandas as pd


def detect_cross_sheet_relationships(workbook: dict[str, pd.DataFrame]) -> dict[str, Any]:
    """Detect relationships, candidate keys, and shared dimensions across sheets."""
    sheet_names = [s for s, df in workbook.items() if isinstance(df, pd.DataFrame) and not df.empty and "__error__" not in df.columns]
    
    if len(sheet_names) < 2:
        return {
            "available": False,
            "reason": f"Cross-sheet analysis requires at least 2 usable sheets (found {len(sheet_names)}).",
            "candidate_keys": {},
            "relationships": [],
            "join_recommendations": [],
        }

    candidate_keys: dict[str, list[str]] = {}
    sheet_columns: dict[str, set[str]] = {}

    # Step 1: Detect candidate primary keys per sheet
    for s_name in sheet_names:
        df = workbook[s_name]
        n_rows = len(df)
        keys = []
        col_set = set()
        
        for col in df.columns:
            str_col = str(col)
            col_set.add(str_col)
            series = df[col].dropna()
            
            # Key criteria: non-empty, high uniqueness, identifier or code-like
            if n_rows > 0 and len(series) == n_rows and series.nunique() == n_rows:
                keys.append(str_col)
            elif n_rows > 0 and len(series) >= n_rows * 0.95 and series.nunique() >= n_rows * 0.95:
                # Quasi-identifier candidate
                col_lower = str_col.lower()
                if any(k in col_lower for k in ["id", "code", "key", "num", "ref", "sku"]):
                    keys.append(str_col)

        candidate_keys[s_name] = keys
        sheet_columns[s_name] = col_set

    # Step 2: Detect pairwise relationships
    relationships = []
    join_recommendations = []

    for i in range(len(sheet_names)):
        for j in range(i + 1, len(sheet_names)):
            s1 = sheet_names[i]
            s2 = sheet_names[j]
            df1 = workbook[s1]
            df2 = workbook[s2]

            cols1 = sheet_columns[s1]
            cols2 = sheet_columns[s2]
            common = cols1.intersection(cols2)

            for col in common:
                s1_vals = set(df1[col].dropna().astype(str).unique())
                s2_vals = set(df2[col].dropna().astype(str).unique())

                if not s1_vals or not s2_vals:
                    continue

                overlap = s1_vals.intersection(s2_vals)
                overlap_count = len(overlap)
                
                if overlap_count == 0:
                    continue

                coverage_s1 = round((overlap_count / len(s1_vals)) * 100, 1)
                coverage_s2 = round((overlap_count / len(s2_vals)) * 100, 1)

                is_key_s1 = col in candidate_keys[s1]
                is_key_s2 = col in candidate_keys[s2]

                rel_type = "many-to-many"
                if is_key_s1 and is_key_s2:
                    rel_type = "one-to-one"
                elif is_key_s1:
                    rel_type = "one-to-many (Sheet 1 is Primary)"
                elif is_key_s2:
                    rel_type = "one-to-many (Sheet 2 is Primary)"

                relationship_entry = {
                    "sheet_a": s1,
                    "sheet_b": s2,
                    "column": col,
                    "relationship_type": rel_type,
                    "common_distinct_values": overlap_count,
                    "sheet_a_coverage_pct": coverage_s1,
                    "sheet_b_coverage_pct": coverage_s2,
                    "is_key_candidate": is_key_s1 or is_key_s2,
                }
                relationships.append(relationship_entry)

                if (coverage_s1 >= 50.0 or coverage_s2 >= 50.0) and (is_key_s1 or is_key_s2 or overlap_count >= 5):
                    join_recommendations.append({
                        "primary_sheet": s1 if is_key_s1 else (s2 if is_key_s2 else s1),
                        "foreign_sheet": s2 if is_key_s1 else (s1 if is_key_s2 else s2),
                        "join_key": col,
                        "match_confidence": "High" if min(coverage_s1, coverage_s2) > 70 else "Moderate",
                        "summary": f"Join {s1} and {s2} on '{col}' ({overlap_count} overlapping keys).",
                    })

    return {
        "available": True,
        "sheets_evaluated": len(sheet_names),
        "candidate_keys": candidate_keys,
        "relationships": relationships,
        "join_recommendations": join_recommendations,
        "relationship_count": len(relationships),
    }
