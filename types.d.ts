export interface RGBColor {
  r: number
  g: number
  b: number
}

export interface BulbState {
  mac: string
  r: number
  g: number
  b: number
  c: number
  w: number
  dimming: number
  rssi: number
  sceneId: number
  src: string
  state: boolean
  temp?: number
  speed?: number
  success?: boolean
  errorCode?: number
}

export interface WizResponse {
  env?: string
  method: string
  result: BulbState
}

export interface BulbCommandParams {
  state?: boolean
  dimming?: number
  r?: number
  g?: number
  b?: number
  temp?: number
  sceneId?: number
  sceneSpeed?: number
  speed?: number
}

export interface SetBulbOptions {
  skipUiRefresh?: boolean
}

export interface BulbEntry {
  ip?: string
  mac?: string
  name?: string
  bulbs?: string[]
  [key: string]: unknown
}

export interface SavedStatus extends BulbCommandParams {
  id?: string
  name?: string
  targetName?: string
  targetType?: string
  bulbs?: Array<BulbEntry & { state?: boolean }>
  ip?: string
  [key: string]: unknown
}

export interface Shortcut {
  statusId: string
  pressedKeys: string[]
  [key: string]: unknown
}
