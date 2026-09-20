import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Sparkles, Send, User, CheckCircle2, ChevronDown, ChevronRight, ShieldCheck, Database } from 'lucide-react'
import { useWorkbook } from '../context/WorkbookContext'
import { askQuestion, getDomainContext, getConversations } from '../services/api'

const DEFAULT_SUGGESTIONS = [
  'What is the total revenue?',
  'Which product has the highest revenue?',
  'Which product has the lowest revenue?',
  'Is revenue growing faster than costs?',
  'What changed recently?',
  'Which month had the highest sales?',
  'Are there any anomalies?',
  'Explain this workbook to me simply.',
]

export default function ChatBox({ workbookId: propWorkbookId } = {}) {
  const { workbookId: contextWorkbookId, chatMessages, setWorkbookChatMessages } = useWorkbook()
  const workbookId = propWorkbookId || contextWorkbookId

  const cachedMessages = (workbookId && chatMessages[workbookId]) || []
  const [messages, setMessages] = useState(cachedMessages)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedTraceability, setExpandedTraceability] = useState({})
  const [domainContext, setDomainContext] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (workbookId && chatMessages[workbookId] && chatMessages[workbookId].length > messages.length) {
      setMessages(chatMessages[workbookId])
    }
  }, [workbookId, chatMessages])

  useEffect(() => {
    if (!workbookId) return

    getDomainContext(workbookId)
      .then((data) => setDomainContext(data))
      .catch(() => setDomainContext(null))

    getConversations(workbookId)
      .then((data) => {
        if (data?.conversations && Array.isArray(data.conversations) && data.conversations.length > 0) {
          const loadedMessages = []
          data.conversations.forEach((conv) => {
            if (conv.question) {
              loadedMessages.push({ role: 'user', content: conv.question })
            }
            if (conv.AI_answer) {
              const calc = conv.calculation_result || {}
              const trace = conv.structured_analysis_request || {}
              loadedMessages.push({
                role: 'assistant',
                content: conv.AI_answer,
                confidence: 'High',
                traceability: trace,
                operation: calc.operation || trace.operation,
                source_sheet: conv.source_sheet || calc.source_sheet || trace.sheet,
                columns_used: conv.source_columns || calc.columns_used || trace.columns || [],
                rows_analyzed: conv.rows_analyzed ?? calc.rows_analyzed ?? trace.rows_analyzed ?? 0,
                formatted_result: calc.formatted_result,
              })
            }
          })
          setMessages(loadedMessages)
          setWorkbookChatMessages(workbookId, loadedMessages)
        }
      })
      .catch((err) => {
        console.error('Could not load MongoDB conversations:', err)
      })
  }, [workbookId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const suggestions = domainContext?.suggested_questions || DEFAULT_SUGGESTIONS

  const toggleTraceability = (index) => {
    setExpandedTraceability((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const send = async (text) => {
    const question = (text || input).trim()
    if (!question || !workbookId || busy) return

    const userMsg = { role: 'user', content: question }
    const updatedWithUser = [...messages, userMsg]
    setMessages(updatedWithUser)
    setWorkbookChatMessages(workbookId, updatedWithUser)
    setInput('')
    setBusy(true)

    try {
      const response = await askQuestion({ workbook_id: workbookId, question })
      const calc = response.calculation_result || {}
      const trace = response.structured_analysis_request || {}
      const aiMsg = {
        role: 'assistant',
        content: response.AI_answer,
        confidence: response.confidence_score || 'High',
        traceability: trace,
        operation: calc.operation || trace.operation,
        source_sheet: response.source_sheet || calc.source_sheet || trace.sheet,
        columns_used: response.source_columns || calc.columns_used || trace.columns || [],
        rows_analyzed: response.rows_analyzed ?? calc.rows_analyzed ?? trace.rows_analyzed ?? 0,
        formatted_result: calc.formatted_result,
      }
      const updatedWithAi = [...updatedWithUser, aiMsg]
      setMessages(updatedWithAi)
      setWorkbookChatMessages(workbookId, updatedWithAi)
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: `Sorry, I encountered an error while processing that question: ${err?.response?.data?.detail || err.message}`,
        confidence: 'Low',
      }
      const updatedWithError = [...updatedWithUser, errorMsg]
      setMessages(updatedWithError)
      setWorkbookChatMessages(workbookId, updatedWithError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Top Protocol Bar */}
      <div className="border-b border-glass-border p-3.5 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ai opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-ai" />
            </span>
            <span className="text-xs font-semibold text-white">Dual Verification Pipeline Active</span>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
              Deterministic Grounding
            </span>
          </div>
          <div className="text-[11px] text-muted hidden sm:block">Pandas calculates • Gemini explains</div>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4 py-4 max-w-3xl mx-auto">
            <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-ai" /> Suggested Business Questions for {domainContext?.domain || 'Your Dataset'}:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="text-left text-xs rounded-xl border border-glass-border bg-white/[0.02] p-3 text-secondary hover:text-white hover:border-ai/50 hover:bg-ai/10 transition-all cursor-pointer font-medium flex items-center justify-between group"
                  onClick={() => send(suggestion)}
                >
                  <span className="truncate">{suggestion}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border ${
                message.role === 'user'
                  ? 'bg-primary/20 border-primary/30 text-primary'
                  : 'bg-ai/20 border-ai/30 text-ai'
              }`}
            >
              {message.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>

            <div
              className={`rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[85%] space-y-2.5 border ${
                message.role === 'user'
                  ? 'bg-primary/10 border-primary/20 text-white'
                  : 'glass-panel text-white'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="space-y-3">
                  <div className="markdown-body text-xs leading-relaxed">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>

                  {/* Confidence Badge */}
                  {message.confidence && (
                    <div className="flex items-center justify-between pt-2 border-t border-glass-border text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Numerical Accuracy Guaranteed by Pandas
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          message.confidence === 'High'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        Confidence: {message.confidence}
                      </span>
                    </div>
                  )}

                  {/* Source Traceability */}
                  {(message.traceability || message.operation) && (
                    <div className="rounded-xl border border-glass-border bg-black/20 overflow-hidden text-[11px]">
                      <button
                        onClick={() => toggleTraceability(index)}
                        className="w-full px-3 py-2 flex items-center justify-between bg-white/[0.02] text-white hover:bg-white/[0.05] font-semibold transition-colors text-left"
                      >
                        <span className="flex items-center gap-1.5 text-[10px] text-ai uppercase font-bold tracking-wider">
                          <Database className="w-3 h-3" /> How this was calculated
                        </span>
                        {expandedTraceability[index] ? <ChevronDown className="w-3.5 h-3.5 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-muted" />}
                      </button>

                      {expandedTraceability[index] && (
                        <div className="p-3 space-y-2 border-t border-glass-border bg-black/40 text-secondary">
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-muted block text-[10px]">Operation:</span>
                              <code className="text-primary font-mono text-[10px] bg-primary/10 px-1 py-0.5 rounded border border-primary/20 inline-block">{message.operation || message.traceability?.operation || 'N/A'}</code>
                            </div>
                            <div>
                              <span className="text-muted block text-[10px]">Sheet:</span>
                              <span className="text-white font-medium">{message.source_sheet || message.traceability?.sheet || 'N/A'}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted block text-[10px]">Columns:</span>
                              <span className="text-white font-medium">
                                {Array.isArray(message.columns_used || message.traceability?.columns)
                                  ? (message.columns_used || message.traceability?.columns).join(', ')
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-xl bg-ai/20 border border-ai/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-ai animate-spin" />
            </div>
            <div className="glass-panel px-4 py-2.5 flex items-center gap-2 text-xs text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse" style={{ animationDelay: '300ms' }} />
              <span>Executing deterministic Pandas calculation & verifying results…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-glass-border p-3.5 bg-white/[0.02]">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
        >
          <input
            className="w-full bg-[#070B14] border border-glass-border rounded-xl text-xs text-white px-3.5 py-2.5 placeholder:text-muted focus:outline-none focus:border-ai"
            placeholder="Ask anything about your workbook metrics (e.g., total revenue, top products, growth comparison)…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!workbookId || busy}
          />
          <button 
            className="btn-ai !px-4 text-xs font-semibold cursor-pointer shrink-0" 
            type="submit" 
            disabled={!workbookId || busy || !input.trim()}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
