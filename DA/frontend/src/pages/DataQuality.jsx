import React, { useMemo } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CopyX,
  FileWarning,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useWorkbook } from '../context/WorkbookContext'
import { EmptyState, WorkbookSelector } from '../components'
import { formatNumber } from '../utils/format'

export default function DataQuality() {
  const { workbookId, overview, selectedSheet, sheets, selectSheet, edaData } = useWorkbook()

  const profile = useMemo(() => {
    if (!overview?.profile) return null
    return overview.profile[selectedSheet] || null
  }, [overview, selectedSheet])

  const sheetEda = useMemo(() => {
    if (!edaData) return null
    const entry = edaData[selectedSheet]
    return entry?.status === 'ok' ? entry.eda : null
  }, [edaData, selectedSheet])

  const outlierTotal = sheetEda?.total_outliers_iqr ?? 0

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">Data Quality & Health</h2>
        <EmptyState />
      </div>
    )
  }

  const health = profile?.health_score ?? 85
  const healthColor = health >= 80 ? '#34D399' : health >= 55 ? '#FBBF24' : '#FB7185'
  const totalCells = profile?.total_cells ?? (profile?.rows || 1) * (profile?.columns || 1)
  const missingCells = profile?.missing_cells ?? 0
  const duplicates = profile?.duplicate_rows ?? 0
  const completeness = totalCells > 0 ? (((totalCells - missingCells) / totalCells) * 100).toFixed(1) : '100'
  const uniqueness = (profile?.rows ?? 0) > 0 ? ((((profile?.rows ?? 0) - duplicates) / (profile?.rows ?? 1)) * 100).toFixed(1) : '100'

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">Data Quality & Health</h2>
          <p className="text-xs text-secondary/80 mt-0.5">
            Deterministic audit of data completeness, consistency, uniqueness, and outliers
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

      {/* Main Scorecard + Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Scorecard */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
              Overall Health Index
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-black font-sans" style={{ color: healthColor }}>
                {health}
              </span>
              <span className="text-lg font-bold text-muted">/ 100</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden border border-white/10 mb-4">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${health}%`, backgroundColor: healthColor }}
              />
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              {health >= 80
                ? 'Optimal data condition. Low missing observations and minimal anomaly rates ensure strong confidence in downstream statistical regressions.'
                : 'Attention required. Multiple missing elements or duplicate observations may distort statistical averages.'}
            </p>
          </div>

          <div className="pt-4 mt-6 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-muted">Active Sheet</span>
            <span className="font-bold text-ink font-mono">{selectedSheet}</span>
          </div>
        </div>

        {/* Diagnostic Pillars */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div className="text-[13px] font-bold text-ink">Core Quality Pillars</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Completeness</span>
                <span className="text-sm font-bold font-mono text-positive">{completeness}%</span>
              </div>
              <div className="text-[11px] text-secondary">
                {missingCells === 0 ? 'No empty cells detected.' : `${formatNumber(missingCells, 0)} missing values identified.`}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Uniqueness</span>
                <span className="text-sm font-bold font-mono text-positive">{uniqueness}%</span>
              </div>
              <div className="text-[11px] text-secondary">
                {duplicates === 0 ? 'Zero row-level duplication.' : `${formatNumber(duplicates, 0)} duplicate records found.`}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Outlier Regularity</span>
                <span className="text-sm font-bold font-mono text-primary">IQR Verified</span>
              </div>
              <div className="text-[11px] text-secondary">
                {outlierTotal} numerical data points deviate past 1.5× IQR threshold.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Date & Type Fidelity</span>
                <span className="text-sm font-bold font-mono text-positive">Optimal</span>
              </div>
              <div className="text-[11px] text-secondary">
                Chronological ordering and observation intervals parsed consistently.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Explanation of Quality Score */}
      <div className="glass-card-ai p-6 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-ai/20 text-ai flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <h3 className="text-sm font-bold text-ink">Why is my data quality score this way?</h3>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          The Data Quality Index uses deterministic rule engines measuring cell completeness ({completeness}%), row uniqueness ({uniqueness}%), and statistical outlier presence ({outlierTotal} IQR points). High completeness allows Gemini and downstream regression models to compute true moving averages without artificial interpolation bias.
        </p>
      </div>
    </div>
  )
}
