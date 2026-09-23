/**
 * Canonical default workspace and calculation settings.
 * Single source of truth across the entire application.
 */
export const DEFAULT_SETTINGS = {
  aiTemperature: 0.2,
  iqrSensitivity: 'standard',
  autoProfile: true,
}

export const SETTINGS_STORAGE_KEY = 'excel_workspace_settings'

/**
 * Maps select box / threshold values to their display names.
 */
export const IQR_SENSITIVITY_OPTIONS = [
  { value: 'standard', label: 'Standard (1.5x IQR - Moderate)', multiplier: 1.5 },
  { value: 'strict', label: 'Strict (3.0x IQR - Extreme Only)', multiplier: 3.0 },
  { value: 'sensitive', label: 'High Sensitivity (1.0x IQR - Wide Filter)', multiplier: 1.0 },
]

/**
 * Normalizes input settings and falls back to canonical defaults.
 */
export function normalizeSettings(input) {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SETTINGS }
  }

  // Handle iqrSensitivity / legacy anomalyThreshold mapping
  let iqrSensitivity = input.iqrSensitivity
  if (!iqrSensitivity && input.anomalyThreshold) {
    if (String(input.anomalyThreshold) === '3.0') iqrSensitivity = 'strict'
    else if (String(input.anomalyThreshold) === '1.0') iqrSensitivity = 'sensitive'
    else iqrSensitivity = 'standard'
  }
  if (!['standard', 'strict', 'sensitive'].includes(iqrSensitivity)) {
    iqrSensitivity = DEFAULT_SETTINGS.iqrSensitivity
  }

  // Handle aiTemperature / modelTemp
  let aiTemperature = typeof input.aiTemperature === 'number'
    ? input.aiTemperature
    : typeof input.modelTemp === 'number'
      ? input.modelTemp
      : DEFAULT_SETTINGS.aiTemperature
  if (isNaN(aiTemperature) || aiTemperature < 0 || aiTemperature > 1) {
    aiTemperature = DEFAULT_SETTINGS.aiTemperature
  }

  // Handle autoProfile
  const autoProfile = typeof input.autoProfile === 'boolean'
    ? input.autoProfile
    : DEFAULT_SETTINGS.autoProfile

  return {
    aiTemperature: Math.round(aiTemperature * 100) / 100,
    iqrSensitivity,
    autoProfile,
  }
}

/**
 * Load settings from storage.
 */
export function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return normalizeSettings(JSON.parse(raw))
  } catch (err) {
    console.warn('Failed to parse saved settings, using canonical defaults:', err)
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Save settings to storage.
 */
export function persistSettings(settings) {
  try {
    const normalized = normalizeSettings(settings)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
    return true
  } catch (err) {
    console.error('Failed to persist settings to localStorage:', err)
    return false
  }
}
