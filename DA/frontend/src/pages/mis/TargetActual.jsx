import React, { useState, useEffect } from 'react'
import MISKPICard from '../../components/mis/MISKPICard'
import MISChart from '../../components/mis/MISChart'
import MISDataTable from '../../components/mis/MISDataTable'
import { getTargetVsActual, getMomYoy } from '../../services/api'
import { Target, TrendingUp } from 'lucide-react'

export default function TargetActual({ workbookId, filters }) {
  const [data, setData] = useState(null)
  const [momData, setMomData] = useState(null)
  const [momMode, setMomMode] = useState('MoM')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workbookId) return
    setLoading(true)
    Promise.all([
      getTargetVsActual(workbookId, filters),
      getMomYoy(workbookId, { mode: momMode, filters }),
    ])
      .then(([tgt, mom]) => {
        setData(tgt)
        setMomData(mom)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workbookId, momMode, filters])

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Computing Target vs Actual analytics…</div>
  }

  if (!data || !data.available) {
    return <div className="card p-8 text-center text-muted text-xs">Target vs Actual data unavailable</div>
  }

  const kpis = data.kpis || {}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Target vs Actual & Growth Analysis</h2>
          <p className="text-xs text-muted mt-0.5">
            Quota achievement %, variance tracking and MoM / QoQ / YoY growth comparisons.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-bg-sidebar p-1 rounded-lg border border-borderline text-xs">
          {['MoM', 'QoQ', 'YoY'].map((mode) => (
            <button
              key={mode}
              onClick={() => setMomMode(mode)}
              className={`px-3 py-1 rounded font-semibold transition ${
                momMode === mode ? 'bg-primary text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Target vs Actual KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MISKPICard title="Sales Target" value={kpis.target} format="currency" change={0} status="neutral" />
        <MISKPICard title="Actual Revenue" value={kpis.actual} format="currency" change={8.4} />
        <MISKPICard title="Achievement %" value={`${kpis.achievement_pct}%`} format="text" change={3.4} status={kpis.achievement_pct >= 90 ? 'positive' : 'warning'} />
        <MISKPICard title="Variance" value={kpis.variance} format="currency" change={0} status={kpis.variance >= 0 ? 'positive' : 'negative'} />
      </div>

      {/* Target vs Actual Progress Visualization */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-primary" />
          <h4 className="text-sm font-bold text-ink">Target Performance Progress</h4>
        </div>

        <div className="space-y-3">
          {(data.breakdown || []).map((b, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-ink">{b.entity}</span>
                <span className="text-muted">
                  Actual: <strong className="text-ink">₹{b.actual?.toLocaleString()}</strong> / Target: ₹{b.target?.toLocaleString()} ({b.achievement}%)
                </span>
              </div>
              <div className="w-full bg-bg-sidebar h-3 rounded-full overflow-hidden border border-borderline/60">
                <div
                  className={`h-full transition-all duration-500 ${
                    b.status === 'achieved'
                      ? 'bg-positive'
                      : b.status === 'warning'
                      ? 'bg-warning'
                      : 'bg-negative'
                  }`}
                  style={{ width: `${Math.min(100, b.achievement)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MoM / QoQ / YoY Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MISChart
          type="line"
          data={momData?.periods || []}
          dataKey="current"
          nameKey="period"
          title={`${momMode} Revenue Trend`}
          height={260}
        />

        <MISDataTable
          title={`${momMode} Performance Matrix`}
          data={momData?.periods || []}
          columns={['period', 'current', 'previous', 'growth_pct']}
        />
      </div>
    </div>
  )
}
