import React, { useState } from 'react'
import {
  MoreVertical,
  Maximize2,
  Minimize2,
  Copy,
  Edit2,
  Trash2,
  RefreshCw,
  Layers,
} from 'lucide-react'
import DynamicChartRenderer from './DynamicChartRenderer'

export default function DashboardVisualCard({
  visual,
  onEdit,
  onDuplicate,
  onRemove,
  onRefresh,
  onToggleResize,
  isExpanded = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleAction = (actionFn) => {
    setMenuOpen(false)
    actionFn()
  }

  return (
    <div
      className={`glass-panel p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 relative group ${
        isExpanded ? 'col-span-full' : ''
      }`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink truncate" title={visual.title}>
              {visual.title || 'Custom Visual'}
            </h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-muted uppercase tracking-wider shrink-0">
              {visual.type}
            </span>
          </div>
          <div className="text-[11px] text-muted truncate mt-0.5">
            Sheet: <strong className="text-secondary font-medium">{visual.sheet}</strong>
            {visual.config?.aggregation && visual.config.aggregation !== 'none' && (
              <span> • Agg: {visual.config.aggregation}</span>
            )}
          </div>
        </div>

        {/* Hover / Actions Menu Controls */}
        <div className="relative shrink-0 flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggleResize}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-ink transition-colors"
            title={isExpanded ? 'Restore size' : 'Expand full width'}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-ink transition-colors"
            title="Visual options"
          >
            <MoreVertical size={14} />
          </button>

          {!visual.isDefault && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition-colors"
              title="Delete Visual"
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* Dropdown Menu */}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-white/10 bg-[#090E1A]/95 p-1 shadow-2xl backdrop-blur-md text-xs">
                <button
                  onClick={() => handleAction(onEdit)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-secondary hover:text-ink hover:bg-white/10 text-left transition-colors"
                >
                  <Edit2 size={13} /> Edit Visual
                </button>
                <button
                  onClick={() => handleAction(onDuplicate)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-secondary hover:text-ink hover:bg-white/10 text-left transition-colors"
                >
                  <Copy size={13} /> Duplicate
                </button>
                <button
                  onClick={() => handleAction(onRefresh)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-secondary hover:text-ink hover:bg-white/10 text-left transition-colors"
                >
                  <RefreshCw size={13} /> Refresh Data
                </button>
                {!visual.isDefault && (
                  <>
                    <div className="my-1 border-t border-white/10" />
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        setConfirmDelete(true)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/15 text-left transition-colors"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal / Overlay for Remove */}
      {confirmDelete && (
        <div className="absolute inset-0 bg-[#090E1A]/95 backdrop-blur-md rounded-2xl z-30 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <p className="text-xs text-ink font-semibold">Remove this visual from your dashboard?</p>
          <p className="text-[11px] text-muted">Underlying sheet data will remain completely intact.</p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirmDelete(false)
                onRemove()
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white transition-colors"
            >
              Remove Visual
            </button>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-[280px] pt-1">
        <DynamicChartRenderer visual={visual.computedResult || visual} height={290} />
      </div>
    </div>
  )
}
