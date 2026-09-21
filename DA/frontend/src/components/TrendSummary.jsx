import React from 'react'
import { TrendingDown, TrendingUp, Minus, Sparkles } from 'lucide-react'
import { formatNumber, formatPercent } from '../utils/format'

function Stat({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
      <span className="text-[12px] text-muted font-medium">{label}</span>
      <span className="text-[12px] font-bold font-mono" style={{ color: color || '#F8FAFC' }}>
        {value}
      </span>
    </div>
  )
}

export default function TrendSummary({ trend }) {
  if (!trend) {
    return (
      <div className="h-full flex items-center justify-center text-[12px] text-muted min-h-[200px]">
        No trend data for the selected metric.
      </div>
    )
  }

  const direction = trend.direction || 'Stable / sideways'
  const isUp = direction.toLowerCase().includes('up')
  const isDown = direction.toLowerCase().includes('down')
  const color = isUp ? '#34D399' : isDown ? '#FB7185' : '#60A5FA'
  const DirectionIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  return (
    <div className="h-full flex flex-col justify-between space-y-4">
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-ai flex items-center gap-1.5 mb-2">
          <Sparkles size={13} /> Trend Diagnostic
        </div>

        <div className="text-[15px] font-bold text-ink mb-2 truncate">
          {trend.metric}
        </div>

        <div className="mb-4">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-semibold border backdrop-blur-md"
            style={{ color, borderColor: `${color}35`, backgroundColor: `${color}12` }}
          >
            <DirectionIcon size={14} />
            {direction}
          </span>
        </div>

        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/10 space-y-0.5">
          <Stat label="Trend Strength" value={`${formatNumber(trend.trend_score, 0)} / 100`} color={color} />
          <Stat label="Observed Change" value={formatPercent(trend.change_pct, 1)} color={color} />
          <Stat label="Volatility" value={formatPercent(trend.volatility_pct, 1)} color={trend.volatility_pct > 50 ? '#FBBF24' : '#60A5FA'} />
          <Stat label="Statistical Confidence" value={trend.confidence} color={trend.confidence === 'High' ? '#34D399' : trend.confidence === 'Medium' ? '#FBBF24' : '#64748B'} />
          <Stat
            label="Trajectory Momentum"
            value={trend.momentum}
            color={trend.momentum === 'accelerating' ? '#34D399' : trend.momentum === 'decelerating' ? '#FB7185' : '#64748B'}
          />
          <Stat
            label="Outlier Sensitivity"
            value={trend.outlier_sensitivity || (trend.outlier_sensitive ? 'High' : 'Low')}
            color={trend.outlier_sensitive ? '#FBBF24' : '#34D399'}
          />
        </div>
      </div>

      <div className="text-[11px] text-muted/80 leading-relaxed border-t border-white/10 pt-3">
        Linear fit R² = {trend.r2 != null ? trend.r2.toFixed(3) : 'N/A'}. Ordinary slope: {trend.slope != null ? trend.slope.toFixed(2) : '0'}. Robust slope: {trend.robust_trend?.slope != null ? trend.robust_trend.slope.toFixed(2) : (trend.slope != null ? trend.slope.toFixed(2) : '0')}.
      </div>
    </div>
  )
}
