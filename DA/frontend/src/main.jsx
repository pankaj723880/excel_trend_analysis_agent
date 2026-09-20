import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { WorkbookProvider } from './context/WorkbookContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <WorkbookProvider>
          <App />
        </WorkbookProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
