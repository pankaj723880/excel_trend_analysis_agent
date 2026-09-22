import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Treemap,
} from 'recharts'
import {
  TrendingUp,
  AlertCircle,
  MapPin,
  ArrowRight,
  Target,
  Layers,
  ChevronRight,
} from 'lucide-react'
import { formatCompact } from '../../utils/format'

const PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#84CC16', // Lime
]

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#090E1A]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md z-50">
      {label && <div className="text-[11px] text-muted mb-1 font-medium">{label}</div>}
      {payload.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 text-[12px]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
          <span className="text-secondary">{item.name || item.dataKey}:</span>
          <span className="font-bold text-ink ml-auto pl-4 font-mono">
            {typeof item.value === 'number' ? formatCompact(item.value) : item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DynamicChartRenderer({ visual, height = 300 }) {
  if (!visual) return null

  if (visual.unsupported_reason) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]"
        style={{ height }}
      >
        <AlertCircle size={28} className="text-amber-400 mb-2 opacity-80" />
        <div className="text-xs font-semibold text-ink">{visual.title}</div>
        <p className="text-[11px] text-muted max-w-xs mt-1">{visual.unsupported_reason}</p>
      </div>
    )
  }

  const { visual_type, data = [], metadata = {} } = visual

  if (!data || !data.length) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted border border-dashed border-white/10 rounded-2xl bg-white/[0.01]"
        style={{ height }}
      >
        No observations found for this visual configuration.
      </div>
    )
  }

  // 1. BAR & COLUMN
  if (visual_type === 'bar' || visual_type === 'column') {
    const isHorizontal = visual_type === 'bar'
    return (
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={isHorizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 10, right: 20, left: isHorizontal ? 30 : 0, bottom: isHorizontal ? 0 : 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            {isHorizontal ? (
              <>
                <XAxis type="number" stroke="#94A3B8" fontSize={10} tickFormatter={formatCompact} />
                <YAxis dataKey="category" type="category" stroke="#94A3B8" fontSize={10} width={80} tickLine={false} />
              </>
            ) : (
              <>
                <XAxis dataKey="category" stroke="#94A3B8" fontSize={10} angle={-25} textAnchor="end" height={45} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickFormatter={formatCompact} />
              </>
            )}
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" name={metadata.measure_column || 'Value'} fill="#3B82F6" radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // 2. LINE CHART
  if (visual_type === 'line') {
    const groups = metadata.groups || []
    return (
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="x" stroke="#94A3B8" fontSize={10} angle={-25} textAnchor="end" height={45} tickLine={false} />
            <YAxis stroke="#94A3B8" fontSize={10} tickFormatter={formatCompact} />
            <Tooltip content={<ChartTooltip />} />
            {groups.length > 0 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {groups.length > 0 ? (
              groups.map((grp, idx) => (
                <Line
                  key={grp}
                  type="monotone"
                  dataKey={grp}
                  name={grp}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))
            ) : (
              <Line type="monotone" dataKey="y" name={metadata.y_label || 'Value'} stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // 3. AREA CHART
  if (visual_type === 'area') {
    const groups = metadata.groups || []
    return (
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="x" stroke="#94A3B8" fontSize={10} angle={-25} textAnchor="end" height={45} tickLine={false} />
            <YAxis stroke="#94A3B8" fontSize={10} tickFormatter={formatCompact} />
            <Tooltip content={<ChartTooltip />} />
            {groups.length > 0 ? (
              groups.map((grp, idx) => (
                <Area
                  key={grp}
                  type="monotone"
                  dataKey={grp}
                  name={grp}
                  stroke={PALETTE[idx % PALETTE.length]}
                  fill={PALETTE[idx % PALETTE.length]}
                  fillOpacity={0.2}
                />
              ))
            ) : (
              <Area type="monotone" dataKey="y" name={metadata.y_label || 'Value'} stroke="#3B82F6" fillOpacity={1} fill="url(#areaGradient)" strokeWidth={2} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // 4. COMBO CHART (Bar + Line)
  if (visual_type === 'combo') {
    return (
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="x" stroke="#94A3B8" fontSize={10} angle={-25} textAnchor="end" height={45} tickLine={false} />
            <YAxis yAxisId="left" stroke="#94A3B8" fontSize={10} tickFormatter={formatCompact} />
            <YAxis yAxisId="right" orientation="right" stroke="#10B981" fontSize={10} tickFormatter={formatCompact} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="primary" name={metadata.primary_metric || 'Primary'} fill="#3B82F6" radius={[4, 4, 0, 0]} opacity={0.8} />
            <Line yAxisId="right" type="monotone" dataKey="secondary" name={metadata.secondary_metric || 'Secondary'} stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // 5. PIE & DOUGHNUT
  if (visual_type === 'pie' || visual_type === 'doughnut') {
    const isDoughnut = visual_type === 'doughnut'
    return (
      <div className="relative" style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} layout="horizontal" verticalAlign="bottom" />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="48%"
              innerRadius={isDoughnut ? '55%' : '0%'}
              outerRadius="78%"
              paddingAngle={isDoughnut ? 3 : 1}
              stroke="rgba(10,15,30,0.8)"
              strokeWidth={2}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {isDoughnut && metadata.total_value != null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
            <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Total</span>
            <span className="text-base font-bold text-ink font-mono">{formatCompact(metadata.total_value)}</span>
          </div>
        )}
      </div>
    )
  }

  // 6. TREEMAP
  if (visual_type === 'treemap') {
    return (
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            stroke="#0F172A"
            fill="#3B82F6"
            content={({ x, y, width, height, name, size, index }) => (
              <g>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  style={{
                    fill: PALETTE[index % PALETTE.length],
                    stroke: '#0B1120',
                    strokeWidth: 2,
                    rx: 4,
                  }}
                />
                {width > 40 && height > 24 && (
                  <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight={600}>
                    {name}
                  </text>
                )}
                {width > 40 && height > 38 && (
                  <text x={x + 6} y={y + 30} fill="rgba(255,255,255,0.7)" fontSize={10} fontFamily="monospace">
                    {formatCompact(size)}
                  </text>
                )}
              </g>
            )}
          >
            <Tooltip content={<ChartTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    )
  }

  // 7. SCORECARD
  if (visual_type === 'scorecard') {
    const item = data[0] || {}
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{item.metric || 'Metric'}</span>
        <div className="text-3xl sm:text-4xl font-extrabold text-ink font-mono tracking-tight">
          {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
        </div>
        {item.target != null && (
          <div className="flex items-center gap-2 text-xs pt-1">
            <span className="text-muted">Target: {formatCompact(item.target)}</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                item.target_status === 'achieved'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {item.pct_of_target}%
            </span>
          </div>
        )}
      </div>
    )
  }

  // 8. GAUGE & BULLET
  if (visual_type === 'gauge' || visual_type === 'bullet') {
    const item = data[0] || {}
    const pct = item.percentage ?? 50
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 space-y-4">
        <div className="relative w-48 h-24 overflow-hidden flex items-end justify-center">
          {/* Semi-circle gauge */}
          <div className="absolute w-44 h-44 rounded-full border-[14px] border-white/10 top-0" />
          <div
            className="absolute w-44 h-44 rounded-full border-[14px] border-primary top-0 transition-transform duration-700"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
              transform: `rotate(${((pct / 100) * 180) - 180}deg)`,
            }}
          />
          <div className="text-center z-10 pb-1">
            <div className="text-2xl font-black text-ink font-mono">{pct}%</div>
            <div className="text-[10px] text-muted">{formatCompact(item.value)} / {formatCompact(item.max)}</div>
          </div>
        </div>
        <div className="flex items-center justify-between w-full max-w-xs text-[11px] text-secondary">
          <span>Min: {formatCompact(item.min)}</span>
          <span className="text-amber-400 font-medium">Target: {formatCompact(item.target)}</span>
          <span>Max: {formatCompact(item.max)}</span>
        </div>
      </div>
    )
  }

  // 9. SCATTER & BUBBLE
  if (visual_type === 'scatter' || visual_type === 'bubble') {
    return (
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="x" name={metadata.x_label} stroke="#94A3B8" fontSize={10} tickFormatter={formatCompact} />
            <YAxis dataKey="y" name={metadata.y_label} stroke="#94A3B8" fontSize={10} tickFormatter={formatCompact} />
            <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Points" data={data} fill="#3B82F6">
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PALETTE[index % PALETTE.length]}
                  r={entry.size ? Math.min(Math.max(entry.size / 10, 4), 16) : 4}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // 10. HISTOGRAM
  if (visual_type === 'histogram') {
    return (
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="bin" stroke="#94A3B8" fontSize={9} angle={-30} textAnchor="end" height={45} tickLine={false} />
            <YAxis stroke="#94A3B8" fontSize={10} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="frequency" name="Frequency" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // 11. MAP / GEOGRAPHIC
  if (visual_type === 'map') {
    return (
      <div className="h-full flex flex-col p-4 overflow-y-auto space-y-2">
        <div className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5 pb-1">
          <MapPin size={13} className="text-primary" /> Geographic Aggregation: {metadata.location_column || 'Locations'}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.slice(0, 12).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
              <span className="text-secondary font-medium truncate max-w-[140px]">{item.location || `Point (${item.lat}, ${item.lon})`}</span>
              <span className="font-mono font-bold text-primary">{formatCompact(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 12. FUNNEL
  if (visual_type === 'funnel') {
    const maxVal = Math.max(...data.map((d) => d.value), 1)
    return (
      <div className="h-full flex flex-col justify-center p-4 space-y-2.5">
        {data.map((item, idx) => {
          const widthPct = Math.max((item.value / maxVal) * 100, 15)
          return (
            <div key={idx} className="flex flex-col space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-secondary">{item.stage}</span>
                <span className="text-ink font-mono font-bold">{formatCompact(item.value)}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: PALETTE[idx % PALETTE.length],
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // 13. FLOW / SANKEY
  if (visual_type === 'sankey') {
    return (
      <div className="h-full overflow-y-auto p-4 space-y-2">
        <div className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5 pb-1">
          <Layers size={13} className="text-primary" /> Transition Flows ({metadata.source} → {metadata.target})
        </div>
        <div className="space-y-1.5">
          {data.slice(0, 15).map((flow, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
              <div className="flex items-center gap-2 truncate max-w-[200px]">
                <span className="text-ink font-semibold">{flow.source}</span>
                <ArrowRight size={12} className="text-muted shrink-0" />
                <span className="text-secondary">{flow.target}</span>
              </div>
              <span className="font-mono font-bold text-primary pl-2">{formatCompact(flow.value)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 14. TABLE
  if (visual_type === 'table') {
    const cols = metadata.columns || (data[0] ? Object.keys(data[0]) : [])
    return (
      <div className="h-full overflow-auto text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-muted text-[11px] uppercase tracking-wider sticky top-0 bg-[#0B1120] z-10">
              {cols.map((c) => (
                <th key={c} className="py-2 px-3 text-left font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 30).map((row, idx) => (
              <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] text-secondary">
                {cols.map((c) => (
                  <td key={c} className="py-1.5 px-3 whitespace-nowrap">
                    {row[c] != null ? String(row[c]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // 15. MATRIX
  if (visual_type === 'matrix') {
    const colHeaders = metadata.column_headers || []
    return (
      <div className="h-full overflow-auto text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-muted text-[11px] uppercase tracking-wider sticky top-0 bg-[#0B1120] z-10">
              <th className="py-2 px-3 text-left font-semibold text-primary">{metadata.row_dimension || 'Row'}</th>
              {colHeaders.map((c) => (
                <th key={c} className="py-2 px-3 text-right font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="py-2 px-3 font-semibold text-ink whitespace-nowrap">{row._row}</td>
                {colHeaders.map((c) => (
                  <td key={c} className="py-2 px-3 text-right font-mono text-secondary whitespace-nowrap">
                    {row[c] != null ? formatCompact(row[c]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center text-xs text-muted">
      Unsupported chart visualization format.
    </div>
  )
}
