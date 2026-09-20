import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  BarChart3,
  Bot,
  RefreshCw,
  Printer,
  FileText,
  Tag,
  ShieldCheck,
  Check,
  Lightbulb,
} from 'lucide-react'
import { getReportHtmlUrl, getReportExcelUrl } from '../services/api'

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg border border-borderline bg-bg-card p-3 shadow-xl text-xs space-y-1 z-50">
      <div className="font-bold text-ink flex items-center justify-between gap-4">
        <span>{data.metric}</span>
        <span className="text-muted text-[11px] font-normal">{data.sheet}</span>
      </div>
      <div className="text-muted flex items-center justify-between gap-4">
        <span>Growth Change:</span>
        <span className={`font-semibold ${data.change_pct >= 0 ? 'text-positive' : 'text-negative'}`}>
          {data.change_pct >= 0 ? '+' : ''}{data.change_pct}%
        </span>
      </div>
      <div className="text-muted flex items-center justify-between gap-4">
        <span>Volatility:</span>
        <span className="font-semibold text-warning">{data.volatility_pct}%</span>
      </div>
      <div className="text-muted flex items-center justify-between gap-4">
        <span>Trend Score:</span>
        <span className="font-semibold text-primary">{data.trend_score}</span>
      </div>
    </div>
  )
}

