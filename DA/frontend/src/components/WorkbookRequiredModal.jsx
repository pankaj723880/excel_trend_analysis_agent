import React, { useEffect, useRef } from 'react'
import { AlertCircle, UploadCloud, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWorkbook } from '../context/WorkbookContext'

export default function WorkbookRequiredModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { handleUpload } = useWorkbook()
  const fileInputRef = useRef(null)

  // Lock body scroll and prevent background interaction when open
  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const previousPaddingRight = document.body.style.paddingRight

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const onFileInputChange = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      onClose?.()
      const result = await handleUpload(file)
      if (result) {
        navigate('/')
      }
    }
    e.target.value = ''
  }

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    } else {
      onClose?.()
      navigate('/upload')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workbook-required-title"
    >
      {/* Full Viewport Non-Dismissible Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* Centered Small Dialog */}
      <div className="relative z-[9999] w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B101E] p-6 shadow-2xl text-center animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-ink p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <AlertCircle size={24} />
        </div>

        <h3 id="workbook-required-title" className="text-base font-bold text-ink">
          Workbook Required
        </h3>

        <p className="mt-2 text-xs text-secondary leading-relaxed">
          Upload an Excel workbook before adding a dashboard visual.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleUploadClick}
            className="btn-primary w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
          >
            <UploadCloud size={15} />
            <span>Upload Excel</span>
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-muted hover:text-ink hover:bg-white/5 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
