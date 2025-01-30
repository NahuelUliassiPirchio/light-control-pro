const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const {
  handleSetBulbStatus,
  handleChangeColor,
  handleGetBulbs,
  handleSetBulb,
  handleSetScene,
  handleSetTemp
} = require('./bulbController.js')
const {
  handleAddData,
  handleEditData,
  handleGetData,
  handleRemoveData,
  handleAddOrUpdateSetting,
  handleAddOrUpdateStoredBulb,
  handleRemoveStoredBulb
} = require('./dataController.js')

let mainWindow
let configWindow
let tray
const iconPath = path.join(__dirname, 'build/icons/icon.png')

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'app/preload.js')
    },
    hasShadow: false
  })

  mainWindow.loadFile(path.join(__dirname, 'app/index.html'))
  // mainWindow.webContents.openDevTools()

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  const menu = Menu.buildFromTemplate(menuTemplate)
  mainWindow.setMenu(menu)
}

const createConfigWindow = () => {
  if (configWindow && !configWindow.isDestroyed()){
    configWindow.focus()
    return
  }

  configWindow = new BrowserWindow({
    width: 600,
    height: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'app/preload.js')
    }
  })

  configWindow.setMenu(null)
  configWindow.webContents.openDevTools()
  configWindow.loadFile(path.join(__dirname, 'app/config.html'))
}

const menuTemplate = [
  {
    label: 'Settings',
    submenu: [
      {
        label: 'Shortcuts',
        click: createConfigWindow
      }
    ]
  }
]

async function registerShortcuts (userDataFilePath) {
  handleGetData('', path.join(userDataFilePath, 'shortcuts.json'))
    .then(shortcuts => {
      if (!shortcuts) return

      return handleGetData('', path.join(userDataFilePath, 'status.json'))
        .then(status => {
          globalShortcut.unregisterAll()

          shortcuts.forEach(shortcut => {
            const shortcutStatus = status.filter(state => state.id === shortcut.statusId)[0]
            if (!shortcutStatus || Object.values(shortcutStatus).length === 0) return

            const shortcutAccelerator = shortcut.pressedKeys.map((key) => {
              switch (key.toLowerCase()) {
                case 'alt': return 'Alt'
                case 'control': return 'CommandOrControl'
                case 'shift': return 'Shift'
                default: return key.charAt(0).toUpperCase() + key.slice(1)
              }
            }).join('+')

            globalShortcut.register(shortcutAccelerator, () => {
              handleSetBulbStatus(mainWindow, '', shortcutStatus.ip, shortcutStatus)
                .catch(error => console.error('Error setting bulb status:', error))
            })
          })
        })
        .catch(error => console.error('Error getting status data:', error))
    })
    .catch(error => console.error('Error getting shortcuts data:', error))
}

app.on('ready', () => {
  createWindow()
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      tray = new Tray(iconPath)

      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => { mainWindow.show() } },
        { label: 'Quit', click: () => { app.isQuiting = true; app.quit() } }
      ])

      tray.setToolTip('Light control pro app')
      tray.setContextMenu(contextMenu)

      tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
      })
    } catch (error) {
      console.error('Error during app ready:', error)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  }

  const logFilePath = path.join(app.getPath('userData'), 'app.log')

  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' })
  const originalConsoleLog = console.log
  console.log = (...args) => {
    logStream.write(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') + '\n')
    originalConsoleLog(...args)
  }

  const exePath = app.isPackaged
    ? (process.env.APPIMAGE ? process.env.APPIMAGE : process.execPath)
    : app.getPath('exe')

  const startOnStartup = (value) => {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      app.setLoginItemSettings({
        openAsHidden: value,
        openAtLogin: value,
        path: exePath
      })
    }
    if (os.platform() === 'linux' && value) {
      const desktopEntry = `[Desktop Entry]
  Type=Application
  Name=Light Control Pro
  Exec=${exePath}
  X-GNOME-Autostart-enabled=true`

      const autostartDir = path.join(os.homedir(), '.config', 'autostart')
      const desktopFilePath = path.join(autostartDir, 'light-control-pro.desktop')

      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true })
      }

      fs.writeFileSync(desktopFilePath, desktopEntry)
      fs.chmodSync(desktopFilePath, '755')
      console.log(`Created .desktop file at: ${desktopFilePath}`)
    }
  }

  const userDataFilePath = app.getPath('userData')
  const settingsFilePath = path.join(userDataFilePath, 'settings.json')
  handleGetData('', settingsFilePath)
    .then(async (settings) => {
      if (settings.length > 0) {
        settings.forEach((setting) => {
          if (setting.id === 'startup') {
            startOnStartup(setting.runOnStartup)
          }
        })
      } else {
        handleAddOrUpdateSetting(null, 'startup', { runOnStartup: true }, settingsFilePath)
        startOnStartup(true)
      }
    })

  registerShortcuts(userDataFilePath)
  const shortcutsFilePath = path.join(userDataFilePath, 'shortcuts.json')
  handleGetData(null, shortcutsFilePath).then(e =>
    fs.watch(shortcutsFilePath, (eventType, filename) => {
      if (eventType === 'change') {
        registerShortcuts(userDataFilePath)
      }
    })
  )

  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.on('startDiscovery', () => {
    handleGetBulbs((bulbData) => mainWindow.webContents.send('bulbDiscovered', bulbData))
  })
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
  ipcMain.handle('setScene', handleSetScene)
  ipcMain.handle('setStatus', (_event, ip, commandParams) => handleSetBulbStatus(mainWindow, _event, ip, commandParams))

  ipcMain.handle('addStatus', (event, data) => handleAddData(event, data, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('getStatus', (event, ..._args) => handleGetData(event, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('editStatus', (event, id, data) => handleEditData(event, id, data, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('removeStatus', (event, id) => handleRemoveData(event, id, path.join(userDataFilePath, 'status.json')))

  ipcMain.handle('addShortcut', (event, data) => handleAddData(event, data, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('getShortcuts', (event, ..._args) => handleGetData(event, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('editShortcut', (event, id, data) => handleEditData(event, id, data, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('removeShortcut', (event, id) => handleRemoveData(event, id, path.join(userDataFilePath, 'shortcuts.json')))

  ipcMain.handle('getSettings', (event, ..._args) => handleGetData(event, path.join(userDataFilePath, 'settings.json')))
  ipcMain.handle('addOrEditSetting', (event, id, data) => handleAddOrUpdateSetting(event, id, data, path.join(userDataFilePath, 'settings.json')))

  ipcMain.handle('getStoredBulbs', (event, ..._args) => handleGetData(event, path.join(userDataFilePath, 'bulbs.json')))
  ipcMain.handle('addOrEditStoredBulbs', (event, data) => handleAddOrUpdateStoredBulb(event, data, path.join(userDataFilePath, 'bulbs.json')))
  ipcMain.handle('removeStoredBulbs', (event, mac) => handleRemoveStoredBulb(event, mac, path.join(userDataFilePath, 'bulbs.json')))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuiting = true
})
