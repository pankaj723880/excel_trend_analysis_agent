import React from 'react'
import { AlertTriangle, CheckCircle2, CopyX, FileWarning } from 'lucide-react'
import { formatNumber } from '../utils/format'

function QualityRow({ label, value, color, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.06] last:border-0">
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 border"
        style={{
          backgroundColor: `${color}14`,
          borderColor: `${color}28`,
          color,
        }}
      >
        <Icon size={13} />
      </div>
      <span className="text-[12px] text-muted flex-1 font-medium">{label}</span>
      <span className="text-[12px] font-bold font-mono text-ink">{value}</span>
    </div>
  )
}

export default function DataQualityCard({ profile, outlierCount = 0 }) {
  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center text-[12px] text-muted min-h-[200px]">
        No data quality information for this sheet.
      </div>
    )
  }

  const health = profile.health_score ?? 0
  const healthColor = health >= 80 ? '#34D399' : health >= 55 ? '#FBBF24' : '#FB7185'
  const statusLabel = health >= 80 ? 'Optimal Health' : health >= 55 ? 'Needs Attention' : 'Critical Issues'
  const totalCells = profile.total_cells ?? profile.rows * profile.columns ?? 1
  const invalidCount = Object.values(profile.invalid_values || {}).reduce((sum, value) => sum + Number(value || 0), 0)
  const dateIssues = Object.values(profile.date_issues || {}).reduce((sum, value) => sum + Number(value || 0), 0)

  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Data Quality Score</span>
          <span className="text-[11.5px] font-semibold" style={{ color: healthColor }}>
            {statusLabel}
          </span>
        </div>

        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-[28px] font-extrabold leading-none tracking-tight font-sans" style={{ color: healthColor }}>
            {health}
          </span>
          <span className="text-[13px] font-bold text-muted"> / 100</span>
        </div>

        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden border border-white/10 mb-4">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${health}%`,
              backgroundColor: healthColor,
              boxShadow: `0 0 10px ${healthColor}50`,
            }}
          />
        </div>

        <div className="space-y-0.5 bg-white/[0.03] p-3 rounded-xl border border-white/10">
          <QualityRow label="Missing cells" value={formatNumber(profile.missing_cells, 0)} color="#FBBF24" icon={AlertTriangle} />
          <QualityRow label="Duplicate rows" value={formatNumber(profile.duplicate_rows, 0)} color="#FBBF24" icon={CopyX} />
          <QualityRow label="Invalid values" value={formatNumber(invalidCount, 0)} color="#FB7185" icon={FileWarning} />
          <QualityRow label="Date format issues" value={formatNumber(dateIssues, 0)} color="#FBBF24" icon={AlertTriangle} />
          <QualityRow label="Statistical outliers (IQR)" value={formatNumber(outlierCount, 0)} color="#60A5FA" icon={CheckCircle2} />
        </div>
      </div>

      <div className="text-[11px] text-muted/80 mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
        <span>Verified by deterministic pandas profiler</span>
        <span className="text-secondary font-mono">{formatNumber(totalCells, 0)} cells</span>
      </div>
    </div>
  )
}
