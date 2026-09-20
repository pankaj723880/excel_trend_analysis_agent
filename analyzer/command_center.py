import re

import numpy as np
import pandas as pd
import plotly.express as px


SAFE_FUNCTIONS = {
    "abs": np.abs,
    "clip": np.clip,
    "exp": np.exp,
    "log": np.log,
    "round": np.round,
    "sqrt": np.sqrt,
    "where": np.where,
}


def _resolve_column_name(df, requested_name):
    requested = str(requested_name).strip()
    lower_requested = requested.lower()

    for column in df.columns:
        if str(column).strip().lower() == lower_requested:
            return column

    for column in df.columns:
        column_text = str(column).strip().lower()
        if lower_requested in column_text:
            return column

    return None


def _infer_numeric_column(df):
    numeric_columns = df.select_dtypes(include="number").columns.tolist()
    return numeric_columns[0] if numeric_columns else None


def _infer_grouping_column(df, exclude=None):
    exclude = set(exclude or [])
    for column in df.columns:
        if column in exclude:
            continue
        if not pd.api.types.is_numeric_dtype(df[column]):
            return column
    return None


def _extract_named_argument(command, names):
    for name in names:
        pattern = rf"(?:^|\s){name}\s*=\s*(.+?)(?=\s+(?:rows?|index|cols?|columns?|values?|value|agg|aggfunc)\s*=|$)"
        match = re.search(pattern, command, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def parse_command(command_text):
    command = (command_text or "").strip()
    if not command:
        return {"type": "empty"}

    lower = command.lower()

    if lower.startswith(("graph ", "plot ", "chart ")):
        remainder = command.split(" ", 1)[1].strip()
        chart_type = "line"

        chart_match = re.search(r"\b(as|type)\s+(line|bar|scatter|area)\b", remainder, flags=re.IGNORECASE)
        if chart_match:
            chart_type = chart_match.group(2).lower()
            remainder = re.sub(r"\b(as|type)\s+(line|bar|scatter|area)\b", "", remainder, flags=re.IGNORECASE).strip()

        by_match = re.search(r"\b(by|x)\s+(.+)$", remainder, flags=re.IGNORECASE)
        x_column = None
        if by_match:
            x_column = by_match.group(2).strip()
            remainder = remainder[: by_match.start()].strip()

        return {
            "type": "graph",
            "chart_type": chart_type,
            "y_column": remainder,
            "x_column": x_column,
        }

    if lower.startswith("pivot "):
        return {
            "type": "pivot",
            "rows": _extract_named_argument(command, ["rows", "row", "index"]),
            "columns": _extract_named_argument(command, ["cols", "col", "columns", "column"]),
            "values": _extract_named_argument(command, ["values", "value"]),
            "agg": (_extract_named_argument(command, ["agg", "aggfunc"]) or "sum").lower(),
        }

    if lower.startswith("formula "):
        remainder = command.split(" ", 1)[1].strip()
        formula_match = re.match(r"(?:(?P<name>.+?)\s*=\s*)?(?P<expr>.+)$", remainder)
        if formula_match:
            return {
                "type": "formula",
                "name": (formula_match.group("name") or "Calculated Result").strip(),
                "expression": formula_match.group("expr").strip(),
            }

    return {"type": "unknown", "raw": command}


def _prepare_formula_expression(df, expression):
    temp_df = pd.DataFrame(index=df.index)
    safe_expression = str(expression)

    for index, column in enumerate(sorted(df.columns, key=lambda value: len(str(value)), reverse=True)):
        safe_name = f"col_{index}"
        temp_df[safe_name] = pd.to_numeric(df[column], errors="coerce")
        safe_expression = re.sub(re.escape(str(column)), safe_name, safe_expression, flags=re.IGNORECASE)

    return temp_df, safe_expression


def run_command(df, command_text):
    spec = parse_command(command_text)

    if spec["type"] == "empty":
        return {
            "kind": "empty",
            "title": "No command entered",
            "message": "Type a graph, pivot, or formula command to process the sheet.",
        }

    if spec["type"] == "graph":
        y_column = _resolve_column_name(df, spec["y_column"])
        if y_column is None:
            return {
                "kind": "error",
                "title": "Graph command failed",
                "message": f"Could not find the data column '{spec['y_column']}'.",
            }

        x_column = _resolve_column_name(df, spec["x_column"]) if spec.get("x_column") else None
        chart_type = spec["chart_type"]
        series = pd.to_numeric(df[y_column], errors="coerce")
        plot_df = pd.DataFrame({y_column: series})

        if x_column is not None:
            plot_df[x_column] = df[x_column]
        else:
            plot_df["Observation"] = df.index
            x_column = "Observation"

        plot_df = plot_df.dropna(subset=[y_column])
        if plot_df.empty:
            return {
                "kind": "error",
                "title": "Graph command failed",
                "message": f"'{y_column}' did not contain usable numeric values.",
            }

        if chart_type == "bar":
            figure = px.bar(plot_df, x=x_column, y=y_column, title=f"{y_column} by {x_column}")
        elif chart_type == "scatter":
            figure = px.scatter(plot_df, x=x_column, y=y_column, title=f"{y_column} by {x_column}")
        elif chart_type == "area":
            figure = px.area(plot_df, x=x_column, y=y_column, title=f"{y_column} by {x_column}")
        else:
            figure = px.line(plot_df, x=x_column, y=y_column, title=f"{y_column} by {x_column}")

        figure.update_layout(height=450)

        return {
            "kind": "graph",
            "title": f"{chart_type.title()} chart for {y_column}",
            "message": f"Generated a {chart_type} chart for '{y_column}'.",
            "figure": figure,
            "table": plot_df.head(20),
        }

    if spec["type"] == "pivot":
        rows_column = _resolve_column_name(df, spec["rows"]) if spec.get("rows") else _infer_grouping_column(df)
        values_column = _resolve_column_name(df, spec["values"]) if spec.get("values") else _infer_numeric_column(df)
        columns_column = _resolve_column_name(df, spec["columns"]) if spec.get("columns") else None
        aggfunc = spec["agg"] if spec.get("agg") in {"sum", "mean", "median", "count", "min", "max"} else "sum"

        if rows_column is None or values_column is None:
            return {
                "kind": "error",
                "title": "Pivot command failed",
                "message": "Pivot needs at least one grouping column and one numeric values column.",
            }

        pivot = pd.pivot_table(
            df,
            index=rows_column,
            columns=columns_column,
            values=values_column,
            aggfunc=aggfunc,
        )

        return {
            "kind": "pivot",
            "title": "Pivot table",
            "message": f"Created a pivot table using rows='{rows_column}', values='{values_column}', agg='{aggfunc}'.",
            "table": pivot,
        }

    if spec["type"] == "formula":
        temp_df, safe_expression = _prepare_formula_expression(df, spec["expression"])

        try:
            result = temp_df.eval(safe_expression, engine="python", local_dict=SAFE_FUNCTIONS)
        except Exception as exc:
            return {
                "kind": "error",
                "title": "Formula command failed",
                "message": f"Could not evaluate the formula: {exc}",
            }

        updated_df = df.copy()
        updated_df[spec["name"]] = result

        return {
            "kind": "formula",
            "title": f"Formula: {spec['name']}",
            "message": f"Calculated '{spec['name']}' from the provided expression.",
            "table": updated_df[[spec["name"]]].head(20),
            "updated_df": updated_df,
        }

    return {
        "kind": "error",
        "title": "Unknown command",
        "message": "Use graph, pivot, or formula commands.",
    }


def command_help_text():
    return (
        "Examples: graph Revenue by Month as line | pivot rows=Region values=Revenue agg=sum | "
        "formula Margin = (Profit / Revenue) * 100"
    )