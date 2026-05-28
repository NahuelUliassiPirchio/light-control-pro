import type { BulbState, BulbCommandParams } from './types'

export interface ILightEntity {
  getName(): string
  getId(): string
  getState(): BulbState | null
  turnOn(): Promise<void>
  turnOff(): Promise<void>
  setColor(r: number, g: number, b: number, dimming: number): Promise<void>
  setTemperature(temp: number, dimming: number): Promise<void>
  setScene(sceneId: number, speed: number, dimming: number): Promise<void>
  applyCommand(params: BulbCommandParams): Promise<void>
  refreshState(): Promise<BulbState>
}
