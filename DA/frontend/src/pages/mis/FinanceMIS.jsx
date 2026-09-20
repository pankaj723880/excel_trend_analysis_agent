import React, { useState, useEffect } from 'react'
import MISKPICard from '../../components/mis/MISKPICard'
import MISChart from '../../components/mis/MISChart'
import MISDataTable from '../../components/mis/MISDataTable'
import { getFinanceMis } from '../../services/api'

export default function FinanceMIS({ workbookId, filters }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workbookId) return
    setLoading(true)
    getFinanceMis(workbookId, filters)
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workbookId, filters])

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Computing Finance MIS metrics…</div>
  }

  if (!data || !data.available) {
    return <div className="card p-8 text-center text-muted text-xs">Finance data unavailable</div>
  }

  const fin = data.financials || {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">Finance & Receivables MIS</h2>
        <p className="text-xs text-muted mt-0.5">
          P&L analysis, margin calculations, receivables aging and outstanding collections.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MISKPICard title="Revenue" value={fin.revenue} format="currency" change={8.4} />
        <MISKPICard title="Operating Expenses" value={fin.expenses} format="currency" change={3.1} status="neutral" />
        <MISKPICard title="Net Profit" value={fin.profit} format="currency" change={12.5} />
        <MISKPICard title="Profit Margin" value={`${fin.margin_pct}%`} format="text" change={1.2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MISChart
          type="bar"
          data={data.receivables_aging || []}
          dataKey="amount"
          nameKey="bucket"
          title="Receivables Aging Buckets"
          height={260}
        />

        <MISDataTable
          title="Top Outstanding Customers"
          subtitle="Customer balances and payment due statuses"
          data={data.top_customers || []}
          columns={['customer', 'outstanding', 'days_outstanding', 'status']}
        />
      </div>
    </div>
  )
}
