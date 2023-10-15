const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bulbNetworking', {
  setBulb: (ip: number, state: boolean) => ipcRenderer.invoke('setBulb', ip, state),
  changeColor: (ip: number, color: RGBColor, dimming: number) => ipcRenderer.invoke('changeColor', ip, color, dimming),
  setTemp: (ip: number, temp: number, dimming: number) => ipcRenderer.invoke('setTemp', ip, temp, dimming),
  setScene: (ip: number, sceneId: number, speed: number, dimming: number) => ipcRenderer.invoke('setScene',ip, sceneId, speed, dimming),
  getBulbs: () => ipcRenderer.invoke('getBulbs')
})
