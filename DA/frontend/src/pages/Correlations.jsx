import React, { useMemo } from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import { CorrelationHeatmap, WorkbookSelector, EmptyState } from '../components'
import { Network, Sparkles, HelpCircle } from 'lucide-react'

export default function Correlations() {
  const { workbookId, correlationsData, selectedSheet } = useWorkbook()

  const sheetCorrelations = useMemo(() => {
    if (!correlationsData) return null
    const entry = correlationsData[selectedSheet]
    return entry?.status === 'ok' ? entry.correlations : null
  }, [correlationsData, selectedSheet])

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white tracking-tight">CORRELATIONS</h2>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" /> Correlation Matrix & Relationships
          </h1>
          <p className="text-sm text-secondary mt-1">
            Discover pairwise Pearson correlation coefficients and co-movement dependencies across variables.
          </p>
        </div>
        <WorkbookSelector />
      </div>

      {/* AI Interpretation Banner */}
      <div className="glass-card-ai p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-ai shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ai">Statistical Principle</div>
          <p className="text-xs text-secondary mt-1 leading-relaxed">
            Values near <span className="text-white font-medium">+1.0</span> denote strong positive co-movement, while values near <span className="text-white font-medium">-1.0</span> signify inverse association. Important: Correlation indicates statistical association, not direct causality.
          </p>
        </div>
      </div>

      {/* Main Heatmap Container */}
      <div className="glass-panel p-6 space-y-4">
        <div className="border-b border-glass-border pb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Pairwise Heatmap Matrix — {selectedSheet}
          </h3>
          <span className="text-xs text-muted">Hover cells for exact coefficient</span>
        </div>

        <CorrelationHeatmap matrix={sheetCorrelations} />
      </div>
    </div>
  )
}
