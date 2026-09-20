import React from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import { ChatBox, EmptyState } from '../components'
import { Sparkles, HelpCircle } from 'lucide-react'

export default function AskData() {
  const { workbookId } = useWorkbook()

  if (!workbookId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white tracking-tight">ASK YOUR DATA</h2>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up h-[calc(100vh-130px)] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 border-b border-glass-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-ai" /> Ask Your Data
          </h1>
          <p className="text-sm text-secondary mt-1">
            Natural-language conversational analytics grounded strictly in deterministic Python calculations.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 glass-panel overflow-hidden flex flex-col">
        <ChatBox workbookId={workbookId} />
      </div>
    </div>
  )
}
