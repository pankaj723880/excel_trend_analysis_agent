import React, { useState, useEffect, useRef } from 'react'
import {
  Settings as SettingsIcon,
  Shield,
  Database,
  Sparkles,
  Check,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import {
  DEFAULT_SETTINGS,
  IQR_SENSITIVITY_OPTIONS,
  loadSavedSettings,
  persistSettings,
} from '../constants/settings'

export default function Settings() {
  // Single settings state initialized from storage (survives page refresh)
  const [settings, setSettings] = useState(() => loadSavedSettings())

  // Toast / notification state
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  // Clear toast on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  // Update a single setting in controlled form state
  const handleChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Action 1: Save currently selected settings
  const handleSavePreferences = (e) => {
    e.preventDefault()
    const success = persistSettings(settings)
    if (success) {
      showToast('Preferences saved successfully', 'success')
    } else {
      showToast('Failed to save preferences to storage', 'error')
    }
  }

  // Action 2: Reset Defaults (separate action)
  const handleResetDefaults = () => {
    // Non-mutating copy of canonical defaults
    const defaults = { ...DEFAULT_SETTINGS }

    // 1. Immediately update all controlled React form state
    setSettings(defaults)

    // 2. Persist defaults to storage with defensive error handling
    const persisted = persistSettings(defaults)

    // 3. Inform user with toast
    if (persisted) {
      showToast('Settings reset to defaults', 'success')
    } else {
      showToast('Defaults applied locally, but could not be saved.', 'warning')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in-up relative">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-fade-in-up ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
              : toast.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/30 text-amber-200'
              : 'bg-rose-950/90 border-rose-500/30 text-rose-200'
          }`}
        >
          {toast.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" /> Workspace Settings
        </h1>
        <p className="text-sm text-secondary mt-1">
          Configure deterministic computation engines, AI inference parameters, and session preferences.
        </p>
      </div>

      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* Section 1: AI Engine Configuration */}
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-glass-border pb-3">
            <Sparkles className="w-5 h-5 text-ai" />
            <div>
              <h2 className="text-base font-semibold text-white">AI Inference Configuration</h2>
              <p className="text-xs text-muted">Manage prompt formatting and synthesis boundaries</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="aiTemperature" className="text-xs font-medium text-secondary">
                Inference Temperature
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="aiTemperature"
                  name="aiTemperature"
                  type="range"
                  min="0"
                  max="0.7"
                  step="0.05"
                  value={settings.aiTemperature}
                  onChange={(e) => handleChange('aiTemperature', parseFloat(e.target.value))}
                  className="w-full accent-ai cursor-pointer"
                />
                <span
                  data-testid="temperature-display"
                  className="text-xs font-mono text-white bg-white/5 px-2.5 py-1 rounded border border-glass-border min-w-[42px] text-center"
                >
                  {settings.aiTemperature}
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Lower values ensure strict factual grounding with zero creative drift.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-secondary">Backend Integration</label>
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                <Shield className="w-4 h-4 shrink-0" />
                <span>API Keys securely routed through server environment (zero client exposure).</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Data Computation Preferences */}
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-glass-border pb-3">
            <Database className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-white">Computation & Anomaly Thresholds</h2>
              <p className="text-xs text-muted">Fine-tune statistical rules and memory allocation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="iqrSensitivity" className="text-xs font-medium text-secondary">
                IQR Outlier Sensitivity
              </label>
              <select
                id="iqrSensitivity"
                name="iqrSensitivity"
                value={settings.iqrSensitivity}
                onChange={(e) => handleChange('iqrSensitivity', e.target.value)}
                className="w-full bg-[#070B14] border border-glass-border rounded-lg text-xs text-white px-3 py-2 focus:outline-none focus:border-primary cursor-pointer"
              >
                {IQR_SENSITIVITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-secondary">Automatic Sheet Profiling</label>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="autoProf"
                  name="autoProf"
                  checked={settings.autoProfile}
                  onChange={(e) => handleChange('autoProfile', e.target.checked)}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="autoProf" className="text-xs text-secondary cursor-pointer select-none">
                  Automatically profile dataset upon workbook switch
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer hover:border-white/20 active:scale-95 transition-all"
            title="Restore all settings to default values"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="submit"
            className="btn-primary text-xs px-5 py-2 flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  )
}
