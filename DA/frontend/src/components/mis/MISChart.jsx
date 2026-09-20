import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

const COLORS = ['#5B7CFF', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#38BDF8']

export default function MISChart({
  type = 'bar',
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  title,
  height = 260,
  onClick,
}) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-4 flex flex-col items-center justify-center text-center text-muted" style={{ height }}>
        <p className="text-xs">No chart data available for current filters</p>
      </div>
    )
  }

  return (
    <div className="card card-pad">
      {title && <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{title}</h4>}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          {type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#202938" vertical={false} />
              <XAxis dataKey={nameKey} stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                formatter={(val) => [typeof val === 'number' ? `₹${val.toLocaleString()}` : val, 'Revenue']}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="#5B7CFF"
                strokeWidth={3}
                dot={{ r: 4, fill: '#5B7CFF', stroke: '#0F172A', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#38BDF8' }}
              />
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="misAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5B7CFF" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#5B7CFF" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#202938" vertical={false} />
              <XAxis dataKey={nameKey} stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                formatter={(val) => [typeof val === 'number' ? `₹${val.toLocaleString()}` : val, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke="#5B7CFF"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#misAreaGrad)"
                dot={{ r: 4, fill: '#5B7CFF', stroke: '#0F172A', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : type === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey={dataKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart data={data} onClick={onClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="#202938" vertical={false} />
              <XAxis dataKey={nameKey} stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                formatter={(val) => [typeof val === 'number' ? `₹${val.toLocaleString()}` : val, 'Revenue']}
              />
              <Bar dataKey={dataKey} fill="#5B7CFF" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
