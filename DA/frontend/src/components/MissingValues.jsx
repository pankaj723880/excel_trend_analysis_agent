import React from 'react'
import { formatNumber } from '../utils/format'

export default function MissingValues({ missingByColumn, rows }) {
  const entries = Object.entries(missingByColumn || {}).sort((a, b) => b[1] - a[1])

  if (!entries.length) {
    return (
      <div className="text-[12.5px] text-muted py-6 text-center">
        No missing values detected in this sheet.
      </div>
    )
  }

  const totalCells = rows ? rows * Object.keys(missingByColumn).length : 0

  return (
    <div className="space-y-3">
      {entries.map(([column, count]) => {
        const pct = rows ? ((count / rows) * 100).toFixed(1) : '0.0'
        const totalForColumn = rows || 1
        const width = Math.min(100, (count / totalForColumn) * 100)
        return (
          <div key={column} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted truncate max-w-[60%]">{column}</span>
              <span className="font-semibold text-ink">
                {formatNumber(count, 0)}
                <span className="text-muted font-normal"> ({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-borderline overflow-hidden">
              <div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(2, width)}%` }} />
            </div>
          </div>
        )
      })}
      <div className="text-[11px] text-muted pt-1">
        Total cells in affected columns: {formatNumber(totalCells, 0)}
      </div>
    </div>
  )
}
