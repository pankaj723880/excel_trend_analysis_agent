import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  getAnomalies,
  getCorrelations,
  getEda,
  getSheetDetail,
  getTrends,
  getWorkbookOverview,
  getWorkbookSheets,
  listWorkbooks,
  uploadWorkbook,
} from '../services/api'
import { loadSavedSettings } from '../constants/settings'

const WorkbookContext = createContext(null)

// Analysis stages shown during upload → analysis
export const ANALYSIS_STAGES = [
  'Uploading',
  'Reading workbook',
  'Analyzing sheets',
  'Running EDA',
  'Detecting trends',
  'Detecting anomalies',
  'Generating insights',
]

export function WorkbookProvider({ children }) {
  const [workbookId, setWorkbookId] = useState(() => localStorage.getItem('excel_wb_id') || null)
  const [filename, setFilename] = useState(() => localStorage.getItem('excel_wb_filename') || null)
  const [overview, setOverview] = useState(null)
  const [sheets, setSheets] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [sheetDetail, setSheetDetail] = useState(null)
  const [edaData, setEdaData] = useState(null)
  const [trendsData, setTrendsData] = useState(null)
  const [anomaliesData, setAnomaliesData] = useState(null)
  const [correlationsData, setCorrelationsData] = useState(null)
  const [selectedMetric, setSelectedMetric] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [loading, setLoading] = useState(false)
  const [analysisStage, setAnalysisStage] = useState(0)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('excel_sidebar_collapsed') === 'true'
  })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('excel_sidebar_collapsed', String(next))
      return next
    })
  }, [])
  const [aiReports, setAiReports] = useState(() => {
    try {
      const stored = localStorage.getItem('excel_ai_reports')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const [chatMessages, setChatMessages] = useState(() => {
    try {
      const stored = localStorage.getItem('excel_chat_messages')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const setWorkbookAiReport = useCallback((id, report) => {
    if (!id) return
    setAiReports((prev) => {
      const updated = { ...prev, [id]: report }
      try {
        localStorage.setItem('excel_ai_reports', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  const setWorkbookChatMessages = useCallback((id, updater) => {
    if (!id) return
    setChatMessages((prev) => {
      const currentMsgs = prev[id] || []
      const nextMsgs = typeof updater === 'function' ? updater(currentMsgs) : updater
      const updated = { ...prev, [id]: nextMsgs }
      try {
        localStorage.setItem('excel_chat_messages', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  const persist = (id, name) => {
    localStorage.setItem('excel_wb_id', id || '')
    localStorage.setItem('excel_wb_filename', name || '')
  }

  const refreshAll = useCallback(async (id) => {
    if (!id) return null
    setLoading(true)
    setError(null)
    try {
      // 1. Mandatory core workbook metadata
      const [overviewData, sheetsData] = await Promise.all([
        getWorkbookOverview(id),
        getWorkbookSheets(id),
      ])

      setOverview(overviewData)
      const validSheets = sheetsData.sheets || []
      setSheets(validSheets)

      const validSheetNames = validSheets.map((s) => s.name)
      const firstSheet = validSheetNames[0] || ''
      let activeSheet = firstSheet
      setSelectedSheet((current) => {
        if (current && validSheetNames.includes(current)) {
          activeSheet = current
          return current
        }
        activeSheet = firstSheet
        return firstSheet
      })

      const shouldProfile = loadSavedSettings().autoProfile !== false
      if (activeSheet && shouldProfile) {
        getSheetDetail(id, activeSheet).then((detail) => setSheetDetail(detail)).catch(() => {})
      }

      // 2. Secondary analytical checks with Promise.allSettled isolation
      const [edaRes, trendsRes, anomaliesRes, correlationsRes] = await Promise.allSettled([
        getEda(id),
        getTrends(id),
        getAnomalies(id),
        getCorrelations(id),
      ])

      setEdaData(edaRes.status === 'fulfilled' ? edaRes.value?.eda || {} : {})
      setTrendsData(trendsRes.status === 'fulfilled' ? trendsRes.value || {} : {})
      setAnomaliesData(anomaliesRes.status === 'fulfilled' ? anomaliesRes.value?.anomalies || {} : {})
      setCorrelationsData(correlationsRes.status === 'fulfilled' ? correlationsRes.value?.correlations || {} : {})

      return { overview: overviewData, sheets: sheetsData.sheets }
    } catch (err) {
      const status = err?.response?.status
      if (status === 404) {
        setWorkbookId(null)
        setFilename(null)
        setOverview(null)
        setSheets([])
        setSelectedSheet('')
        setAnalysis(null)
        setSheetDetail(null)
        setEdaData(null)
        setTrendsData(null)
        setAnomaliesData(null)
        setCorrelationsData(null)
        persist(null, null)
        setAnalysisStage(0)
      }
      setError(err?.response?.data?.detail || err.message || 'Could not load analysis')
      return null
    } finally {
      setAnalysisStage(0)
      setLoading(false)
    }
  }, [])

  // Restore session on mount ONLY if an existing workbook was previously active
  useEffect(() => {
    if (workbookId) {
      refreshAll(workbookId)
    } else {
      // If no workbook is stored, ensure everything is clean null
      persist(null, null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpload = useCallback(
    async (file) => {
      setLoading(true)
      setError(null)
      setUploadProgress(10)
      setAnalysisStage(0)

      let interval = null

      try {
        // Smoothly advance stage indicator while backend processes
        interval = setInterval(() => {
          setAnalysisStage((prev) => Math.min(ANALYSIS_STAGES.length - 2, prev + 1))
          setUploadProgress((prev) => Math.min(95, prev + 15))
        }, 600)

        const result = await uploadWorkbook(file, (percent) => {
          setUploadProgress(Math.max(10, percent))
        })

        if (interval) clearInterval(interval)

        const id = result.workbook_id
        const name = result.filename
        setSelectedSheet('')
        setWorkbookId(id)
        setFilename(name)
        persist(id, name)

        setAnalysisStage(ANALYSIS_STAGES.length - 1)
        setUploadProgress(100)

        await refreshAll(id)
        return result
      } catch (err) {
        if (interval) clearInterval(interval)
        setError(err?.response?.data?.detail || err.message || 'Upload failed')
        return null
      } finally {
        if (interval) clearInterval(interval)
        setAnalysisStage(0)
        setUploadProgress(0)
        setLoading(false)
      }
    },
    [refreshAll]
  )

  const loadSheetDetail = useCallback(
    async (sheetName) => {
      if (!workbookId || !sheetName) return null
      try {
        const detail = await getSheetDetail(workbookId, sheetName)
        setSheetDetail(detail)
        return detail
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
        return null
      }
    },
    [workbookId]
  )

  const reset = useCallback(() => {
    setWorkbookId(null)
    setFilename(null)
    setOverview(null)
    setSheets([])
    setSelectedSheet('')
    setAnalysis(null)
    setSheetDetail(null)
    setEdaData(null)
    setTrendsData(null)
    setAnomaliesData(null)
    setCorrelationsData(null)
    setSelectedMetric('')
    setError(null)
    persist(null, null)
  }, [])

  const selectSheet = useCallback(
    (name) => {
      setSelectedSheet(name)
      const shouldProfile = loadSavedSettings().autoProfile !== false
      if (shouldProfile) {
        loadSheetDetail(name)
      }
    },
    [loadSheetDetail]
  )

  const switchWorkbook = useCallback(
    async (newId, newName) => {
      if (!newId) return
      setWorkbookId(newId)
      setFilename(newName || 'workbook.xlsx')
      persist(newId, newName || 'workbook.xlsx')
      setSelectedSheet('')
      return refreshAll(newId)
    },
    [refreshAll]
  )


  const value = {
    workbookId,
    filename,
    overview,
    sheets,
    selectedSheet,
    selectSheet,
    analysis,
    sheetDetail,
    edaData,
    trendsData,
    anomaliesData,
    correlationsData,
    selectedMetric,
    setSelectedMetric,
    selectedPeriod,
    setSelectedPeriod,
    loading,
    analysisStage,
    uploadProgress,
    error,
    setError,
    handleUpload,
    refreshAll,
    loadSheetDetail,
    reset,
    switchWorkbook,
    aiReports,
    setWorkbookAiReport,
    chatMessages,
    setWorkbookChatMessages,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
  }

  return <WorkbookContext.Provider value={value}>{children}</WorkbookContext.Provider>
}

export function useWorkbook() {
  const context = useContext(WorkbookContext)
  if (!context) {
    throw new Error('useWorkbook must be used within WorkbookProvider')
  }
  return context
}
