/**
 * Centralized Chart Styling & Color Palette Utility
 * 
 * Provides professional palettes, dynamic series color assignment,
 * category coloring, gauge threshold evaluation, and validation.
 */

export const COLOR_PALETTES = {
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#3B82F6', '#06B6D4', '#14B8A6', '#22C55E', '#84CC16', '#EAB308'],
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    colors: ['#8B5CF6', '#6366F1', '#3B82F6', '#06B6D4', '#14B8A6', '#22C55E'],
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#F97316', '#EF4444', '#EC4899', '#A855F7', '#6366F1', '#3B82F6'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    colors: ['#2563EB', '#0F766E', '#475569', '#7C3AED', '#0891B2', '#059669'],
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel',
    colors: ['#93C5FD', '#A5B4FC', '#C4B5FD', '#F9A8D4', '#99F6E4', '#BBF7D0'],
  },
  monochrome: {
    id: 'monochrome',
    name: 'Monochrome',
    colors: ['#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B', '#475569', '#334155'],
  },
  high_contrast: {
    id: 'high_contrast',
    name: 'High Contrast',
    colors: ['#2563EB', '#DC2626', '#16A34A', '#CA8A04', '#9333EA', '#0891B2'],
  },
  ai_glass: {
    id: 'ai_glass',
    name: 'AI / Glass',
    colors: ['#60A5FA', '#A78BFA', '#34D399', '#FBBF24', '#FB7185', '#22D3EE'],
  },
}

export const DEFAULT_PALETTE_ID = 'ocean'

/**
 * Returns color palette array by ID, with fallback to default ocean palette.
 */
export function getPalette(paletteId = DEFAULT_PALETTE_ID) {
  const pal = COLOR_PALETTES[paletteId]
  return pal ? pal.colors : COLOR_PALETTES[DEFAULT_PALETTE_ID].colors
}

/**
 * Resolves color for a specific series or category index based on visual style settings.
 */
export function getSeriesColor(seriesName, index = 0, style = {}) {
  // If specific series color mapped:
  if (style?.seriesColors && style.seriesColors[seriesName]) {
    return style.seriesColors[seriesName]
  }

  // If single color mode:
  if (style?.colorMode === 'single' && style?.singleColor) {
    return style.singleColor
  }

  // Custom colors list if specified:
  if (style?.colorMode === 'custom' && Array.isArray(style?.colors) && style.colors.length > 0) {
    return style.colors[index % style.colors.length]
  }

  // Palette mode (default):
  const palette = getPalette(style?.palette)
  return palette[index % palette.length]
}

/**
 * Resolves category slice / item color.
 */
export function getCategoryColor(categoryName, index = 0, style = {}) {
  if (style?.categoryColors && style.categoryColors[categoryName]) {
    return style.categoryColors[categoryName]
  }
  return getSeriesColor(categoryName, index, style)
}

/**
 * Resolves gauge progress color based on value and configurable thresholds.
 */
export function getGaugeColor(value, style = {}) {
  if (style?.gaugeMode === 'thresholds') {
    const warning = style.warningThreshold ?? 50
    const good = style.goodThreshold ?? 80
    if (value >= good) return '#10B981' // Green
    if (value >= warning) return '#F59E0B' // Amber
    return '#EF4444' // Red
  }
  return style?.singleColor || getPalette(style?.palette)[0]
}

/**
 * Default safe style object for any new visual.
 */
export function getDefaultStyle(visualType = 'bar') {
  return {
    colorMode: 'palette', // 'palette' | 'single' | 'custom' | 'series' | 'category'
    palette: DEFAULT_PALETTE_ID,
    singleColor: COLOR_PALETTES.ocean.colors[0],
    colors: [...COLOR_PALETTES.ocean.colors],
    seriesColors: {},
    categoryColors: {},
    gaugeMode: 'single', // 'single' | 'thresholds'
    warningThreshold: 50,
    goodThreshold: 80,
  }
}
