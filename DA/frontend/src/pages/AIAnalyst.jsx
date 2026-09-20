import React, { useState, useEffect } from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import { AIInsights, EmptyState } from '../components'
import { generateAISummary, getWorkbookInsights } from '../services/api'
import { Sparkles, RefreshCw, Compass, ShieldCheck } from 'lucide-react'

export default function AIAnalyst() {
  const { workbookId, aiReports, setWorkbookAiReport } = useWorkbook()
  const cachedReport = workbookId ? aiReports[workbookId] : null
  const [aiResult, setAiResult] = useState(cachedReport || null)
  const [aiLoading, setAiLoading] = useState(false)

  // Sync state if cached report updates
  useEffect(() => {
    if (cachedReport) {
      setAiResult(cachedReport)
    }
  }, [cachedReport])

  // Load existing report from cache or MongoDB, only generate if none exists
  useEffect(() => {
    if (!workbookId) {
      setAiResult(null)
      return
    }

    if (aiReports[workbookId]) {
      setAiResult(aiReports[workbookId])
      return
    }

    let isMounted = true
    setAiLoading(true)
    getWorkbookInsights(workbookId)
      .then((data) => {
        if (!isMounted) return
        if (data && (data.full_response || data.summary || data.markdown)) {
          const report = data.full_response || data
          setAiResult(report)
          setWorkbookAiReport(workbookId, report)
          setAiLoading(false)
        } else {
          return handleGenerateAI()
        }
      })
      .catch(() => {
        if (isMounted) {
          handleGenerateAI()
        }
      })

    return () => {
      isMounted = false
    }
  }, [workbookId])

  const handleGenerateAI = async () => {
    if (!workbookId) return
    setAiLoading(true)
    try {
      const result = await generateAISummary(workbookId)
      setAiResult(result)
      setWorkbookAiReport(workbookId, result)
    } catch (err) {
      setAiResult({ source: 'error', markdown: `AI summary failed: ${err?.response?.data?.detail || err.message}` })
    } finally {
      setAiLoading(false)
    }
  }

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white tracking-tight">AI ANALYST</h2>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-ai" /> AI Analyst
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ai/20 text-ai border border-ai/30">
              Grounded Narrative
            </span>
          </div>
          <p className="text-sm text-secondary mt-1">
            Deterministic executive synthesis powered by statistical computation and Gemini explanation.
          </p>
        </div>

        <button
          onClick={handleGenerateAI}
          disabled={aiLoading}
          className="btn-ai text-xs flex items-center gap-2 py-2 px-4 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
          {aiLoading ? 'Synthesizing Narrative...' : 'Regenerate Narrative'}
        </button>
      </div>

      {/* Suggested Directions Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card-ai p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ai">
            <Compass className="w-4 h-4" /> What Is Happening?
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Synthesizes macroscopic momentum, identifying whether high-value measures are expanding or contracting.
          </p>
        </div>

        <div className="glass-card-ai p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ai">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Evidence Grounding
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            All numerical figures derive deterministically from Pandas/NumPy aggregations with zero synthetic hallucination.
          </p>
        </div>

        <div className="glass-card-ai p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ai">
            <Sparkles className="w-4 h-4" /> Strategic Inquiries
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Highlights unexpected variance, outlier concentrations, and recommended questions for deep-dive investigation.
          </p>
        </div>
      </div>

      {/* Main AI Insights Display */}
      <AIInsights
        result={aiResult}
        loading={aiLoading}
        onGenerate={handleGenerateAI}
        workbookId={workbookId}
      />
    </div>
  )
}
