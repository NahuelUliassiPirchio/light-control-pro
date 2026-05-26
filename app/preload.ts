'use strict'
import { contextBridge, ipcRenderer } from 'electron'
import { RGBColor, WizResponse, BulbCommandParams } from '../types'

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close')
})

contextBridge.exposeInMainWorld('audioCapture', {
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources')
})

contextBridge.exposeInMainWorld('updateUi', {
  onUpdatedBulbs: (callback: (value: boolean) => void) => ipcRenderer.on('updatedBulbs', (_event, value) => callback(value))
})

contextBridge.exposeInMainWorld('bulbNetworking', {
  setBulb: (ip: string, state: boolean) => ipcRenderer.invoke('setBulb', ip, state),
  setStatus: (ip: string, status: BulbCommandParams) => ipcRenderer.invoke('setStatus', ip, status),
  changeColor: (ip: string, color: RGBColor, dimming: number) => ipcRenderer.invoke('changeColor', ip, color, dimming),
  setTemp: (ip: string, temp: number, dimming: number) => ipcRenderer.invoke('setTemp', ip, temp, dimming),
  setScene: (ip: string, sceneId: number, speed: number, dimming: number) => ipcRenderer.invoke('setScene', ip, sceneId, speed, dimming),
  startDiscovery: () => ipcRenderer.send('startDiscovery'),
  onBulbDiscovered: (callback: (bulb: { ip: string } & WizResponse) => void) => ipcRenderer.on('bulbDiscovered', (_event, arg) => callback(arg))
})

contextBridge.exposeInMainWorld('dataProcessing', {
  addStatus: (data: Record<string, unknown>) => ipcRenderer.invoke('addStatus', data),
  getStatus: () => ipcRenderer.invoke('getStatus'),
  editStatus: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('editStatus', id, data),
  removeStatus: (id: string) => ipcRenderer.invoke('removeStatus', id),

  getShortcuts: () => ipcRenderer.invoke('getShortcuts'),
  addShortcut: (data: Record<string, unknown>) => ipcRenderer.invoke('addShortcut', data),
  editShortcut: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('editShortcut', id, data),
  removeShortcut: (id: string) => ipcRenderer.invoke('removeShortcut', id),

  getSettings: () => ipcRenderer.invoke('getSettings'),
  addOrEditSetting: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('addOrEditSetting', id, data),

  getStoredBulbs: () => ipcRenderer.invoke('getStoredBulbs'),
  addOrEditStoredBulbs: (data: Record<string, unknown>) => ipcRenderer.invoke('addOrEditStoredBulbs', data),
  removeStoredBulbs: (mac: string) => ipcRenderer.invoke('removeStoredBulbs', mac)
})
