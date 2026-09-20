import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import LoadingOverlay from './LoadingOverlay'
import AuroraDataWave from './AuroraDataWave'
import { useWorkbook } from '../context/WorkbookContext'

export default function Layout() {
  const { loading, analysisStage, sidebarCollapsed } = useWorkbook()
  const showOverlay = loading && analysisStage > 0

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#060913] text-ink flex relative">
      {/* Futuristic Aurora Data Wave Canvas Background */}
      <AuroraDataWave />

      {showOverlay && <LoadingOverlay label="Running analysis pipeline…" />}
      <Sidebar />
      <div 
        className={`flex-1 min-w-0 max-w-full min-h-screen flex flex-col transition-all duration-300 ease-in-out relative z-10 ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        <Header />
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 max-w-full mx-auto w-full box-border">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
