import pandas as pd

from analyzer.command_center import run_command


def test_graph_command_generates_plot():
    df = pd.DataFrame({"Month": ["Jan", "Feb", "Mar"], "Revenue": [10, 20, 30]})

    result = run_command(df, "graph Revenue by Month as line")

    assert result["kind"] == "graph"
    assert result["figure"] is not None
    assert "Revenue" in result["message"]


def test_pivot_command_generates_table():
    df = pd.DataFrame(
        {
            "Region": ["North", "North", "South"],
            "Revenue": [10, 20, 30],
        }
    )

    result = run_command(df, "pivot rows=Region values=Revenue agg=sum")

    assert result["kind"] == "pivot"
    assert result["table"].loc["North", "Revenue"] == 30


def test_formula_command_adds_derived_column():
    df = pd.DataFrame({"Revenue": [100, 200], "Profit": [25, 50]})

    result = run_command(df, "formula Margin = (Profit / Revenue) * 100")

    assert result["kind"] == "formula"
    assert "Margin" in result["updated_df"].columns
    assert result["updated_df"].loc[0, "Margin"] == 25