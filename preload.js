const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bulbNetworking', {
  setBulb: (state) => ipcRenderer.invoke('setBulb', state),
  changeColor: (color, dimming) => ipcRenderer.invoke('changeColor', color, dimming),
  setTemp: (temp, dimming) => ipcRenderer.invoke('setTemp', temp, dimming),
  getBulbs: () => ipcRenderer.invoke('getBulbs')
})
