import React from 'react'
import { formatNumber } from '../utils/format'

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

  // Sort: severity first, then most extreme values
  const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 }
  const sorted = [...rows].sort((a, b) => {
    const diff = (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4)
    if (diff !== 0) return diff
    return Math.abs(Number(b.value || 0)) - Math.abs(Number(a.value || 0))
  })

  return (
    <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th className="sticky top-0">Metric</th>
            <th className="sticky top-0">Row</th>
            <th className="sticky top-0">Date</th>
            <th className="sticky top-0">Value</th>
            <th className="sticky top-0">Type</th>
            <th className="sticky top-0">Severity</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((anomaly, index) => {
            const badge = getSeverityBadge(anomaly.severity)
            return (
              <tr key={index}>
                <td className="font-semibold text-ink">{anomaly.metric}</td>
                <td className="text-muted font-mono text-xs">{anomaly.row}</td>
                <td className="text-muted">{anomaly.date || '—'}</td>
                <td className="font-bold text-ink">{formatNumber(anomaly.value, 2)}</td>
                <td className="text-muted">{anomaly.type}</td>
                <td>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center"
                    style={{
                      color: badge.text,
                      backgroundColor: badge.bg,
                      borderColor: badge.border,
                    }}
                  >
                    {anomaly.severity}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

