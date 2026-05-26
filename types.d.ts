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
  dimming: number
  rssi: number
  sceneId: number
  src: string
  state: boolean
  w: number
}

export interface WizResponse {
  env: string
  method: string
  result: BulbState
}
