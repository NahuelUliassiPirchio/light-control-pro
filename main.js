const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
  nativeImage
} = require('electron')
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
const iconPath = path.join(__dirname, './build/icons/icon.png')

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
  if (configWindow && !configWindow.isDestroyed()) {
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
  // configWindow.webContents.openDevTools()
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

const exePath = app.isPackaged
  ? (process.env.APPIMAGE ? process.env.APPIMAGE : process.execPath)
  : app.getPath('exe')

function startOnStartup (value) {
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

async function registerShortcuts (userDataFilePath) {
  handleGetData('', path.join(userDataFilePath, 'shortcuts.json'))
    .then(shortcuts => {
      if (!shortcuts) return

      return handleGetData('', path.join(userDataFilePath, 'status.json'))
        .then(statuses => {
          globalShortcut.unregisterAll()

          shortcuts.forEach(shortcut => {
            const shortcutStatus = statuses.filter(state => state.id === shortcut.statusId)[0]
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

const userDataFilePath = app.getPath('userData')
const settingsFilePath = path.join(userDataFilePath, 'settings.json')
handleGetData('', settingsFilePath)
  .then(async (settings) => {
    if (settings && settings.length > 0) {
      const startupSetting = settings.find(setting => setting.id === 'startup')
      if (startupSetting) {
        startOnStartup(startupSetting.runOnStartup)
      } else {
        await handleAddOrUpdateSetting(null, 'startup', { runOnStartup: true }, settingsFilePath)
        startOnStartup(true)
      }
    } else {
      await handleAddOrUpdateSetting(null, 'startup', { runOnStartup: true }, settingsFilePath)
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

Menu.setApplicationMenu(null)
app.on('ready', () => {
  createWindow()
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      const contextMenuTemplate = []

      handleGetData('', path.join(userDataFilePath, 'status.json'))
        .then(statuses => {
          statuses.forEach(status => {
            contextMenuTemplate.push({
              label: status.name,
              click: () => {
                handleSetBulbStatus(mainWindow, '', status.ip, status)
                  .catch(error => console.error('Error setting bulb status:', error))
              }
            })
          })

          if (statuses.length > 0) {
            contextMenuTemplate.push({ type: 'separator' })
          }

          contextMenuTemplate.push(
            { label: 'Open app', click: () => mainWindow.show() },
            { label: 'Quit', role: 'quit' }
          )

          const trayIcon = nativeImage.createFromPath(iconPath).resize({
            width: 32, height: 32
          })

          tray = new Tray(trayIcon)
          const contextMenu = Menu.buildFromTemplate(contextMenuTemplate)

          tray.setToolTip('Light control pro')
          tray.on('click', () => {
            mainWindow.show()
          })

          tray.setContextMenu(contextMenu)
        })
        .catch(error => console.error('Error getting shortcuts data:', error))
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
