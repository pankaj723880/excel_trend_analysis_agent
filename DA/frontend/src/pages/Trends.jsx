import React, { useMemo, useState } from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import WorkbookSelector from '../components/WorkbookSelector'
import EmptyState from '../components/EmptyState'
import TrendChart from '../components/TrendChart'
import TrendSummary from '../components/TrendSummary'
import { formatNumber, formatPercent } from '../utils/format'
import { TrendingUp, Sparkles, AlertCircle } from 'lucide-react'

export default function Trends() {
  const { workbookId, trendsData, selectedSheet } = useWorkbook()
  const [selectedMetric, setSelectedMetric] = useState('')

  const sheetTrends = useMemo(() => {
    if (!trendsData?.trends) return {}
    return trendsData.trends[selectedSheet] || {}
  }, [trendsData, selectedSheet])

  const metrics = useMemo(() => Object.keys(sheetTrends), [sheetTrends])
  const activeMetric = selectedMetric && metrics.includes(selectedMetric) ? selectedMetric : metrics[0] || ''
  const activeTrend = sheetTrends[activeMetric] || null

  if (!workbookId) return <EmptyState message="No workbook loaded" />

  const getBadgeStyle = (direction) => {
    const dir = (direction || '').toLowerCase()
    if (dir.includes('up')) {
      return { text: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.25)' }
    } else if (dir.includes('down')) {
      return { text: '#FB7185', bg: 'rgba(251, 113, 133, 0.12)', border: 'rgba(251, 113, 133, 0.25)' }
    }
    return { text: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)' }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Trend Analysis
          </h1>
          <p className="text-sm text-secondary mt-1">
            Statistical regression, moving averages, and trajectory modeling across sheet dimensions.
          </p>
        </div>
        <WorkbookSelector />
      </div>

      {!metrics.length && (
        <div className="glass-panel p-12 text-center text-secondary text-sm">
          No numerical metrics detected in <span className="text-white font-semibold">{selectedSheet}</span> to model trends.
        </div>
      )}

      {metrics.length > 0 && (
        <>
          {/* Primary 2fr / 1fr Layout: Chart + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-5 lg:col-span-2">
              <TrendChart
                workbookId={workbookId}
                sheetName={selectedSheet}
                metrics={metrics}
                initialMetric={activeMetric}
                height={360}
              />
            </div>
            <div className="glass-panel p-5">
              <TrendSummary trend={activeTrend} />
            </div>
          </div>

          {/* AI Explanation Callout */}
          <div className="glass-card-ai p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-ai shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ai">AI Trend Interpretation</div>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                Evaluating active metric <span className="text-white font-medium">{activeMetric}</span>: regression slope indicates a <span className="text-white font-medium">{activeTrend?.direction || 'stable'}</span> trajectory with {activeTrend?.confidence || 'High'} statistical confidence. Volatility quotient is constrained at {formatPercent(activeTrend?.volatility_pct, 1)}.
              </p>
            </div>
          </div>

          {/* All Metrics Table */}
          <div className="glass-panel p-5 space-y-4">
            <div className="border-b border-glass-border pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                All Audited Numerical Metrics — {selectedSheet}
              </h3>
              <span className="text-xs text-muted">Click row to switch chart</span>
            </div>
            <div className="overflow-x-auto border border-glass-border rounded-lg bg-black/20">
              <table className="table-base text-xs">
                <thead>
                  <tr>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Metric</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Direction</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Score</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Change %</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Volatility</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Confidence</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Momentum</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">R²</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics
                    .map((metric) => sheetTrends[metric])
                    .filter(Boolean)
                    .sort((a, b) => Math.abs(b.trend_score) - Math.abs(a.trend_score))
                    .map((trend) => {
                      const badge = getBadgeStyle(trend.direction)
                      const isSelected = trend.metric === activeMetric
                      return (
                        <tr
                          key={trend.metric}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/20 border-l-2 border-primary' : 'hover:bg-white/[0.04]'}`}
                          onClick={() => setSelectedMetric(trend.metric)}
                        >
                          <td className="font-semibold text-white">{trend.metric}</td>
                          <td>
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1"
                              style={{ color: badge.text, backgroundColor: badge.bg, borderColor: badge.border }}
                            >
                              {trend.direction}
                            </span>
                          </td>
                          <td className="font-bold" style={{ color: badge.text }}>
                            {formatNumber(trend.trend_score, 0)}
                          </td>
                          <td className="font-medium text-white">{formatPercent(trend.change_pct, 1)}</td>
                          <td className="text-secondary">{formatPercent(trend.volatility_pct, 1)}</td>
                          <td>
                            <span className={trend.confidence === 'High' ? 'text-emerald-400 font-semibold' : 'text-secondary'}>
                              {trend.confidence}
                            </span>
                          </td>
                          <td className="capitalize text-secondary">{trend.momentum}</td>
                          <td className="text-secondary font-mono text-xs">{formatNumber(trend.r2, 2)}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
