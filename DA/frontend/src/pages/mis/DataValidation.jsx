import React, { useState, useEffect } from 'react'
import MISDataTable from '../../components/mis/MISDataTable'
import { getDataValidation } from '../../services/api'
import { ShieldCheck, CheckCircle2, AlertOctagon, RefreshCw } from 'lucide-react'

export default function DataValidation({ workbookId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchValidation = async () => {
    if (!workbookId) return
    setLoading(true)
    try {
      const res = await getDataValidation(workbookId)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchValidation()
  }, [workbookId])

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Evaluating data validation rules…</div>
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Data Validation Center & Rule Engine</h2>
          <p className="text-xs text-muted mt-0.5">
            Automated integrity checking for missing fields, negative values, duplicates, and invalid dates.
          </p>
        </div>

        <button onClick={fetchValidation} className="btn btn-ghost py-1.5 px-3 text-xs gap-1.5">
          <RefreshCw size={14} className="text-primary" /> Run Validation
        </button>
      </div>

      {/* Overview Score Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted font-semibold uppercase">Data Quality Score</div>
            <div className="text-2xl font-bold text-positive mt-1">{data.quality_score}%</div>
          </div>
          <ShieldCheck size={32} className="text-positive" />
        </div>

        <div className="card p-4">
          <div className="text-xs text-muted font-semibold uppercase">Total Workbook Records</div>
          <div className="text-2xl font-bold text-ink mt-1">{data.total_records?.toLocaleString()}</div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-muted font-semibold uppercase">Valid Records</div>
          <div className="text-2xl font-bold text-positive mt-1">{data.valid_records?.toLocaleString()}</div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-muted font-semibold uppercase">Validation Exceptions</div>
          <div className="text-2xl font-bold text-warning mt-1">{data.exceptions_count?.toLocaleString()}</div>
        </div>
      </div>

      {/* Rule Violations Table */}
      <MISDataTable
        title="Active Validation Rule Violations"
        subtitle="Evaluated across all sheets in active workbook"
        data={data.violations || []}
        columns={['sheet', 'rule', 'count', 'severity']}
      />
    </div>
  )
}
