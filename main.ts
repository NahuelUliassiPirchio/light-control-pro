import { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, nativeTheme, desktopCapturer, NativeImage, MenuItemConstructorOptions } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { exec } from 'child_process'
import { handleSetBulbStatus, handleGetBulbs, handleGetBulbState, closeCmdSocket } from './bulbController.js'
import { handleAddData, handleEditData, handleGetData, handleRemoveData, handleAddOrUpdateSetting, handleAddOrUpdateStoredBulb, handleRemoveStoredBulb } from './dataController.js'
import type { BulbEntry, SavedStatus, Shortcut, WizResponse } from './types'

interface AppSetting {
  id: string
  runOnStartup?: boolean
  openOnStartup?: boolean
}

function getArpTable (): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'arp -a' : 'arp -a'
    exec(cmd, (err, stdout) => {
      if (err) { resolve(new Map()); return }
      const table = new Map<string, string>()
      for (const line of stdout.split('\n')) {
        // macOS/Linux: "? (192.168.0.117) at a8:bb:50:bb:e4:72 on en0"
        // Windows:     "192.168.0.117    a8-bb-50-bb-e4-72    dynamic"
        const match = line.match(/\(?([\d.]+)\)?\s+at\s+([\da-fA-F:]+)/) ||
                      line.match(/([\d.]+)\s+([\da-fA-F-]+)\s+dynamic/)
        if (!match) continue
        const ip = match[1]
        const mac = match[2].replace(/[:-]/g, '').toLowerCase()
        if (mac && mac !== 'ffffffffffff') table.set(mac, ip)
      }
      resolve(table)
    })
  })
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuiting = false
const iconPath = path.join(__dirname, './build/icons/icon.png')

const createWindow = (showOnStart = true): void => {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    minWidth: 300,
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

  if (showOnStart) {
    mainWindow.show()
  } else {
    mainWindow.hide()
  }

  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.setMenu(null)
}

const exePath = app.isPackaged
  ? (process.env.APPIMAGE ? process.env.APPIMAGE : process.execPath)
  : app.getPath('exe')

function startOnStartup (value: boolean): void {
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

async function applySavedStatus (status: SavedStatus) {
  const isPerBulb = status.targetType === 'room' &&
    Array.isArray(status.bulbs) && status.bulbs.length > 0 &&
    status.bulbs[0].state !== undefined

  if (isPerBulb) {
    const targets = status.bulbs!
      .filter(b => b.ip)
      .filter((t, i, arr) => arr.findIndex(x => x.ip === t.ip) === i)

    if (targets.length === 0) {
      throw new Error('Saved status does not contain any reachable bulbs.')
    }

    const results = await Promise.allSettled(
      targets.map(bulbState =>
        bulbState.state === false
          ? handleSetBulbStatus(mainWindow, null, bulbState.ip!, { state: false }, { skipUiRefresh: true })
          : handleSetBulbStatus(mainWindow, null, bulbState.ip!, bulbState, { skipUiRefresh: true })
      )
    )

    if (mainWindow) {
      mainWindow.webContents.send('updatedBulbs', true)
    }

    const rejectedResult = results.find(result => result.status === 'rejected')
    if (rejectedResult) {
      throw (rejectedResult as PromiseRejectedResult).reason
    }

    return results
  }

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
    handleSetBulbStatus(mainWindow, null, target.ip!, status, { skipUiRefresh: true })
  ))

  if (mainWindow) {
    mainWindow.webContents.send('updatedBulbs', true)
  }

  const rejectedResult = results.find(result => result.status === 'rejected')
  if (rejectedResult) {
    throw (rejectedResult as PromiseRejectedResult).reason
  }

  return results
}

