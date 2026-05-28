import type { ILightEntity } from './ILightEntity'
import type { BulbState, BulbCommandParams } from './types'
import { Bulb } from './Bulb.js'

export class Room implements ILightEntity {
  private _mac: string
  private _name: string
  private _bulbs: Bulb[]

  constructor (mac: string, name: string, bulbs: Bulb[]) {
    this._mac = mac
    this._name = name
    this._bulbs = bulbs
  }

  getName (): string { return this._name }
  getId (): string { return this._mac }

  get mac (): string { return this._mac }

  getBulbs (): Bulb[] { return [...this._bulbs] }
  setBulbs (bulbs: Bulb[]): void { this._bulbs = bulbs }
  updateName (newName: string): void { this._name = newName }

  getState (): BulbState | null {
    const states = this._bulbs.map(b => b.getState()).filter((s): s is BulbState => s !== null)
    if (states.length === 0) return null
    const onStates = states.filter(s => s.state)
    const avgDimming = onStates.length > 0
      ? Math.round(onStates.reduce((sum, s) => sum + s.dimming, 0) / onStates.length)
      : states[0].dimming
    return {
      ...states[0],
      state: onStates.length > 0,
      dimming: avgDimming
    }
  }

  async turnOn (): Promise<void> {
    await this._fanOut(b => b.turnOn())
  }

  async turnOff (): Promise<void> {
    await this._fanOut(b => b.turnOff())
  }

  async setColor (r: number, g: number, b: number, dimming: number): Promise<void> {
    await this._fanOut(bulb => bulb.setColor(r, g, b, dimming))
  }

  async setTemperature (temp: number, dimming: number): Promise<void> {
    await this._fanOut(bulb => bulb.setTemperature(temp, dimming))
  }

  async setScene (sceneId: number, speed: number, dimming: number): Promise<void> {
    await this._fanOut(bulb => bulb.setScene(sceneId, speed, dimming))
  }

  async applyCommand (params: BulbCommandParams): Promise<void> {
    await this._fanOut(bulb => bulb.applyCommand(params))
  }

  async refreshState (): Promise<BulbState> {
    await this._fanOut(bulb => bulb.refreshState().then(() => undefined))
    return this.getState()!
  }

  private async _fanOut (op: (bulb: Bulb) => Promise<void>): Promise<void> {
    const results = await Promise.allSettled(this._bulbs.map(op))
    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length === results.length && results.length > 0) {
      throw new Error(`All bulbs in room "${this._name}" failed to respond`)
    }
    failed.forEach(f =>
      console.error(`Room "${this._name}" partial failure:`, (f as PromiseRejectedResult).reason)
    )
  }
}
