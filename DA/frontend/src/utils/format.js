export function formatNumber(value, maxDecimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const num = Number(value)
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxDecimals,
  }).format(num)
}

export function formatCompact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value))
}

export function formatFileSize(bytes) {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  let value = Number(bytes)
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatPercent(value, maxDecimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${formatNumber(value, maxDecimals)}%`
}

export function trendColor(direction) {
  const d = String(direction || '').toLowerCase()
  if (d.includes('up')) return '#22C55E'
  if (d.includes('down')) return '#EF4444'
  if (d.includes('volatile')) return '#F59E0B'
  return '#94A3B8'
}

export function scoreColor(score) {
  const value = Number(score) || 0
  if (value > 20) return '#22C55E'
  if (value < -20) return '#EF4444'
  return '#F59E0B'
}

export function severityColor(severity) {
  const s = String(severity || '').toLowerCase()
  if (s === 'critical') return '#EF4444'
  if (s === 'high') return '#F97316'
  if (s === 'medium') return '#F59E0B'
  return '#94A3B8'
}

export function confidenceColor(confidence) {
  const c = String(confidence || '').toLowerCase()
  if (c === 'high') return '#22C55E'
  if (c === 'medium') return '#F59E0B'
  return '#94A3B8'
}
