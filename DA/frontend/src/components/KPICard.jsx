import React from 'react'

export default function KPICard({ label, value, sub, icon: Icon, color = '#38BDF8', accent = true }) {
  return (
    <div className="glass-card p-4 sm:p-5 flex flex-col justify-between min-h-[115px] relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-200">
      {/* Ambient background glow on hover */}
      <div 
        className="absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl pointer-events-none"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-center justify-between gap-2 mb-2 z-10">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted group-hover:text-secondary transition-colors truncate" title={label}>
          {label}
        </span>
        {Icon && (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 border"
            style={{
              backgroundColor: `${color}18`,
              borderColor: `${color}35`,
              color,
            }}
          >
            <Icon size={16} strokeWidth={2.2} />
          </div>
        )}
      </div>

      <div className="z-10">
        <div className="text-[26px] font-extrabold text-ink leading-none tracking-tight font-sans truncate" title={String(value)}>
          {value}
        </div>
        {sub ? (
          <div className="text-[11px] text-muted mt-2 flex items-center gap-1.5 font-medium truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            {sub}
          </div>
        ) : null}
      </div>

      {accent && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] opacity-30 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          }}
        />
      )}
    </div>
  )
}
