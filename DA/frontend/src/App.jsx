import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Cleaning from './pages/Cleaning'
import EDA from './pages/EDA'
import Trends from './pages/Trends'
import Anomalies from './pages/Anomalies'
import Correlations from './pages/Correlations'
import AIAnalyst from './pages/AIAnalyst'
import AskData from './pages/AskData'
import Downloads from './pages/Downloads'
import MIS from './pages/MIS'
import DataExplorer from './pages/DataExplorer'
import DataQuality from './pages/DataQuality'
import KPIAnalysis from './pages/KPIAnalysis'
import AIReports from './pages/AIReports'
import History from './pages/History'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/upload" element={<Upload />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/mis" element={<MIS />} />
        <Route path="/cleaning" element={<Cleaning />} />
        <Route path="/explorer" element={<DataExplorer />} />
        <Route path="/eda" element={<EDA />} />
        <Route path="/quality" element={<DataQuality />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/anomalies" element={<Anomalies />} />
        <Route path="/correlations" element={<Correlations />} />
        <Route path="/kpis" element={<KPIAnalysis />} />
        <Route path="/ai-analyst" element={<AIAnalyst />} />
        <Route path="/ask-data" element={<AskData />} />
        <Route path="/ai-reports" element={<AIReports />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
