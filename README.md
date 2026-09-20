# Excel Trend Analysis Agent

An AI-assisted Excel analytics project that performs automated EDA, statistical trend detection, visualization, and optional Gemini-powered business interpretation across every worksheet in an Excel workbook.

## Features

- Upload `.xlsx` / `.xls`
- Analyze every worksheet
- Detect numeric and categorical columns
- Count missing cells and duplicates
- Generate descriptive EDA information
- Detect upward/downward/stable trends
- Calculate trend score from -100 to +100
- Estimate period change
- Measure volatility
- Estimate trend confidence using regression R²
- Detect recent momentum: accelerating, decelerating, or steady
- Interactive Plotly charts
- Workbook-level strongest rising/falling metrics
- Optional Gemini AI executive analysis
- Graceful fallback when no AI key is configured

## Architecture

```text
Excel Workbook
  ↓
FastAPI Backend (DA/backend)
  ├─ Excel Loader & Structure Detector
  ├─ EDA Profiler
  ├─ Trend Engine (Regression, Volatility, R², Momentum)
  ├─ Anomaly & Correlation Engines
  └─ AI Analyst (Gemini API Integration)
  ↓
React Frontend (DA/frontend - Vite + Tailwind CSS)
```

## Setup

### 1. Create environment

Windows:

```bash
python -m venv .venv
.venv\Scripts\activate
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Optional Gemini setup

Copy `.env.example` to `.env` and add your Gemini API key.

For a local terminal, you can alternatively set:

Windows PowerShell:
```powershell
$env:GEMINI_API_KEY="YOUR_KEY"
```

macOS/Linux:
```bash
export GEMINI_API_KEY="YOUR_KEY"
```

### 4. Run Application

#### Backend (FastAPI)
```bash
# From workspace root or DA/backend
uvicorn app.main:app --reload --port 8000
```
Backend API docs will be available at `http://localhost:8000/docs`.

#### Frontend (React + Vite)
```bash
cd DA/frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

## How trend detection works

For each numeric column:

1. Remove non-numeric/missing observations.
2. Fit a linear regression over observation order.
3. Calculate R² to estimate how consistently the series follows its trend.
4. Compare the first 20% and last 20% averages.
5. Calculate volatility from changes between consecutive observations.
6. Compare recent slope with overall slope to estimate momentum.
7. Combine normalized slope and R² into a bounded trend score from -100 to +100.

### Interpretation

- `+60 to +100`: strongly upward
- `+20 to +59`: upward
- `-19 to +19`: stable / sideways
- `-59 to -20`: downward
- `-100 to -60`: strongly downward

These are heuristic indicators. They should not be treated as causal conclusions.

## Recommended Excel structure

The strongest results come from sheets containing:

| Date | Revenue | Profit | Customers |
|---|---:|---:|---:|
| Jan | 100000 | 15000 | 1200 |
| Feb | 108000 | 16000 | 1270 |
| Mar | 115000 | 17000 | 1340 |

The current version also works with numeric tables that do not have an explicit date column, but the trend axis then represents row/observation order.

## Portfolio positioning

Suggested project title:

**AI-Powered Automated EDA & Excel Trend Analysis Agent**

Suggested resume bullet:

> Built an AI-assisted Excel analytics agent using React, FastAPI, Pandas, and SciPy that automatically profiles multi-sheet workbooks, detects statistical trends, quantifies growth, volatility and confidence, visualizes key metrics, and generates executive-level insights using Gemini.

## Future upgrades

- Automatic date-column detection
- Seasonality detection
- Forecasting with ARIMA/Prophet
- Correlation and feature relationship analysis
- Anomaly detection
- Natural-language chat over the workbook
- Exportable PDF/Excel analysis reports
- Database connectors
- Scheduled monitoring
- Email/Slack alerts
- Role-based dashboards
