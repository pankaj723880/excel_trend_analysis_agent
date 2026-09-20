import React, { useState } from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import { FileDown, Download, FileSpreadsheet, ShieldCheck, CheckCircle, Database } from 'lucide-react'
import { getExportUrl, getCleanedExportUrl } from '../services/api'
import { EmptyState } from '../components'
import axios from 'axios'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Downloads() {
  const { workbookId, filename } = useWorkbook()
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingCleaned, setDownloadingCleaned] = useState(false)

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white tracking-tight">REPORTS & EXPORTS</h2>
        <EmptyState />
      </div>
    )
  }

  // --- PDF GENERATION ---
  const handleDownloadPDF = async () => {
    setDownloadingPdf(true)
    try {
      const response = await axios.get(getExportUrl(workbookId))
      const data = response.data
      
      const doc = new jsPDF()
      
      doc.setFontSize(22)
      doc.text('Excel Intelligence Report', 14, 22)
      doc.setFontSize(14)
      doc.setTextColor(100)
      doc.text(`Workbook: ${data.filename}`, 14, 32)
      doc.text(`Exported At: ${new Date(data.exported_at).toLocaleString()}`, 14, 40)
      
      let y = 50
      
      if (data.profile) {
        for (const [sheetName, profile] of Object.entries(data.profile)) {
          if (y > 250) {
            doc.addPage()
            y = 20
          }
          doc.setFontSize(16)
          doc.setTextColor(0, 0, 0)
          doc.text(`Sheet: ${sheetName}`, 14, y)
          y += 10
          
          doc.setFontSize(12)
          doc.setTextColor(50)
          doc.text(`Rows: ${profile.rows} | Columns: ${profile.columns}`, 14, y)
          y += 10
          
          const tableData = [
            ['Total Missing Cells', profile.missing_cells || 0],
            ['Total Duplicates', profile.duplicate_rows || 0],
            ['Numeric Columns', profile.numeric_columns?.length || 0],
            ['Categorical Columns', profile.categorical_columns?.length || 0]
          ]
          
          autoTable(doc, {
            startY: y,
            head: [['Metric', 'Value']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [96, 165, 250] }
          })
          y = doc.lastAutoTable.finalY + 15
        }
      }
      
      doc.save(`${data.filename.replace(/\.[^/.]+$/, "")}_report.pdf`)
    } catch (err) {
      console.error("Failed to generate PDF", err)
      alert("Failed to generate PDF: " + (err.message || "Unknown error"))
    } finally {
      setDownloadingPdf(false)
    }
  }

  // --- CLEANED WORKBOOK DOWNLOAD ---
  const handleDownloadCleaned = async () => {
    setDownloadingCleaned(true)
    try {
      const response = await axios.get(getCleanedExportUrl(workbookId), {
        responseType: 'blob'
      })
      let fileName = `${filename.replace(/\.[^/.]+$/, "")}_cleaned.xlsx`
      const contentDisposition = response.headers['content-disposition']
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) fileName = match[1]
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert("Failed to download cleaned workbook. Did you run the cleaning tools yet?")
    } finally {
      setDownloadingCleaned(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileDown className="w-6 h-6 text-primary" /> Reports & Exports
          </h1>
          <p className="text-sm text-secondary mt-1">
            Export deterministic audit documentation and download sanitized Excel workbooks.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Executive Report Card */}
        <div className="glass-panel p-6 flex flex-col justify-between space-y-5 border-t-2 border-t-primary">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center justify-center">
                <FileDown className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Ready to Export
              </span>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted mb-1">PDF Audit Document</div>
              <h3 className="text-lg font-bold text-white">Comprehensive Intelligence Brief</h3>
            </div>

            <div className="space-y-1.5 text-xs text-secondary glass-card p-3">
              <div className="flex justify-between">
                <span>Workbook:</span>
                <strong className="text-white font-mono">{filename}</strong>
              </div>
              <div className="flex justify-between">
                <span>Audited:</span>
                <span className="text-white">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Format:</span>
                <span className="text-white font-semibold">PDF Document</span>
              </div>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Synthesized analytical report including data health metrics, descriptive statistics, and sheet diagnostics.
            </p>
          </div>

          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            className="btn-primary flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold cursor-pointer"
          >
            {downloadingPdf ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
          </button>
        </div>

        {/* Cleaned Dataset Card */}
        <div className="glass-panel p-6 flex flex-col justify-between space-y-5 border-t-2 border-t-emerald-400">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                Processed Dataset
              </span>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Excel Spreadsheet</div>
              <h3 className="text-lg font-bold text-white">Cleaned & Transformed Workbook</h3>
            </div>

            <div className="space-y-1.5 text-xs text-secondary glass-card p-3">
              <div className="flex justify-between">
                <span>Workbook:</span>
                <strong className="text-white font-mono">{filename}</strong>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-emerald-400 font-semibold">Transformations Applied</span>
              </div>
              <div className="flex justify-between">
                <span>Format:</span>
                <span className="text-white font-semibold">Excel (.xlsx)</span>
              </div>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Standardized Excel file incorporating whitespace trimming, header normalization, and outlier handling.
            </p>
          </div>

          <button
            onClick={handleDownloadCleaned}
            disabled={downloadingCleaned}
            className="btn-secondary flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold cursor-pointer"
          >
            {downloadingCleaned ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloadingCleaned ? 'Downloading...' : 'Download Cleaned Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}
