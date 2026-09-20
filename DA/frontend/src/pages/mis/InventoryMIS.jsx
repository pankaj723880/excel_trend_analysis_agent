import React, { useState, useEffect } from 'react'
import MISKPICard from '../../components/mis/MISKPICard'
import MISChart from '../../components/mis/MISChart'
import MISDataTable from '../../components/mis/MISDataTable'
import { getInventoryMis } from '../../services/api'
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function InventoryMIS({ workbookId, filters }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alertFilter, setAlertFilter] = useState('All')

  useEffect(() => {
    if (!workbookId) return
    setLoading(true)
    getInventoryMis(workbookId, filters)
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workbookId, filters])

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Computing Inventory MIS metrics…</div>
  }

  if (!data || !data.available) {
    return <div className="card p-8 text-center text-muted text-xs">Inventory data unavailable</div>
  }

  const ov = data.overview || {}
  const filteredAlerts = (data.alerts || []).filter((a) => alertFilter === 'All' || a.status === alertFilter)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">Inventory MIS & Aging</h2>
        <p className="text-xs text-muted mt-0.5">
          Stock valuation, 0–90+ days aging analysis and interactive reorder alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MISKPICard title="Total Units" value={ov.total_units} format="number" change={2.1} />
        <MISKPICard title="Stock Value" value={ov.stock_value} format="currency" change={-1.8} />
        <MISKPICard title="Low Stock SKUs" value={ov.low_stock_count} format="number" change={0} status="warning" />
        <MISKPICard title="Out of Stock SKUs" value={ov.out_of_stock_count} format="number" change={0} status="negative" />
      </div>

      {/* Reorder Alert Badges */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borderline pb-3">
          <h4 className="text-sm font-bold text-ink">Inventory Reorder Alerts</h4>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setAlertFilter('All')}
              className={`px-3 py-1 rounded font-semibold transition ${
                alertFilter === 'All' ? 'bg-primary text-white' : 'bg-bg-sidebar text-muted hover:text-ink'
              }`}
            >
              All ({data.alerts?.length || 0})
            </button>
            <button
              onClick={() => setAlertFilter('Out of Stock')}
              className={`px-3 py-1 rounded font-semibold transition flex items-center gap-1 ${
                alertFilter === 'Out of Stock' ? 'bg-negative text-white' : 'bg-negative/10 text-negative border border-negative/30'
              }`}
            >
              <AlertCircle size={12} /> Out of Stock ({ov.out_of_stock_count})
            </button>
            <button
              onClick={() => setAlertFilter('Below Reorder Level')}
              className={`px-3 py-1 rounded font-semibold transition flex items-center gap-1 ${
                alertFilter === 'Below Reorder Level' ? 'bg-warning text-slate-950' : 'bg-warning/10 text-warning border border-warning/30'
              }`}
            >
              <AlertTriangle size={12} /> Below Reorder ({ov.low_stock_count})
            </button>
          </div>
        </div>

        <MISDataTable
          data={filteredAlerts}
          columns={['sku', 'stock', 'reorder_level', 'status']}
        />
      </div>

      {/* Inventory Aging Chart & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MISChart
          type="bar"
          data={data.aging || []}
          dataKey="value"
          nameKey="bucket"
          title="Inventory Aging Valuation (Rupees)"
          height={260}
        />

        <MISDataTable
          title="Inventory Aging Detail"
          data={data.aging || []}
          columns={['bucket', 'skus', 'qty', 'value']}
        />
      </div>
    </div>
  )
}
