import React from 'react'
import { Filter, RefreshCw, Download } from 'lucide-react'

export default function MISFilterBar({
  filters,
  options,
  onFilterChange,
  onRefresh,
  onExport,
  lastRefreshed,
  filename,
}) {
  return (
    <div className="card p-4 mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borderline/60 pb-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted">MIS Global Filters</span>
          {filename && (
            <span className="ml-2 text-xs text-ink/70 bg-bg-sidebar px-2 py-0.5 rounded border border-borderline">
              Source: <strong className="text-ink">{filename}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-xs text-muted mr-2">
              Refreshed: <span className="text-ink font-medium">{lastRefreshed}</span>
            </span>
          )}
          <button onClick={onRefresh} className="btn btn-ghost py-1.5 px-3 text-xs gap-1.5">
            <RefreshCw size={14} className="text-primary" />
            Refresh
          </button>
          <button onClick={onExport} className="btn btn-primary py-1.5 px-3 text-xs gap-1.5">
            <Download size={14} />
            Export MIS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Department</label>
          <select
            value={filters.department || 'All'}
            onChange={(e) => onFilterChange('department', e.target.value)}
            className="select text-xs py-1 px-2"
          >
            {(options?.departments || ['All']).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Region</label>
          <select
            value={filters.region || 'All'}
            onChange={(e) => onFilterChange('region', e.target.value)}
            className="select text-xs py-1 px-2"
          >
            {(options?.regions || ['All']).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Product</label>
          <select
            value={filters.product || 'All'}
            onChange={(e) => onFilterChange('product', e.target.value)}
            className="select text-xs py-1 px-2"
          >
            {(options?.products || ['All']).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Category</label>
          <select
            value={filters.category || 'All'}
            onChange={(e) => onFilterChange('category', e.target.value)}
            className="select text-xs py-1 px-2"
          >
            {(options?.categories || ['All']).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Salesperson</label>
          <select
            value={filters.salesperson || 'All'}
            onChange={(e) => onFilterChange('salesperson', e.target.value)}
            className="select text-xs py-1 px-2"
          >
            {(options?.salespeople || ['All']).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Start Date</label>
          <input
            type="date"
            value={filters.date_start || ''}
            onChange={(e) => onFilterChange('date_start', e.target.value)}
            className="input text-xs py-1 px-2"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">End Date</label>
          <input
            type="date"
            value={filters.date_end || ''}
            onChange={(e) => onFilterChange('date_end', e.target.value)}
            className="input text-xs py-1 px-2"
          />
        </div>
      </div>
    </div>
  )
}
