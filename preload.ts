const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bulbNetworking', {
  setBulb: (state: boolean) => ipcRenderer.invoke('setBulb', state),
  changeColor: (color: RGBColor, dimming: number) => ipcRenderer.invoke('changeColor', color, dimming),
  setTemp: (temp:number, dimming: number) => ipcRenderer.invoke('setTemp', temp, dimming),
  getBulbs: () => ipcRenderer.invoke('getBulbs')
})
