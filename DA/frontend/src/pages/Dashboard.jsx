import React, { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, Columns, Rows3, Table2, TriangleAlert, Sparkles, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWorkbook } from '../context/WorkbookContext'
import {
  AIInsights,
  KPICard,
  TrendChart,
  TrendSummary,
  DataQualityCard,
  EDAStatistics,
  WorkbookSelector,
  EmptyState,
} from '../components'
import { generateAISummary } from '../services/api'
import { formatNumber } from '../utils/format'

export default function Dashboard() {
  const { workbookId, overview, edaData, trendsData, anomaliesData, selectedSheet, selectSheet, sheets, loading, error } =
    useWorkbook()
  const navigate = useNavigate()
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Reset AI result when workbook changes
  useEffect(() => {
    if (!workbookId) {
      setAiResult(null)
    } else {
      setAiResult(null)
    }
  }, [workbookId])

  const sheetInfo = useMemo(() => sheets.find((sheet) => sheet.name === selectedSheet) || null, [sheets, selectedSheet])
  const profile = useMemo(() => {
    if (!overview?.profile) return null
    return overview.profile[selectedSheet] || null
  }, [overview, selectedSheet])

  const sheetEda = useMemo(() => {
    if (!edaData) return null
    const entry = edaData[selectedSheet]
    return entry?.status === 'ok' ? entry.eda : null
  }, [edaData, selectedSheet])

  const sheetTrends = useMemo(() => {
    if (!trendsData?.trends) return null
    return trendsData.trends[selectedSheet] || {}
  }, [trendsData, selectedSheet])

  const sheetAnomalies = useMemo(() => {
    if (!anomaliesData) return null
    return anomaliesData[selectedSheet] || { all: [], total: 0 }
  }, [anomaliesData, selectedSheet])

  const bestMetric = useMemo(() => {
    if (!sheetTrends || !Object.keys(sheetTrends).length) return null
    return Object.values(sheetTrends).sort((a, b) => Math.abs(b.trend_score) - Math.abs(a.trend_score))[0]
  }, [sheetTrends])

  const metrics = useMemo(() => {
    return Object.keys(sheetTrends || {})
  }, [sheetTrends])

  const outlierTotal = sheetEda?.total_outliers_iqr ?? 0

  const handleGenerateAI = async () => {
    if (!workbookId || aiLoading) return
    setAiLoading(true)
    try {
      const result = await generateAISummary(workbookId)
      setAiResult(result)
    } catch (err) {
      setAiResult({ source: 'error', markdown: `AI summary failed: ${err?.response?.data?.detail || err.message}` })
    } finally {
      setAiLoading(false)
    }
  }

  const summary = overview?.analysis_summary || {}

  const calculatedSheetCount = useMemo(() => {
    if (summary.sheet_count && summary.sheet_count > 0) return summary.sheet_count
    return sheets.length || 0
  }, [summary.sheet_count, sheets])

  const calculatedTotalRows = useMemo(() => {
    if (summary.total_rows && summary.total_rows > 0) return summary.total_rows
    return sheets.reduce((acc, s) => acc + (s.rows || s.row_count || 0), 0)
  }, [summary.total_rows, sheets])

  const calculatedColumns = useMemo(() => {
    if (typeof sheetInfo?.columns === 'number') return sheetInfo.columns
    if (Array.isArray(sheetInfo?.columns)) return sheetInfo.columns.length
    if (sheetInfo?.column_count) return sheetInfo.column_count
    if (profile?.columns) return profile.columns
    if (sheetInfo?.numeric_columns || sheetInfo?.categorical_columns) {
      return (sheetInfo.numeric_columns?.length || 0) + (sheetInfo.categorical_columns?.length || 0)
    }
    return 0
  }, [sheetInfo, profile])

  if (!workbookId) {
    return (
      <div>
        <h2 className="text-lg font-bold text-ink mb-5">Dashboard</h2>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {error && !loading && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger backdrop-blur-md">
          {error}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">Dashboard</h2>
          <p className="text-xs text-secondary/80 mt-0.5">Overview of your workbook and key business insights</p>
        </div>
        <WorkbookSelector />
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        <KPICard label="Total Rows" value={formatNumber(calculatedTotalRows, 0)} sub="Total records" icon={Rows3} color="#60A5FA" />
        <KPICard label="Total Columns" value={formatNumber(calculatedColumns, 0)} sub="Data fields" icon={Columns} color="#60A5FA" />
        <KPICard label="Data Health" value={`${profile?.health_score ?? 85}%`} sub="Overall score" icon={Table2} color="#34D399" />
        <KPICard label="Missing Values" value={formatNumber(summary.total_missing ?? 0, 0)} sub="Needs attention" icon={TriangleAlert} color="#FBBF24" />
        <KPICard label="Duplicate Rows" value={formatNumber(summary.total_duplicates ?? 0, 0)} sub={summary.total_duplicates > 0 ? "Detected duplicates" : "Clean uniqueness"} icon={AlertOctagon} color="#FB7185" />
      </div>

      {/* Primary Analytics Grid: 2fr Chart + 1fr AI Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[14px] font-bold text-ink">Trend Overview</div>
              <div className="text-[11px] text-muted">Chronological analysis of numeric series across {selectedSheet}</div>
            </div>
          </div>
          {metrics.length ? (
            <TrendChart
              workbookId={workbookId}
              sheetName={selectedSheet}
              metrics={metrics}
              initialMetric={bestMetric?.metric}
              height={320}
              sheets={sheets.map((s) => s.name)}
              selectedSheet={selectedSheet}
              onSelectSheet={selectSheet}
            />
          ) : (
            <div className="h-[320px] flex items-center justify-center text-xs text-muted border border-dashed border-white/10 rounded-xl">
              No numeric metrics detected in this sheet.
            </div>
          )}
        </div>

        {/* AI Insight Card */}
        <div className="glass-card-ai p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-ai flex items-center gap-1.5">
                <Sparkles size={13} /> Executive AI Insight
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ai/15 text-ai border border-ai/30">
                PANDAS VERIFIED
              </span>
            </div>

            {bestMetric ? (
              <div className="space-y-3">
                <div className="text-base font-bold text-ink">
                  {bestMetric.metric}
                </div>
                <div className="text-xs text-secondary leading-relaxed">
                  Strongest observed trend momentum is <strong>{bestMetric.direction?.toLowerCase()}</strong> with an estimated period shift of <strong className={bestMetric.change_pct >= 0 ? "text-positive" : "text-negative"}>{bestMetric.change_pct}%</strong> and R² confidence rating of <strong>{bestMetric.confidence}</strong>.
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Trend Score</span>
                    <span className="font-bold text-primary font-mono">{bestMetric.trend_score} / 100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Volatility Rate</span>
                    <span className="font-bold text-warning font-mono">{bestMetric.volatility_pct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Regression Fit</span>
                    <span className="font-bold text-secondary font-mono">{bestMetric.r2 != null ? bestMetric.r2.toFixed(3) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted py-8 text-center">
                Select a worksheet with numerical variables to generate automated executive trend insights.
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/ai-analyst')}
            className="w-full mt-4 btn-ai text-xs py-2 flex items-center justify-center gap-1.5 font-bold"
          >
            <span>Launch Deep AI Analysis</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Secondary Analytics: EDA Overview & Data Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[14px] font-bold text-ink">Exploratory Data Summary</div>
              <div className="text-[11px] text-muted">Distribution statistics & descriptive measures</div>
            </div>
            <button
              onClick={() => navigate('/eda')}
              className="text-xs text-primary hover:text-ink font-semibold flex items-center gap-1 transition-colors"
            >
              Open EDA Profiler <ArrowRight size={13} />
            </button>
          </div>
          <EDAStatistics statistics={sheetEda?.numeric_statistics || null} />
        </div>

        <div className="glass-panel p-5 rounded-2xl">
          <DataQualityCard profile={profile} outlierCount={outlierTotal} />
        </div>
      </div>

      {/* Ask Your Data Quick Prompt */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ai flex items-center gap-1.5 mb-1.5">
            <Sparkles size={13} /> What would you like to know about your data?
          </div>
          <h3 className="text-lg font-bold text-ink mb-2">Ask natural language questions</h3>
          <p className="text-xs text-secondary/80 mb-4">
            Directly query metrics, calculations, anomalies, or performance comparisons verified deterministically by Pandas.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const query = e.target.elements.dashboardQuery.value
              if (query?.trim()) {
                navigate('/ask-data', { state: { initialQuery: query.trim() } })
              }
            }}
            className="flex gap-2"
          >
            <input
              name="dashboardQuery"
              placeholder="Ask anything about your workbook... (e.g. Which metric has the highest growth?)"
              className="input text-xs py-2.5 px-3.5 flex-1"
            />
            <button type="submit" className="btn-ai text-xs px-4 py-2.5 font-bold shrink-0">
              Query Data
            </button>
          </form>

          {/* Dynamic Suggestion Chips */}
          <div className="flex flex-wrap gap-2 mt-3.5">
            {[
              `What is the overall trend in ${selectedSheet}?`,
              'Are there any unusual values or outliers?',
              'Show me data quality issues in this sheet',
              'Summarize key takeaways for executives',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => navigate('/ask-data', { state: { initialQuery: chip } })}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-secondary hover:text-ink border border-white/10 transition-colors cursor-pointer text-left"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights Full Executive Report Block */}
      <AIInsights
        result={aiResult}
        loading={aiLoading}
        onGenerate={handleGenerateAI}
        workbookId={workbookId}
      />
    </div>
  )
}
