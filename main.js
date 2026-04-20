const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
  nativeImage,
  nativeTheme,
  desktopCapturer
} = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const {
  handleSetBulbStatus,
  handleChangeColor,
  handleGetBulbs,
  handleGetBulbState,
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
const isMac = process.platform === 'darwin'
const iconPath = path.join(__dirname, './build/icons/icon.png')
const MENU_ICONS_DIR = path.join(__dirname, './build/icons/menu')

// --- Tray helpers ---

let _iconCache = null
let _iconCacheIsDark = null

function getIconCache () {
  const isDark = nativeTheme.shouldUseDarkColors
  if (_iconCache === null || _iconCacheIsDark !== isDark) {
    _iconCache = {}
    _iconCacheIsDark = isDark
  }
  return _iconCache
}

/**
 * Loads a menu item icon from `folder`, picking the `name_dark.png` variant
 * when dark mode is active and falling back to `name.png` otherwise.
 * Returns undefined (no icon) if the file doesn't exist.
 * Icons are resized to 16×16 — the correct size for macOS menu items.
 */
function buildIcon (name, folder = MENU_ICONS_DIR) {
  const cache = getIconCache()
  if (cache[name]) return cache[name]

  const isDark = nativeTheme.shouldUseDarkColors
  const darkCandidate = path.join(folder, `${name}_dark.png`)
  const lightCandidate = path.join(folder, `${name}.png`)
  const filePath = isDark && fs.existsSync(darkCandidate) ? darkCandidate : lightCandidate

  if (!fs.existsSync(filePath)) return undefined

  const img = nativeImage.createFromPath(filePath).resize({ width: 16, height: 16 })
  cache[name] = img
  return img
}

function createTrayMenuTemplate (statuses) {
  const template = []

  statuses.forEach(status => {
    template.push({
      label: status.name,
      icon: buildIcon('bulb'),
      click: () => applySavedStatus(status)
        .catch(err => console.error('Error setting bulb status:', err))
    })
  })

  if (statuses.length > 0) {
    template.push({ type: 'separator' })
  }

  template.push(
    { label: 'Open app', icon: buildIcon('open'), click: () => mainWindow.show() },
    { label: 'Quit', icon: buildIcon('quit'), role: 'quit' }
  )

  return template
}

function cleanupTray () {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

async function createTray () {
  cleanupTray()

  const statuses = await handleGetData('', path.join(userDataFilePath, 'status.json'))

  const trayIcon = isMac
    ? path.join(__dirname, './build/icons/processing.png')
    : path.join(__dirname, './build/icons/icon.png')

  const icon = nativeImage
    .createFromPath(trayIcon)
    .resize({ width: 28, height: 28 })

  if (isMac) {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  tray.setToolTip('Light Control Pro')
  tray.on('click', () => mainWindow.show())
  tray.setContextMenu(Menu.buildFromTemplate(createTrayMenuTemplate(statuses)))
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'app/preload.js')
    },
    frame: false,
    maximizable: false
  })

  mainWindow.loadFile(path.join(__dirname, 'app/index.html'))
  // mainWindow.webContents.openDevTools()

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.setMenu(null)
}

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

async function applySavedStatus (status) {
  const targets = Array.isArray(status.bulbs) && status.bulbs.length > 0
    ? status.bulbs.filter(bulb => bulb.ip)
    : (status.ip ? [{ ip: status.ip }] : [])

  if (targets.length === 0) {
    throw new Error('Saved status does not contain any reachable bulbs.')
  }

  const uniqueTargets = targets.filter((target, index, array) =>
    array.findIndex(item => item.ip === target.ip) === index
  )

  const results = await Promise.allSettled(uniqueTargets.map(target =>
    handleSetBulbStatus(mainWindow, '', target.ip, status, { skipUiRefresh: true })
  ))

  if (mainWindow) {
    mainWindow.webContents.send('updatedBulbs', true)
  }

  const rejectedResult = results.find(result => result.status === 'rejected')
  if (rejectedResult) {
    throw rejectedResult.reason
  }

  return results
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
              applySavedStatus(shortcutStatus)
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
    createTray().catch(err => console.error('Error creating tray:', err))

    if (process.platform === 'darwin') {
      nativeTheme.on('updated', () => {
        createTray().catch(err => console.error('Error rebuilding tray on theme change:', err))
      })
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

  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-close', () => mainWindow.close())

  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.on('startDiscovery', async () => {
    const discoveredMacs = new Set()

    function notifyBulb (bulbData) {
      const mac = bulbData.result?.mac
      if (mac && discoveredMacs.has(mac)) return
      if (mac) discoveredMacs.add(mac)
      mainWindow.webContents.send('bulbDiscovered', bulbData)
    }

    // Broadcast discovery runs in background for 10s
    handleGetBulbs(notifyBulb).catch(err => console.error('Broadcast discovery error:', err))

    // Also query stored bulbs directly — catches bulbs that ignore broadcasts
    try {
      const storedBulbs = await handleGetData('', path.join(userDataFilePath, 'bulbs.json'))
      const knownBulbs = storedBulbs.filter(b => b.ip && !b.bulbs)
      await Promise.allSettled(knownBulbs.map(async (bulb) => {
        try {
          const pilotData = await handleGetBulbState(null, bulb.ip)
          notifyBulb({ ip: bulb.ip, ...pilotData })
        } catch (err) {
          console.error(`Could not reach stored bulb ${bulb.name} (${bulb.ip}):`, err.message)
        }
      }))
    } catch (err) {
      console.error('Error querying stored bulbs:', err.message)
    }
  })
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
  ipcMain.handle('setScene', handleSetScene)
  ipcMain.handle('setStatus', (_event, ip, commandParams) => applySavedStatus({
    ...commandParams,
    ip: commandParams.ip ?? ip
  }))

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
