import React, { useState, useEffect } from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import { Wrench, Play, Download, CheckSquare, Sparkles, ArrowRightLeft, Database, CheckCircle, AlertTriangle } from 'lucide-react'
import { cleanWorkbook, getCleanedExportUrl, getSheetDetail, getCleanedPreview } from '../services/api'
import { EmptyState, WorkbookSelector } from '../components'

export default function Cleaning() {
  const { workbookId, filename, selectedSheet } = useWorkbook()
  const [cleaning, setCleaning] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  const [originalData, setOriginalData] = useState([])
  const [cleanedData, setCleanedData] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [options, setOptions] = useState({
    trim_text: true,
    standardize_headers: true,
    remove_empty_rows: true,
    remove_empty_columns: true,
    remove_duplicates: true,
    coerce_numeric: true,
    fill_missing: 'mean',
    standardize_categories: true,
    standardize_dates: true,
    remove_outliers: false,
    clean_domain_anomalies: true,
  })

  // Fetch original sheet preview when workbookId or selectedSheet changes
  useEffect(() => {
    if (workbookId && selectedSheet) {
      setLoadingPreview(true)
      getSheetDetail(workbookId, selectedSheet)
        .then((data) => {
          setOriginalData(data.preview || [])
        })
        .catch(() => setOriginalData([]))
        .finally(() => setLoadingPreview(false))

      getCleanedPreview(workbookId, selectedSheet)
        .then((data) => {
          setCleanedData(data.preview || [])
        })
        .catch(() => setCleanedData([]))
    }
  }, [workbookId, selectedSheet])

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">DATA CLEANING STUDIO</h2>
        </div>
        <EmptyState />
      </div>
    )
  }

  const handleClean = async () => {
    setCleaning(true)
    setError(null)
    setReport(null)
    try {
      const payload = {
        workbook_id: workbookId,
        sheet_name: selectedSheet,
        ...options,
      }
      const data = await cleanWorkbook(payload)
      setReport(data.report)

      // Fetch fresh cleaned preview for current sheet
      const previewRes = await getCleanedPreview(workbookId, selectedSheet)
      setCleanedData(previewRes.preview || [])
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setCleaning(false)
    }
  }

  const origColumns = originalData.length > 0 ? Object.keys(originalData[0]) : []
  const cleanColumns = cleanedData.length > 0 ? Object.keys(cleanedData[0]) : []

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" /> Data Cleaning Studio
          </h1>
          <p className="text-sm text-secondary mt-1">
            Apply automated cleaning transformations and review original vs. cleaned records side-by-side.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={getCleanedExportUrl(workbookId)}
            download
            className="btn-primary text-xs flex items-center gap-2 py-2 px-3"
          >
            <Download className="w-4 h-4" /> Download Cleaned
          </a>
          <WorkbookSelector />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Cleaning Rules & Controls (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 space-y-4">
            <div className="border-b border-glass-border pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" /> Cleaning Rules & Fixes
              </h3>
            </div>

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {/* Extra Spaces */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.trim_text}
                  onChange={(e) => setOptions({ ...options, trim_text: e.target.checked })}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Trim Extra Spaces</span>
                  <span className="text-[11px] text-muted leading-tight block">Strip leading, trailing & excess whitespace from text</span>
                </div>
              </label>

              {/* Standardize Column Names */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.standardize_headers}
                  onChange={(e) => setOptions({ ...options, standardize_headers: e.target.checked })}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Standardize Column Names</span>
                  <span className="text-[11px] text-muted leading-tight block">Normalize header labels & remove special characters</span>
                </div>
              </label>

              {/* Data Type Correction */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.coerce_numeric}
                  onChange={(e) => setOptions({ ...options, coerce_numeric: e.target.checked })}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Data Type Correction</span>
                  <span className="text-[11px] text-muted leading-tight block">Coerce text numbers ($1,200, 45%) into numeric fields</span>
                </div>
              </label>

              {/* Date & Time Cleaning */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.standardize_dates}
                  onChange={(e) => setOptions({ ...options, standardize_dates: e.target.checked })}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Date & Time Cleaning</span>
                  <span className="text-[11px] text-muted leading-tight block">Parse & standardize all date formats to YYYY-MM-DD</span>
                </div>
              </label>

              {/* Format & Inconsistent Values */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.standardize_categories}
                  onChange={(e) => setOptions({ ...options, standardize_categories: e.target.checked })}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Format & Inconsistent Values</span>
                  <span className="text-[11px] text-muted leading-tight block">Standardize casing (Title Case) across text categories</span>
                </div>
              </label>

              {/* Duplicates */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.remove_duplicates}
                  onChange={(e) => setOptions({ ...options, remove_duplicates: e.target.checked })}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Drop Duplicate Rows</span>
                  <span className="text-[11px] text-muted leading-tight block">Identify & remove identical duplicate records</span>
                </div>
              </label>

              {/* Empty Rows & Columns */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.remove_empty_rows}
                    onChange={(e) => setOptions({ ...options, remove_empty_rows: e.target.checked })}
                    className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span className="text-xs font-semibold text-white">Drop Empty Rows</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.remove_empty_columns}
                    onChange={(e) => setOptions({ ...options, remove_empty_columns: e.target.checked })}
                    className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span className="text-xs font-semibold text-white">Drop Empty Cols</span>
                </label>
              </div>

              {/* Outliers & Domain Anomalies */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.remove_outliers}
                  onChange={(e) => setOptions({ ...options, remove_outliers: e.target.checked })}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Outlier Replacement</span>
                  <span className="text-[11px] text-muted leading-tight block">Replace extreme IQR & Z-score outliers with column median</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.clean_domain_anomalies}
                  onChange={(e) => setOptions({ ...options, clean_domain_anomalies: e.target.checked })}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Fix Domain Anomalies</span>
                  <span className="text-[11px] text-muted leading-tight block">Clip negative prices/quantities & cap rates between 0-100%</span>
                </div>
              </label>

              {/* Missing Values Strategy Select */}
              <div className="p-3 rounded-lg border border-glass-border bg-white/[0.02] space-y-1.5">
                <label className="block text-xs font-semibold text-secondary">Handle Missing Values Strategy</label>
                <select
                  className="w-full bg-[#070B14] border border-glass-border rounded-lg text-xs text-white px-2.5 py-1.5 focus:outline-none focus:border-primary"
                  value={options.fill_missing}
                  onChange={(e) => setOptions({ ...options, fill_missing: e.target.value })}
                >
                  <option value="mean">Fill with Column Mean</option>
                  <option value="median">Fill with Column Median</option>
                  <option value="mode">Fill with Column Mode</option>
                  <option value="zero">Fill with Constant Zero (0)</option>
                  <option value="forward">Forward Fill (ffill)</option>
                  <option value="backward">Backward Fill (bfill)</option>
                  <option value="none">Do Nothing (Leave Missing)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleClean}
              disabled={cleaning}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 font-semibold text-xs cursor-pointer shadow-lg mt-2"
            >
              {cleaning ? (
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {cleaning ? 'Applying Cleaning Pipeline...' : 'Run Cleaning Pipeline Strictly'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Side-by-Side Dataset Comparison (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
              {error}
            </div>
          )}

          {/* Cleaning Execution Summary */}
          {report && (
            <div className="glass-panel p-5 space-y-3 border-t-2 border-t-emerald-400">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Cleaning Pipeline Executed — Sheet: {selectedSheet}
                </h3>
                <a
                  href={getCleanedExportUrl(workbookId)}
                  download
                  className="btn-primary text-xs py-1 px-3 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download Cleaned File
                </a>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {report.sheets &&
                  report.sheets.map((stats, i) => (
                    <React.Fragment key={i}>
                      <div className="glass-card p-3">
                        <span className="text-muted block text-[11px]">Rows Dropped</span>
                        <span className="text-sm font-bold text-white">{stats.rows_dropped ?? 0}</span>
                      </div>
                      <div className="glass-card p-3">
                        <span className="text-muted block text-[11px]">Missing Values Filled</span>
                        <span className="text-sm font-bold text-emerald-400">{stats.missing_filled ?? 0}</span>
                      </div>
                      <div className="glass-card p-3">
                        <span className="text-muted block text-[11px]">Duplicates Removed</span>
                        <span className="text-sm font-bold text-amber-400">{stats.duplicates_removed ?? 0}</span>
                      </div>
                      <div className="glass-card p-3">
                        <span className="text-muted block text-[11px]">Headers Renamed</span>
                        <span className="text-sm font-bold text-primary">{stats.columns_renamed ?? 0}</span>
                      </div>
                    </React.Fragment>
                  ))}
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE DATASET COMPARISON PANELS */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* PANEL 1: OLDER DATASET (ORIGINAL) */}
            <div className="glass-panel p-4 space-y-3 flex flex-col h-[520px]">
              <div className="flex items-center justify-between border-b border-glass-border pb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Original Dataset
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {originalData.length} records
                </span>
              </div>

              <div className="flex-1 overflow-auto border border-glass-border rounded-lg bg-black/20">
                {originalData.length > 0 ? (
                  <table className="table-base text-xs">
                    <thead>
                      <tr>
                        {origColumns.map((col) => (
                          <th key={col} className="sticky top-0 bg-[#0C1220] text-secondary text-[11px]">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {originalData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.04]">
                          {origColumns.map((col) => {
                            const val = row[col]
                            const isNull = val === null || val === undefined || val === ''
                            return (
                              <td key={col} className={isNull ? 'text-amber-400 font-mono bg-amber-400/5' : 'text-muted'}>
                                {isNull ? '⟨null⟩' : String(val)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted text-xs p-6 text-center">
                    No original dataset preview loaded for this sheet.
                  </div>
                )}
              </div>
            </div>

            {/* PANEL 2: NEWER DATASET (CLEANED) */}
            <div className="glass-panel p-4 space-y-3 flex flex-col h-[520px] border-primary/40">
              <div className="flex items-center justify-between border-b border-glass-border pb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Cleaned Dataset
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                  {cleanedData.length > 0 ? `${cleanedData.length} clean records` : 'Pending Pipeline'}
                </span>
              </div>

              <div className="flex-1 overflow-auto border border-glass-border rounded-lg bg-black/20">
                {cleanedData.length > 0 ? (
                  <table className="table-base text-xs">
                    <thead>
                      <tr>
                        {cleanColumns.map((col) => (
                          <th key={col} className="sticky top-0 bg-[#0C1220] text-white text-[11px]">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cleanedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.04]">
                          {cleanColumns.map((col) => {
                            const val = row[col]
                            const origVal = originalData[idx]?.[col]
                            const isChanged = origVal !== undefined && String(val) !== String(origVal)
                            return (
                              <td
                                key={col}
                                className={
                                  isChanged
                                    ? 'text-emerald-400 font-semibold bg-emerald-400/10'
                                    : 'text-white font-medium'
                                }
                              >
                                {val === null || val === undefined ? '—' : String(val)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted text-xs p-6 text-center space-y-2">
                    <ArrowRightLeft className="w-7 h-7 text-muted/40" />
                    <p className="font-semibold text-white">No Cleaned Dataset Generated Yet</p>
                    <p className="max-w-xs text-muted">
                      Select your cleaning rules on the left and click "Run Cleaning Pipeline Strictly" to compare datasets side-by-side.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
