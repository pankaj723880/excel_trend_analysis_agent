import React, { useState, useEffect } from 'react'
import MISKPICard from '../../components/mis/MISKPICard'
import MISChart from '../../components/mis/MISChart'
import MISDataTable from '../../components/mis/MISDataTable'
import { getSalesMis, getSalesDrilldown } from '../../services/api'
import { ChevronRight, Layers } from 'lucide-react'

export default function SalesMIS({ workbookId, filters }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Drill-down state: level = 'overview' | 'salesperson' | 'customer' | 'transactions'
  const [drillLevel, setDrillLevel] = useState('overview')
  const [parentVal, setParentVal] = useState(null)
  const [drillData, setDrillData] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    if (!workbookId) return
    setLoading(true)
    getSalesMis(workbookId, filters)
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workbookId, filters])

  const handleDrillClick = async (level, value) => {
    setDrillLevel(level)
    setParentVal(value)
    setDrillLoading(true)
    try {
      const res = await getSalesDrilldown(workbookId, { level, parent_value: value, filters })
      setDrillData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setDrillLoading(false)
    }
  }

  const resetDrill = () => {
    setDrillLevel('overview')
    setParentVal(null)
    setDrillData(null)
  }

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Loading Sales MIS analytics…</div>
  }

  if (!data || !data.available) {
    return (
      <div className="card p-8 text-center text-muted text-xs">
        Sales MIS data unavailable — please check column mappings.
      </div>
    )
  }

  const kpis = data.kpis || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Sales MIS</h2>
          <p className="text-xs text-muted mt-0.5">
            Revenue tracking, regional breakdown, product performance and interactive drill-down.
          </p>
        </div>

        {/* Drilldown breadcrumb */}
        {drillLevel !== 'overview' && (
          <button onClick={resetDrill} className="btn btn-ghost py-1 px-3 text-xs gap-1">
            <Layers size={14} className="text-primary" /> Reset Drill-Down
          </button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MISKPICard title="Total Revenue" value={kpis.total_revenue} format="currency" change={8.4} />
        <MISKPICard title="Total Orders" value={kpis.total_orders} format="number" change={5.2} />
        <MISKPICard title="Units Sold" value={kpis.units_sold} format="number" change={6.1} />
        <MISKPICard title="Avg Order Value" value={kpis.aov} format="currency" change={2.8} />
      </div>

      {/* Interactive Drill-down Header */}
      {drillLevel !== 'overview' && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-2 text-xs font-semibold text-primary">
          <span>Revenue</span> <ChevronRight size={14} />
          <span>{parentVal}</span> <ChevronRight size={14} />
          <span className="uppercase">{drillLevel} Drill-Down</span>
        </div>
      )}

      {/* Main Charts / Drill-Down Content */}
      {drillLevel === 'overview' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <MISChart
              type="bar"
              data={data.by_region || []}
              dataKey="revenue"
              nameKey="region"
              title="Sales by Region (Click Region to Drill-Down)"
              height={260}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  handleDrillClick('salesperson', e.activePayload[0].payload.region)
                }
              }}
            />

            <MISChart
              type="bar"
              data={data.by_product || []}
              dataKey="revenue"
              nameKey="product"
              title="Sales by Product"
              height={260}
            />
          </div>

          <MISDataTable
            title="Salesperson Performance"
            subtitle="Click any salesperson to view customer transactions"
            data={data.salesperson_perf || []}
            columns={['salesperson', 'revenue', 'orders', 'target', 'achievement']}
            onRowClick={(row) => handleDrillClick('customer', row.salesperson)}
          />
        </>
      ) : (
        <div className="space-y-4">
          {drillLoading ? (
            <div className="card p-8 text-center text-muted text-xs">Loading drill-down records…</div>
          ) : (
            <MISDataTable
              title={`Drill-Down Records for ${parentVal}`}
              subtitle={`Showing ${drillData?.count || 0} transaction records`}
              data={drillData?.records || []}
            />
          )}
        </div>
      )}
    </div>
  )
}
