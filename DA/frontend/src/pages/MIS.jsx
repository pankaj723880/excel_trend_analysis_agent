import React, { useState, useEffect } from 'react'
import { useWorkbook } from '../context/WorkbookContext'
import MISFilterBar from '../components/mis/MISFilterBar'
import DataMappingView from '../components/mis/DataMappingView'

import MISOverview from './mis/MISOverview'
import DailyMIS from './mis/DailyMIS'
import SalesMIS from './mis/SalesMIS'
import PurchaseMIS from './mis/PurchaseMIS'
import InventoryMIS from './mis/InventoryMIS'
import FinanceMIS from './mis/FinanceMIS'
import HRMIS from './mis/HRMIS'
import TargetActual from './mis/TargetActual'
import Reconciliation from './mis/Reconciliation'
import DataValidation from './mis/DataValidation'
import ExceptionCenter from './mis/ExceptionCenter'
import ReportBuilder from './mis/ReportBuilder'
import ScheduledReports from './mis/ScheduledReports'
import MasterData from './mis/MasterData'
import MISAssistant from './mis/MISAssistant'

import { getMisFilters, refreshMisData } from '../services/api'
import { exportToCSV } from '../services/misExport'
import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  ShoppingBag,
  Package,
  DollarSign,
  Users,
  Target,
  GitCompare,
  ShieldCheck,
  AlertCircle,
  FileText,
  Clock,
  Database,
  Sparkles,
  Sliders,
} from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'daily', label: 'Daily MIS', icon: Calendar },
  { id: 'sales', label: 'Sales MIS', icon: TrendingUp },
  { id: 'purchase', label: 'Purchase MIS', icon: ShoppingBag },
  { id: 'inventory', label: 'Inventory MIS', icon: Package },
  { id: 'finance', label: 'Finance MIS', icon: DollarSign },
  { id: 'hr', label: 'HR MIS', icon: Users },
  { id: 'target', label: 'Target vs Actual', icon: Target },
  { id: 'reconciliation', label: 'Reconciliation', icon: GitCompare },
  { id: 'validation', label: 'Data Validation', icon: ShieldCheck },
  { id: 'exceptions', label: 'Exceptions', icon: AlertCircle },
  { id: 'builder', label: 'Report Builder', icon: FileText },
  { id: 'scheduled', label: 'Scheduled', icon: Clock },
  { id: 'master', label: 'Master Data', icon: Database },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'mapping', label: 'Data Mapping', icon: Sliders },
]

export default function MIS() {
  const { workbookId, filename, sheets } = useWorkbook()
  const [activeTab, setActiveTab] = useState('overview')

  const [filters, setFilters] = useState({
    department: 'All',
    region: 'All',
    product: 'All',
    category: 'All',
    salesperson: 'All',
    date_start: '',
    date_end: '',
  })
  const [filterOptions, setFilterOptions] = useState({})
  const [lastRefreshed, setLastRefreshed] = useState('Just now')

  useEffect(() => {
    if (workbookId) {
      getMisFilters(workbookId)
        .then((res) => setFilterOptions(res.options || {}))
        .catch((err) => console.error(err))
    }
  }, [workbookId])

  const handleFilterChange = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }))
  }

  const handleRefresh = async () => {
    if (!workbookId) return
    try {
      const res = await refreshMisData(workbookId)
      setLastRefreshed(new Date().toLocaleTimeString())
    } catch (err) {
      console.error(err)
    }
  }

  const handleGlobalExport = () => {
    exportToCSV(`MIS_Export_${activeTab}`, [
      { Tab: activeTab, Workbook: filename, ExportedAt: new Date().toISOString() },
    ])
  }

  if (!workbookId) {
    return (
      <div className="glass-panel p-12 text-center text-secondary text-sm space-y-3 max-w-xl mx-auto my-12">
        <p className="text-lg font-bold text-white">No Excel Workbook Loaded</p>
        <p>Please upload or select an Excel workbook to activate the Management Information System.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Global MIS Header & Filter Bar */}
      <MISFilterBar
        filters={filters}
        options={filterOptions}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
        onExport={handleGlobalExport}
        lastRefreshed={lastRefreshed}
        filename={filename}
      />

      {/* Internal Sub-Navigation Tabs */}
      <div className="border-b border-glass-border overflow-x-auto max-w-full">
        <div className="flex items-center gap-1 min-w-max pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                  isActive
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-transparent text-secondary hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Tab Workspace Content */}
      <div className="pt-2">
        {activeTab === 'overview' && <MISOverview workbookId={workbookId} filters={filters} />}
        {activeTab === 'daily' && <DailyMIS workbookId={workbookId} filters={filters} />}
        {activeTab === 'sales' && <SalesMIS workbookId={workbookId} filters={filters} />}
        {activeTab === 'purchase' && <PurchaseMIS workbookId={workbookId} filters={filters} onConfigureMapping={() => setActiveTab('mapping')} />}
        {activeTab === 'inventory' && <InventoryMIS workbookId={workbookId} filters={filters} />}
        {activeTab === 'finance' && <FinanceMIS workbookId={workbookId} filters={filters} />}
        {activeTab === 'hr' && <HRMIS workbookId={workbookId} />}
        {activeTab === 'target' && <TargetActual workbookId={workbookId} filters={filters} />}
        {activeTab === 'reconciliation' && <Reconciliation workbookId={workbookId} sheets={sheets} />}
        {activeTab === 'validation' && <DataValidation workbookId={workbookId} />}
        {activeTab === 'exceptions' && <ExceptionCenter workbookId={workbookId} />}
        {activeTab === 'builder' && <ReportBuilder workbookId={workbookId} />}
        {activeTab === 'scheduled' && <ScheduledReports workbookId={workbookId} />}
        {activeTab === 'master' && <MasterData workbookId={workbookId} />}
        {activeTab === 'ai' && <MISAssistant workbookId={workbookId} />}
        {activeTab === 'mapping' && <DataMappingView workbookId={workbookId} />}
      </div>
    </div>
  )
}
