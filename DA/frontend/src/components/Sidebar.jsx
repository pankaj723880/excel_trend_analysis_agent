import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  FileBarChart,
  FileDown,
  FileSpreadsheet,
  FileText,
  Gauge,
  HelpCircle,
  History,
  LayoutDashboard,
  MessageSquareText,
  Network,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table,
  TrendingUp,
  UploadCloud,
  Wrench,
} from 'lucide-react'
import { useWorkbook } from '../context/WorkbookContext'

const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/mis', label: 'MIS Overview', icon: FileBarChart },
    ],
  },
  {
    label: 'DATA',
    items: [
      { to: '/cleaning', label: 'Data Cleaning Studio', icon: Wrench },
      { to: '/explorer', label: 'Data Explorer', icon: Table },
      { to: '/eda', label: 'EDA Profiler', icon: Database },
      { to: '/quality', label: 'Data Quality', icon: ShieldCheck },
    ],
  },
  {
    label: 'ANALYSIS',
    items: [
      { to: '/trends', label: 'Trend Analysis', icon: TrendingUp },
      { to: '/anomalies', label: 'Anomalies', icon: ShieldAlert },
      { to: '/correlations', label: 'Correlations', icon: Network },
      { to: '/kpis', label: 'KPI Analysis', icon: Gauge },
    ],
  },
  {
    label: 'AI INTELLIGENCE',
    items: [
      { to: '/ai-analyst', label: 'AI Analyst', icon: Sparkles, isAi: true },
      { to: '/ask-data', label: 'Ask Your Data', icon: MessageSquareText, isAi: true },
      { to: '/ai-reports', label: 'AI Reports', icon: FileText, isAi: true },
    ],
  },
  {
    label: 'WORKSPACE',
    items: [
      { to: '/downloads', label: 'Reports & Export', icon: FileDown },
      { to: '/history', label: 'Analysis History', icon: History },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function Sidebar() {
  const { workbookId, filename, sheets, overview, sidebarCollapsed, toggleSidebar } = useWorkbook()
  const collapsed = !!sidebarCollapsed

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 ease-in-out flex flex-col select-none border-r border-white/[0.08] backdrop-blur-2xl ${
        collapsed ? 'w-20' : 'w-64'
      }`}
      style={{
        background: 'rgba(10, 15, 29, 0.82)',
      }}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.08]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-ai/20 border border-primary/30 flex items-center justify-center shrink-0 shadow-glow-blue">
            <BarChart3 size={18} className="text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13.5px] font-bold text-ink leading-tight truncate tracking-tight">Excel Intelligence</div>
              <div className="text-[10px] font-semibold text-primary/80 tracking-wider uppercase">AI Enterprise Analyst</div>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="h-7 w-7 rounded-lg border border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.05] flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted/60 mb-1.5">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group relative ${
                      isActive
                        ? item.isAi
                          ? 'bg-ai/15 text-white font-semibold border border-ai/30 shadow-glow-purple'
                          : 'bg-primary/15 text-white font-semibold border border-primary/30 shadow-glow-blue'
                        : 'text-secondary hover:text-ink hover:bg-white/[0.04]'
                    } ${collapsed ? 'justify-center px-0' : ''}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={16}
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? item.isAi
                              ? 'text-ai'
                              : 'text-primary'
                            : 'text-muted group-hover:text-secondary'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {isActive && (
                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full ${
                          item.isAi ? 'bg-ai' : 'bg-primary'
                        }`} />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Current Workbook Card Footer */}
      {!collapsed ? (
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2 px-1">
            Current Workbook
          </div>
          {workbookId && filename ? (
            <div className="p-2.5 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
              <div className="flex items-start gap-2">
                <FileSpreadsheet size={15} className="text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-ink truncate" title={filename}>
                    {filename}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {overview?.analysis_summary?.sheet_count ?? sheets?.length ?? 0} sheets analyzed
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[11px] font-medium text-positive">
                <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
                <span>Engine Ready</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] text-left">
              <div className="text-[12px] font-semibold text-ink">
                No workbook loaded
              </div>
              <p className="text-[11px] text-muted mt-1 leading-relaxed">
                Upload an Excel file to start analysis.
              </p>
              <NavLink
                to="/upload"
                className="mt-3 btn-primary w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <UploadCloud size={13} />
                <span>Upload Excel</span>
              </NavLink>
            </div>
          )}
        </div>
      ) : (
        <div className="p-2 border-t border-white/10 flex justify-center">
          <NavLink
            to="/upload"
            title={workbookId && filename ? filename : 'Upload Workbook'}
            className="h-10 w-10 rounded-xl border border-white/10 hover:border-primary/40 bg-white/[0.03] flex items-center justify-center text-primary"
          >
            <FileSpreadsheet size={17} />
          </NavLink>
        </div>
      )}
    </aside>
  )
}
