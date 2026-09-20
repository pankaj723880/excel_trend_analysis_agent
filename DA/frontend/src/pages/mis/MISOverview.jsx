import React, { useState, useEffect } from 'react'
import MISKPICard from '../../components/mis/MISKPICard'
import MISChart from '../../components/mis/MISChart'
import MISDataTable from '../../components/mis/MISDataTable'
import { getMisOverview } from '../../services/api'
import { AlertCircle, Activity, ShieldCheck, FileText } from 'lucide-react'

export default function MISOverview({ workbookId, filters }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState('area')

  useEffect(() => {
    if (!workbookId) return
    let isMounted = true
    setLoading(true)
    getMisOverview(workbookId, filters)
      .then((res) => {
        if (isMounted) setData(res)
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [workbookId, filters])

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Loading MIS Overview analytics…</div>
  }

  if (!data) return null

  return (
    <div className="space-y-6 max-w-full min-w-0 overflow-hidden">
      {/* Title & Subtitle */}
      <div>
        <h2 className="text-xl font-extrabold text-ink">MIS Overview</h2>
        <p className="text-xs text-muted mt-0.5">
          Operational reporting, KPI monitoring and business performance insights.
        </p>
      </div>

      {/* Row 1: Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 min-w-0">
        {(data.kpis || []).map((kpi, idx) => (
          <MISKPICard key={idx} {...kpi} />
        ))}
      </div>

      {/* Row 2: Revenue Trend & Target/Exceptions Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0">
        <div className="lg:col-span-2 space-y-2 min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Monthly Sales Trend (Actual Workbook Data)
            </span>
            <div className="flex items-center gap-1 bg-bg-card border border-borderline p-1 rounded-lg">
              {['area', 'line', 'bar'].map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded capitalize transition-all cursor-pointer ${
                    chartType === t
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <MISChart
            type={chartType}
            data={data.revenue_trend || []}
            dataKey="revenue"
            nameKey="period"
            height={280}
          />
        </div>

        <div className="card p-4 space-y-4">
          <h4 className="text-sm font-bold text-ink">Business Signals & Quality</h4>

          <div className="p-3.5 rounded-lg bg-bg-sidebar border border-borderline flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-positive" />
              <div>
                <div className="text-xs font-bold text-ink">Data Quality Score</div>
                <div className="text-[11px] text-muted">Workbook integrity & clean rules</div>
              </div>
            </div>
            <div className="text-xl font-extrabold text-positive">{data.data_quality_score}%</div>
          </div>

          <div className="p-3.5 rounded-lg bg-bg-sidebar border border-borderline flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="text-warning" />
              <div>
                <div className="text-xs font-bold text-ink">Open Exceptions</div>
                <div className="text-[11px] text-muted">Business anomalies flagged</div>
              </div>
            </div>
            <div className="text-xl font-extrabold text-warning">
              {data.exceptions_summary?.critical + data.exceptions_summary?.warning || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Activity Log */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <h4 className="text-sm font-bold text-ink">Recent Audit & Activity Log</h4>
        </div>

        <div className="divide-y divide-borderline/60">
          {(data.activity_log || []).map((act, idx) => (
            <div key={idx} className="py-2 flex items-center justify-between text-xs">
              <span className="text-ink/90 font-medium">{act.event}</span>
              <span className="text-muted font-mono text-[11px]">{act.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
