import { WizResponse, BulbCommandParams, Shortcut } from './types'

interface Setting {
  id: string
  runOnStartup?: boolean
  [key: string]: unknown
}

interface StoredShortcut extends Shortcut {
  id: string
}

declare global {
  type RGBColor = import('./types').RGBColor
  type BulbState = import('./types').BulbState
  type BulbEntry = import('./types').BulbEntry
  type SavedStatus = import('./types').SavedStatus

  interface Window {
    windowControls: {
      minimize: () => void
      close: () => void
    }
    audioCapture: {
      getDesktopSources: () => Promise<Array<{ id: string; name: string }>>
    }
    updateUi: {
      onUpdatedBulbs: (callback: (value: boolean) => void) => void
    }
    bulbNetworking: {
      setBulb: (ip: string, state: boolean) => Promise<void>
      setStatus: (ip: string, status: BulbCommandParams) => Promise<void>
      changeColor: (ip: string, color: RGBColor, dimming: number) => Promise<void>
      setTemp: (ip: string, temp: number, dimming: number) => Promise<void>
      setScene: (ip: string, sceneId: number, speed: number, dimming: number) => Promise<void>
      startDiscovery: () => void
      onBulbDiscovered: (callback: (bulb: { ip: string; name?: string } & WizResponse) => void) => void
    }
    dataProcessing: {
      addStatus: (data: Record<string, unknown>) => Promise<void>
      getStatus: () => Promise<SavedStatus[]>
      editStatus: (id: string, data: Record<string, unknown>) => Promise<void>
      removeStatus: (id: string) => Promise<void>
      getStoredBulbs: () => Promise<BulbEntry[]>
      addOrEditStoredBulbs: (data: Record<string, unknown>) => Promise<void>
      removeStoredBulbs: (mac: string) => Promise<void>
      getSettings: () => Promise<Setting[]>
      addOrEditSetting: (id: string, data: Record<string, unknown>) => Promise<void>
      getShortcuts: () => Promise<StoredShortcut[]>
      addShortcut: (data: Record<string, unknown>) => Promise<void>
      editShortcut: (id: string, data: Record<string, unknown>) => Promise<void>
      removeShortcut: (id: string) => Promise<void>
    }
  }
}
