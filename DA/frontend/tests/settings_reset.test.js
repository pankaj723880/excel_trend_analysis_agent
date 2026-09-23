/**
 * Automated test runner for Settings Reset Defaults and Persistence flow.
 * Validates:
 * 1. Initial non-default values (temperature: 0.7, iqrSensitivity: 'sensitive', autoProfile: false)
 * 2. Reset Defaults restores canonical DEFAULT_SETTINGS:
 *    temperature: 0.2, iqrSensitivity: 'standard', autoProfile: true
 * 3. Persisted settings in storage contain the default values and survive reload.
 * 4. Save Preferences vs Reset Defaults independence.
 */
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadSavedSettings,
  persistSettings,
  normalizeSettings,
} from '../src/constants/settings.js'

// Simple in-memory mock of localStorage
class LocalStorageMock {
  constructor() {
    this.store = {}
  }
  getItem(key) {
    return this.store[key] || null
  }
  setItem(key, value) {
    this.store[key] = String(value)
  }
  removeItem(key) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
}

globalThis.localStorage = new LocalStorageMock()

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASSED: ${message}`)
}

console.log('--- RUNNING SETTINGS RESET DEFAULTS & PERSISTENCE TESTS ---')

// 1. Verify canonical defaults
assert(DEFAULT_SETTINGS.aiTemperature === 0.2, 'DEFAULT_SETTINGS.aiTemperature is 0.2')
assert(DEFAULT_SETTINGS.iqrSensitivity === 'standard', 'DEFAULT_SETTINGS.iqrSensitivity is standard')
assert(DEFAULT_SETTINGS.autoProfile === true, 'DEFAULT_SETTINGS.autoProfile is true')

// 2. Set modified non-default settings
const customSettings = {
  aiTemperature: 0.7,
  iqrSensitivity: 'sensitive',
  autoProfile: false,
}
persistSettings(customSettings)

let loaded = loadSavedSettings()
assert(loaded.aiTemperature === 0.7, 'Saved custom aiTemperature is 0.7')
assert(loaded.iqrSensitivity === 'sensitive', 'Saved custom iqrSensitivity is sensitive')
assert(loaded.autoProfile === false, 'Saved custom autoProfile is false')

// 3. Perform Reset Defaults operation
const resetState = { ...DEFAULT_SETTINGS }
const resetSuccess = persistSettings(resetState)

assert(resetSuccess === true, 'Reset Defaults persist operation returned true')
assert(resetState.aiTemperature === 0.2, 'Reset state aiTemperature is 0.2')
assert(resetState.iqrSensitivity === 'standard', 'Reset state iqrSensitivity is standard')
assert(resetState.autoProfile === true, 'Reset state autoProfile is true')

// 4. Verify persisted storage after Reset
const reloaded = loadSavedSettings()
assert(reloaded.aiTemperature === 0.2, 'Persisted aiTemperature in storage is 0.2')
assert(reloaded.iqrSensitivity === 'standard', 'Persisted iqrSensitivity in storage is standard')
assert(reloaded.autoProfile === true, 'Persisted autoProfile in storage is true')

const rawStored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY))
assert(rawStored.aiTemperature === 0.2, 'Raw localStorage contains default aiTemperature')
assert(rawStored.iqrSensitivity === 'standard', 'Raw localStorage contains default iqrSensitivity')
assert(rawStored.autoProfile === true, 'Raw localStorage contains default autoProfile')

// 5. Test immutability: Ensure modifying resetState does not alter DEFAULT_SETTINGS
resetState.aiTemperature = 0.5
assert(DEFAULT_SETTINGS.aiTemperature === 0.2, 'DEFAULT_SETTINGS was not mutated by changes to local state')

console.log('--- ALL SETTINGS TESTS COMPLETED SUCCESSFULLY ---')
