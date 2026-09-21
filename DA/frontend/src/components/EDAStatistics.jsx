import React, { useState } from 'react'
import { formatNumber } from '../utils/format'

const NUMERIC_STAT_ROWS = [
  { key: 'count', label: 'Count' },
  { key: 'mean', label: 'Mean' },
  { key: 'median', label: 'Median' },
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
  { key: 'std', label: 'Std dev' },
  { key: 'q1', label: 'Q1 (25%)' },
  { key: 'q3', label: 'Q3 (75%)' },
  { key: 'skewness', label: 'Skewness' },
  { key: 'kurtosis', label: 'Kurtosis' },
  { key: 'missing', label: 'Missing' },
  { key: 'missing_pct', label: 'Missing %' },
]

const CATEGORICAL_STAT_ROWS = [
  { key: 'count', label: 'Count' },
  { key: 'missing', label: 'Missing' },
  { key: 'missing_pct', label: 'Missing %' },
  { key: 'unique', label: 'Unique' },
  { key: 'top_value', label: 'Most Frequent' },
  { key: 'top_frequency', label: 'Frequency' },
]

const DATETIME_STAT_ROWS = [
  { key: 'count', label: 'Count' },
  { key: 'missing', label: 'Missing' },
  { key: 'missing_pct', label: 'Missing %' },
  { key: 'min_date', label: 'Min Date' },
  { key: 'max_date', label: 'Max Date' },
  { key: 'unique_dates', label: 'Unique Dates' },
  { key: 'date_span_days', label: 'Date Span (Days)' },
]

const BOOLEAN_STAT_ROWS = [
  { key: 'count', label: 'Count' },
  { key: 'missing', label: 'Missing' },
  { key: 'missing_pct', label: 'Missing %' },
  { key: 'true_count', label: 'True Count' },
  { key: 'false_count', label: 'False Count' },
  { key: 'true_pct', label: 'True %' },
]

const TEXT_STAT_ROWS = [
  { key: 'count', label: 'Count' },
  { key: 'missing', label: 'Missing' },
  { key: 'missing_pct', label: 'Missing %' },
  { key: 'unique', label: 'Unique' },
  { key: 'avg_length', label: 'Average Length' },
  { key: 'min_length', label: 'Min Length' },
  { key: 'max_length', label: 'Max Length' },
]

export default function EDAStatistics({
  statistics,
  categoricalStatistics,
  datetimeStatistics,
  booleanStatistics,
  textStatistics,
}) {
  const hasNumeric = statistics && Object.keys(statistics).length > 0
  const hasCategorical = categoricalStatistics && Object.keys(categoricalStatistics).length > 0
  const hasDatetime = datetimeStatistics && Object.keys(datetimeStatistics).length > 0
  const hasBoolean = booleanStatistics && Object.keys(booleanStatistics).length > 0
  const hasText = textStatistics && Object.keys(textStatistics).length > 0

  const [activeTab, setActiveTab] = useState(
    hasNumeric ? 'numeric' : (hasCategorical ? 'categorical' : (hasDatetime ? 'datetime' : (hasBoolean ? 'boolean' : 'text')))
  )

  if (!hasNumeric && !hasCategorical && !hasDatetime && !hasBoolean && !hasText) {
    return (
      <div className="text-[12.5px] text-muted py-8 text-center">No statistics available for this sheet.</div>
    )
  }

  const renderTable = (statsMap, rowDefs) => {
    const columns = Object.keys(statsMap)
    if (!columns.length) {
      return <div className="text-xs text-muted py-6 text-center">No columns in this category.</div>
    }

    return (
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="table-base text-xs">
          <thead>
            <tr>
              <th className="sticky top-0 bg-[#0C1220] z-10 text-secondary">Statistic</th>
              {columns.map((column) => (
                <th key={column} className="sticky top-0 bg-[#0C1220] z-10 font-bold text-white whitespace-nowrap">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowDefs.map((row) => (
              <tr key={row.key} className="hover:bg-white/[0.03]">
                <td className="text-muted font-medium whitespace-nowrap">{row.label}</td>
                {columns.map((colName) => {
                  const stats = statsMap[colName]
                  if (!stats || typeof stats !== 'object') return <td key={colName}>—</td>
                  const value = stats[row.key]
                  if (value === null || value === undefined) return <td key={colName}>—</td>
                  if (row.key === 'missing_pct' || row.key === 'true_pct') return <td key={colName} className="font-mono">{formatNumber(value, 2)}%</td>
                  if (typeof value === 'number') return <td key={colName} className="font-mono">{formatNumber(value, 2)}</td>
                  return <td key={colName} className="font-medium text-white">{String(value)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Type Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-glass-border pb-2">
        {hasNumeric && (
          <button
            onClick={() => setActiveTab('numeric')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'numeric'
                ? 'bg-primary text-black font-bold shadow-sm'
                : 'text-secondary hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Numeric ({Object.keys(statistics).length})
          </button>
        )}
        {hasCategorical && (
          <button
            onClick={() => setActiveTab('categorical')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'categorical'
                ? 'bg-primary text-black font-bold shadow-sm'
                : 'text-secondary hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Categorical ({Object.keys(categoricalStatistics).length})
          </button>
        )}
        {hasDatetime && (
          <button
            onClick={() => setActiveTab('datetime')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'datetime'
                ? 'bg-primary text-black font-bold shadow-sm'
                : 'text-secondary hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Datetime ({Object.keys(datetimeStatistics).length})
          </button>
        )}
        {hasBoolean && (
          <button
            onClick={() => setActiveTab('boolean')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'boolean'
                ? 'bg-primary text-black font-bold shadow-sm'
                : 'text-secondary hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Boolean ({Object.keys(booleanStatistics).length})
          </button>
        )}
        {hasText && (
          <button
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'bg-primary text-black font-bold shadow-sm'
                : 'text-secondary hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Text ({Object.keys(textStatistics).length})
          </button>
        )}
      </div>

      {activeTab === 'numeric' && hasNumeric && renderTable(statistics, NUMERIC_STAT_ROWS)}
      {activeTab === 'categorical' && hasCategorical && renderTable(categoricalStatistics, CATEGORICAL_STAT_ROWS)}
      {activeTab === 'datetime' && hasDatetime && renderTable(datetimeStatistics, DATETIME_STAT_ROWS)}
      {activeTab === 'boolean' && hasBoolean && renderTable(booleanStatistics, BOOLEAN_STAT_ROWS)}
      {activeTab === 'text' && hasText && renderTable(textStatistics, TEXT_STAT_ROWS)}
    </div>
  )
}
