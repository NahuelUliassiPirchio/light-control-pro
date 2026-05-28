import { EventEmitter } from 'events'
import { sendCommandToBulb, validateWizResponse } from './bulbController.js'
import type { ILightEntity } from './ILightEntity'
import type { BulbState, BulbCommandParams, WizResponse } from './types'

interface PilotParams {
  state?: boolean
  dimming?: number
  r?: number
  g?: number
  b?: number
  temp?: number
  sceneId?: number
  speed?: number
}

function clamp (value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export class Bulb extends EventEmitter implements ILightEntity {
  private _ip: string
  private _mac: string
  private _name: string
  private _state: BulbState | null = null

  constructor (ip: string, mac: string, name: string) {
    super()
    this._ip = ip
    this._mac = mac
    this._name = name
  }

  getName (): string { return this._name }
  getId (): string { return this._mac }
  getState (): BulbState | null { return this._state }

  get ip (): string { return this._ip }
  get mac (): string { return this._mac }

  updateIp (newIp: string): void { this._ip = newIp }
  updateName (newName: string): void { this._name = newName }

  async turnOn (): Promise<void> {
    await this.applyCommand({ state: true })
  }

  async turnOff (): Promise<void> {
    await this.applyCommand({ state: false })
  }

  async setColor (r: number, g: number, b: number, dimming: number): Promise<void> {
    await this.applyCommand({ r, g, b, dimming })
  }

  async setTemperature (temp: number, dimming: number): Promise<void> {
    await this.applyCommand({ temp, dimming })
  }

  async setScene (sceneId: number, speed: number, dimming: number): Promise<void> {
    await this.applyCommand({ sceneId, speed, dimming })
  }

  async applyCommand (params: BulbCommandParams): Promise<void> {
    const pilot = this._buildPilotParams(params)
    const message = JSON.stringify({ method: 'setPilot', params: pilot })
    const response = await sendCommandToBulb(this._ip, message)
    const parsed: WizResponse = validateWizResponse(JSON.parse(response))
    if (parsed.result) {
      this._state = { ...this._state, ...parsed.result } as BulbState
    }
    this.emit('stateChanged', this._state)
  }

  async refreshState (): Promise<BulbState> {
    const message = '{"method":"getPilot","params":{}}'
    const response = await sendCommandToBulb(this._ip, message)
    const parsed: WizResponse = validateWizResponse(JSON.parse(response))
    this._state = parsed.result
    this.emit('stateChanged', this._state)
    return this._state
  }

  toEntry (): { ip: string; mac: string; name: string } {
    return { ip: this._ip, mac: this._mac, name: this._name }
  }

  private _buildPilotParams (params: BulbCommandParams): PilotParams {
    const pilot: PilotParams = {}

    if (params.state !== undefined) {
      pilot.state = params.state
    }

    if (params.dimming !== undefined) {
      pilot.dimming = clamp(Math.round(Number(params.dimming)), 10, 100)
    }

    if (params.r !== undefined && params.g !== undefined && params.b !== undefined) {
      pilot.r = clamp(Math.round(params.r), 0, 255)
      pilot.g = clamp(Math.round(params.g), 0, 255)
      pilot.b = clamp(Math.round(params.b), 0, 255)
    }

    if (params.temp !== undefined) {
      pilot.temp = clamp(Math.round(Number(params.temp)), 2200, 6500)
    }

    const sceneId = params.sceneId !== undefined ? Number(params.sceneId) : undefined
    if (sceneId !== undefined && !Number.isNaN(sceneId) && sceneId !== 0) {
      pilot.sceneId = sceneId
      const speed = params.sceneSpeed ?? params.speed
      if (speed !== undefined) {
        pilot.speed = Number(speed)
      }
    }

    return pilot
  }
}
