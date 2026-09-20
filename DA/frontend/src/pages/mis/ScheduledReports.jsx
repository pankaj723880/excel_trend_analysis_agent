import React, { useState, useEffect } from 'react'
import MISDataTable from '../../components/mis/MISDataTable'
import { getScheduledReports, addScheduledReport } from '../../services/api'
import { Calendar, Plus, Clock } from 'lucide-react'

export default function ScheduledReports({ workbookId }) {
  const [reports, setReports] = useState([])
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState('Daily')
  const [time, setTime] = useState('09:00 AM')
  const [format, setFormat] = useState('PDF')
  const [recipients, setRecipients] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchReports = async () => {
    if (!workbookId) return
    setLoading(true)
    try {
      const res = await getScheduledReports(workbookId)
      setReports(res.scheduled_reports || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [workbookId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name || !recipients) return
    try {
      await addScheduledReport(workbookId, {
        name,
        frequency,
        time,
        format,
        recipients,
        status: 'Active',
      })
      setName('')
      setRecipients('')
      fetchReports()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Loading scheduled reports…</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">Scheduled Reports</h2>
        <p className="text-xs text-muted mt-0.5">
          Configure automated recurring email delivery schedules for MIS reports.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <form onSubmit={handleAdd} className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-borderline pb-3">
            <Clock size={16} className="text-primary" />
            <h4 className="text-sm font-bold text-ink">Schedule New Report</h4>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Report Name</label>
            <input
              type="text"
              placeholder="e.g. Daily Sales MIS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input text-xs"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="select text-xs">
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Delivery Time</label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Export Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="select text-xs">
              <option value="PDF">PDF</option>
              <option value="Excel">Excel</option>
              <option value="CSV">CSV</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Recipients (Emails)</label>
            <input
              type="text"
              placeholder="management@company.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="input text-xs"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full py-2 text-xs gap-1.5 mt-2">
            <Plus size={14} /> Add Schedule
          </button>
        </form>

        {/* List */}
        <div className="lg:col-span-2">
          <MISDataTable
            title="Active Report Delivery Schedules"
            data={reports}
            columns={['name', 'frequency', 'time', 'format', 'recipients', 'status']}
          />
        </div>
      </div>
    </div>
  )
}
