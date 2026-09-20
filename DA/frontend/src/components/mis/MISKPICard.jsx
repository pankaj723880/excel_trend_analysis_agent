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
    <div className="card card-pad card-hover flex flex-col justify-between min-h-[110px] min-w-0 overflow-hidden relative group hover:-translate-y-0.5 transition-all duration-200">
      <div 
        className="absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-0 group-hover:opacity-15 transition-opacity duration-300 blur-xl pointer-events-none"
        style={{ backgroundColor: isUp ? '#34D399' : isDown ? '#F43F5E' : '#38BDF8' }}
      />
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted group-hover:text-secondary transition-colors mb-1 truncate z-10" title={title}>{title}</div>
      <div className="text-[20px] 2xl:text-[24px] font-extrabold text-ink leading-tight mb-2 truncate z-10 font-sans" title={formatVal(value)}>{formatVal(value)}</div>

      <div className="flex items-center justify-between text-[11.5px] z-10">
        <div className="flex items-center gap-1 font-semibold">
          {isUp && (
            <span className="flex items-center gap-0.5 text-positive bg-positive/10 px-1.5 py-0.5 rounded border border-positive/30">
              <TrendingUp size={12} />
              +{change}%
            </span>
          )}
          {isDown && (
            <span className="flex items-center gap-0.5 text-negative bg-negative/10 px-1.5 py-0.5 rounded border border-negative/30">
              <TrendingDown size={12} />
              {change}%
            </span>
          )}
          {!isUp && !isDown && (
            <span className="flex items-center gap-0.5 text-muted bg-bg-sidebar px-1.5 py-0.5 rounded border border-borderline">
              <Minus size={12} />
              0.0%
            </span>
          )}
          <span className="text-muted/60 font-normal text-[11px]">vs prev</span>
        </div>

        {previous !== null && previous !== undefined && (
          <div className="text-[11px] text-muted truncate">Prev: <strong className="text-ink/80 font-medium">{formatVal(previous)}</strong></div>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] opacity-25 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${isUp ? '#34D399' : isDown ? '#F43F5E' : '#38BDF8'}, transparent)`,
        }}
      />
    </div>
  )
}
