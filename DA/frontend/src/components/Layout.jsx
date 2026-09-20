import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import LoadingOverlay from './LoadingOverlay'
import { useWorkbook } from '../context/WorkbookContext'

export default function Layout() {
  const { loading, analysisStage, sidebarCollapsed } = useWorkbook()
  const showOverlay = loading && analysisStage > 0

  return (
    <div className="min-h-screen bg-[#070B14] text-ink flex">
      {showOverlay && <LoadingOverlay label="Running analysis pipeline…" />}
      <Sidebar />
      <div 
        className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        <Header />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1520px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
