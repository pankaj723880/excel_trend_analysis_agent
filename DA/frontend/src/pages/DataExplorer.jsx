import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  Download,
  Filter,
  Layers,
  Search,
  Table as TableIcon,
} from 'lucide-react'
import { useWorkbook } from '../context/WorkbookContext'
import { getSheetDetail } from '../services/api'
import { EmptyState, WorkbookSelector } from '../components'
import { formatNumber } from '../utils/format'

export default function DataExplorer() {
  const { workbookId, sheets, selectedSheet, selectSheet } = useWorkbook()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

  useEffect(() => {
    if (!workbookId || !selectedSheet) return
    let active = true
    setLoading(true)

    getSheetDetail(workbookId, selectedSheet)
      .then((res) => {
        if (active) setData(res)
      })
      .catch(() => {
        if (active) setData(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [workbookId, selectedSheet])

  const columns = useMemo(() => {
    if (!data?.columns) return []
    return data.columns
  }, [data])

  const rows = useMemo(() => {
    const rawList = data?.preview || (Array.isArray(data?.rows) ? data.rows : [])
    if (!rawList || !rawList.length) return []
    let result = [...rawList]

    // Filter by text search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((row) =>
        Object.values(row).some((val) => String(val).toLowerCase().includes(q))
      )
    }

    // Sort
    if (sortColumn) {
      result.sort((a, b) => {
        const valA = a[sortColumn]
        const valB = b[sortColumn]
        if (valA == null) return 1
        if (valB == null) return -1
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA
        }
        return sortDirection === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA))
      })
    }

    return result
  }, [data, search, sortColumn, sortDirection])

  const totalPages = Math.ceil(rows.length / pageSize) || 1
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, currentPage, pageSize])

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">Data Explorer</h2>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight font-sans">Data Explorer</h2>
          <p className="text-xs text-secondary/80 mt-0.5">
            Raw workbook records, column types, and data structure inspection
          </p>
        </div>
        <WorkbookSelector />
      </div>

      {/* Toolbar / Filters */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sheet tabs */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/10 overflow-x-auto max-w-full">
            {sheets.map((s) => (
              <button
                key={s.name}
                onClick={() => {
                  selectSheet(s.name)
                  setCurrentPage(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  selectedSheet === s.name
                    ? 'bg-primary text-black font-bold shadow-sm'
                    : 'text-secondary hover:text-ink hover:bg-white/5'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Filter row values..."
              className="input pl-9 pr-3 text-xs py-1.5"
            />
          </div>
        </div>

        {/* Row count info */}
        <div className="flex items-center gap-3 text-xs text-secondary">
          <span className="font-medium text-muted">
            Showing <strong className="text-ink font-mono">{paginatedRows.length}</strong> of{' '}
            <strong className="text-ink font-mono">{formatNumber(rows.length, 0)}</strong> records
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="input !py-1 !px-2.5 text-xs w-28 cursor-pointer"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Main Glass Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div className="text-xs text-muted">Loading sheet records from engine…</div>
          </div>
        ) : columns.length === 0 ? (
          <div className="py-20 text-center text-xs text-muted">No rows or columns available in this sheet.</div>
        ) : (
          <div className="overflow-x-auto max-h-[620px] relative">
            <table className="table-base w-full">
              <thead className="sticky top-0 z-20 backdrop-blur-md bg-[#090E1A]/95 shadow-sm border-b border-white/10">
                <tr>
                  <th className="w-12 text-center text-[10.5px] font-mono text-muted">#</th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="cursor-pointer hover:text-ink select-none transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{col}</span>
                        <ArrowUpDown size={11} className="text-muted/60" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedRows.map((row, idx) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + idx + 1
                  return (
                    <tr key={idx} className="hover:bg-white/[0.04] transition-colors">
                      <td className="text-center font-mono text-[10.5px] text-muted">{absoluteIndex}</td>
                      {columns.map((col) => {
                        const val = row[col]
                        const isNull = val == null || val === ''
                        const isNumeric = typeof val === 'number'
                        return (
                          <td key={col} className={`truncate max-w-[220px] ${isNumeric ? 'font-mono' : ''}`}>
                            {isNull ? (
                              <span className="text-[10px] text-muted/60 italic">null</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-3.5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-secondary">
          <div>
            Page <span className="font-bold text-ink font-mono">{currentPage}</span> of{' '}
            <span className="font-bold text-ink font-mono">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-8 px-2.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-semibold cursor-pointer"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-8 px-2.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-semibold cursor-pointer"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
