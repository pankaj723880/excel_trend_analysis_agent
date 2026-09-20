import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import UploadZone from '../components/UploadZone'
import { useWorkbook } from '../context/WorkbookContext'

export default function Upload() {
  const { workbookId, filename, loading } = useWorkbook()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle Background Radial Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-ai/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-xl w-full relative z-10">
        {workbookId && !loading && (
          <div className="mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to current workbook ({filename})
            </button>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-ai/10 text-ai border border-ai/20 mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Deterministic Analytics Grounding
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Excel Intelligence</h1>
          <p className="text-sm text-secondary max-w-md mx-auto">
            Upload any Excel or CSV workbook to instantly generate statistical profiles, detect multi-method trends, and synthesize AI executive insights.
          </p>
        </div>

        <div className="glass-panel p-6 shadow-2xl">
          <UploadZone onUploadSuccess={() => navigate('/')} />
        </div>
      </div>
    </div>
  )
}
