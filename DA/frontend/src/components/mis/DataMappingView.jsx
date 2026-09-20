import React, { useState, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, Save, RefreshCw } from 'lucide-react'
import { getMisMapping, saveMisMapping } from '../../services/api'

const MIS_FIELDS = [
  { key: 'revenue', label: 'Revenue / Sales Amount', desc: 'Total sales or revenue values' },
  { key: 'date', label: 'Transaction Date', desc: 'Date of sales or invoices' },
  { key: 'customer', label: 'Customer / Client Name', desc: 'Customer identifier or name' },
  { key: 'product', label: 'Product / SKU', desc: 'Product name or SKU code' },
  { key: 'category', label: 'Category', desc: 'Product or item category' },
  { key: 'region', label: 'Region / Zone', desc: 'Geographic zone or region' },
  { key: 'quantity', label: 'Quantity / Units', desc: 'Quantity of items sold or moved' },
  { key: 'purchase_value', label: 'Purchase Value', desc: 'PO or purchase order cost' },
  { key: 'stock', label: 'Stock / Inventory Qty', desc: 'Current or closing inventory stock' },
  { key: 'reorder_level', label: 'Reorder Level', desc: 'Minimum stock threshold for alert' },
  { key: 'target', label: 'Sales Target', desc: 'Budget or target sales quota' },
  { key: 'expenses', label: 'Expenses', desc: 'Operating costs or expense amount' },
  { key: 'invoice_no', label: 'Invoice / Bill No', desc: 'Unique invoice identifier' },
  { key: 'due_date', label: 'Due / Expiry Date', desc: 'Payment due date' },
  { key: 'department', label: 'Department / Unit', desc: 'Business division or dept' },
  { key: 'vendor', label: 'Vendor / Supplier', desc: 'Supplier name or ID' },
  { key: 'salesperson', label: 'Sales Rep / Executive', desc: 'Sales rep or employee name' },
]

export default function DataMappingView({ workbookId, onSaved }) {
  const [effective, setEffective] = useState({})
  const [custom, setCustom] = useState({})
  const [sheetsColumns, setSheetsColumns] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const fetchMapping = async () => {
    if (!workbookId) return
    setLoading(true)
    try {
      const res = await getMisMapping(workbookId)
      setEffective(res.effective_mapping || {})
      setCustom(res.custom_mapping || {})
      setSheetsColumns(res.sheets_columns || {})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMapping()
  }, [workbookId])

  const handleSelectChange = (fieldKey, selectedVal) => {
    setCustom((prev) => ({
      ...prev,
      [fieldKey]: selectedVal,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await saveMisMapping(workbookId, custom)
      setMsg({ type: 'success', text: 'Column mapping saved successfully!' })
      fetchMapping()
      if (onSaved) onSaved()
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to save column mapping' })
    } finally {
      setSaving(false)
    }
  }

  // All sheet::column choices list
  const allChoices = []
  Object.entries(sheetsColumns).forEach(([sheet, cols]) => {
    cols.forEach((col) => {
      allChoices.push({ value: `${sheet}::${col}`, label: `[${sheet}] ${col}` })
    })
  })

  if (loading) {
    return (
      <div className="card p-8 text-center text-muted text-sm">
        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-primary" />
        Detecting workbook column schemas…
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borderline pb-4">
        <div>
          <h3 className="text-base font-bold text-ink">MIS Data Schema Mapping</h3>
          <p className="text-xs text-muted mt-0.5">
            Configure how uploaded Excel columns map to MIS business concepts. Unmapped fields will show a data-unavailable state.
          </p>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn btn-primary py-2 px-4 text-xs gap-1.5">
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Mapping'}
        </button>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-lg text-xs font-medium border ${
            msg.type === 'success'
              ? 'bg-positive/10 border-positive/30 text-positive'
              : 'bg-negative/10 border-negative/30 text-negative'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MIS_FIELDS.map((field) => {
          const matched = effective[field.key]
          const isDetected = matched && matched.sheet && matched.column

          return (
            <div key={field.key} className="p-3.5 rounded-lg border border-borderline/80 bg-bg-sidebar space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-ink">{field.label}</div>
                  <div className="text-[11px] text-muted">{field.desc}</div>
                </div>

                {isDetected ? (
                  <span className="tag bg-positive/10 border-positive/30 text-positive text-[10px]">
                    <CheckCircle2 size={12} /> Detected
                  </span>
                ) : (
                  <span className="tag bg-warning/10 border-warning/30 text-warning text-[10px]">
                    <AlertTriangle size={12} /> Unmapped
                  </span>
                )}
              </div>

              <div>
                <select
                  value={
                    custom[field.key]
                      ? typeof custom[field.key] === 'string'
                        ? custom[field.key]
                        : `${custom[field.key].sheet}::${custom[field.key].column}`
                      : isDetected
                      ? `${matched.sheet}::${matched.column}`
                      : ''
                  }
                  onChange={(e) => handleSelectChange(field.key, e.target.value)}
                  className="select text-xs py-1.5"
                >
                  <option value="">-- Select Column --</option>
                  {allChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
