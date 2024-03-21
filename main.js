const { BrowserWindow, app, ipcMain, Menu } = require('electron')
const { handleChangeColor, handleGetBulbs, handleSetBulb, handleSetScene, handleSetTemp } = require('./bulbController.js')
const fs = require('fs')
const path = require('path')

async function handleAddData (_event, data, filePath) {
  const fileExists = fs.existsSync(filePath)
  let existingData = []

  if (fileExists) {
    const fileContent = fs.readFileSync(filePath, {
      encoding: 'utf-8'
    })
    existingData = JSON.parse(fileContent)
  }

  existingData.push(data)

  const updatedJsonData = JSON.stringify(existingData)

  fs.writeFileSync(filePath, updatedJsonData, {
    encoding: 'utf-8'
  })

  console.log('Data added to', filePath)
}
// async function handleSaveData (_event, data, path) {
//   const jsonData = JSON.stringify(data)
//   console.log(path)
//   fs.writeFileSync(path, jsonData)
//   console.log('data saved')
// }
async function handleGetData (_event, path) {
  const data = fs.readFileSync(path)
  return JSON.parse(data)
}

const createWindow = () => {
  const window = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, './app/preload.js')
    }
  })

  window.loadFile('./app/index.html')
  window.webContents.openDevTools()
}

const createShortcutWindow = () => {
  const window = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, './app/preload.js')
    }
  })

  window.loadFile('./app/config.html')
  window.webContents.openDevTools()
}

const menuTemplate = [
  {
    label: 'Configuration',
    submenu: [
      {
        label: 'Shortcuts',
        click: createShortcutWindow
      }
    ]
  }
]

app.whenReady().then(() => {
  const userDataFilePath = app.getPath('userData')

  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.handle('getBulbs', handleGetBulbs)
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
  ipcMain.handle('setScene', handleSetScene)

  ipcMain.handle('addStatus', (event, ...args) => handleAddData(event, args, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('getStatus', (event, ..._args) => handleGetData(event, path.join(userDataFilePath, 'status.json')))

  createWindow()

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
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
