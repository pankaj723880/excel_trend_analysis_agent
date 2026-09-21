import React, { useMemo } from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import WorkbookSelector from '../components/WorkbookSelector'
import EmptyState from '../components/EmptyState'
import EDAStatistics from '../components/EDAStatistics'
import MissingValues from '../components/MissingValues'
import DataQualityCard from '../components/DataQualityCard'
import { formatNumber } from '../utils/format'
import { BarChart3, Layers, AlertCircle, Database } from 'lucide-react'

export default function EDA() {
  const { workbookId, overview, edaData, selectedSheet } = useWorkbook()

  const sheetEda = useMemo(() => {
    if (!edaData) return null
    const entry = edaData[selectedSheet]
    return entry?.status === 'ok' ? entry.eda : null
  }, [edaData, selectedSheet])

  const profile = useMemo(() => {
    if (!overview?.profile) return null
    return overview.profile[selectedSheet] || null
  }, [overview, selectedSheet])

  const sheetError = useMemo(() => {
    if (!edaData) return null
    const entry = edaData[selectedSheet]
    return entry?.status === 'error' ? entry?.reason || 'Unknown error' : null
  }, [edaData, selectedSheet])

  if (!workbookId) return <EmptyState message="No workbook loaded" />

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Exploratory Data Analysis
          </h1>
          <p className="text-sm text-secondary mt-1">
            Descriptive statistics, distribution quantiles, and structural column typing for {selectedSheet}.
          </p>
        </div>
        <WorkbookSelector />
      </div>

      {sheetError && (
        <div className="glass-panel p-4 border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-rose-400">Analysis unavailable</div>
            <div className="text-xs text-secondary mt-0.5">Reason: {sheetError}</div>
          </div>
        </div>
      )}

      {/* Primary Grid: Numeric Statistics (2 Cols) + Data Quality Profile (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-5 lg:col-span-2 space-y-4">
          <div className="border-b border-glass-border pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> Numeric Statistics — {selectedSheet}
            </h3>
          </div>
          {sheetEda ? (
            <EDAStatistics
              statistics={sheetEda.numeric_statistics}
              categoricalStatistics={sheetEda.categorical_statistics}
              datetimeStatistics={sheetEda.datetime_statistics}
              booleanStatistics={sheetEda.boolean_statistics}
              textStatistics={sheetEda.text_statistics}
            />
          ) : !sheetError ? (
            <div className="text-xs text-muted py-12 text-center">No statistics available for this sheet.</div>
          ) : null}
        </div>

        <div className="glass-panel p-5">
          <DataQualityCard profile={profile} outlierCount={sheetEda?.total_outliers_iqr ?? 0} />
        </div>
      </div>

      {/* Secondary Grid: Missing Values + Column Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-5 space-y-4">
          <div className="border-b border-glass-border pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Missing Values by Column
            </h3>
          </div>
          <MissingValues missingByColumn={profile?.missing_by_column} rows={profile?.rows} />
        </div>

        <div className="glass-panel p-5 space-y-4">
          <div className="border-b border-glass-border pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Column Schema & Typing
            </h3>
          </div>
          {profile?.data_types && Object.keys(profile.data_types).length ? (
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto border border-glass-border rounded-lg bg-black/20">
              <table className="table-base text-xs">
                <thead>
                  <tr>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Column</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Inferred Type</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Semantic Role</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Confidence</th>
                    <th className="sticky top-0 bg-[#0C1220] text-secondary">Unique Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(profile.data_types).map(([column, type]) => {
                    const schemaMeta = profile.columns_schema?.[column]
                    const semantic = schemaMeta?.semantic_type || type
                    const confidence = schemaMeta?.confidence ? `${Math.round(schemaMeta.confidence * 100)}%` : '95%'
                    return (
                      <tr key={column} className="hover:bg-white/[0.04]">
                        <td className="font-semibold text-white">{column}</td>
                        <td className="text-secondary font-mono text-xs">{type}</td>
                        <td className="text-primary font-medium capitalize">{semantic}</td>
                        <td className="text-emerald-400 font-mono text-xs">{confidence}</td>
                        <td className="text-white font-medium">{formatNumber(profile.unique_counts?.[column] ?? 0, 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-muted py-8 text-center">No column schema information found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
