import React, { useState } from 'react'
import ReportPreviewView from '../../components/mis/ReportPreviewView'
import { buildMisReport } from '../../services/api'
import { FileText, Play } from 'lucide-react'

export default function ReportBuilder({ workbookId }) {
  const [reportName, setReportName] = useState('Monthly Sales MIS')
  const [period, setPeriod] = useState('September 2026')
  const [department, setDepartment] = useState('All Departments')

  const [toggles, setToggles] = useState({
    include_kpi_summary: true,
    include_target_actual: true,
    include_trend_analysis: true,
    include_regional_analysis: true,
    include_product_analysis: true,
    include_exceptions: true,
    include_ai_summary: true,
  })

  const [reportData, setReportData] = useState(null)
  const [generating, setGenerating] = useState(false)

  const handleToggle = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleGenerate = async () => {
    if (!workbookId) return
    setGenerating(true)
    try {
      const config = {
        report_name: reportName,
        period,
        department,
        ...toggles,
      }
      const res = await buildMisReport(workbookId, config)
      setReportData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">MIS Report Builder</h2>
        <p className="text-xs text-muted mt-0.5">
          Configure sections, parameters and generate custom executive MIS reports.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Configuration */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-borderline pb-3">
            <FileText size={16} className="text-primary" />
            <h4 className="text-sm font-bold text-ink">Report Parameters</h4>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Report Name</label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="input text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Reporting Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select text-xs">
              <option value="September 2026">September 2026</option>
              <option value="Q3 2026">Q3 2026</option>
              <option value="YTD 2026">YTD 2026</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="select text-xs">
              <option value="All Departments">All Departments</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          <div className="border-t border-borderline pt-3 space-y-2">
            <label className="text-xs font-bold text-ink mb-1 block">Included Report Sections</label>

            {[
              ['include_kpi_summary', 'KPI Summary'],
              ['include_target_actual', 'Target vs Actual'],
              ['include_trend_analysis', 'Trend Analysis'],
              ['include_regional_analysis', 'Regional Analysis'],
              ['include_product_analysis', 'Product Analysis'],
              ['include_exceptions', 'Exception Summary'],
              ['include_ai_summary', 'AI Executive Summary'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-ink/90 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={toggles[key]}
                  onChange={() => handleToggle(key)}
                  className="rounded border-borderline bg-bg-sidebar text-primary focus:ring-primary"
                />
                {label}
              </label>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-primary w-full py-2.5 text-xs gap-1.5 mt-2"
          >
            <Play size={14} />
            {generating ? 'Generating Report…' : 'Generate MIS Report'}
          </button>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-2">
          {reportData ? (
            <ReportPreviewView reportData={reportData} />
          ) : (
            <div className="card p-12 text-center text-muted text-xs flex flex-col items-center justify-center space-y-2 min-h-[400px]">
              <FileText size={32} className="text-muted/50 mb-2" />
              <p className="font-semibold text-ink text-sm">No Report Generated Yet</p>
              <p>Configure parameters on the left and click "Generate MIS Report".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
