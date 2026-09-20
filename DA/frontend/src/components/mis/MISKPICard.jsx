import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function MISKPICard({ title, value, previous, change, format = 'currency', status = 'positive' }) {
  const formatVal = (val) => {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'string') return val
    if (format === 'currency') {
      if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`
      if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`
      return `₹${Number(val).toLocaleString()}`
    }
    if (format === 'number') return Number(val).toLocaleString()
    return String(val)
  }

  const isUp = change > 0
  const isDown = change < 0

  return (
    <div className="card card-pad card-hover flex flex-col justify-between min-h-[105px] min-w-0 overflow-hidden">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1 truncate" title={title}>{title}</div>
      <div className="text-[20px] 2xl:text-[24px] font-bold text-ink leading-tight mb-2 truncate" title={formatVal(value)}>{formatVal(value)}</div>

      <div className="flex items-center justify-between text-[11.5px]">
        <div className="flex items-center gap-1 font-semibold">
          {isUp && (
            <span className="flex items-center gap-0.5 text-positive bg-positive/10 px-1.5 py-0.5 rounded border border-positive/30">
              <TrendingUp size={13} />
              +{change}%
            </span>
          )}
          {isDown && (
            <span className="flex items-center gap-0.5 text-danger bg-danger/10 px-1.5 py-0.5 rounded border border-danger/30">
              <TrendingDown size={13} />
              {change}%
            </span>
          )}
          {!isUp && !isDown && (
            <span className="flex items-center gap-0.5 text-muted bg-bg-sidebar px-1.5 py-0.5 rounded border border-borderline">
              <Minus size={13} />
              0.0%
            </span>
          )}
          <span className="text-muted/70 font-normal">vs prev</span>
        </div>

        {previous !== null && previous !== undefined && (
          <div className="text-[11px] text-muted">Prev: <strong className="text-ink/80">{formatVal(previous)}</strong></div>
        )}
      </div>
    </div>
  )
}
