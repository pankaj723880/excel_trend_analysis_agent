import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // 'light' | 'dark'
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('excel_theme_mode')
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    localStorage.setItem('excel_theme_mode', themeMode)
    const root = document.documentElement
    const body = document.body

    if (themeMode === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
      body.classList.add('light')
      body.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
      body.setAttribute('data-theme', 'light')
    } else {
      root.classList.add('dark')
      root.classList.remove('light')
      body.classList.add('dark')
      body.classList.remove('light')
      root.setAttribute('data-theme', 'dark')
      body.setAttribute('data-theme', 'dark')
    }
  }, [themeMode])

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, resolvedTheme: themeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
