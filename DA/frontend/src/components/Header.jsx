import React, { useEffect, useRef, useState } from 'react'
import { Check, Moon, Settings, Sun, UploadCloud, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useWorkbook } from '../context/WorkbookContext'
import { formatFileSize } from '../utils/format'

export default function Header() {
  const { filename, overview, handleUpload } = useWorkbook()
  const { themeMode, setThemeMode } = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const settingsRef = useRef(null)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const onDirectUpload = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const result = await handleUpload(file)
      if (result) {
        navigate('/')
      }
    }
    e.target.value = ''
  }

  // Close settings popup when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false)
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false)
      }
    }
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSettingsOpen])

  const themeOptions = [
    {
      id: 'light',
      label: 'Light Mode',
      description: 'Clean bright layout',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Dark Mode',
      description: 'Sleek dark theme',
      icon: Moon,
    },
  ]

  return (
    <header
      className="h-16 shrink-0 w-full max-w-full px-4 sm:px-6 flex items-center justify-between border-b border-white/10 sticky top-0 z-30 box-border"
      style={{
        background: 'rgba(9, 14, 26, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onDirectUpload}
      />

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-[15px] font-bold text-ink leading-tight flex items-center gap-2">
            Excel Intelligence
          </h1>
          <p className="text-[11px] text-muted leading-tight">AI-Powered Enterprise Data Analyst</p>
        </div>
      </div>

      <div className="flex items-center gap-3 relative" ref={settingsRef}>
        {filename ? (
          <div className="hidden md:flex items-center gap-2 text-[12px] bg-white/[0.04] border border-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-positive animate-pulse" />
            <span className="font-semibold text-ink truncate max-w-[180px]">{filename}</span>
            <span className="text-muted">·</span>
            <span className="text-positive text-[11px] font-medium">Engine Active</span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 text-[12px] bg-white/[0.04] border border-white/10 px-3.5 py-1.5 rounded-full text-muted backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span>No workbook loaded</span>
          </div>
        )}

        <button
          className="btn-primary text-[12px] px-3.5 py-2 cursor-pointer flex items-center gap-2"
          onClick={() => fileInputRef.current?.click()}
          title="Directly select and upload an Excel worksheet"
        >
          <UploadCloud size={15} />
          <span>Upload Excel</span>
        </button>

        <button
          className={`h-9 w-9 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-center text-muted hover:text-ink cursor-pointer transition-all ${
            isSettingsOpen ? 'bg-primary/15 text-primary border-primary/40' : ''
          }`}
          title="Settings"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
        >
          <Settings size={15} className={isSettingsOpen ? 'rotate-45 transition-transform duration-200' : 'transition-transform duration-200'} />
        </button>

        {/* Settings Dropdown Popover */}
        {isSettingsOpen && (
          <div className="settings-popover absolute right-0 top-12 w-80 rounded-card border border-borderline bg-bg-card p-4 z-50 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-borderline">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-ink">Settings</h3>
              </div>
              <button
                className="h-6 w-6 rounded-md hover:bg-bg-sidebar flex items-center justify-center text-muted hover:text-ink cursor-pointer"
                onClick={() => setIsSettingsOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Theme Mode Section */}
            <div>
              <div className="section-label mb-2.5">Theme Mode</div>
              <div className="space-y-2">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = themeMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setThemeMode(opt.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-ink font-medium'
                          : 'border-borderline hover:border-borderline/80 hover:bg-bg-sidebar text-muted hover:text-ink'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'bg-bg-sidebar text-muted'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-ink leading-snug">
                            {opt.label}
                          </div>
                          <div className="text-[11px] text-muted leading-snug">
                            {opt.description}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-white">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-borderline text-[11px] text-muted text-center">
              Excel Intelligence Workspace · v2.0
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
