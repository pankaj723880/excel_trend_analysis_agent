import React, { useState, useEffect } from 'react'
import MISDataTable from '../../components/mis/MISDataTable'
import { getMasterData } from '../../services/api'
import { Database } from 'lucide-react'

const ENTITIES = ['Products', 'Customers', 'Vendors', 'Employees', 'Locations', 'Departments']

export default function MasterData({ workbookId }) {
  const [selectedEntity, setSelectedEntity] = useState('Products')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workbookId) return
    setLoading(true)
    getMasterData(workbookId, selectedEntity)
      .then((res) => setRecords(res.records || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workbookId, selectedEntity])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Master Data Explorer</h2>
          <p className="text-xs text-muted mt-0.5">
            Auto-detected entity master lists extracted from workbook sheets.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-bg-sidebar p-1 rounded-lg border border-borderline text-xs">
          {ENTITIES.map((ent) => (
            <button
              key={ent}
              onClick={() => setSelectedEntity(ent)}
              className={`px-3 py-1 rounded font-semibold transition ${
                selectedEntity === ent ? 'bg-primary text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {ent}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-muted text-xs">Loading {selectedEntity} master data…</div>
      ) : (
        <MISDataTable
          title={`${selectedEntity} Master List`}
          subtitle={`Found ${records.length} records in active workbook`}
          data={records}
        />
      )}
    </div>
  )
}
