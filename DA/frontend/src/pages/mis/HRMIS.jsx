import React, { useState, useEffect } from 'react'
import MISKPICard from '../../components/mis/MISKPICard'
import MISChart from '../../components/mis/MISChart'
import MISDataTable from '../../components/mis/MISDataTable'
import { getMasterData } from '../../services/api'

export default function HRMIS({ workbookId }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workbookId) return
    setLoading(true)
    getMasterData(workbookId, 'Employees')
      .then((res) => setEmployees(res.records || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workbookId])

  if (loading) {
    return <div className="card p-8 text-center text-muted text-xs">Loading HR MIS metrics…</div>
  }

  const deptHeadcount = [
    { department: 'Sales', headcount: 42 },
    { department: 'Engineering', headcount: 35 },
    { department: 'Operations', headcount: 28 },
    { department: 'Finance', headcount: 12 },
    { department: 'HR', headcount: 8 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">HR MIS</h2>
        <p className="text-xs text-muted mt-0.5">
          Headcount distribution, department staffing and employee directory.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MISKPICard title="Total Employees" value={125} format="number" change={3.2} />
        <MISKPICard title="Active Staff" value={122} format="number" change={2.1} />
        <MISKPICard title="New Hires (This Month)" value={5} format="number" change={0} />
        <MISKPICard title="Attrition Rate" value="2.4%" format="text" change={-0.5} status="positive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MISChart
          type="bar"
          data={deptHeadcount}
          dataKey="headcount"
          nameKey="department"
          title="Headcount by Department"
          height={260}
        />

        <MISDataTable
          title="Employee Master Records"
          data={employees}
        />
      </div>
    </div>
  )
}
