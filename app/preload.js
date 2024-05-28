'use strict'
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('bulbNetworking', {
  setBulb: (ip, state) => ipcRenderer.invoke('setBulb', ip, state),
  setStatus: (ip, status) => ipcRenderer.invoke('setStatus', ip, status),
  changeColor: (ip, color, dimming) => ipcRenderer.invoke('changeColor', ip, color, dimming),
  setTemp: (ip, temp, dimming) => ipcRenderer.invoke('setTemp', ip, temp, dimming),
  setScene: (ip, sceneId, speed, dimming) => ipcRenderer.invoke('setScene', ip, sceneId, speed, dimming),
  startDiscovery: () => ipcRenderer.send('startDiscovery'),
  onBulbDiscovered: (callback) => ipcRenderer.on('bulbDiscovered', (event, arg) => callback(arg))
})

contextBridge.exposeInMainWorld('dataProcessing', {
  addStatus: (data) => ipcRenderer.invoke('addStatus', data),
  getStatus: () => ipcRenderer.invoke('getStatus'),
  editStatus: (id, data) => ipcRenderer.invoke('editStatus', id, data),
  removeStatus: (id) => ipcRenderer.invoke('removeStatus', id),

  getShortcuts: () => ipcRenderer.invoke('getShortcuts'),
  addShortcut: (data) => ipcRenderer.invoke('addShortcut', data),
  editShortcut: (id, data) => ipcRenderer.invoke('editShortcut', id, data),
  removeShortcut: (id) => ipcRenderer.invoke('removeShortcut', id),

  getSettings: () => ipcRenderer.invoke('getSettings'),
  addOrEditSetting: (id, data) => ipcRenderer.invoke('addOrEditSetting', id, data),

  getStoredBulbs: () => ipcRenderer.invoke('getStoredBulbs'),
  addOrEditStoredBulbs: (data) => ipcRenderer.invoke('addOrEditStoredBulbs', data),
  removeStoredBulbs: (mac) => ipcRenderer.invoke('removeStoredBulbs', mac)
})
