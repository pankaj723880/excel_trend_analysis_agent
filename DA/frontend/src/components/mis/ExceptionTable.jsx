import React from 'react'
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

export default function ExceptionTable({ exceptions = [], onStatusChange }) {
  if (!exceptions || exceptions.length === 0) {
    return (
      <div className="card p-6 text-center text-muted text-xs">
        <CheckCircle2 size={24} className="mx-auto text-positive mb-2" />
        No business exceptions detected for current filters.
      </div>
    )
  }

  const getSeverityBadge = (severity) => {
    if (severity === 'Critical') {
      return (
        <span className="tag bg-negative/10 border-negative/30 text-negative text-[10px]">
          <AlertCircle size={12} /> Critical
        </span>
      )
    }
    if (severity === 'Warning') {
      return (
        <span className="tag bg-warning/10 border-warning/30 text-warning text-[10px]">
          <AlertTriangle size={12} /> Warning
        </span>
      )
    }
    return (
      <span className="tag bg-primary/10 border-primary/30 text-primary text-[10px]">
        <Info size={12} /> Info
      </span>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-ink">Business & Data Exception Center</h4>
        <span className="text-xs text-muted font-medium">Total: {exceptions.length} exceptions</span>
      </div>

      <div className="overflow-x-auto border border-borderline rounded-lg">
        <table className="table-base">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Record</th>
              <th>Date</th>
              <th>Value</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((exc) => (
              <tr key={exc.id}>
                <td className="font-mono text-xs text-primary">{exc.id}</td>
                <td className="font-semibold text-ink">{exc.type}</td>
                <td>{getSeverityBadge(exc.severity)}</td>
                <td className="text-ink/80">{exc.record}</td>
                <td className="text-muted text-xs">{exc.date}</td>
                <td className="font-bold text-ink">{exc.value}</td>
                <td className="text-xs text-muted">{exc.reason}</td>
                <td>
                  <span
                    className={`tag text-[10px] ${
                      exc.status === 'Resolved'
                        ? 'bg-positive/10 border-positive/30 text-positive'
                        : exc.status === 'In Review'
                        ? 'bg-warning/10 border-warning/30 text-warning'
                        : 'bg-negative/10 border-negative/30 text-negative'
                    }`}
                  >
                    {exc.status}
                  </span>
                </td>
                <td>
                  {exc.status !== 'Resolved' ? (
                    <button
                      onClick={() => onStatusChange && onStatusChange(exc.id, 'Resolved')}
                      className="btn btn-ghost py-1 px-2.5 text-[11px] text-positive hover:bg-positive/10 border-positive/30"
                    >
                      Resolve
                    </button>
                  ) : (
                    <button
                      onClick={() => onStatusChange && onStatusChange(exc.id, 'Open')}
                      className="btn btn-ghost py-1 px-2.5 text-[11px] text-muted hover:bg-borderline"
                    >
                      Reopen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