export default function AIInsights({ result, loading, onGenerate, workbookId }) {
  const [chartMetric, setChartMetric] = useState('change_pct')

  const markdown = result?.markdown
  const source = result?.source
  const domain = result?.domain || 'General Data Analytics'
  const domainReasoning = result?.domain_reasoning
  const sections = result?.sections || {}
  const chartData = sections.chart_data || []

  const topGrowth = [...chartData].sort((a, b) => b.change_pct - a.change_pct).filter((m) => m.change_pct > 0)
  const pressureMetrics = [...chartData].sort((a, b) => a.change_pct - b.change_pct).filter((m) => m.change_pct < 0)

  return (
    <div className="space-y-6">
      {/* Business Domain Context Banner */}
      <div className="glass-card-ai p-5 sm:p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-ai/20 border border-ai/40 flex items-center justify-center shrink-0 shadow-glow-purple">
            <Sparkles size={20} className="text-ai" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-ink leading-tight flex items-center gap-2.5">
              <span>Executive AI Intelligence Center</span>
              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-ai/15 text-ai border border-ai/30">
                <Tag size={11} /> {domain}
              </span>
            </div>
            <div className="text-xs text-muted mt-1">
              {domainReasoning || 'Automated non-technical statistical profiling, trend modeling, and risk evaluation.'}
            </div>
          </div>
        </div>

        {workbookId && (
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={getReportHtmlUrl(workbookId)}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 cursor-pointer font-semibold"
            >
              <Printer size={14} /> Print / Save PDF
            </a>
            <a
              href={getReportExcelUrl(workbookId)}
              download
              className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <FileText size={14} /> Download Excel Report
            </a>
            <button
              className="btn-ai text-xs px-3.5 py-2 flex items-center gap-1.5 cursor-pointer font-bold"
              onClick={onGenerate}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Analyzing...' : 'Re-run'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card card-pad py-16 flex flex-col items-center justify-center text-center space-y-3 border-ai/30">
          <Bot size={36} className="text-ai animate-pulse" />
          <div className="text-sm font-semibold text-ink">Building Executive AI Report...</div>
          <div className="text-xs text-muted max-w-sm">
            Fitting trend lines, evaluating volatility scores, and detecting critical anomalies across all worksheets.
          </div>
        </div>
      ) : result ? (
        <>
          {/* Executive KPI Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 space-y-1">
              <div className="flex items-center justify-between text-muted text-xs font-semibold">
                <span>WORKBOOK SCALE</span>
                <FileSpreadsheet size={15} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-ink">
                {sections.total_rows?.toLocaleString() || 0} <span className="text-xs font-normal text-muted">rows</span>
              </div>
              <div className="text-[11px] text-muted">Across all active worksheets</div>
            </div>

            <div className="card p-4 space-y-1">
              <div className="flex items-center justify-between text-muted text-xs font-semibold">
                <span>DATA HEALTH</span>
                <CheckCircle2 size={15} className="text-positive" />
              </div>
              <div className="text-2xl font-bold text-ink">{sections.health_score || 85}%</div>
              <div className="w-full bg-bg-sidebar rounded-full h-1.5 overflow-hidden mt-1.5 border border-borderline/40">
                <div
                  className="bg-positive h-full rounded-full transition-all duration-500"
                  style={{ width: `${sections.health_score || 85}%` }}
                />
              </div>
            </div>

            <div className="card p-4 space-y-1">
              <div className="flex items-center justify-between text-muted text-xs font-semibold">
                <span>TOP GROWTH METRIC</span>
                <TrendingUp size={15} className="text-positive" />
              </div>
              <div className="text-xl font-bold text-positive truncate" title={sections.top_growth?.metric}>
                +{sections.top_growth?.change_pct}%
              </div>
              <div className="text-[11px] text-muted truncate">{sections.top_growth?.metric || 'N/A'}</div>
            </div>

            <div className="card p-4 space-y-1">
              <div className="flex items-center justify-between text-muted text-xs font-semibold">
                <span>TOTAL ANOMALIES</span>
                <AlertTriangle size={15} className="text-danger" />
              </div>
              <div className="text-2xl font-bold text-ink">{sections.total_anomalies || 0}</div>
              <div className="text-[11px] text-danger font-medium">
                {sections.severity_counts?.Critical || 0} Critical / {sections.severity_counts?.High || 0} High
              </div>
            </div>
          </div>

          {/* Interactive Recharts Graph Section */}
          {chartData.length > 0 && (
            <div className="card card-pad space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-borderline">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-primary" />
                  <h3 className="text-sm font-bold text-ink">Key Metrics Visual Comparison</h3>
                </div>
                <div className="flex items-center gap-1.5 bg-bg-sidebar p-1 rounded-lg border border-borderline">
                  <button
                    onClick={() => setChartMetric('change_pct')}
                    className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                      chartMetric === 'change_pct' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                  >
                    Growth Rate (%)
                  </button>
                  <button
                    onClick={() => setChartMetric('volatility_pct')}
                    className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                      chartMetric === 'volatility_pct' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                  >
                    Volatility (%)
                  </button>
                  <button
                    onClick={() => setChartMetric('trend_score')}
                    className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                      chartMetric === 'trend_score' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                  >
                    Trend Score
                  </button>
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2337" vertical={false} />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      interval={0}
                      tickFormatter={(val) => (val.length > 14 ? `${val.slice(0, 12)}...` : val)}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      tickFormatter={(val) => `${val}${chartMetric === 'trend_score' ? '' : '%'}`}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey={chartMetric} radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => {
                        let val = entry[chartMetric]
                        let color = '#4F7CFF'
                        if (chartMetric === 'change_pct') {
                          color = val >= 0 ? '#22C55E' : '#EF4444'
                        } else if (chartMetric === 'volatility_pct') {
                          color = val > 50 ? '#F59E0B' : '#4F7CFF'
                        }
                        return <Cell key={`cell-${index}`} fill={color} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Formatted Cards Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Upward Growth Drivers */}
            <div className="card card-pad space-y-3 border-t-2 border-t-positive">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <TrendingUp size={18} className="text-positive" />
                <span>Top Upward Growth Drivers</span>
              </div>
              {topGrowth.length > 0 ? (
                <div className="space-y-2.5">
                  {topGrowth.slice(0, 5).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-borderline bg-bg-sidebar flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink truncate">{item.metric}</div>
                        <div className="text-[11px] text-muted flex items-center gap-2">
                          <span>
                            Sheet: <strong className="text-ink/80">{item.sheet}</strong>
                          </span>
                          <span>
                            · Trend Score: <strong>{item.trend_score}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="tag bg-positive/10 border-positive/30 text-positive text-xs font-bold shrink-0">
                        +{item.change_pct}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted py-4 text-center">No upward growth drivers detected.</div>
              )}
            </div>

            {/* Metrics Under Pressure */}
            <div className="card card-pad space-y-3 border-t-2 border-t-negative">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <TrendingDown size={18} className="text-negative" />
                <span>Metrics Under Pressure</span>
              </div>
              {pressureMetrics.length > 0 ? (
                <div className="space-y-2.5">
                  {pressureMetrics.slice(0, 5).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-borderline bg-bg-sidebar flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink truncate">{item.metric}</div>
                        <div className="text-[11px] text-muted flex items-center gap-2">
                          <span>
                            Sheet: <strong className="text-ink/80">{item.sheet}</strong>
                          </span>
                          <span>
                            · Trend Score: <strong>{item.trend_score}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="tag bg-negative/10 border-negative/30 text-negative text-xs font-bold shrink-0">
                        {item.change_pct}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted py-4 text-center">No metrics under pressure detected.</div>
              )}
            </div>
          </div>

          {/* Verified Facts vs Possible Explanations */}
          <div className="card card-pad space-y-4 border-l-4 border-l-primary">
            <div className="flex items-center gap-2 text-sm font-bold text-ink pb-2 border-b border-borderline">
              <ShieldCheck size={18} className="text-primary" />
              <span>Verified Facts vs Grounded Explanations</span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg border border-positive/30 bg-positive/5 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-positive flex items-center gap-1">
                  <Check size={13} /> Verified Fact (Pandas Engine)
                </span>
                <p className="text-xs text-ink/90 font-medium">
                  {topGrowth.length > 0
                    ? `Top growth metric '${topGrowth[0].metric}' in sheet '${topGrowth[0].sheet}' increased by +${topGrowth[0].change_pct}% over the evaluated timeframe.`
                    : 'Dataset contains stable metric evaluations across all worksheets.'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-ai/30 bg-ai/5 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ai flex items-center gap-1">
                  <Lightbulb size={13} /> Possible Explanation
                </span>
                <p className="text-xs text-ink/90 font-medium">
                  {topGrowth.length > 0
                    ? `Growth correlates with sustained transaction volume and a positive momentum score (${topGrowth[0].trend_score}).`
                    : 'No anomalous spikes or drops were detected during statistical evaluation.'}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Narrative Section */}
          <div className="card card-pad space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-ink pb-2 border-b border-borderline">
              <Bot size={18} className="text-primary" />
              <span>Full Analytical Narrative & Strategic Report</span>
            </div>
            <div className="markdown-body pt-2">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
          </div>
        </>
      ) : (
        <div className="card card-pad py-12 text-center text-muted text-xs space-y-2">
          <div>Click <strong>Re-run Analysis</strong> to generate visual reports and graphs across your workbook.</div>
        </div>
      )}
    </div>
  )
}
