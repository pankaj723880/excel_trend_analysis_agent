import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

/**
 * Export data to CSV file.
 */
export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) return
  const keys = Object.keys(rows[0])
  const csvContent = [
    keys.join(','),
    ...rows.map((row) =>
      keys.map((k) => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export data to JSON/Excel raw format.
 */
export function exportToExcel(filename, rows) {
  exportToCSV(filename, rows)
}

/**
 * Generate and download a formatted PDF report.
 */
export function exportReportPDF(reportData) {
  const doc = new jsPDF()

  doc.setFontSize(20)
  doc.setTextColor(30, 41, 59)
  doc.text(reportData.report_name || 'MIS Executive Report', 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(`Period: ${reportData.period || 'September 2026'} | Generated: ${new Date().toLocaleDateString()}`, 14, 28)

  let currentY = 36

  if (reportData.sections?.ai_summary) {
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text('Executive Summary', 14, currentY)
    currentY += 6

    doc.setFontSize(9)
    doc.setTextColor(51, 65, 85)
    const splitText = doc.splitTextToSize(reportData.sections.ai_summary, 180)
    doc.text(splitText, 14, currentY)
    currentY += splitText.length * 5 + 6
  }

  if (reportData.sections?.kpis && reportData.sections.kpis.length > 0) {
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text('KPI Performance Summary', 14, currentY)
    currentY += 6

    const tableData = reportData.sections.kpis.map((kpi) => [
      kpi.title,
      typeof kpi.value === 'number' ? `₹${kpi.value.toLocaleString()}` : String(kpi.value),
      kpi.change ? `${kpi.change > 0 ? '+' : ''}${kpi.change}%` : '—',
      kpi.status || 'OK',
    ])

    doc.autoTable({
      startY: currentY,
      head: [['KPI Metric', 'Value', 'Change', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 91, 255] },
    })

    currentY = doc.lastAutoTable.finalY + 10
  }

  doc.save(`${(reportData.report_name || 'MIS_Report').replace(/\s+/g, '_')}.pdf`)
}
