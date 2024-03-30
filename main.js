const { BrowserWindow, app, ipcMain, Menu, globalShortcut } = require('electron')
const { handleBulbStatus, handleChangeColor, handleGetBulbs, handleSetBulb, handleSetScene, handleSetTemp, handleGetBulbState } = require('./bulbController.js')
const { handleAddData, handleEditData, handleGetData, handleRemoveData } = require('./dataController.js')
const path = require('path')

let mainWindow

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, './app/preload.js')
    }
  })

  mainWindow.loadFile('./app/index.html')
  mainWindow.webContents.openDevTools()
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

  handleGetData('', path.join(userDataFilePath, 'shortcuts.json'))
    .then(async shortcuts => {
      if (!shortcuts) return
      const status = await handleGetData('', path.join(userDataFilePath, 'status.json'))
      shortcuts.forEach(async shortcut => {
        const shortcutStatus = status.filter(state => state.name === shortcut.status)[0]
        if (Object.values(shortcutStatus).length === 0) return
        const shortcutAccelerator = shortcut.pressedKeys.map(key => {
          switch (key.toLowerCase()) {
            case 'alt':
              return 'Alt'
            case 'control':
              return 'CommandOrControl'
            case 'shift':
              return 'Shift'
            default:
              return key.charAt(0).toUpperCase() + key.slice(1)
          }
        }).join('+')

        globalShortcut.register(shortcutAccelerator, async () => {
          // if(shortcutStatus.isToggle)
          // const currentState = await handleGetBulbState('', shortcutStatus.ip)
          // const newState = !currentState.result.state
          // console.log('Enviado')
          // await handleSetBulb('', shortcutStatus.ip, newState)

          await handleBulbStatus(shortcutStatus.ip, shortcutStatus.result)
        })

        // asignar shortcuts, en shortcut.pressedKeys hay un objeto con las teclas del shortcut en las keys
      })
    })

  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.on('startDiscovery', (event) => {
    handleGetBulbs((bulbData) => mainWindow.webContents.send('bulbDiscovered', bulbData))
  })
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
  ipcMain.handle('setScene', handleSetScene)

  ipcMain.handle('addStatus', (event, data) => handleAddData(event, data, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('getStatus', (event, ..._args) => handleGetData(event, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('editStatus', (event, id, data) => handleEditData(event, id, data, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('removeStatus', (event, id) => handleRemoveData(event, id, path.join(userDataFilePath, 'status.json')))

  ipcMain.handle('addShortcut', (event, data) => handleAddData(event, data, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('getShortcuts', (event, ..._args) => handleGetData(event, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('editShortcut', (event, id, data) => handleEditData(event, id, data, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('removeShortcut', (event, id) => handleRemoveData(event, id, path.join(userDataFilePath, 'shortcuts.json')))

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
