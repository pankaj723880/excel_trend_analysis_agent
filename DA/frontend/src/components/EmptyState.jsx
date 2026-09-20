import React from 'react'
import { UploadCloud } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function EmptyState({ message = 'No workbook loaded yet' }) {
  const navigate = useNavigate()

  return (
    <div className="card flex flex-col items-center justify-center py-20 px-8 text-center animate-fade-in-up">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-4">
        <UploadCloud size={26} className="text-primary" />
      </div>
      <div className="text-[15px] font-semibold text-ink">{message}</div>
      <div className="text-[12.5px] text-muted mt-1.5 max-w-sm">
        Upload an Excel workbook to start automatic analysis: profiles, EDA, trends, anomalies, correlations and AI insights.
      </div>
      <button className="btn-primary mt-6" onClick={() => navigate('/upload')}>
        <UploadCloud size={15} />
        Upload workbook
      </button>
    </div>
  )
}
