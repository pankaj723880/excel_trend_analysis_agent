import React, { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarRange, Inbox, BarChart2 } from 'lucide-react'
import { getChartSeries } from '../services/api'
import { formatCompact } from '../utils/format'

function CustomTooltip({ active, payload, label, xLabel }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#090E1A]/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-md">
      <div className="text-[11px] text-muted mb-1 font-medium">
        {xLabel || 'Observations'}: <span className="text-secondary font-semibold">{label}</span>
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-[12px]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-secondary">{entry.name}</span>
          <span className="font-bold text-ink ml-auto pl-4 font-mono">{formatCompact(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function TrendChart({
  workbookId,
  sheetName,
  metrics = [],
  initialMetric = null,
  height = 320,
  showControls = true,
  sheets = [],
  selectedSheet = '',
  onSelectSheet = null,
}) {
  const [metric, setMetric] = useState(initialMetric || metrics[0] || '')
  const [chartType, setChartType] = useState('area') // 'area' | 'line' | 'bar' | 'scatter'
  const [data, setData] = useState([])
  const [hasDate, setHasDate] = useState(false)
  const [xLabel, setXLabel] = useState('Observation')
  const [noTemporalNote, setNoTemporalNote] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (metrics.length && !metrics.includes(metric)) {
      setMetric(metrics[0])
    }
  }, [metrics, metric])

  useEffect(() => {
    if (!workbookId || !sheetName || !metric) {
      setData([])
      return
    }
    let cancelled = false
    setLoading(true)
    getChartSeries(workbookId, sheetName, metric)
      .then((result) => {
        if (cancelled) return
        setData(result.points || [])
        setHasDate(Boolean(result.has_date))
        setXLabel(result.x_label || (result.has_date ? result.date_column : 'Observation'))
        setNoTemporalNote(result.has_date ? null : 'No temporal column detected.')
      })
      .catch(() => {
        if (!cancelled) setData([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workbookId, sheetName, metric])

  const chartPoints = useMemo(() => {
    if (hasDate) {
      return data.map((point) => ({
        ...point,
        sortKey: point.x,
      }))
    }
    return data
  }, [data, hasDate])

  const chartData = useMemo(() => {
    if (!hasDate) return chartPoints
    return [...chartPoints].sort((a, b) => (a.sortKey > b.sortKey ? 1 : -1))
  }, [chartPoints, hasDate])

  if (loading) {
    return (
      <div className="h-full min-h-[220px] flex items-center justify-center text-muted text-[12.5px]">
        Loading chart data…
      </div>
    )
  }

  return (
    <div>
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-bg-sidebar/50 p-2.5 rounded-lg border border-borderline/70">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sheet Selector */}
            {sheets.length > 0 && onSelectSheet && (
              <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                <span>Sheet:</span>
                <select
                  className="select !py-1 text-xs font-semibold bg-bg-card border-borderline"
                  value={selectedSheet}
                  onChange={(e) => onSelectSheet(e.target.value)}
                >
                  {sheets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* KPI / Metric Selector */}
            <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
              <span>KPI / Metric:</span>
              <select
                className="select !py-1 text-xs font-semibold bg-bg-card border-borderline min-w-[150px]"
                value={metric}
                onChange={(event) => setMetric(event.target.value)}
              >
                {metrics.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Graph Type Selector */}
            <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
              <BarChart2 size={13} className="text-ai" />
              <span>Graph Type:</span>
              <select
                className="select !py-1 text-xs font-semibold bg-bg-card border-borderline min-w-[130px]"
                value={chartType}
                onChange={(event) => setChartType(event.target.value)}
              >
                <option value="area">Area Chart</option>
                <option value="line">Line Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="scatter">Scatter / Point</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasDate && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted tag border-borderline">
                <CalendarRange size={12} className="text-primary" />
                Time axis: {xLabel}
              </span>
            )}
            {noTemporalNote && (
              <span className="inline-flex items-center gap-1.5 text-[11px] tag border-warning/40 text-warning">
                <Inbox size={12} />
                {noTemporalNote}
              </span>
            )}
          </div>
        </div>
      )}

      {chartData.length < 2 ? (
        <div className="h-full min-h-[220px] border border-dashed border-borderline rounded-lg flex items-center justify-center text-[12.5px] text-muted">
          Not enough data points to render a chart for this metric.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="x"
                tickFormatter={(value) => (hasDate ? String(value).slice(0, 10) : value)}
                minTickGap={30}
                stroke="#64748B"
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <YAxis
                tickFormatter={(value) => formatCompact(value)}
                stroke="#64748B"
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <Tooltip content={<CustomTooltip xLabel={xLabel} />} />
              <Line
                type="monotone"
                dataKey="y"
                name={metric}
                stroke="#60A5FA"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#60A5FA', stroke: '#070B14', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#60A5FA', stroke: '#F8FAFC', strokeWidth: 2 }}
              />
            </LineChart>
          ) : chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="x"
                tickFormatter={(value) => (hasDate ? String(value).slice(0, 10) : value)}
                minTickGap={30}
                stroke="#64748B"
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <YAxis
                tickFormatter={(value) => formatCompact(value)}
                stroke="#64748B"
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <Tooltip content={<CustomTooltip xLabel={xLabel} />} />
              <Bar dataKey="y" name={metric} fill="#60A5FA" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chartType === 'scatter' ? (
            <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="x"
                tickFormatter={(value) => (hasDate ? String(value).slice(0, 10) : value)}
                minTickGap={30}
                stroke="#64748B"
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <YAxis
                tickFormatter={(value) => formatCompact(value)}
                stroke="#64748B"
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <Tooltip content={<CustomTooltip xLabel={xLabel} />} />
              <Scatter dataKey="y" name={metric} fill="#60A5FA" />
            </ComposedChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="x"
                tickFormatter={(value) => (hasDate ? String(value).slice(0, 10) : value)}
                minTickGap={30}
                stroke="#64748B"
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <YAxis
                tickFormatter={(value) => formatCompact(value)}
                stroke="#64748B"
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <Tooltip content={<CustomTooltip xLabel={xLabel} />} />
              <Area
                type="monotone"
                dataKey="y"
                name={metric}
                stroke="#60A5FA"
                strokeWidth={2.2}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  )
}
