import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertOctagon,
  Columns,
  Rows3,
  Table2,
  TriangleAlert,
  Sparkles,
  ArrowRight,
  Plus,
  LayoutGrid,
} from 'lucide-react'
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
  VisualBuilderModal,
  DashboardVisualCard,
  WorkbookRequiredModal,
} from '../components'
import {
  generateAISummary,
  getDashboardConfig,
  saveDashboardConfig,
  executeVisualize,
} from '../services/api'
import { formatNumber } from '../utils/format'

export default function Dashboard() {
  const { workbookId, overview, edaData, trendsData, anomaliesData, selectedSheet, selectSheet, sheets, loading, error } =
    useWorkbook()
  const navigate = useNavigate()
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Dynamic Dashboard Visual Builder State
  const [visuals, setVisuals] = useState([])
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [editingVisual, setEditingVisual] = useState(null)
  const [expandedVisualId, setExpandedVisualId] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)

  // Load saved dashboard configuration (MongoDB + localStorage fallback)
  useEffect(() => {
    if (!workbookId) {
      setVisuals([])
      return
    }

    let active = true
    setDashboardLoading(true)

    // Check localStorage cache first
    const localKey = `dashboard_visuals_${workbookId}`
    try {
      const cached = localStorage.getItem(localKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisuals(parsed)
        }
      }
    } catch (e) {
      // ignore JSON error
    }

    // Fetch from backend
    getDashboardConfig(workbookId)
      .then(async (res) => {
        if (!active) return
        const loadedVisuals = res?.visuals || res?.dashboard?.visuals || []
        if (Array.isArray(loadedVisuals) && loadedVisuals.length > 0) {
          // Re-compute visual data for each loaded card
          const populated = await Promise.all(
            loadedVisuals.map(async (v) => {
              try {
                const computed = await executeVisualize(workbookId, {
                  sheet: v.sheet,
                  type: v.type,
                  title: v.title,
                  config: v.config,
                  filters: v.filters || [],
                })
                return { ...v, computedResult: computed }
              } catch (err) {
                return {
                  ...v,
                  computedResult: {
                    visual_type: v.type,
                    title: v.title,
                    data: [],
                    unsupported_reason: err?.response?.data?.detail || err.message,
                  },
                }
              }
            })
          )
          setVisuals(populated)
          try {
            localStorage.setItem(localKey, JSON.stringify(populated))
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn('Dashboard config load fallback to local:', err)
      })
      .finally(() => {
        if (active) setDashboardLoading(false)
      })

    return () => {
      active = false
    }
  }, [workbookId])

  // Save dashboard visuals whenever they change
  const persistVisuals = (updatedVisuals) => {
    setVisuals(updatedVisuals)
    if (!workbookId) return

    // 1. LocalStorage fallback
    const localKey = `dashboard_visuals_${workbookId}`
    try {
      localStorage.setItem(localKey, JSON.stringify(updatedVisuals))
    } catch (e) {}

    // 2. MongoDB backend sync
    saveDashboardConfig(workbookId, {
      visuals: updatedVisuals.map((v) => ({
        id: v.id,
        sheet: v.sheet,
        type: v.type,
        title: v.title,
        config: v.config,
        filters: v.filters || [],
        style: v.style || v.computedResult?.style || null,
      })),
    }).catch((err) => {
      console.warn('Dashboard backend persistence notice:', err)
    })
  }

  // Visual card handlers (immutable functional updates)
  const handleSaveVisual = (visualItem) => {
    setVisuals((prev) => {
      const existingIdx = prev.findIndex((v) => v.id === visualItem.id)
      let updated
      if (existingIdx >= 0) {
        updated = prev.map((v) => (v.id === visualItem.id ? visualItem : v))
      } else {
        updated = [...prev, visualItem]
      }
      persistVisuals(updated)
      return updated
    })
  }

  const handleDuplicateVisual = (vis) => {
    setVisuals((prev) => {
      const duplicated = {
        ...vis,
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `vis_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
        title: `${vis.title} (Copy)`,
        created_at: Date.now(),
        updated_at: Date.now(),
      }
      const updated = [...prev, duplicated]
      persistVisuals(updated)
      return updated
    })
  }

  const handleRemoveVisual = (visId) => {
    setVisuals((prev) => {
      const updated = prev.filter((v) => v.id !== visId)
      persistVisuals(updated)
      return updated
    })
  }

  const handleRefreshVisual = async (vis) => {
    try {
      const computed = await executeVisualize(workbookId, {
        sheet: vis.sheet,
        type: vis.type,
        title: vis.title,
        config: vis.config,
        filters: vis.filters || [],
      })
      setVisuals((prev) => {
        const updated = prev.map((v) => (v.id === vis.id ? { ...v, computedResult: computed } : v))
        persistVisuals(updated)
        return updated
      })
    } catch (err) {
      console.error('Refresh visual error:', err)
    }
  }

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

  const sheetData = useMemo(() => {
    if (!edaData) return null
    return edaData[selectedSheet] || null
  }, [edaData, selectedSheet])

  const sheetEda = useMemo(() => {
    return sheetData?.status === 'ok' ? sheetData.eda : null
  }, [sheetData])

  const sheetQuality = useMemo(() => {
    return sheetData?.quality || null
  }, [sheetData])

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
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
          <div>
            <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">Dashboard</h2>
            <p className="text-xs text-secondary/80 mt-0.5">Overview of your workbook and key business insights</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsBuilderOpen(true)}
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-lg shadow-primary/20 cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Add New Visual</span>
            </button>
          </div>
        </div>

        <EmptyState />

        {/* Workbook Required Modal when user clicks Add New Visual without an active workbook */}
        <WorkbookRequiredModal
          isOpen={isBuilderOpen}
          onClose={() => setIsBuilderOpen(false)}
        />
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingVisual(null)
              setIsBuilderOpen(true)
            }}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-lg shadow-primary/20"
          >
            <Plus size={14} />
            <span>Add New Visual</span>
          </button>
          <WorkbookSelector />
        </div>
      </div>

      {/* KPI Cards Row - Workbook Totals vs Active Sheet Level */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Workbook Overview (All Sheets)</span>
          <span className="text-[11px] text-primary/90 font-medium">Active Sheet: <strong className="text-white">{selectedSheet}</strong> ({profile?.rows || 0} rows, {calculatedColumns} cols)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
          <KPICard label="Workbook Rows" value={formatNumber(calculatedTotalRows, 0)} sub={`${summary.sheet_count || sheets.length} total sheet(s)`} icon={Rows3} color="#60A5FA" />
          <KPICard label="Active Sheet Cols" value={formatNumber(calculatedColumns, 0)} sub={`${selectedSheet} fields`} icon={Columns} color="#60A5FA" />
          <KPICard label="Sheet Health" value={`${sheetQuality?.overall_score ?? profile?.health_score ?? 85}%`} sub={`${selectedSheet} integrity`} icon={Table2} color="#34D399" />
          <KPICard label="Workbook Missing" value={formatNumber(summary.total_missing ?? 0, 0)} sub="Across all sheets" icon={TriangleAlert} color="#FBBF24" />
          <KPICard label="Workbook Dups" value={formatNumber(summary.total_duplicates ?? 0, 0)} sub={summary.total_duplicates > 0 ? "Detected across sheets" : "Clean uniqueness"} icon={AlertOctagon} color="#FB7185" />
        </div>
      </div>

      {/* PERMANENT CORE DASHBOARD: Trend Overview (Default Visual) + AI Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[14px] font-bold text-ink">Trend Overview</div>
              <div className="text-[11px] text-muted">Chronological analysis of numeric series across {selectedSheet}</div>
            </div>
            <button
              onClick={() => {
                setEditingVisual(null)
                setIsBuilderOpen(true)
              }}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 font-bold shadow-md shadow-primary/20"
            >
              <Plus size={12} /> Add Visual
            </button>
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

      {/* CUSTOM DASHBOARD VISUALIZATIONS SECTION */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-ink">Custom Visualizations</div>
            <div className="text-[11px] text-muted">
              {visuals.length > 0
                ? `${visuals.length} visual${visuals.length > 1 ? 's' : ''} added to your personal dashboard`
                : 'Add multi-sheet custom charts, metrics, maps, or pivot tables'}
            </div>
          </div>
          <button
            onClick={() => {
              setEditingVisual(null)
              setIsBuilderOpen(true)
            }}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold shadow-md shadow-primary/20"
          >
            <Plus size={13} />
            <span>Add New Visual</span>
          </button>
        </div>

        {/* Custom Visuals Grid */}
        {visuals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {visuals.map((vis) => (
              <DashboardVisualCard
                key={vis.id}
                visual={vis}
                isExpanded={expandedVisualId === vis.id}
                onToggleResize={() =>
                  setExpandedVisualId(expandedVisualId === vis.id ? null : vis.id)
                }
                onEdit={() => {
                  setEditingVisual(vis)
                  setIsBuilderOpen(true)
                }}
                onDuplicate={() => handleDuplicateVisual(vis)}
                onRemove={() => handleRemoveVisual(vis.id)}
                onRefresh={() => handleRefreshVisual(vis)}
              />
            ))}
          </div>
        ) : (
          /* Clean Empty Call-to-action for Custom Visuals */
          <div className="glass-panel p-6 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
              <LayoutGrid size={20} />
            </div>
            <h4 className="text-sm font-bold text-ink">No custom visuals added yet</h4>
            <p className="text-xs text-muted max-w-sm">
              Keep the core Trend Overview above while creating additional charts, scorecards, pie charts, scatter plots, or matrices.
            </p>
            <button
              onClick={() => {
                setEditingVisual(null)
                setIsBuilderOpen(true)
              }}
              className="mt-2 btn-primary text-xs py-2 px-4 flex items-center gap-1.5 font-bold shadow-lg shadow-primary/20"
            >
              <Plus size={13} />
              <span>+ Add New Visual</span>
            </button>
          </div>
        )}
      </div>

      {/* Visual Builder Modal */}
      <VisualBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => {
          setIsBuilderOpen(false)
          setEditingVisual(null)
        }}
        workbookId={workbookId}
        sheets={sheets}
        initialVisual={editingVisual}
        onSaveVisual={handleSaveVisual}
      />

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
