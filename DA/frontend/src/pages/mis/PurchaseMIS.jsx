import React, { useState, useEffect } from 'react'
import MISKPICard from '../../components/mis/MISKPICard'
import MISChart from '../../components/mis/MISChart'
import MISDataTable from '../../components/mis/MISDataTable'
import { getPurchaseMis } from '../../services/api'
import { AlertTriangle } from 'lucide-react'

export default function PurchaseMIS({ workbookId, filters, onConfigureMapping }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workbookId) return
    setLoading(true)
    getPurchaseMis(workbookId, filters)
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workbookId, filters])

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Computing Purchase MIS metrics…</div>
  }

  if (!data || !data.available) {
    return (
      <div className="card p-8 text-center text-muted text-xs space-y-3">
        <AlertTriangle size={24} className="mx-auto text-warning" />
        <p className="font-semibold text-ink text-sm">Purchase Analysis Unavailable</p>
        <p className="max-w-md mx-auto">{data?.warning || 'Required purchase fields were not detected in the workbook.'}</p>
        <button onClick={onConfigureMapping} className="btn btn-primary py-1.5 px-4 text-xs">
          Configure Data Mapping
        </button>
      </div>
    )
  }

  const kpis = data.kpis || {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">Purchase MIS</h2>
        <p className="text-xs text-muted mt-0.5">
          Procurement value, vendor delivery rates, pending POs and purchase price variance.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MISKPICard title="Total Purchase Value" value={kpis.total_purchase_value} format="currency" change={4.2} />
        <MISKPICard title="PO Count" value={kpis.po_count} format="number" change={2.1} />
        <MISKPICard title="Pending POs" value={kpis.pending_pos} format="number" change={-1.5} />
        <MISKPICard title="Purchase Variance" value={kpis.purchase_variance} format="text" change={0} status="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MISChart
          type="bar"
          data={data.vendors || []}
          dataKey="purchase_value"
          nameKey="vendor"
          title="Top Vendor Procurement Value"
          height={260}
        />

        <MISDataTable
          title="Vendor Performance & Rejection Rate"
          data={data.vendors || []}
          columns={['vendor', 'po_count', 'purchase_value', 'delivery_rate', 'rejection_rate']}
        />
      </div>
    </div>
  )
}
