import React, { useState } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

export default function MISDataTable({
  columns = [],
  data = [],
  title,
  subtitle,
  onRowClick,
  pageSize = 10,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const filteredData = data.filter((row) =>
    Object.values(row).some((val) =>
      String(val ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const keys = columns.length > 0 ? columns : (data[0] ? Object.keys(data[0]) : [])

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {title && <h4 className="text-sm font-bold text-ink">{title}</h4>}
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>

        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search records…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="input text-xs pl-8 py-1.5"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-borderline rounded-lg">
        <table className="table-base">
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>{String(k).replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
                <tr
                  key={row._id || idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={onRowClick ? 'cursor-pointer hover:bg-[#182135]' : ''}
                >
                  {keys.map((k) => (
                    <td key={k}>
                      {typeof row[k] === 'number'
                        ? row[k].toLocaleString()
                        : String(row[k] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={keys.length || 1} className="text-center py-6 text-muted text-xs">
                  No records match current filter criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted pt-2">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} records
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="btn btn-ghost py-1 px-2 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-medium text-ink">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="btn btn-ghost py-1 px-2 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
