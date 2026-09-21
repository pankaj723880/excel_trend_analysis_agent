import React from 'react'
import { formatNumber } from '../utils/format'
import { AlertTriangle, Activity } from 'lucide-react'

export default function AnomalyTable({ rows }) {
  if (!rows || !rows.length) {
    return (
      <div className="text-[12.5px] text-muted py-8 text-center">
        No anomalies detected in this sheet.
      </div>
    )
  }

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'Critical':
        return { text: '#EF4444', bg: '#EF444415', border: '#EF444430' }
      case 'High':
        return { text: '#F97316', bg: '#F9731615', border: '#F9731630' }
      case 'Medium':
        return { text: '#F59E0B', bg: '#F59E0B15', border: '#F59E0B30' }
      case 'Low':
      default:
        return { text: '#5B7CFF', bg: '#5B7CFF15', border: '#5B7CFF30' }
    }
  }

  // Sort: validation violations first, then severity rank, then absolute value
  const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 }
  const sorted = [...rows].sort((a, b) => {
    if (a.validation_violation && !b.validation_violation) return -1
    if (!a.validation_violation && b.validation_violation) return 1
    const diff = (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4)
    if (diff !== 0) return diff
    return Math.abs(Number(b.value || 0)) - Math.abs(Number(a.value || 0))
  })

  return (
    <div className="overflow-x-auto max-h-[460px] overflow-y-auto border border-white/10 rounded-xl">
      <table className="table-base text-xs">
        <thead>
          <tr>
            <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Metric</th>
            <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Row</th>
            <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Date</th>
            <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Value</th>
            <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Nature</th>
            <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Type</th>
            <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Severity</th>
            <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Reason</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((anomaly, index) => {
            const badge = getSeverityBadge(anomaly.severity)
            const isViolation = Boolean(anomaly.validation_violation)
            return (
              <tr key={index} className="hover:bg-white/[0.04]">
                <td className="font-semibold text-white">{anomaly.metric}</td>
                <td className="text-secondary font-mono text-xs">{anomaly.row}</td>
                <td className="text-secondary font-mono">{anomaly.date || '—'}</td>
                <td className="font-bold font-mono text-white">{formatNumber(anomaly.value, 2)}</td>
                <td>
                  {isViolation ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Rule Violation
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Statistical Outlier
                    </span>
                  )}
                </td>
                <td className="text-secondary">{anomaly.type}</td>
                <td>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border inline-flex items-center"
                    style={{
                      color: badge.text,
                      backgroundColor: badge.bg,
                      borderColor: badge.border,
                    }}
                  >
                    {anomaly.severity}
                  </span>
                </td>
                <td className="text-secondary text-[11px] max-w-[280px] truncate" title={anomaly.reason}>
                  {anomaly.reason || (anomaly.methods?.length ? anomaly.methods.join(', ') : 'Statistical deviation')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
