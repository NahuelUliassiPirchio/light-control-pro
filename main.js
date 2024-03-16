const { handleChangeColor, handleGetBulbs, handleSetBulb, handleSetScene, handleSetTemp } = require('./bulbController.js')
const { BrowserWindow, app, ipcMain } = require('electron')
const path = require('path')

const createWindow = () => {
  const window = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, './app/preload.js')
    }
  })

  window.loadFile('./app/index.html')
  // window.webContents.openDevTools()
}

app.whenReady().then(() => {
  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.handle('getBulbs', handleGetBulbs)
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
  ipcMain.handle('setScene', handleSetScene)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
