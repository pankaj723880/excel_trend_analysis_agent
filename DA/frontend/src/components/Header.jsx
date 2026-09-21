import React, { useEffect, useRef, useState } from 'react'
import { Check, Moon, Settings, Sun, UploadCloud, X, ChevronRight, Sparkles, FileSpreadsheet, RefreshCw, PanelLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useWorkbook } from '../context/WorkbookContext'
import { formatFileSize } from '../utils/format'

const ROUTE_LABELS = {
  '/': 'Executive Dashboard',
  '/mis': 'MIS Overview',
  '/cleaning': 'Data Cleaning Studio',
  '/explorer': 'Data Explorer',
  '/eda': 'EDA Profiler',
  '/quality': 'Data Quality Assessment',
  '/trends': 'Trend Analysis & Forecasting',
  '/anomalies': 'Anomaly Detection',
  '/correlations': 'Correlation Matrix',
  '/kpis': 'KPI Benchmarks',
  '/ai-analyst': 'Gemini AI Analyst',
  '/ask-data': 'Ask Your Data',
  '/ai-reports': 'Automated AI Reports',
  '/downloads': 'Reports & Export',
  '/history': 'Audit & History',
  '/settings': 'System Settings',
}

export default function Header() {
  const { filename, overview, handleUpload, refreshWorkbook, toggleSidebar, sidebarCollapsed } = useWorkbook()
  const { themeMode, setThemeMode } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)
  const settingsRef = useRef(null)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const currentTitle = ROUTE_LABELS[location.pathname] || 'Workspace'

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
      className="h-16 shrink-0 w-full max-w-full px-4 sm:px-6 flex items-center justify-between border-b border-white/[0.08] sticky top-0 z-30 box-border backdrop-blur-xl"
      style={{
        background: 'rgba(8, 12, 22, 0.75)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onDirectUpload}
      />

      {/* Left: Breadcrumbs, Sidebar Toggle & Page Context */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={toggleSidebar}
          className="md:hidden h-8 w-8 rounded-lg border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer shrink-0"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={16} />
        </button>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted font-medium">
          <span className="hover:text-ink cursor-pointer transition-colors" onClick={() => navigate('/')}>
            Intelligence
          </span>
          <ChevronRight size={13} className="text-muted/60" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[14px] sm:text-[15px] font-bold text-ink leading-tight truncate flex items-center gap-2">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* Right: Status Pill & Consolidated Actions */}
      <div className="flex items-center gap-2.5 relative shrink-0" ref={settingsRef}>
        {filename ? (
          <div className="hidden md:flex items-center gap-2 text-[12px] bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] px-3 py-1.5 rounded-full backdrop-blur-md transition-colors">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-positive" />
            </span>
            <span className="font-semibold text-ink truncate max-w-[150px] lg:max-w-[220px]" title={filename}>{filename}</span>
            <span className="text-muted/40">|</span>
            <span className="text-primary text-[11px] font-medium flex items-center gap-1">
              Active
            </span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 text-[11.5px] bg-white/[0.02] border border-white/[0.06] px-3 py-1.5 rounded-full text-muted backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            <span>Ready for Excel</span>
          </div>
        )}

        <button
          className="btn-primary text-[12px] px-3.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 shadow-glow-blue"
          onClick={() => fileInputRef.current?.click()}
          title="Upload Excel spreadsheet for instant AI analysis"
        >
          <UploadCloud size={14} />
          <span className="hidden sm:inline">Upload Excel</span>
        </button>

        <button
          className={`h-8 w-8 rounded-lg border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-center text-muted hover:text-ink cursor-pointer transition-all ${
            isSettingsOpen ? 'bg-primary/15 text-primary border-primary/40' : ''
          }`}
          title="Settings"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
        >
          <Settings size={14} className={isSettingsOpen ? 'rotate-45 transition-transform duration-200' : 'transition-transform duration-200'} />
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
