import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  PieChart as PieIcon,
  Activity,
  Layers,
  MapPin,
  Table as TableIcon,
  Check,
  Filter,
  Plus,
  Trash2,
  Eye,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { getSheetVisualSchema, executeVisualize } from '../../services/api'
import DynamicChartRenderer from './DynamicChartRenderer'

// Visual Categories & Catalog
const VISUAL_CATEGORIES = [
  {
    id: 'comparisons',
    name: 'Comparisons & Trends',
    items: [
      { id: 'bar', name: 'Bar Chart', desc: 'Compare values across categories horizontally.', icon: BarChart2 },
      { id: 'column', name: 'Column Chart', desc: 'Compare values across discrete categories or time periods.', icon: BarChart2 },
      { id: 'line', name: 'Line Chart', desc: 'Track changes over time or ordered observations.', icon: Activity },
      { id: 'area', name: 'Area Chart', desc: 'Show trends and magnitude over time.', icon: Activity },
      { id: 'combo', name: 'Combo Chart', desc: 'Combine two related metrics with dual axes.', icon: Layers },
    ],
  },
  {
    id: 'parts_of_whole',
    name: 'Parts of a Whole',
    items: [
      { id: 'pie', name: 'Pie Chart', desc: 'Show proportional contribution of categories.', icon: PieIcon },
      { id: 'doughnut', name: 'Doughnut Chart', desc: 'Proportional composition with center metric.', icon: PieIcon },
      { id: 'treemap', name: 'Treemap', desc: 'Hierarchical composition using rectangle sizes.', icon: Layers },
    ],
  },
  {
    id: 'single_metrics',
    name: 'Single Metrics & Progress',
    items: [
      { id: 'scorecard', name: 'Scorecard / Big Number', desc: 'Highlight one important metric with target.', icon: Sparkles },
      { id: 'gauge', name: 'Gauge', desc: 'Show progress toward a target percentage.', icon: Activity },
      { id: 'bullet', name: 'Bullet Chart', desc: 'Compare actual performance against thresholds.', icon: Activity },
    ],
  },
  {
    id: 'distributions',
    name: 'Distributions & Relationships',
    items: [
      { id: 'scatter', name: 'Scatter Plot', desc: 'Relationship between two numeric variables.', icon: Activity },
      { id: 'bubble', name: 'Bubble Chart', desc: 'Two numeric variables with a 3rd bubble size metric.', icon: Activity },
      { id: 'histogram', name: 'Histogram', desc: 'Show frequency distribution of a numeric variable.', icon: BarChart2 },
    ],
  },
  {
    id: 'geographic_process',
    name: 'Geographic & Process Data',
    items: [
      { id: 'map', name: 'Map', desc: 'Display values across detected geographic regions.', icon: MapPin },
      { id: 'funnel', name: 'Funnel', desc: 'Show sequential stages and drop-off rate.', icon: Layers },
      { id: 'sankey', name: 'Flow / Sankey', desc: 'Show movement between source-target stages.', icon: Layers },
    ],
  },
  {
    id: 'data_detail',
    name: 'Data Detail',
    items: [
      { id: 'table', name: 'Table', desc: 'Display selected columns and records.', icon: TableIcon },
      { id: 'matrix', name: 'Matrix', desc: 'Pivot-style cross tabulation of dimensions.', icon: TableIcon },
    ],
  },
]

