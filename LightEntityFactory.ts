import { Bulb } from './Bulb.js'
import { Room } from './Room.js'
import type { BulbEntry } from './types'

export class LightEntityFactory {
  static createBulb (entry: BulbEntry): Bulb {
    if (!entry.ip || !entry.mac) {
      throw new Error(`BulbEntry missing ip or mac: ${JSON.stringify(entry)}`)
    }
    return new Bulb(entry.ip, entry.mac, entry.name ?? 'Bulb')
  }

  static createRoom (entry: BulbEntry, bulbRegistry: Map<string, Bulb>): Room {
    if (!entry.mac) throw new Error('Room BulbEntry missing mac')
    const members = (entry.bulbs ?? [])
      .map(mac => bulbRegistry.get(mac))
      .filter((b): b is Bulb => b !== undefined)
    return new Room(entry.mac, entry.name ?? 'Room', members)
  }

  static hydrateAll (entries: BulbEntry[]): { bulbs: Map<string, Bulb>; rooms: Map<string, Room> } {
    const bulbs = new Map<string, Bulb>()
    const rooms = new Map<string, Room>()

    for (const entry of entries) {
      if (!entry.bulbs && entry.mac && entry.ip) {
        bulbs.set(entry.mac, LightEntityFactory.createBulb(entry))
      }
    }

    for (const entry of entries) {
      if (entry.bulbs && entry.mac) {
        rooms.set(entry.mac, LightEntityFactory.createRoom(entry, bulbs))
      }
    }

    return { bulbs, rooms }
  }
}
