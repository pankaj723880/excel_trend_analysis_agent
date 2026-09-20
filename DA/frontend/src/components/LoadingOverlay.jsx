import React from 'react'

export default function LoadingOverlay({ label = 'Loading analysis…' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm">
      <div className="card card-pad flex flex-col items-center gap-4 px-8 py-8 animate-fade-in-up">
        <div className="h-10 w-10 border-[3px] border-primary/25 border-t-primary rounded-full animate-spin" />
        <div className="text-sm font-semibold text-ink">{label}</div>
        <div className="text-[12px] text-muted">Calculations run in the Python analysis engine</div>
      </div>
    </div>
  )
}
