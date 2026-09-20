import React from 'react'
import { FileSpreadsheet, FileText, Download, CheckCircle2 } from 'lucide-react'
import { exportToCSV, exportReportPDF } from '../../services/misExport'

export default function ReportPreviewView({ reportData }) {
  if (!reportData) return null

  const handleExportCSV = () => {
    if (reportData.sections?.kpis) {
      exportToCSV(reportData.report_name || 'MIS_Report', reportData.sections.kpis)
    }
  }

  const handleExportPDF = () => {
    exportReportPDF(reportData)
  }

  return (
    <div className="card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderline pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-ink uppercase tracking-tight">
            {reportData.report_name}
          </h2>
          <div className="text-xs text-muted mt-1">
            Period: <span className="font-semibold text-ink">{reportData.period}</span> | Department:{' '}
            <span className="font-semibold text-ink">{reportData.department}</span> | Generated:{' '}
            <span className="font-semibold text-ink">{reportData.generated_at}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn btn-ghost text-xs py-2 px-3 gap-1.5">
            <FileSpreadsheet size={14} className="text-positive" />
            Export CSV
          </button>
          <button onClick={handleExportPDF} className="btn btn-primary text-xs py-2 px-3 gap-1.5 shadow">
            <FileText size={14} />
            Export PDF
          </button>
        </div>
      </div>

      {/* AI Executive Summary */}
      {reportData.sections?.ai_summary && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider">AI Executive Summary</h4>
          <p className="text-xs text-ink/90 leading-relaxed">{reportData.sections.ai_summary}</p>
        </div>
      )}

      {/* Executive KPIs */}
      {reportData.sections?.kpis && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-ink uppercase tracking-wider">KPI Performance Overview</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {reportData.sections.kpis.map((kpi, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-bg-sidebar border border-borderline">
                <div className="text-[10px] font-semibold text-muted uppercase">{kpi.title}</div>
                <div className="text-base font-bold text-ink mt-1">
                  {typeof kpi.value === 'number' ? `₹${kpi.value.toLocaleString()}` : kpi.value}
                </div>
                {kpi.change !== undefined && (
                  <div className={`text-[10px] font-bold mt-1 ${kpi.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {kpi.change > 0 ? '+' : ''}{kpi.change}% vs prev
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Target vs Actual */}
      {reportData.sections?.target_actual && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Target vs Actual Performance</h4>
          <div className="grid grid-cols-4 gap-3 p-4 rounded-lg bg-bg-sidebar border border-borderline text-center">
            <div>
              <div className="text-[10px] text-muted font-semibold uppercase">Target</div>
              <div className="text-base font-bold text-ink">
                ₹{reportData.sections.target_actual.kpis?.target?.toLocaleString() || '50.0L'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted font-semibold uppercase">Actual</div>
              <div className="text-base font-bold text-primary">
                ₹{reportData.sections.target_actual.kpis?.actual?.toLocaleString() || '46.2L'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted font-semibold uppercase">Achievement</div>
              <div className="text-base font-bold text-positive">
                {reportData.sections.target_actual.kpis?.achievement_pct || 92.4}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted font-semibold uppercase">Variance</div>
              <div className="text-base font-bold text-negative">
                ₹{reportData.sections.target_actual.kpis?.variance?.toLocaleString() || '-3.8L'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regional Performance Table */}
      {reportData.sections?.sales_regional && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Regional Sales Breakdown</h4>
          <div className="overflow-x-auto border border-borderline rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg-sidebar text-muted uppercase font-semibold">
                <tr>
                  <th className="p-2 border-b border-borderline">Region</th>
                  <th className="p-2 border-b border-borderline">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderline">
                {reportData.sections.sales_regional.map((r, i) => (
                  <tr key={i}>
                    <td className="p-2 font-medium text-ink">{r.region}</td>
                    <td className="p-2 font-bold text-primary">₹{r.revenue?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
