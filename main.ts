/* eslint-disable quotes */
const { BrowserWindow, app, ipcMain, IpcMainEvent } = require('electron')
const { exec } = require('child_process')
const path = require('path')

const ips = ['192.168.0.3', '192.168.0.9']

async function handleChangeColor (event: typeof IpcMainEvent, { r, g, b }:RGBColor, dimming:number) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"r":${r},"g":${g},"b":${b},"dimming": ${dimming}}}' | nc -u -w 1 ${ips[0]} 38899`)
}

async function handleSetTemp (event: typeof IpcMainEvent, temp: number, dimming: number) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"temp":${temp},"dimming": ${dimming}}}' | nc -u -w 1 ${ips[0]} 38899`)
}

async function handleSetBulb (event: typeof IpcMainEvent, state: boolean) {
  return execFunction(`echo -n '{"id":1,"method":"setState","params":{"state":${state}}}' | nc -u -w 1 ${ips[0]} 38899`)
}

async function handleGetBulbs (event: typeof IpcMainEvent) {
  const bulbsRequests = ips.map(ip => execFunction(`echo -n '{"method":"getPilot","params":{}}' | nc -u -w 1 ${ip} 38899`))
  return Promise.all(bulbsRequests)
}

const createWindow = () => {
  const window = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  window.loadFile('index.html')
}

app.whenReady().then(() => {
  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.handle('getBulbs', handleGetBulbs)
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
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

function execFunction (functionStatement: string) {
  return new Promise((resolve, reject) => {
    exec(functionStatement, (error: Error, stdout: string, stderr: string) => {
      if (error) {
        console.log(stderr)
        reject(error)
      }
      try {
        const parsedOutput = JSON.parse(stdout)
        if (parsedOutput.error) throw new Error('Something went wrong')
        resolve(parsedOutput)
      } catch (parseError) {
        reject(parseError)
      }
    })
  })
}
