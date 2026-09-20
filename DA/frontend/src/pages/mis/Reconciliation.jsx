import React, { useState, useEffect } from 'react'
import MISDataTable from '../../components/mis/MISDataTable'
import { getReconciliation } from '../../services/api'
import { exportToCSV } from '../../services/misExport'
import { CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'

export default function Reconciliation({ workbookId, sheets = [] }) {
  const [sourceA, setSourceA] = useState('')
  const [sourceB, setSourceB] = useState('')
  const [keyField, setKeyField] = useState('')
  const [valField, setValField] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sheets.length > 0 && !sourceA) {
      setSourceA(sheets[0].name)
      setSourceB(sheets[1] ? sheets[1].name : sheets[0].name)
    }
  }, [sheets])

  const runReconcile = async () => {
    if (!workbookId) return
    setLoading(true)
    try {
      const res = await getReconciliation(workbookId, {
        source_a: sourceA,
        source_b: sourceB,
        key_field: keyField,
        value_field: valField,
      })
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (workbookId && sourceA) {
      runReconcile()
    }
  }, [workbookId, sourceA, sourceB])

  const handleExportExceptions = () => {
    if (data?.record_details) {
      const exceptionsOnly = data.record_details.filter((r) => r.status !== 'Matched')
      exportToCSV(`Reconciliation_Exceptions_${sourceA}_vs_${sourceB}`, exceptionsOnly)
    }
  }

  const summ = data?.summary || {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">Reconciliation Center</h2>
        <p className="text-xs text-muted mt-0.5">
          Cross-sheet data verification and record-level discrepancy analysis.
        </p>
      </div>

      {/* Control Bar */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Source A (ERP)</label>
          <select value={sourceA} onChange={(e) => setSourceA(e.target.value)} className="select text-xs py-1.5">
            {sheets.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Source B (Reported)</label>
          <select value={sourceB} onChange={(e) => setSourceB(e.target.value)} className="select text-xs py-1.5">
            {sheets.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Key Field (Invoice ID)</label>
          <input
            type="text"
            placeholder="Auto-detect"
            value={keyField}
            onChange={(e) => setKeyField(e.target.value)}
            className="input text-xs py-1.5"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted mb-1 block">Value Field (Revenue)</label>
          <input
            type="text"
            placeholder="Auto-detect"
            value={valField}
            onChange={(e) => setValField(e.target.value)}
            className="input text-xs py-1.5"
          />
        </div>

        <div className="flex items-end">
          <button onClick={runReconcile} className="btn btn-primary w-full py-1.5 text-xs">
            Run Reconciliation
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-muted text-xs">Reconciling records across sheets…</div>
      ) : data && data.available ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="card p-4">
              <div className="text-xs text-muted font-semibold uppercase">Source A Total ({data.source_a})</div>
              <div className="text-xl font-bold text-ink mt-1">₹{summ.source_a_total?.toLocaleString()}</div>
            </div>

            <div className="card p-4">
              <div className="text-xs text-muted font-semibold uppercase">Source B Total ({data.source_b})</div>
              <div className="text-xl font-bold text-ink mt-1">₹{summ.source_b_total?.toLocaleString()}</div>
            </div>

            <div className="card p-4">
              <div className="text-xs text-muted font-semibold uppercase">Total Variance</div>
              <div className={`text-xl font-bold mt-1 ${summ.variance === 0 ? 'text-positive' : 'text-negative'}`}>
                ₹{summ.variance?.toLocaleString()}
              </div>
            </div>

            <div className="card p-4">
              <div className="text-xs text-muted font-semibold uppercase">Overall Status</div>
              <div className="flex items-center gap-1.5 mt-1 font-bold text-base">
                {summ.status === 'Matched' ? (
                  <span className="text-positive flex items-center gap-1">
                    <CheckCircle2 size={16} /> Matched
                  </span>
                ) : (
                  <span className="text-negative flex items-center gap-1">
                    <AlertTriangle size={16} /> Discrepancies Flagged
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Record-Level Reconciliation Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-ink">Record-Level Reconciliation Details</h4>
              <button onClick={handleExportExceptions} className="btn btn-ghost py-1 px-3 text-xs gap-1.5">
                <FileSpreadsheet size={14} className="text-primary" /> Export Exceptions
              </button>
            </div>

            <MISDataTable
              data={data.record_details || []}
              columns={['key', 'source_a_val', 'source_b_val', 'difference', 'status']}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
