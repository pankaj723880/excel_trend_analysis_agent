import React from 'react'
import { formatNumber } from '../utils/format'

const STAT_ROWS = [
  { key: 'count', label: 'Count' },
  { key: 'mean', label: 'Mean' },
  { key: 'median', label: 'Median' },
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
  { key: 'std', label: 'Std dev' },
  { key: 'q1', label: 'Q1 (25%)' },
  { key: 'q3', label: 'Q3 (75%)' },
  { key: 'skewness', label: 'Skewness' },
  { key: 'missing', label: 'Missing' },
  { key: 'missing_pct', label: 'Missing %' },
]

export default function EDAStatistics({ statistics }) {
  if (!statistics || !Object.keys(statistics).length) {
    return (
      <div className="text-[12.5px] text-muted py-8 text-center">No numeric statistics available.</div>
    )
  }

  return (
    <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th className="sticky top-0">Statistic</th>
            {Object.keys(statistics).map((column) => (
              <th key={column} className="sticky top-0">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STAT_ROWS.map((row) => (
            <tr key={row.key}>
              <td className="text-muted font-medium">{row.label}</td>
              {Object.values(statistics).map((stats, index) => {
                if (!stats || typeof stats !== 'object') {
                  return <td key={index}>—</td>
                }
                const value = stats[row.key]
                if (value === null || value === undefined) return <td key={index}>—</td>
                if (row.key === 'missing_pct') return <td key={index}>{formatNumber(value, 2)}%</td>
                return <td key={index}>{formatNumber(value, 2)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
