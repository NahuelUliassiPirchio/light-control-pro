const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bulbNetworking', {
  setBulb: (state) => ipcRenderer.invoke('setBulb', state)
})
