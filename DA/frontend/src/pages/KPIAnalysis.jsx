import React, { useMemo } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Gauge,
  HelpCircle,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWorkbook } from '../context/WorkbookContext'
import { EmptyState, WorkbookSelector } from '../components'
import { formatCompact, formatNumber, formatPercent } from '../utils/format'

export default function KPIAnalysis() {
  const { workbookId, trendsData, selectedSheet, sheets, selectSheet, edaData } = useWorkbook()
  const navigate = useNavigate()

  const sheetTrends = useMemo(() => {
    if (!trendsData?.trends) return {}
    return trendsData.trends[selectedSheet] || {}
  }, [trendsData, selectedSheet])

  const sheetEda = useMemo(() => {
    if (!edaData) return null
    const entry = edaData[selectedSheet]
    return entry?.status === 'ok' ? entry.eda : null
  }, [edaData, selectedSheet])

  const kpis = useMemo(() => {
    const metrics = Object.values(sheetTrends)
    const stats = sheetEda?.numeric_statistics || {}

    return metrics.map((m) => {
      const colStats = stats[m.metric] || {}
      return {
        metric: m.metric,
        trend_score: m.trend_score,
        change_pct: m.change_pct,
        direction: m.direction,
        volatility: m.volatility_pct,
        confidence: m.confidence,
        mean: colStats.mean,
        min: colStats.min,
        max: colStats.max,
        observations: m.observations,
      }
    })
  }, [sheetTrends, sheetEda])

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">KPI Analysis</h2>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">KPI Analysis</h2>
          <p className="text-xs text-secondary/80 mt-0.5">
            Key performance indicators, growth trajectories, and executive metric scorecards
          </p>
        </div>
        <WorkbookSelector />
      </div>

      {/* Sheet Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {sheets.map((s) => (
          <button
            key={s.name}
            onClick={() => selectSheet(s.name)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedSheet === s.name
                ? 'bg-primary text-black font-bold shadow-glow-blue'
                : 'bg-white/[0.03] text-secondary hover:text-ink hover:bg-white/[0.07] border border-white/10'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* KPI Cards Grid */}
      {kpis.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center text-xs text-muted border border-dashed border-white/10">
          No numeric KPIs identified in this worksheet. Select another sheet to explore performance indicators.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {kpis.map((kpi) => {
            const isUp = kpi.change_pct >= 0
            const isPositiveTrend = kpi.trend_score > 20
            const isNegativeTrend = kpi.trend_score < -20

            return (
              <div key={kpi.metric} className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 group">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Metric Indicator</span>
                      <h3 className="text-base font-bold text-ink mt-0.5 group-hover:text-primary transition-colors">
                        {kpi.metric}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                        isUp
                          ? 'bg-positive/15 text-positive border-positive/30'
                          : 'bg-negative/15 text-negative border-negative/30'
                      }`}
                    >
                      {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {formatPercent(kpi.change_pct, 1)}
                    </span>
                  </div>

                  {/* High level figures */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/[0.06] text-xs">
                    <div>
                      <span className="text-muted block text-[11px]">Mean Value</span>
                      <span className="font-bold text-ink font-mono text-sm">
                        {kpi.mean != null ? formatCompact(kpi.mean) : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[11px]">Trend Score</span>
                      <span
                        className={`font-bold font-mono text-sm ${
                          isPositiveTrend ? 'text-positive' : isNegativeTrend ? 'text-negative' : 'text-secondary'
                        }`}
                      >
                        {kpi.trend_score} / 100
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[11px]">Peak Value</span>
                      <span className="font-bold text-ink font-mono">
                        {kpi.max != null ? formatCompact(kpi.max) : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[11px]">Confidence</span>
                      <span className="font-bold text-secondary font-mono">{kpi.confidence}</span>
                    </div>
                  </div>
                </div>

                {/* Explain Button */}
                <button
                  onClick={() =>
                    navigate('/ask-data', {
                      state: { initialQuery: `Explain the KPI performance, trends, and volatility for ${kpi.metric}` },
                    })
                  }
                  className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 font-semibold"
                >
                  <Sparkles size={13} className="text-ai" />
                  <span>Explain KPI with AI</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