async function registerShortcuts (userDataFilePath: string): Promise<void> {
  handleGetData(null, path.join(userDataFilePath, 'shortcuts.json'))
    .then((shortcuts) => {
      if (!shortcuts) return

      return handleGetData(null, path.join(userDataFilePath, 'status.json'))
        .then(statuses => {
          globalShortcut.unregisterAll()

          ;(shortcuts as Shortcut[]).forEach(shortcut => {
            const shortcutStatus = (statuses as SavedStatus[]).filter(state => state.id === shortcut.statusId)[0]
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
const bulbsFilePath = path.join(userDataFilePath, 'bulbs.json')
const statusFilePath = path.join(userDataFilePath, 'status.json')
handleGetData(null, settingsFilePath)
  .then(async (settings) => {
    const list = settings as AppSetting[] | null
    if (list && list.length > 0) {
      const startupSetting = list.find(setting => setting.id === 'startup')
      if (startupSetting) {
        startOnStartup(startupSetting.runOnStartup ?? true)
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
handleGetData(null, shortcutsFilePath).then(_data =>
  fs.watch(shortcutsFilePath, (eventType, _filename) => {
    if (eventType === 'change') {
      registerShortcuts(userDataFilePath)
    }
  })
)

/** Placeholders resolved in resolveMenuSvg() so tray icons contrast with light/dark system menus. */
const MENU_SVGS: Record<string, string> = {
  gear: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="__MONO__" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>',
  power: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="__MONO__" d="M13,3H11V13H13V3M17.83,5.17L16.41,6.59C17.99,7.86 19,9.81 19,12A7,7 0 0,1 12,19A7,7 0 0,1 5,12C5,9.81 6.01,7.86 7.58,6.58L6.17,5.17C4.23,6.82 3,9.26 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12C21,9.26 19.77,6.82 17.83,5.17Z"/></svg>',
  bookmark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="__MONO__" d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z"/></svg>',
  bulb: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="__MONO__" d="M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z"/></svg>',
  home: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="__MONO__" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/></svg>',
  circleOn: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="__ON__"/></svg>',
  circleOff: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="__OFF__"/></svg>',
  eye: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="__MONO__" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/></svg>',
  eyeOff: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="__MONO__" d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10.02 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,4.5C17,4.5 21.27,7.61 23,12C22.18,14.08 20.79,15.88 19,17.19L17.58,15.76C18.95,14.82 20.1,13.54 20.82,12C19.17,8.64 15.76,6.5 12,6.5C10.91,6.5 9.84,6.68 8.84,7L7.3,5.47C8.74,4.85 10.33,4.5 12,4.5Z"/></svg>'
}

function resolveMenuSvg (key: string): string {
  const dark = nativeTheme.shouldUseDarkColors
  const mono = dark ? '#f3f4f6' : '#111827'
  const on = dark ? '#4ade80' : '#16a34a'
  const off = dark ? '#cbd5e1' : '#475569'
  return MENU_SVGS[key]
    .replace(/__MONO__/g, mono)
    .replace(/__ON__/g, on)
    .replace(/__OFF__/g, off)
}

const menuIcons: Record<string, NativeImage | null> = {}

async function getMenuIcon (key: string): Promise<NativeImage | undefined> {
  const themeKey = `${key}:${nativeTheme.shouldUseDarkColors ? 'd' : 'l'}`
  if (themeKey in menuIcons) return menuIcons[themeKey] || undefined
  if (!mainWindow || mainWindow.isDestroyed()) return undefined
  try {
    const b64 = Buffer.from(resolveMenuSvg(key)).toString('base64')
    const script = `new Promise((resolve) => {
      const c = Object.assign(document.createElement('canvas'), {width:16,height:16})
      const img = new Image()
      img.onload = () => { c.getContext('2d').drawImage(img,0,0,16,16); resolve(c.toDataURL('image/png')) }
      img.onerror = () => resolve(null)
      img.src = 'data:image/svg+xml;base64,${b64}'
    })`
    const dataUrl = await mainWindow.webContents.executeJavaScript(script)
    const icon = dataUrl ? nativeImage.createFromDataURL(dataUrl) : null
    menuIcons[themeKey] = (icon && !icon.isEmpty()) ? icon : null
  } catch {
    menuIcons[themeKey] = null
  }
  return menuIcons[themeKey] || undefined
}

function resolveRoomIPs (room: BulbEntry, allBulbs: BulbEntry[]): string[] {
  return room.bulbs!
    .map(mac => allBulbs.find(b => b.mac === mac && b.ip))
    .filter((b): b is BulbEntry => b !== undefined)
    .map(b => b.ip!)
}

async function buildAndShowMenu (): Promise<void> {
  let allBulbs: BulbEntry[] = []
  let statuses: SavedStatus[] = []
  try { allBulbs = await handleGetData(null, bulbsFilePath) as BulbEntry[] } catch {}
  try { statuses = await handleGetData(null, statusFilePath) as SavedStatus[] } catch {}

  const [gearIcon, powerIcon, bookmarkIcon, bulbIcon, homeIcon, circleOnIcon, circleOffIcon, eyeIcon, eyeOffIcon] = await Promise.all([
    getMenuIcon('gear'),
    getMenuIcon('power'),
    getMenuIcon('bookmark'),
    getMenuIcon('bulb'),
    getMenuIcon('home'),
    getMenuIcon('circleOn'),
    getMenuIcon('circleOff'),
    getMenuIcon('eye'),
    getMenuIcon('eyeOff')
  ])

  const individualBulbs = allBulbs.filter(b => b.ip && !b.bulbs)
  const rooms = allBulbs.filter(b => b.bulbs)

  const allIPs = [
    ...individualBulbs.map(b => b.ip!),
    ...rooms.flatMap(r => resolveRoomIPs(r, allBulbs))
  ].filter((ip, i, arr) => arr.indexOf(ip) === i)

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'All lights ON',
      ...(circleOnIcon && { icon: circleOnIcon }),
      enabled: allIPs.length > 0,
      click: () => Promise.allSettled(allIPs.map(ip => handleSetBulbStatus(mainWindow, null, ip, { state: true }, { skipUiRefresh: true }))).catch(console.error)
    },
    {
      label: 'All lights OFF',
      ...(circleOffIcon && { icon: circleOffIcon }),
      enabled: allIPs.length > 0,
      click: () => Promise.allSettled(allIPs.map(ip => handleSetBulbStatus(mainWindow, null, ip, { state: false }, { skipUiRefresh: true }))).catch(console.error)
    },
    { type: 'separator' }
  ]

  if (individualBulbs.length === 0 && rooms.length === 0) {
    template.push({ label: 'No bulbs configured', enabled: false })
  } else {
    const brightnessSubmenu = (ips: string[]): MenuItemConstructorOptions[] =>
      [25, 50, 75, 100].map(level => ({
        label: `${level}%`,
        click: () => Promise.allSettled(
          ips.map(ip => handleSetBulbStatus(mainWindow, null, ip, { dimming: level }, { skipUiRefresh: true }))
        ).catch(console.error)
      }))

    if (rooms.length > 0) {
      template.push({ label: 'Rooms', enabled: false })
      rooms.forEach(room => {
        const ips = resolveRoomIPs(room, allBulbs)
        template.push({
          label: room.name || 'Room',
          ...(homeIcon && { icon: homeIcon }),
          submenu: ips.length > 0
            ? [
                { label: 'Turn On', click: () => Promise.allSettled(ips.map(ip => handleSetBulbStatus(mainWindow, null, ip, { state: true }, { skipUiRefresh: true }))).catch(console.error) },
                { label: 'Turn Off', click: () => Promise.allSettled(ips.map(ip => handleSetBulbStatus(mainWindow, null, ip, { state: false }, { skipUiRefresh: true }))).catch(console.error) },
                { type: 'separator' as const },
                { label: 'Brightness', submenu: brightnessSubmenu(ips) }
              ]
            : [{ label: 'No reachable bulbs', enabled: false }]
        })
      })
      if (individualBulbs.length > 0) template.push({ type: 'separator' })
    }

    if (individualBulbs.length > 0) {
      template.push({ label: 'Bulbs', enabled: false })
      individualBulbs.forEach(bulb => {
        template.push({
          label: bulb.name || 'Bulb',
          ...(bulbIcon && { icon: bulbIcon }),
          submenu: [
            { label: 'Turn On', click: () => handleSetBulbStatus(mainWindow, null, bulb.ip!, { state: true }, { skipUiRefresh: true }).catch(console.error) },
            { label: 'Turn Off', click: () => handleSetBulbStatus(mainWindow, null, bulb.ip!, { state: false }, { skipUiRefresh: true }).catch(console.error) },
            { type: 'separator' as const },
            { label: 'Brightness', submenu: brightnessSubmenu([bulb.ip!]) }
          ]
        })
      })
    }
  }

  template.push({ type: 'separator' })

  if (statuses.length === 0) {
    template.push({ label: 'No saved states', enabled: false })
  } else {
    template.push({ label: 'Saved States', enabled: false })
    statuses.forEach(status => {
      const sublabel = status.targetName ? ` — ${status.targetName}` : ''
      template.push({
        label: `${status.name}${sublabel}`,
        ...(bookmarkIcon && { icon: bookmarkIcon }),
        click: () => applySavedStatus(status).catch(console.error)
      })
    })
  }

  const visible = mainWindow?.isVisible()
  template.push(
    { type: 'separator' },
    {
      label: 'Settings',
      ...(gearIcon && { icon: gearIcon }),
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.webContents.send('navigate-to-config')
        }
      }
    },
    {
      label: visible ? 'Hide App' : 'Show App',
      ...(visible ? (eyeOffIcon && { icon: eyeOffIcon }) : (eyeIcon && { icon: eyeIcon })),
      click: () => visible ? mainWindow?.hide() : mainWindow?.show()
    },
    { label: 'Quit', role: 'quit', ...(powerIcon && { icon: powerIcon }) }
  )

  tray!.popUpContextMenu(Menu.buildFromTemplate(template))
}

Menu.setApplicationMenu(null)
app.on('ready', async () => {
  let showOnStart = true
  try {
    const settings = await handleGetData(null, settingsFilePath) as AppSetting[] | null
    if (settings) {
      const openSetting = settings.find(s => s.id === 'openOnStartup')
      if (openSetting) showOnStart = openSetting.openOnStartup ?? true
    }
  } catch {}

  createWindow(showOnStart)
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      const isMac = process.platform === 'darwin'
      const trayIconPath = isMac
        ? path.join(__dirname, './build/icons/processing.png')
        : iconPath
      const trayIcon = nativeImage.createFromPath(trayIconPath).resize({ width: 28, height: 28 })
      if (isMac) trayIcon.setTemplateImage(true)
      tray = new Tray(trayIcon)
      tray.setToolTip('Light Control Pro')
      tray.on('right-click', () => buildAndShowMenu().catch(console.error))
      tray.on('click', () => buildAndShowMenu().catch(console.error))
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
  console.log = (...args: object[] | string[]) => {
    logStream.write(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') + '\n')
    originalConsoleLog(...args)
  }

  ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources.map(s => ({ id: s.id, name: s.name }))
  })

  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-close', () => mainWindow?.close())

  ipcMain.handle('setBulb', (_event, ip: string, state: boolean) =>
    handleSetBulbStatus(null, _event, ip, { state }, { skipUiRefresh: true }))

  let discoveryActive = false
  ipcMain.on('startDiscovery', async () => {
    if (discoveryActive) return
    discoveryActive = true
    setTimeout(() => { discoveryActive = false }, 11000)

    const discoveredMacs = new Set<string>()

    function notifyBulb (bulbData: { ip: string } & WizResponse): void {
      const mac = bulbData.result?.mac
      if (mac && discoveredMacs.has(mac)) return
      if (mac) discoveredMacs.add(mac)
      mainWindow?.webContents.send('bulbDiscovered', bulbData)
    }

    // Broadcast discovery runs in background for 10s
    handleGetBulbs(notifyBulb).catch(err => console.error('Broadcast discovery error:', (err as Error).message))

    // Also query stored bulbs directly — catches bulbs that ignore broadcasts
    try {
      const storedBulbs = await handleGetData(null, path.join(userDataFilePath, 'bulbs.json')) as BulbEntry[]
      const knownBulbs = storedBulbs.filter(b => b.mac && !b.bulbs)

      const arpTable = await getArpTable()

      await Promise.allSettled(knownBulbs.map(async (bulb) => {
        const mac = bulb.mac!.replace(/[:-]/g, '').toLowerCase()
        const arpIp = arpTable.get(mac)
        const ip = arpIp || bulb.ip
        if (!ip) {
          console.error(`No IP for stored bulb ${bulb.name} (mac: ${bulb.mac})`)
          return
        }
        if (arpIp && arpIp !== bulb.ip) {
          console.log(`Bulb ${bulb.name} IP updated via ARP: ${bulb.ip} → ${arpIp}`)
          await handleAddOrUpdateStoredBulb(null, { ...bulb, ip: arpIp }, path.join(userDataFilePath, 'bulbs.json'))
        }
        try {
          const pilotData = await handleGetBulbState(null, ip)
          notifyBulb({ ip, ...pilotData })
        } catch (err) {
          console.error(`Could not reach stored bulb ${bulb.name} (${ip}):`, (err as Error).message)
        }
      }))
    } catch (err) {
      console.error('Error querying stored bulbs:', (err as Error).message)
    }
  })

  ipcMain.handle('changeColor', (_event, ip: string, { r, g, b }: { r: number; g: number; b: number }, dimming: number) =>
    handleSetBulbStatus(null, _event, ip, { r, g, b, dimming: Number(dimming) }, { skipUiRefresh: true }))
  ipcMain.handle('setTemp', (_event, ip: string, temp: number, dimming: number) =>
    handleSetBulbStatus(null, _event, ip, { temp: Number(temp), dimming: Number(dimming) }, { skipUiRefresh: true }))
  ipcMain.handle('setScene', (_event, ip: string, sceneId: number, sceneSpeed: number, dimming: number) =>
    handleSetBulbStatus(null, _event, ip, { sceneId: Number(sceneId), speed: Number(sceneSpeed), dimming: Number(dimming) }, { skipUiRefresh: true }))
  ipcMain.handle('setStatus', (_event, ip: string, commandParams: SavedStatus) => applySavedStatus({
    ...commandParams,
    ip: commandParams.ip ?? ip
  }))

  ipcMain.handle('addStatus', (event, data: SavedStatus) => handleAddData(event, data, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('getStatus', (event) => handleGetData(event, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('editStatus', (event, id: string, data: Partial<SavedStatus>) => handleEditData(event, id, data, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('removeStatus', (event, id: string) => handleRemoveData(event, id, path.join(userDataFilePath, 'status.json')))

  ipcMain.handle('addShortcut', (event, data: Shortcut) => handleAddData(event, data, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('getShortcuts', (event) => handleGetData(event, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('editShortcut', (event, id: string, data: Partial<Shortcut>) => handleEditData(event, id, data, path.join(userDataFilePath, 'shortcuts.json')))
  ipcMain.handle('removeShortcut', (event, id: string) => handleRemoveData(event, id, path.join(userDataFilePath, 'shortcuts.json')))

  ipcMain.handle('getSettings', (event) => handleGetData(event, path.join(userDataFilePath, 'settings.json')))
  ipcMain.handle('addOrEditSetting', (event, id: string, data: Record<string, unknown>) => handleAddOrUpdateSetting(event, id, data, path.join(userDataFilePath, 'settings.json')))

  ipcMain.handle('getStoredBulbs', (event) => handleGetData(event, path.join(userDataFilePath, 'bulbs.json')))
  ipcMain.handle('addOrEditStoredBulbs', (event, data: BulbEntry) => handleAddOrUpdateStoredBulb(event, data, path.join(userDataFilePath, 'bulbs.json')))
  ipcMain.handle('removeStoredBulbs', (event, mac: string) => handleRemoveStoredBulb(event, mac, path.join(userDataFilePath, 'bulbs.json')))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuiting = true
  closeCmdSocket()
})
