import React, { useState, useEffect } from 'react'
import ExceptionTable from '../../components/mis/ExceptionTable'
import { getExceptions, updateExceptionStatus } from '../../services/api'
import { exportToCSV } from '../../services/misExport'
import { AlertCircle, Download } from 'lucide-react'

export default function ExceptionCenter({ workbookId }) {
  const [exceptions, setExceptions] = useState([])
  const [severityFilter, setSeverityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  const fetchExceptions = async () => {
    if (!workbookId) return
    setLoading(true)
    try {
      const res = await getExceptions(workbookId)
      setExceptions(res.exceptions || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExceptions()
  }, [workbookId])

  const handleStatusChange = async (exceptionId, newStatus) => {
    try {
      await updateExceptionStatus(workbookId, exceptionId, newStatus)
      fetchExceptions()
    } catch (err) {
      console.error(err)
    }
  }

  const handleExport = () => {
    exportToCSV('Business_Exceptions_Report', filteredExceptions)
  }

  const filteredExceptions = exceptions.filter((e) => {
    if (severityFilter !== 'All' && e.severity !== severityFilter) return false
    if (statusFilter !== 'All' && e.status !== statusFilter) return false
    return true
  })

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Collecting business exceptions…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Exception Center</h2>
          <p className="text-xs text-muted mt-0.5">
            Auto-collected business and data exceptions with interactive status resolution.
          </p>
        </div>

        <button onClick={handleExport} className="btn btn-ghost py-1.5 px-3 text-xs gap-1.5">
          <Download size={14} className="text-primary" /> Export Exceptions
        </button>
      </div>

      {/* Exception Filters */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted font-semibold">
            <AlertCircle size={14} className="text-primary" />
            <span>Severity:</span>
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="select text-xs py-1 px-3 w-36"
          >
            <option value="All">All Severities</option>
            <option value="Critical">Critical Only</option>
            <option value="Warning">Warning Only</option>
            <option value="Info">Info Only</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted font-semibold">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select text-xs py-1 px-3 w-36"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Review">In Review</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      <ExceptionTable exceptions={filteredExceptions} onStatusChange={handleStatusChange} />
    </div>
  )
}
