import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { misAiAssistant } from '../../services/api'
import { Sparkles, Send, Bot, User, HelpCircle } from 'lucide-react'

const SUGGESTED_QUESTIONS = [
  "Show today's sales vs target",
  "Which regions missed their target?",
  "Which products are below reorder level?",
  "Which customers have overdue payments?",
  "Generate this month's MIS summary",
  "Why did sales decline?",
  "Find unusual transactions",
  "Summarize inventory performance",
  "Show top performing salespeople",
  "Generate an executive report",
]

export default function MISAssistant({ workbookId }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hello! I am your **MIS AI Assistant**. I have analyzed your workbook's sales, targets, inventory, receivables, and validation records. Ask me any question or click a sample query below!",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async (questionText) => {
    const q = (questionText || input).trim()
    if (!q || !workbookId || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    setLoading(true)

    try {
      const res = await misAiAssistant(workbookId, q)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer || 'I could not generate an answer for this query.',
          source: res.source,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error querying the MIS assistant.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">MIS AI Assistant</h2>
        <p className="text-xs text-muted mt-0.5">
          Ask natural-language questions grounded in your workbook's actual MIS data.
        </p>
      </div>

      {/* Suggested Questions Grid */}
      <div className="card p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted font-semibold">
          <HelpCircle size={14} className="text-primary" />
          <span>Suggested Questions:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((sq) => (
            <button
              key={sq}
              onClick={() => handleSend(sq)}
              className="text-xs py-1 px-2.5 rounded-full bg-bg-sidebar hover:bg-primary/20 hover:text-primary text-ink/80 border border-borderline transition"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Window */}
      <div className="card p-4 space-y-4 min-h-[380px] max-h-[500px] overflow-y-auto flex flex-col justify-between">
        <div className="space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={15} className="text-primary" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-white font-medium'
                    : 'bg-bg-sidebar border border-borderline text-ink markdown-body'
                }`}
              >
                {m.role === 'user' ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
              </div>

              {m.role === 'user' && (
                <div className="h-7 w-7 rounded-lg bg-borderline flex items-center justify-center shrink-0 mt-0.5">
                  <User size={15} className="text-muted" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Sparkles size={14} className="animate-spin text-primary" /> Analyzing MIS context & generating data answer…
            </div>
          )}
        </div>
      </div>

      {/* Input Box */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Ask anything about today's sales, target variance, stock or overdue customers…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="input text-xs py-2.5 flex-1"
        />
        <button onClick={() => handleSend()} disabled={loading} className="btn btn-primary py-2.5 px-4 text-xs gap-1.5">
          <Send size={14} /> Send
        </button>
      </div>
    </div>
  )
}
