import React from 'react'
import { Network } from 'lucide-react'
import { formatNumber } from '../utils/format'

// Diverging color scale: -1 → red, 0 → dark neutral, +1 → green
function corrColor(value) {
  if (value === null || value === undefined) return '#111722'
  const v = Math.max(-1, Math.min(1, Number(value) || 0))
  if (v >= 0) {
    return `rgba(34, 197, 94, ${Math.max(0.08, v * 0.45)})`
  }
  return `rgba(239, 68, 68, ${Math.max(0.08, Math.abs(v) * 0.45)})`
}

export default function CorrelationHeatmap({ matrix, columns }) {
  if (!columns || columns.length < 2 || !Object.keys(matrix || {}).length) {
    return (
      <div className="py-16 px-6 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
        <div className="h-12 w-12 rounded-xl bg-bg-sidebar border border-borderline flex items-center justify-center text-muted">
          <Network size={24} className="text-primary" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-base font-bold text-ink">No correlation matrix available</h4>
          <p className="text-[12.5px] text-muted leading-relaxed">
            This workbook does not contain enough numeric variables to calculate meaningful correlations.
          </p>
        </div>
      </div>
    )
  }

  const cellSize = Math.max(52, Math.min(84, Math.floor(760 / columns.length)))

  return (
    <div className="overflow-x-auto">
      <div className="p-2" style={{ minWidth: `${columns.length * cellSize + 90}px` }}>
        {/* Header row */}
        <div className="flex" style={{ paddingLeft: 90 }}>
          {columns.map((column) => (
            <div
              key={column}
              className="text-[10.5px] text-muted font-medium truncate text-center px-1"
              style={{ width: cellSize }}
              title={column}
            >
              {column.length > 12 ? `${column.slice(0, 11)}…` : column}
            </div>
          ))}
        </div>

        {/* Rows */}
        {columns.map((rowColumn, rowIndex) => (
          <div key={rowColumn} className="flex items-center mb-0.5">
            <div
              className="text-[10.5px] text-muted font-medium truncate text-right pr-2"
              style={{ width: 88 }}
              title={rowColumn}
            >
              {rowColumn.length > 20 ? `${rowColumn.slice(0, 19)}…` : rowColumn}
            </div>
            {columns.map((column, colIndex) => {
              const value = matrix[rowColumn]?.[column]
              const isDiagonal = rowIndex === colIndex
              return (
                <div
                  key={column}
                  className="flex items-center justify-center rounded border border-borderline/30 text-[11px] font-semibold text-ink mx-0.5"
                  style={{
                    width: cellSize - 4,
                    height: Math.max(26, cellSize - 8),
                    backgroundColor: isDiagonal ? 'var(--borderline)' : corrColor(value),
                    color: value !== null && Math.abs(Number(value) || 0) > 0.5 ? '#ffffff' : 'var(--ink)',
                  }}
                >
                  {value === null || value === undefined ? '—' : formatNumber(value, 2)}
                </div>
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 ml-[90px]">
          <span className="text-[10.5px] text-muted">-1</span>
          <div
            className="h-2 rounded-full"
            style={{
              width: 180,
              background: 'linear-gradient(to right, rgba(239,68,68,1), var(--borderline), rgba(34,197,94,1))',
            }}
          />
          <span className="text-[10.5px] text-muted">+1</span>
        </div>
      </div>
    </div>
  )
}
