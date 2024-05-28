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
let tray

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, './app/preload.js')
    },
    hasShadow: false
  })

  mainWindow.loadFile('./app/index.html')
  mainWindow.webContents.openDevTools()

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
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

app.on('ready', () => {
  // tray = new Tray(path.join(__dirname, './build/icons/icon.png'))
  // const contextMenu = Menu.buildFromTemplate([
  //   { label: 'Show App', click: () => { mainWindow.show() } },
  //   { label: 'Quit', click: () => { app.isQuiting = true; app.quit() } }
  // ])
  // tray.setContextMenu(contextMenu)

  // tray.on('click', () => {
  //   mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  // })

  createWindow()

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  const logFilePath = path.join(app.getPath('userData'), 'app.log')

  // Redirect console.log to a file
  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' })
  const originalConsoleLog = console.log
  console.log = (...args) => {
    logStream.write(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') + '\n')
    originalConsoleLog(...args)
  }

  // Determine the correct executable path based on the platform
  const exePath = app.isPackaged
    ? (process.env.APPIMAGE ? process.env.APPIMAGE : process.execPath)
    : app.getPath('exe')

  console.log(`Executable path: ${exePath}`)

  // Set login item settings for auto-launch on macOS and Windows
  if (process.platform === 'darwin' || process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: exePath
    })
  }

  // Programmatically create the .desktop file for Linux
  if (os.platform() === 'linux') {
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
    console.log(`Created .desktop file at: ${desktopFilePath}`)
  }

  const userDataFilePath = app.getPath('userData')

  handleGetData('', path.join(userDataFilePath, 'settings.json'))
    .then(async (settings) => {
      if (settings) {
        settings.forEach((setting) => {
          if (setting.id === 'startup') {
            app.setLoginItemSettings({
              openAtLogin: setting.runOnStartup || false,
              openAsHidden: setting.runOnStartup || false,
              path: exePath
            })
          }
        })
      }
    })

  handleGetData('', path.join(userDataFilePath, 'shortcuts.json'))
    .then(async (shortcuts) => {
      if (!shortcuts) return
      const status = await handleGetData('', path.join(userDataFilePath, 'status.json'))
      shortcuts.forEach(async (shortcut) => {
        const shortcutStatus = status.filter(state => state.id === shortcut.statusId)[0]
        if (Object.values(shortcutStatus).length === 0) return
        const shortcutAccelerator = shortcut.pressedKeys.map((key) => {
          switch (key.toLowerCase()) {
            case 'alt': return 'Alt'
            case 'control': return 'CommandOrControl'
            case 'shift': return 'Shift'
            default: return key.charAt(0).toUpperCase() + key.slice(1)
          }
        }).join('+')

        globalShortcut.register(shortcutAccelerator, async () => {
          // if(shortcutStatus.isToggle)
          // const currentState = await handleGetBulbState('', shortcutStatus.ip)
          // const newState = !currentState.result.state
          // console.log('Enviado')
          // await handleSetBulb('', shortcutStatus.ip, newState)

          await handleSetBulbStatus('', shortcutStatus.ip, shortcutStatus.result)
        })
      })
    })

  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.on('startDiscovery', () => {
    handleGetBulbs((bulbData) => mainWindow.webContents.send('bulbDiscovered', bulbData))
  })
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
  ipcMain.handle('setScene', handleSetScene)
  ipcMain.handle('setStatus', handleSetBulbStatus)

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
