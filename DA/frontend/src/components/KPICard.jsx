import React from 'react'

export default function KPICard({ label, value, sub, icon: Icon, color = '#60A5FA', accent = true }) {
  return (
    <div className="glass-card p-4 sm:p-5 flex flex-col justify-between min-h-[110px] relative overflow-hidden group">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted group-hover:text-secondary transition-colors">
          {label}
        </span>
        {Icon && (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 border"
            style={{
              backgroundColor: `${color}14`,
              borderColor: `${color}28`,
              color,
            }}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
        )}
      </div>

      <div>
        <div className="text-[26px] font-bold text-ink leading-none tracking-tight font-sans">{value}</div>
        {sub ? (
          <div className="text-[11px] text-muted mt-1.5 flex items-center gap-1 font-medium">
            {sub}
          </div>
        ) : null}
      </div>

      {accent && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] opacity-40 group-hover:opacity-100 transition-opacity"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          }}
        />
      )}
    </div>
  )
}
