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
  const { filename, sheets, overview, sidebarCollapsed, toggleSidebar } = useWorkbook()
  const collapsed = !!sidebarCollapsed

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 ease-in-out flex flex-col select-none border-r border-white/10 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
      style={{
        background: 'rgba(9, 14, 26, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 shadow-glow-blue">
            <BarChart3 size={18} className="text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13.5px] font-bold text-ink leading-tight truncate">Excel Intelligence</div>
              <div className="text-[10px] font-medium text-muted tracking-wide uppercase">AI Data Analyst</div>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="h-7 w-7 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 py-4 px-2.5 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted/70 px-2.5 mb-1.5">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-2.5 rounded-lg transition-all duration-150 ${
                      collapsed ? 'justify-center p-2.5' : 'px-2.5 py-2 text-[12.5px]'
                    } ${
                      isActive
                        ? item.isAi
                          ? 'bg-ai/15 text-ink font-semibold border border-ai/30 shadow-glow-purple'
                          : 'bg-primary/15 text-ink font-semibold border border-primary/30 shadow-glow-blue'
                        : 'text-secondary/70 hover:text-ink hover:bg-white/5 font-medium'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={17}
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? item.isAi
                              ? 'text-ai'
                              : 'text-primary'
                            : 'text-muted group-hover:text-secondary'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
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
          {filename ? (
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
            <NavLink
              to="/upload"
              className="p-2.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-primary/40 block text-center transition-all cursor-pointer group"
            >
              <div className="text-[12px] font-medium text-secondary group-hover:text-primary flex items-center justify-center gap-1.5">
                <UploadCloud size={14} /> Upload Excel
              </div>
            </NavLink>
          )}
        </div>
      ) : (
        <div className="p-2 border-t border-white/10 flex justify-center">
          <NavLink
            to="/upload"
            title={filename || 'Upload Workbook'}
            className="h-10 w-10 rounded-xl border border-white/10 hover:border-primary/40 bg-white/[0.03] flex items-center justify-center text-primary"
          >
            <FileSpreadsheet size={17} />
          </NavLink>
        </div>
      )}
    </aside>
  )
}
