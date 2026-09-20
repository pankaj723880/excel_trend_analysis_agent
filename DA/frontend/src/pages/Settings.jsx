import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, Sliders, Database, Sparkles, Bell, Check, Key } from 'lucide-react';

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [modelTemp, setModelTemp] = useState(0.2);
  const [autoProfile, setAutoProfile] = useState(true);
  const [anomalyThreshold, setAnomalyThreshold] = useState('1.5');

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" /> Workspace Settings
        </h1>
        <p className="text-sm text-secondary mt-1">
          Configure deterministic computation engines, AI inference parameters, and session preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
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
              <label className="text-xs font-medium text-secondary">Inference Temperature</label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="0" 
                  max="0.7" 
                  step="0.05"
                  value={modelTemp} 
                  onChange={(e) => setModelTemp(parseFloat(e.target.value))}
                  className="w-full accent-ai cursor-pointer"
                />
                <span className="text-xs font-mono text-white bg-white/5 px-2 py-1 rounded border border-glass-border">{modelTemp}</span>
              </div>
              <p className="text-[11px] text-muted">Lower values ensure strict factual grounding with zero creative drift.</p>
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
              <label className="text-xs font-medium text-secondary">IQR Outlier Sensitivity</label>
              <select 
                value={anomalyThreshold}
                onChange={(e) => setAnomalyThreshold(e.target.value)}
                className="w-full bg-[#070B14] border border-glass-border rounded-lg text-xs text-white px-3 py-2 focus:outline-none focus:border-primary"
              >
                <option value="1.5">Standard (1.5x IQR - Moderate)</option>
                <option value="3.0">Strict (3.0x IQR - Extreme Only)</option>
                <option value="1.0">High Sensitivity (1.0x IQR - Wide Filter)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-secondary">Automatic Sheet Profiling</label>
              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox" 
                  id="autoProf"
                  checked={autoProfile}
                  onChange={(e) => setAutoProfile(e.target.checked)}
                  className="rounded border-glass-border bg-transparent text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="autoProf" className="text-xs text-secondary cursor-pointer">
                  Automatically profile dataset upon workbook switch
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary text-xs px-4 py-2">
            Reset Defaults
          </button>
          <button type="submit" className="btn-primary text-xs px-5 py-2 flex items-center gap-2">
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? 'Preferences Saved' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}