export default function VisualBuilderModal({
  isOpen,
  onClose,
  workbookId,
  sheets = [],
  initialVisual = null,
  onSaveVisual,
}) {
  const [step, setStep] = useState(1) // 1: Type, 2: Sheet, 3: Configure, 4: Preview
  const [selectedType, setSelectedType] = useState('bar')
  const [selectedSheet, setSelectedSheet] = useState(sheets[0]?.name || '')
  const [sheetSchema, setSheetSchema] = useState(null)
  const [schemaLoading, setSchemaLoading] = useState(false)

  // Configuration state
  const [title, setTitle] = useState('')
  const [config, setConfig] = useState({})
  const [filters, setFilters] = useState([])

  // Preview state
  const [previewResult, setPreviewResult] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)

  // Populate existing visual when editing
  useEffect(() => {
    if (initialVisual) {
      setSelectedType(initialVisual.type || 'bar')
      setSelectedSheet(initialVisual.sheet || sheets[0]?.name || '')
      setTitle(initialVisual.title || '')
      setConfig(initialVisual.config || {})
      setFilters(initialVisual.filters || [])
      setStep(3)
    } else {
      setSelectedType('bar')
      setSelectedSheet(sheets[0]?.name || '')
      setTitle('')
      setConfig({})
      setFilters([])
      setStep(1)
    }
  }, [initialVisual, isOpen, sheets])

  // Fetch sheet schema when sheet changes
  useEffect(() => {
    if (!workbookId || !selectedSheet) return
    let active = true
    setSchemaLoading(true)

    getSheetVisualSchema(workbookId, selectedSheet)
      .then((res) => {
        if (active) {
          setSheetSchema(res)
          setSchemaLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setSchemaLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [workbookId, selectedSheet])

  const columns = useMemo(() => sheetSchema?.columns || [], [sheetSchema])
  const numericCols = useMemo(() => columns.filter((c) => c.numeric), [columns])
  const categoricalCols = useMemo(() => columns.filter((c) => c.categorical), [columns])
  const dateCols = useMemo(() => columns.filter((c) => c.datetime), [columns])
  const geoCols = useMemo(() => columns.filter((c) => c.geographic), [columns])

  // Smart Auto-Defaults when chart type or columns change
  useEffect(() => {
    if (initialVisual || !columns.length) return

    if (selectedType === 'bar' || selectedType === 'column') {
      const cat = categoricalCols[0]?.column_name || dateCols[0]?.column_name || columns[0]?.column_name
      const num = numericCols[0]?.column_name || ''
      setConfig((prev) => ({
        category: prev.category || cat,
        measure: prev.measure || num,
        aggregation: prev.aggregation || (num ? 'sum' : 'count'),
        sort: prev.sort || 'desc',
        limit: prev.limit || 15,
      }))
      if (!title) {
        setTitle(num ? `${num} by ${cat}` : `Count by ${cat}`)
      }
    } else if (selectedType === 'line' || selectedType === 'area') {
      const x = dateCols[0]?.column_name || columns[0]?.column_name
      const y = numericCols[0]?.column_name || ''
      setConfig((prev) => ({
        x: prev.x || x,
        y: prev.y || y,
        aggregation: prev.aggregation || 'sum',
        time_grain: prev.time_grain || (dateCols.length ? 'month' : ''),
      }))
      if (!title) {
        setTitle(y ? `${y} over ${x}` : `Trend of ${x}`)
      }
    } else if (selectedType === 'combo') {
      const x = categoricalCols[0]?.column_name || dateCols[0]?.column_name || columns[0]?.column_name
      const m1 = numericCols[0]?.column_name || ''
      const m2 = numericCols[1]?.column_name || numericCols[0]?.column_name || ''
      setConfig((prev) => ({
        x: prev.x || x,
        primary_metric: prev.primary_metric || m1,
        secondary_metric: prev.secondary_metric || m2,
        primary_agg: prev.primary_agg || 'sum',
        secondary_agg: prev.secondary_agg || 'avg',
      }))
      if (!title) {
        setTitle(`${m1} and ${m2} by ${x}`)
      }
    } else if (selectedType === 'pie' || selectedType === 'doughnut') {
      const cat = categoricalCols[0]?.column_name || columns[0]?.column_name
      const num = numericCols[0]?.column_name || ''
      setConfig((prev) => ({
        category: prev.category || cat,
        measure: prev.measure || num,
        aggregation: prev.aggregation || (num ? 'sum' : 'count'),
        top_n: prev.top_n || 7,
      }))
      if (!title) {
        setTitle(num ? `${num} Distribution by ${cat}` : `${cat} Share`)
      }
    } else if (selectedType === 'scorecard') {
      const m = numericCols[0]?.column_name || ''
      setConfig((prev) => ({
        measure: prev.measure || m,
        aggregation: prev.aggregation || (m ? 'sum' : 'count'),
      }))
      if (!title) {
        setTitle(m ? `Total ${m}` : 'Total Records')
      }
    } else if (selectedType === 'scatter' || selectedType === 'bubble') {
      const x = numericCols[0]?.column_name || ''
      const y = numericCols[1]?.column_name || numericCols[0]?.column_name || ''
      const s = selectedType === 'bubble' ? numericCols[2]?.column_name || '' : ''
      const c = categoricalCols[0]?.column_name || ''
      setConfig((prev) => ({
        x: prev.x || x,
        y: prev.y || y,
        size: prev.size || s,
        color: prev.color || c,
      }))
      if (!title) {
        setTitle(`${y} vs ${x}`)
      }
    } else if (selectedType === 'histogram') {
      const m = numericCols[0]?.column_name || ''
      setConfig((prev) => ({
        metric: prev.metric || m,
        bins: prev.bins || 20,
      }))
      if (!title) {
        setTitle(`Distribution of ${m}`)
      }
    } else if (selectedType === 'table') {
      setConfig((prev) => ({
        columns: prev.columns || columns.slice(0, 6).map((c) => c.column_name),
        limit: prev.limit || 50,
      }))
      if (!title) {
        setTitle(`${selectedSheet} Table Detail`)
      }
    } else if (selectedType === 'matrix') {
      const r = categoricalCols[0]?.column_name || columns[0]?.column_name
      const c = categoricalCols[1]?.column_name || columns[1]?.column_name
      const v = numericCols[0]?.column_name || ''
      setConfig((prev) => ({
        rows: prev.rows || r,
        columns: prev.columns || c,
        values: prev.values || v,
        aggregation: prev.aggregation || (v ? 'sum' : 'count'),
      }))
      if (!title) {
        setTitle(`${r} x ${c} Matrix`)
      }
    }
  }, [selectedType, columns, initialVisual])

  // Trigger preview fetch
  const fetchPreview = async () => {
    if (!workbookId || !selectedSheet) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const result = await executeVisualize(workbookId, {
        sheet: selectedSheet,
        type: selectedType,
        title: title || 'Custom Visual',
        config,
        filters,
      })
      setPreviewResult(result)
    } catch (err) {
      setPreviewError(err?.response?.data?.detail || err.message || 'Failed to render preview.')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Handle advancing to Preview step
  const handleGoToPreview = async () => {
    await fetchPreview()
    setStep(4)
  }

  // Handle Save
  const handleSave = () => {
    const visualItem = {
      id: initialVisual?.id || `vis_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sheet: selectedSheet,
      type: selectedType,
      title: title || `${selectedType.toUpperCase()} Visual`,
      config,
      filters,
      computedResult: previewResult,
      updated_at: Date.now(),
    }
    onSaveVisual(visualItem)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-4xl max-h-[92vh] rounded-3xl flex flex-col shadow-2xl border border-white/10 overflow-hidden bg-[#090E1A]/95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">
              {initialVisual ? 'Edit Visualization' : 'Add New Visual'}
            </h2>
            <p className="text-xs text-muted">
              Choose a visualization and configure it using your workbook data.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-ink hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-2.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs font-semibold">
          {[
            { num: 1, label: 'Visualization' },
            { num: 2, label: 'Data Sheet' },
            { num: 3, label: 'Configure' },
            { num: 4, label: 'Preview & Add' },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => s.num < step && setStep(s.num)}
              className={`flex items-center gap-2 cursor-pointer ${
                step === s.num
                  ? 'text-primary font-bold'
                  : step > s.num
                  ? 'text-secondary hover:text-ink'
                  : 'text-muted pointer-events-none'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === s.num
                    ? 'bg-primary text-white'
                    : step > s.num
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-white/5 text-muted'
                }`}
              >
                {step > s.num ? <Check size={11} /> : s.num}
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: CHOOSE VISUALIZATION TYPE */}
          {step === 1 && (
            <div className="space-y-6">
              {VISUAL_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2.5">
                    {cat.name}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cat.items.map((item) => {
                      const Icon = item.icon
                      const isSelected = selectedType === item.id
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedType(item.id)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                              : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <span
                              className={`p-2 rounded-xl ${
                                isSelected ? 'bg-primary text-white' : 'bg-white/5 text-muted'
                              }`}
                            >
                              <Icon size={16} />
                            </span>
                            <span className="text-xs font-bold text-ink">{item.name}</span>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed">{item.desc}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 2: CHOOSE DATA SHEET */}
          {step === 2 && (
            <div className="space-y-5 max-w-xl mx-auto py-6">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Select Worksheet
                </label>
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    setSelectedSheet(e.target.value)
                    setConfig({})
                  }}
                  className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:border-primary"
                >
                  {sheets.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.rows || s.row_count || 0} rows, {s.columns || s.column_count || 0} cols)
                    </option>
                  ))}
                </select>
              </div>

              {schemaLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted">
                  <Loader2 size={16} className="animate-spin text-primary" /> Inspecting sheet structure...
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 p-4 bg-white/[0.02] space-y-3">
                  <div className="text-xs font-bold text-ink">Detected Columns & Roles</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted block text-[10px] uppercase font-bold">Numeric</span>
                      <span className="font-mono text-emerald-400 font-bold">{numericCols.length}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px] uppercase font-bold">Categorical</span>
                      <span className="font-mono text-blue-400 font-bold">{categoricalCols.length}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px] uppercase font-bold">Temporal</span>
                      <span className="font-mono text-amber-400 font-bold">{dateCols.length}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-secondary">
                    Sheet columns dynamically adapt to the chosen visual type.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: CONFIGURE VISUAL */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Title input */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">Visualization Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Metric by Dimension"
                  className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-primary"
                />
              </div>

              {/* Dynamic Chart Configuration Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                {/* 1. BAR & COLUMN */}
                {(selectedType === 'bar' || selectedType === 'column') && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">
                        Category / X-Axis <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={config.category || ''}
                        onChange={(e) => setConfig({ ...config, category: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {columns.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name} ({c.data_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">
                        Measure / Y-Axis
                      </label>
                      <select
                        value={config.measure || ''}
                        onChange={(e) => setConfig({ ...config, measure: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value="">(None - Record Count)</option>
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name} (Numeric)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Aggregation</label>
                      <select
                        value={config.aggregation || 'sum'}
                        onChange={(e) => setConfig({ ...config, aggregation: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value="sum">Sum</option>
                        <option value="avg">Average</option>
                        <option value="median">Median</option>
                        <option value="count">Count Rows</option>
                        <option value="distinct_count">Count Distinct</option>
                        <option value="min">Min</option>
                        <option value="max">Max</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Sort & Limit</label>
                      <div className="flex gap-2">
                        <select
                          value={config.sort || 'desc'}
                          onChange={(e) => setConfig({ ...config, sort: e.target.value })}
                          className="w-1/2 bg-[#0B1120] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-ink"
                        >
                          <option value="desc">Descending</option>
                          <option value="asc">Ascending</option>
                        </select>
                        <input
                          type="number"
                          value={config.limit || 15}
                          onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) || 10 })}
                          className="w-1/2 bg-[#0B1120] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-ink"
                          placeholder="Top N"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 2. LINE & AREA */}
                {(selectedType === 'line' || selectedType === 'area') && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">
                        Time / X-Axis
                      </label>
                      <select
                        value={config.x || ''}
                        onChange={(e) => setConfig({ ...config, x: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value="">(Observation Order)</option>
                        {columns.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name} {c.datetime ? '(Date)' : `(${c.data_type})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">
                        Metric / Y-Axis <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={config.y || ''}
                        onChange={(e) => setConfig({ ...config, y: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name} (Numeric)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Time Grain</label>
                      <select
                        value={config.time_grain || 'month'}
                        onChange={(e) => setConfig({ ...config, time_grain: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="quarter">Quarter</option>
                        <option value="year">Year</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Optional Group By</label>
                      <select
                        value={config.group_by || ''}
                        onChange={(e) => setConfig({ ...config, group_by: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value="">(None)</option>
                        {categoricalCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* 3. COMBO */}
                {selectedType === 'combo' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">X-Axis Column</label>
                      <select
                        value={config.x || ''}
                        onChange={(e) => setConfig({ ...config, x: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {columns.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Primary Metric (Bar)</label>
                      <select
                        value={config.primary_metric || ''}
                        onChange={(e) => setConfig({ ...config, primary_metric: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Secondary Metric (Line)</label>
                      <select
                        value={config.secondary_metric || ''}
                        onChange={(e) => setConfig({ ...config, secondary_metric: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* 4. PIE & DOUGHNUT */}
                {(selectedType === 'pie' || selectedType === 'doughnut') && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Category Slice</label>
                      <select
                        value={config.category || ''}
                        onChange={(e) => setConfig({ ...config, category: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {categoricalCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Measure (Value)</label>
                      <select
                        value={config.measure || ''}
                        onChange={(e) => setConfig({ ...config, measure: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value="">(Count Rows)</option>
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Top N Slices</label>
                      <input
                        type="number"
                        value={config.top_n || 7}
                        onChange={(e) => setConfig({ ...config, top_n: parseInt(e.target.value) || 7 })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      />
                    </div>
                  </>
                )}

                {/* 5. SCORECARD & GAUGE */}
                {(selectedType === 'scorecard' || selectedType === 'gauge' || selectedType === 'bullet') && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Metric</label>
                      <select
                        value={config.measure || ''}
                        onChange={(e) => setConfig({ ...config, measure: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value="">(Row Count)</option>
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Target Value (Optional)</label>
                      <input
                        type="number"
                        value={config.target || ''}
                        onChange={(e) => setConfig({ ...config, target: e.target.value })}
                        placeholder="e.g. 100000"
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      />
                    </div>
                  </>
                )}

                {/* 6. SCATTER & BUBBLE */}
                {(selectedType === 'scatter' || selectedType === 'bubble') && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">X-Axis (Numeric)</label>
                      <select
                        value={config.x || ''}
                        onChange={(e) => setConfig({ ...config, x: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Y-Axis (Numeric)</label>
                      <select
                        value={config.y || ''}
                        onChange={(e) => setConfig({ ...config, y: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedType === 'bubble' && (
                      <div>
                        <label className="block text-xs font-bold text-ink mb-1">Bubble Size (Numeric)</label>
                        <select
                          value={config.size || ''}
                          onChange={(e) => setConfig({ ...config, size: e.target.value })}
                          className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                        >
                          <option value="">(Uniform Size)</option>
                          {numericCols.map((c) => (
                            <option key={c.column_name} value={c.column_name}>
                              {c.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {/* 7. HISTOGRAM */}
                {selectedType === 'histogram' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Numeric Column</label>
                      <select
                        value={config.metric || ''}
                        onChange={(e) => setConfig({ ...config, metric: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Bin Count</label>
                      <select
                        value={config.bins || 20}
                        onChange={(e) => setConfig({ ...config, bins: parseInt(e.target.value) })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value={10}>10 Bins</option>
                        <option value={20}>20 Bins</option>
                        <option value={30}>30 Bins</option>
                        <option value={50}>50 Bins</option>
                      </select>
                    </div>
                  </>
                )}

                {/* 8. TABLE & MATRIX */}
                {selectedType === 'matrix' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Row Dimension</label>
                      <select
                        value={config.rows || ''}
                        onChange={(e) => setConfig({ ...config, rows: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {categoricalCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Column Dimension</label>
                      <select
                        value={config.columns || ''}
                        onChange={(e) => setConfig({ ...config, columns: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        {categoricalCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">Values Metric</label>
                      <select
                        value={config.values || ''}
                        onChange={(e) => setConfig({ ...config, values: e.target.value })}
                        className="w-full bg-[#0B1120] border border-white/10 rounded-xl px-3 py-2 text-xs text-ink"
                      >
                        <option value="">(Row Count)</option>
                        {numericCols.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Optional Filters Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Filter size={13} className="text-primary" /> Optional Filters
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFilters([
                        ...filters,
                        { column: columns[0]?.column_name || '', operator: 'equals', value: '' },
                      ])
                    }
                    className="text-[11px] text-primary hover:text-ink flex items-center gap-1 font-semibold"
                  >
                    <Plus size={12} /> Add Filter
                  </button>
                </div>

                {filters.length > 0 && (
                  <div className="space-y-2">
                    {filters.map((flt, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <select
                          value={flt.column}
                          onChange={(e) => {
                            const updated = [...filters]
                            updated[idx].column = e.target.value
                            setFilters(updated)
                          }}
                          className="w-1/3 bg-[#0B1120] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-ink"
                        >
                          {columns.map((c) => (
                            <option key={c.column_name} value={c.column_name}>
                              {c.display_name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={flt.operator}
                          onChange={(e) => {
                            const updated = [...filters]
                            updated[idx].operator = e.target.value
                            setFilters(updated)
                          }}
                          className="w-1/4 bg-[#0B1120] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-ink"
                        >
                          <option value="equals">=</option>
                          <option value="not_equals">≠</option>
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value="in">Includes</option>
                        </select>
                        <input
                          type="text"
                          value={flt.value}
                          onChange={(e) => {
                            const updated = [...filters]
                            updated[idx].value = e.target.value
                            setFilters(updated)
                          }}
                          placeholder="Filter value..."
                          className="flex-1 bg-[#0B1120] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-ink"
                        />
                        <button
                          type="button"
                          onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW & ADD */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">{title || 'Live Preview'}</h3>
                  <span className="text-[11px] text-muted">
                    Source: {selectedSheet} • Type: {selectedType.toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchPreview}
                  disabled={previewLoading}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Eye size={12} /> Refresh Preview
                </button>
              </div>

              {previewLoading ? (
                <div className="h-72 flex items-center justify-center text-xs text-muted gap-2 border border-dashed border-white/10 rounded-2xl">
                  <Loader2 size={16} className="animate-spin text-primary" /> Calculating deterministic aggregation...
                </div>
              ) : previewError ? (
                <div className="h-72 flex items-center justify-center p-6 text-center text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                  {previewError}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 min-h-[300px]">
                  <DynamicChartRenderer visual={previewResult} height={300} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-white/[0.01]">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-ink hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 font-bold"
              >
                <span>Continue</span>
                <ArrowRight size={13} />
              </button>
            ) : step === 3 ? (
              <button
                onClick={handleGoToPreview}
                className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 font-bold"
              >
                <span>Preview Visual</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={previewLoading || previewError}
                className="btn-primary text-xs py-2 px-6 flex items-center gap-1.5 font-bold shadow-lg shadow-primary/20"
              >
                <Check size={14} />
                <span>{initialVisual ? 'Save Changes' : 'Add to Dashboard'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
