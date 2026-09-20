/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--bg-default-rgb) / <alpha-value>)',
          sidebar: 'rgb(var(--bg-sidebar-rgb) / <alpha-value>)',
          card: 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          surface: 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          hover: 'var(--bg-table-hover)',
          input: 'rgb(var(--bg-input-rgb, var(--bg-card-rgb)) / <alpha-value>)',
        },
        borderline: 'rgb(var(--borderline-rgb) / <alpha-value>)',
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        ai: 'rgb(var(--ai-rgb, 139 92 246) / <alpha-value>)',
        positive: 'rgb(var(--positive-rgb) / <alpha-value>)',
        success: 'rgb(var(--positive-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        negative: 'rgb(var(--negative-rgb) / <alpha-value>)',
        danger: 'rgb(var(--negative-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        secondary: '#CBD5E1',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        subtle: 'var(--subtle)',
        'glass-border': 'rgba(255, 255, 255, 0.10)',
        'glass-surface': 'rgba(255, 255, 255, 0.05)',
      },
      borderRadius: {
        card: '12px',
        xl: '12px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 30px rgba(0, 0, 0, 0.18)',
        glow: '0 0 0 1px rgba(91, 124, 255, 0.35), 0 8px 30px rgba(91, 124, 255, 0.15)',
        ai: '0 0 0 1px rgba(139, 92, 246, 0.35), 0 8px 30px rgba(139, 92, 246, 0.15)',
      },
    },
  },
  plugins: [],
}
