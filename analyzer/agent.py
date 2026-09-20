import os
import pandas as pd

def _fallback_summary(results):
    if results.empty:
        return "No analyzable numeric trends were found."

    top_up = results.sort_values("trend_score", ascending=False).head(3)
    top_down = results.sort_values("trend_score").head(3)

    lines = ["## Executive analysis", ""]
    lines.append("### Strongest upward trends")
    for _, r in top_up.iterrows():
        lines.append(
            f"- **{r['column']}** ({r['Sheet']}): {r['direction']}, "
            f"{r['change_pct']:.2f}% estimated period change, "
            f"{r['confidence']} confidence."
        )

    lines.append("")
    lines.append("### Strongest downward trends")
    for _, r in top_down.iterrows():
        lines.append(
            f"- **{r['column']}** ({r['Sheet']}): {r['direction']}, "
            f"{r['change_pct']:.2f}% estimated period change, "
            f"{r['confidence']} confidence."
        )

    lines.append("")
    lines.append("### Overall interpretation")
    median_score = results["trend_score"].median()
    if median_score > 20:
        overall = "The workbook is predominantly showing upward movement."
    elif median_score < -20:
        overall = "The workbook is predominantly showing downward movement."
    else:
        overall = "The workbook contains mixed or relatively stable movement."

    lines.append(overall)
    return "\n".join(lines)

def generate_ai_summary(results):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return _fallback_summary(results)

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        compact = results[
            ["Sheet", "column", "direction", "trend_score",
             "change_pct", "volatility_pct", "confidence", "momentum"]
        ].round(2).to_dict(orient="records")

        prompt = f"""
You are a senior data analyst. Analyze the following automated Excel trend results.

{compact}

Return a concise executive report with:
1. Overall direction of the workbook
2. Strongest positive trends
3. Strongest negative trends
4. Metrics with high volatility
5. Metrics whose momentum is accelerating or decelerating
6. 3 practical questions an analyst should investigate next

Do not invent facts that are not present in the data.
Clearly distinguish correlation/trend from causation.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text
    except Exception as exc:
        return _fallback_summary(results) + f"\n\n_AI layer unavailable: {exc}_"

def ask_data_question(df, question):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "GEMINI_API_KEY not set. Please set the environment variable to use Q&A."
        
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
        # Create a sample and schema summary to send to LLM
        schema = str(df.dtypes)
        sample = df.head(3).to_string()
        summary = df.describe().to_string()
        
        prompt = f"""
You are an expert data analyst. The user has uploaded a dataset and asked a question.
Here is the schema of the dataset:
{schema}

Here is a 3-row sample:
{sample}

Here is the statistical summary of numeric columns:
{summary}

User Question: "{question}"

Answer the question based ONLY on the provided schema and statistical summary. If the question requires executing code on the full dataset to get an exact answer (e.g., 'What is the sum of X where Y is Z?'), write a short Python Pandas code snippet that would compute the answer, assuming the dataframe is called `df`. 
Otherwise, just answer the question directly. Keep your response extremely concise.
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text
    except Exception as exc:
        return f"AI layer unavailable: {exc}"
