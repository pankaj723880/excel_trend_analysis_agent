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
  Info,
  Layers,
  Activity,
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

  const sheetData = useMemo(() => {
    if (!edaData) return null
    return edaData[selectedSheet] || null
  }, [edaData, selectedSheet])

  const sheetQuality = sheetData?.quality || null
  const sheetValidation = sheetData?.validation || null
  const sheetCategoricalInconsistencies = sheetData?.categorical_inconsistencies || {}

  const dimensions = sheetQuality?.dimensions || {}
  const issues = sheetQuality?.issues || []
  const recommendations = sheetQuality?.recommendations || []
  const statsObs = sheetQuality?.statistical_observations || {}

  // 100% Weight Model Scores
  const health = sheetQuality?.overall_score ?? (profile?.health_score ?? 85)
  const healthRaw = sheetQuality?.overall_raw ?? health
  const healthColor = health >= 80 ? '#34D399' : health >= 55 ? '#FBBF24' : '#FB7185'

  const pillars = sheetQuality?.pillars || {}

  const completenessScore = pillars.completeness?.score ?? (typeof dimensions.completeness === 'number' ? dimensions.completeness : dimensions.completeness?.score ?? 100)
  const uniquenessScore = pillars.uniqueness?.score ?? (typeof dimensions.uniqueness === 'number' ? dimensions.uniqueness : dimensions.uniqueness?.score ?? 100)
  const validityScore = pillars.validity?.score ?? (typeof dimensions.validity === 'number' ? dimensions.validity : dimensions.validity?.score ?? 100)
  const consistencyScore = pillars.consistency?.score ?? (typeof dimensions.consistency === 'number' ? dimensions.consistency : dimensions.consistency?.score ?? 100)
  const structuralScore = pillars.structural?.score ?? (typeof dimensions.structural_integrity === 'number' ? dimensions.structural_integrity : dimensions.structural_integrity?.score ?? 100)

  const totalCells = sheetQuality?.details?.total_cells ?? profile?.total_cells ?? (profile?.rows || 1) * (profile?.columns || 1)
  const missingCells = sheetQuality?.details?.missing_cells ?? profile?.missing_cells ?? 0
  const duplicates = sheetQuality?.details?.duplicate_rows ?? profile?.duplicate_rows ?? 0
  const totalViolations = sheetValidation?.total_violations ?? sheetQuality?.validation_summary?.total_violations ?? 0
  const outliersCount = statsObs.outliers_count ?? sheetQuality?.details?.outlier_count ?? 0
  const anomaliesCount = statsObs.statistical_anomalies_count ?? outliersCount

  // Evidence-based dynamic explanation
  const dynamicExplanation = useMemo(() => {
    const points = []
    if (missingCells === 0) {
      points.push("All analyzed cells are fully populated (100% completeness).")
    } else {
      points.push(`Detected ${formatNumber(missingCells, 0)} missing values across cells (${sheetQuality?.details?.missing_percentage ?? 0}% missing).`)
    }

    if (duplicates === 0) {
      points.push("Zero duplicate records were identified (100% uniqueness).")
    } else {
      points.push(`Found ${formatNumber(duplicates, 0)} duplicate rows.`)
    }

    if (totalViolations === 0) {
      points.push("All values respect inferred domain range, non-negative count, and percentage boundaries.")
    } else {
      points.push(`Detected ${totalViolations} domain rule violation(s) (e.g. negative counts or out-of-bound percentages).`)
    }

    if (Object.keys(sheetCategoricalInconsistencies).length > 0) {
      points.push("Potential categorical casing or whitespace variants detected across text fields.")
    }

    return points.join(" ")
  }, [missingCells, duplicates, totalViolations, sheetQuality, sheetCategoricalInconsistencies])

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">Data Quality & Health</h2>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">Data Quality & Health</h2>
          <p className="text-xs text-secondary/80 mt-0.5">
            Documented 100-point composite score separating core integrity from statistical variance
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

      {/* Main Scorecard + 5 Core Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Scorecard */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
              Overall Data Health Score
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-black font-sans" style={{ color: healthColor }}>
                {health}
              </span>
              <span className="text-lg font-bold text-muted">/ 100</span>
              {healthRaw !== health && (
                <span className="text-xs text-secondary/60 ml-2 font-mono">({healthRaw})</span>
              )}
            </div>
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden border border-white/10 mb-4">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${health}%`, backgroundColor: healthColor }}
              />
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              {health >= 80
                ? 'High data fidelity across all 5 core integrity dimensions. Core data health is calculated deterministically with transparent 100% weighting.'
                : 'Attention required. Domain violations, missing elements, or structural constraints affect statistical fidelity.'}
            </p>
          </div>

          <div className="pt-4 mt-6 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-muted">Weighting Model</span>
            <span className="font-bold text-ink font-mono text-[11px]">100% Core Integrity</span>
          </div>
        </div>

        {/* 5 Core Diagnostic Pillars */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="text-[13px] font-bold text-ink">Core Integrity Pillars (100% Total Weight)</div>
            <div className="text-[11px] text-muted font-mono">Σ Weights = 1.0</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Completeness (25%)</span>
                <span className={`text-sm font-bold font-mono ${completenessScore >= 90 ? 'text-positive' : completenessScore >= 70 ? 'text-warning' : 'text-danger'}`}>
                  {completenessScore}%
                </span>
              </div>
              <div className="text-[11px] text-secondary">
                {missingCells === 0 ? 'No empty cells detected.' : `${formatNumber(missingCells, 0)} missing cell(s) (${sheetQuality?.details?.missing_percentage ?? 0}%).`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Uniqueness (20%)</span>
                <span className={`text-sm font-bold font-mono ${uniquenessScore >= 90 ? 'text-positive' : uniquenessScore >= 70 ? 'text-warning' : 'text-danger'}`}>
                  {uniquenessScore}%
                </span>
              </div>
              <div className="text-[11px] text-secondary">
                {duplicates === 0 ? 'Zero duplicate rows.' : `${formatNumber(duplicates, 0)} duplicate row(s) (${pillars.uniqueness?.issue_rate ?? 0}%).`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Validity (25%)</span>
                <span className={`text-sm font-bold font-mono ${validityScore >= 90 ? 'text-positive' : validityScore >= 70 ? 'text-warning' : 'text-danger'}`}>
                  {validityScore}%
                </span>
              </div>
              <div className="text-[11px] text-secondary">
                {totalViolations === 0 ? 'All domain rules satisfied.' : `${totalViolations} domain violation(s) (${pillars.validity?.issue_rate ?? 0}%).`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Consistency (20%)</span>
                <span className={`text-sm font-bold font-mono ${consistencyScore >= 90 ? 'text-positive' : consistencyScore >= 70 ? 'text-warning' : 'text-danger'}`}>
                  {consistencyScore}%
                </span>
              </div>
              <div className="text-[11px] text-secondary">
                {Object.keys(sheetCategoricalInconsistencies).length === 0 ? 'Consistent text casing.' : `${Object.keys(sheetCategoricalInconsistencies).length} casing variant(s) flagged.`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">Structural (10%)</span>
                <span className={`text-sm font-bold font-mono ${structuralScore >= 90 ? 'text-positive' : structuralScore >= 70 ? 'text-warning' : 'text-danger'}`}>
                  {structuralScore}%
                </span>
              </div>
              <div className="text-[11px] text-secondary">
                Column variance and schema integrity.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistical Observations Section (Separated from Core Health) */}
      <div className="glass-panel p-5 rounded-2xl border border-primary/20 bg-primary/[0.02] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Statistical Observations (Informational)
            </h3>
          </div>
          <span className="text-[11px] text-primary/80 font-medium px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            Does not penalize core data integrity
          </span>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          Statistical outliers indicate unusual observations. They are not automatically invalid data.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted font-medium">Statistical Outliers (1.5× IQR)</div>
              <div className="text-[11px] text-secondary mt-0.5">Natural tail distributions and extreme values</div>
            </div>
            <div className="text-2xl font-bold font-mono text-primary">{outliersCount}</div>
          </div>
          <div className="p-4 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted font-medium">Statistical Anomalies (Multi-method)</div>
              <div className="text-[11px] text-secondary mt-0.5">Observations flagged by Z-score, IQR, or sudden change</div>
            </div>
            <div className="text-2xl font-bold font-mono text-primary">{anomaliesCount}</div>
          </div>
        </div>
      </div>

      {/* Domain Rule Violations if any */}
      {sheetValidation?.violations?.length > 0 && (
        <div className="glass-panel p-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Deterministic Domain Validation Violations ({sheetValidation.violations.length})
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-white/10 rounded-lg">
            <table className="table-base text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Column</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Row</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Value</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Rule</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Severity</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Message</th>
                </tr>
              </thead>
              <tbody>
                {sheetValidation.violations.map((v, i) => (
                  <tr key={i} className="hover:bg-white/[0.04]">
                    <td className="font-semibold text-white">{v.column}</td>
                    <td className="font-mono text-secondary">{v.row}</td>
                    <td className="font-mono font-bold text-rose-300">{String(v.value)}</td>
                    <td className="font-mono text-secondary">{v.rule}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.severity === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {v.severity}
                      </span>
                    </td>
                    <td className="text-secondary">{v.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Categorical Inconsistencies if any */}
      {Object.keys(sheetCategoricalInconsistencies).length > 0 && (
        <div className="glass-panel p-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Potential Categorical Inconsistencies Detected
          </div>
          <p className="text-xs text-secondary">
            Variants detected across whitespace or casing. The original dataset remains unchanged unless explicitly cleaned.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {Object.entries(sheetCategoricalInconsistencies).map(([col, data]) => (
              <div key={col} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>{col}</span>
                  <span className="text-[10px] text-muted">{data.variant_count} variants</span>
                </div>
                <div className="space-y-1 text-xs">
                  {Object.entries(data.canonical_candidates || {}).map(([canonical, group]) => (
                    <div key={canonical} className="flex items-center gap-2 text-secondary text-[11px]">
                      <span className="font-semibold text-emerald-400">{canonical}</span>
                      <span className="text-muted">←</span>
                      <span className="font-mono text-slate-300">[{group.map(g => `"${g}"`).join(', ')}]</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence-Based Quality Findings & Recommendations */}
      {recommendations.length > 0 && (
        <div className="glass-panel p-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-white">
            Evidence-Based Quality Findings — {selectedSheet}
          </div>
          <div className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-secondary flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Explanation of Quality Score */}
      <div className="glass-card-ai p-6 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-ai/20 text-ai flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <h3 className="text-sm font-bold text-ink">Evidence-Based Health Explanation</h3>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          {dynamicExplanation}
        </p>
      </div>
    </div>
  )
}
