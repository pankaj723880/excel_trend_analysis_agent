import React, { useCallback, useRef, useState } from 'react'
import { FileSpreadsheet, UploadCloud, CheckCircle2 } from 'lucide-react'
import { useWorkbook, ANALYSIS_STAGES } from '../context/WorkbookContext'
import { formatFileSize } from '../utils/format'

export default function UploadZone({ onUploadSuccess }) {
  const { handleUpload, loading, analysisStage, uploadProgress, error } = useWorkbook()
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const inputRef = useRef(null)

  const pickFile = useCallback(
    async (file) => {
      if (!file) return
      const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name)
      if (!isExcel) return
      setSelectedFile(file)
      const res = await handleUpload(file)
      if (res && onUploadSuccess) {
        onUploadSuccess(res)
      }
    },
    [handleUpload, onUploadSuccess]
  )

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      setDragOver(false)
      const file = event.dataTransfer?.files?.[0]
      if (file) pickFile(file)
    },
    [pickFile]
  )

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
          <span className="font-semibold">Upload failed: </span>
          {error}
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={`glass-card cursor-pointer transition-all duration-200 flex flex-col items-center justify-center py-12 px-6 text-center border-dashed ${
          dragOver ? '!border-primary ring-2 ring-primary/30 bg-primary/10' : 'hover:border-primary/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          {loading ? (
            <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : (
            <UploadCloud className="w-7 h-7 text-primary" />
          )}
        </div>
        <div className="text-sm font-semibold text-white">Upload your Excel or CSV workbook</div>
        <div className="text-xs text-secondary mt-1">Drag and drop files here, or click to browse</div>
        
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
          disabled={loading}
          className="btn-primary mt-4 text-xs px-5 py-2.5 shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          <UploadCloud className="w-4 h-4" />
          Choose Excel File
        </button>
        <div className="text-[11px] text-muted mt-3">
          Supported: <span className="text-secondary font-medium">.xlsx</span>, <span className="text-secondary font-medium">.xls</span>, <span className="text-secondary font-medium">.csv</span> · Max 50 MB
        </div>

        {selectedFile && !loading && (
          <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-glass-border bg-white/[0.03] px-4 py-2.5">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <div className="text-left">
              <div className="text-xs font-semibold text-white max-w-[260px] truncate">{selectedFile.name}</div>
              <div className="text-[11px] text-muted">{formatFileSize(selectedFile.size)}</div>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-white">
              {ANALYSIS_STAGES[analysisStage] || 'Processing workbook…'}
            </div>
            <div className="text-xs font-mono text-primary font-bold">
              {analysisStage / Math.max(1, ANALYSIS_STAGES.length - 1) >= 1
                ? 'Finalizing'
                : `${Math.min(99, Math.round(uploadProgress || analysisStage * 14))}%`}
            </div>
          </div>
          
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(100, analysisStage * 14 + (uploadProgress || 0) * 0.2)}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {ANALYSIS_STAGES.map((stage, index) => (
              <div
                key={stage}
                className={`flex items-center gap-2 text-xs ${
                  index < analysisStage
                    ? 'text-emerald-400'
                    : index === analysisStage
                      ? 'text-white font-medium'
                      : 'text-muted'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    index < analysisStage
                      ? 'bg-emerald-400'
                      : index === analysisStage
                        ? 'bg-primary animate-ping'
                        : 'bg-muted/40'
                  }`}
                />
                <span className="truncate">{stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
