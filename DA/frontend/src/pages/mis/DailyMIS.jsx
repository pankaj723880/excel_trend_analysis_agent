import React, { useState, useEffect } from 'react'
import { getDailyMis } from '../../services/api'
import { Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react'

export default function DailyMIS({ workbookId, filters }) {
  const [selectedDate, setSelectedDate] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workbookId) return
    setLoading(true)
    getDailyMis(workbookId, { selected_date: selectedDate, filters })
      .then((res) => {
        setData(res)
        if (res.selected_date && !selectedDate) {
          setSelectedDate(res.selected_date)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workbookId, selectedDate, filters])

  if (loading && !data) {
    return <div className="card p-8 text-center text-muted text-xs">Computing Daily MIS metrics…</div>
  }

  if (!data || !data.available) {
    return (
      <div className="card p-8 text-center text-muted text-xs space-y-2">
        <p className="font-semibold text-ink text-sm">Daily MIS Data Unavailable</p>
        <p>{data?.reason || 'Required sales & date columns were not detected in the current workbook.'}</p>
      </div>
    )
  }

  const formatVal = (val, fmt) => {
    if (fmt === 'currency') {
      if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`
      return `₹${Number(val).toLocaleString()}`
    }
    return Number(val).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Daily MIS Report</h2>
          <p className="text-xs text-muted mt-0.5">
            Daily operational metrics comparison against previous day.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          <span className="text-xs font-semibold text-muted">Select Date:</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="select text-xs py-1.5 px-3 w-40"
          >
            {(data.available_dates || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted border-b border-borderline pb-2">
          <span>Comparing <strong className="text-ink">{data.selected_date}</strong> vs Previous Day (<strong className="text-ink">{data.previous_date}</strong>)</span>
        </div>

        <div className="overflow-x-auto border border-borderline rounded-lg">
          <table className="table-base">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Today ({data.selected_date})</th>
                <th>Previous ({data.previous_date})</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {(data.metrics || []).map((m, idx) => (
                <tr key={idx}>
                  <td className="font-semibold text-ink">{m.metric}</td>
                  <td className="font-bold text-ink">{formatVal(m.today, m.format)}</td>
                  <td className="text-muted">{formatVal(m.previous, m.format)}</td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold text-xs ${
                        m.status === 'positive' ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {m.status === 'positive' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {m.change}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
