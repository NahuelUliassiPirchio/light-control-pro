import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

export type SettingPayloadMap = {
  startup: { runOnStartup: boolean }
  openOnStartup: { openOnStartup: boolean }
}

export type SettingId = keyof SettingPayloadMap

export interface AppSettings {
  runOnStartup: boolean
  openOnStartup: boolean
}

type RawSetting = { id: string } & Record<string, unknown>

const DEFAULTS: AppSettings = {
  runOnStartup: true,
  openOnStartup: true,
}

let _filePath = ''
let _cache: AppSettings | null = null

export function initSettings(userDataPath: string): void {
  _filePath = path.join(userDataPath, 'settings.json')
  _cache = null
}

function loadCache(): AppSettings {
  if (_cache) return _cache

  if (!existsSync(_filePath)) {
    _cache = { ...DEFAULTS }
    return _cache
  }

  try {
    const raw: RawSetting[] = JSON.parse(readFileSync(_filePath, 'utf-8'))
    const startup = raw.find(s => s.id === 'startup')
    const openEntry = raw.find(s => s.id === 'openOnStartup')
    _cache = {
      runOnStartup: typeof startup?.runOnStartup === 'boolean' ? startup.runOnStartup : DEFAULTS.runOnStartup,
      openOnStartup: typeof openEntry?.openOnStartup === 'boolean' ? openEntry.openOnStartup : DEFAULTS.openOnStartup,
    }
  } catch {
    _cache = { ...DEFAULTS }
  }

  return _cache
}

function persist(): void {
  if (!_cache || !_filePath) return
  const raw: RawSetting[] = [
    { id: 'startup', runOnStartup: _cache.runOnStartup },
    { id: 'openOnStartup', openOnStartup: _cache.openOnStartup },
  ]
  writeFileSync(_filePath, JSON.stringify(raw, null, 2), 'utf-8')
}

export function getSettings(): AppSettings {
  return loadCache()
}

export function updateSetting<K extends SettingId>(id: K, data: SettingPayloadMap[K]): void {
  loadCache()
  if (id === 'startup') {
    _cache!.runOnStartup = (data as SettingPayloadMap['startup']).runOnStartup
  } else if (id === 'openOnStartup') {
    _cache!.openOnStartup = (data as SettingPayloadMap['openOnStartup']).openOnStartup
  }
  persist()
}

// Returns the legacy array format the renderer expects via IPC
export function getSettingsRaw(): RawSetting[] {
  const s = loadCache()
  return [
    { id: 'startup', runOnStartup: s.runOnStartup },
    { id: 'openOnStartup', openOnStartup: s.openOnStartup },
  ]
}
