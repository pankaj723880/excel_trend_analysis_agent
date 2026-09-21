import React, { useMemo } from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import WorkbookSelector from '../components/WorkbookSelector'
import EmptyState from '../components/EmptyState'
import AnomalyTable from '../components/AnomalyTable'
import { formatNumber } from '../utils/format'
import { AlertOctagon, AlertTriangle, Sparkles, ShieldAlert, CheckCircle } from 'lucide-react'

function SeverityMini({ label, count, color, bg }) {
  return (
    <div className="glass-card p-4 flex flex-col justify-between min-h-[95px] relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div className="text-2xl font-bold leading-none mt-2" style={{ color: color || '#F8FAFC' }}>
        {formatNumber(count, 0)}
      </div>
    </div>
  )
}

export default function Anomalies() {
  const { workbookId, anomaliesData, selectedSheet } = useWorkbook()

  const sheetAnomalies = useMemo(() => {
    if (!anomaliesData) return { all: [], total: 0 }
    return anomaliesData[selectedSheet] || { all: [], total: 0 }
  }, [anomaliesData, selectedSheet])

  const severityCounts = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 }
    for (const anomaly of sheetAnomalies.all || []) {
      if (counts[anomaly.severity] !== undefined) counts[anomaly.severity] += 1
    }
    return counts
  }, [sheetAnomalies])

  if (!workbookId) return <EmptyState message="No workbook loaded" />

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-rose-400" /> Anomaly Detection
          </h1>
          <p className="text-sm text-secondary mt-1">
            Deterministic statistical outlier evaluation via IQR, Z-score, and moving sudden change algorithms.
          </p>
        </div>
        <WorkbookSelector />
      </div>

      {sheetAnomalies.error && (
        <div className="glass-panel p-4 border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-rose-400">Analysis unavailable</div>
            <div className="text-xs text-secondary mt-0.5">Reason: {sheetAnomalies.error}</div>
          </div>
        </div>
      )}

      {/* Severity Summary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <SeverityMini label="UNIQUE OUTLIERS" count={sheetAnomalies.unique_anomalous_observations ?? sheetAnomalies.total} color="#60A5FA" />
        <SeverityMini label="CRITICAL" count={severityCounts.Critical} color="#FB7185" />
        <SeverityMini label="HIGH" count={severityCounts.High} color="#F97316" />
        <SeverityMini label="MEDIUM" count={severityCounts.Medium} color="#FBBF24" />
        <SeverityMini label="LOW" count={severityCounts.Low} color="#A78BFA" />
      </div>

      {/* Detection Methods Breakdown */}
      {sheetAnomalies.method_counts && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted font-medium">Detection Method Breakdown:</span>
          <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-secondary">
            IQR Outliers: <strong className="text-white font-mono">{sheetAnomalies.method_counts.iqr_outliers ?? 0}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-secondary">
            Z-Score: <strong className="text-white font-mono">{sheetAnomalies.method_counts.zscore_outliers ?? 0}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-secondary">
            Sudden Changes: <strong className="text-white font-mono">{sheetAnomalies.method_counts.sudden_changes ?? 0}</strong>
          </span>
          {sheetAnomalies.method_counts.domain_violations > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400">
              Domain Violations: <strong className="font-mono">{sheetAnomalies.method_counts.domain_violations}</strong>
            </span>
          )}
        </div>
      )}

      {/* AI Explanation Banner */}
      <div className="glass-card-ai p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-ai shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ai">AI Anomaly Hypothesis</div>
          <p className="text-xs text-secondary mt-1 leading-relaxed">
            Identified <span className="text-white font-medium">{sheetAnomalies.total}</span> data points diverging past expected boundaries. Note: Statistical anomalies reflect mathematical variance (e.g. batch transactions or seasonal rushes) and should be validated against operational business logs before manual removal.
          </p>
        </div>
      </div>

      {/* Main Detected Anomalies Table */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-glass-border pb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-white">
            Detected Outliers — {selectedSheet}
          </div>
          <div className="text-xs text-muted">
            {sheetAnomalies.note || (sheetAnomalies.has_date ? 'Temporal context verified' : '')}
          </div>
        </div>
        <AnomalyTable rows={sheetAnomalies.all} />
      </div>

      {/* Missing-Value Clusters if present */}
      {sheetAnomalies.missing_clusters?.length > 0 && (
        <div className="glass-panel p-5 space-y-4">
          <div className="border-b border-glass-border pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Missing-Value Clusters
            </h3>
          </div>
          <div className="overflow-x-auto border border-glass-border rounded-lg bg-black/20">
            <table className="table-base text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Metric</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Row Interval</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Count</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Date Start</th>
                  <th className="sticky top-0 bg-[#0C1220] text-secondary">Severity</th>
                </tr>
              </thead>
              <tbody>
                {sheetAnomalies.missing_clusters.map((cluster, index) => (
                  <tr key={index} className="hover:bg-white/[0.04]">
                    <td className="font-medium text-white">{cluster.metric}</td>
                    <td className="text-secondary font-mono">
                      {cluster.start_row}–{cluster.end_row}
                    </td>
                    <td className="text-amber-400 font-semibold">{cluster.count}</td>
                    <td className="text-secondary">{cluster.date_start || '—'}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {cluster.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
