'use strict'
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('bulbNetworking', {
  setBulb: (ip, state) => ipcRenderer.invoke('setBulb', ip, state),
  changeColor: (ip, color, dimming) => ipcRenderer.invoke('changeColor', ip, color, dimming),
  setTemp: (ip, temp, dimming) => ipcRenderer.invoke('setTemp', ip, temp, dimming),
  setScene: (ip, sceneId, speed, dimming) => ipcRenderer.invoke('setScene', ip, sceneId, speed, dimming),
  getBulbs: () => ipcRenderer.invoke('getBulbs')
})
