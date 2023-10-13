'use strict'
const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  function adopt (value) { return value instanceof P ? value : new P(function (resolve) { resolve(value) }) }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled (value) { try { step(generator.next(value)) } catch (e) { reject(e) } }
    function rejected (value) { try { step(generator.throw(value)) } catch (e) { reject(e) } }
    function step (result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected) }
    step((generator = generator.apply(thisArg, _arguments || [])).next())
  })
}
/* eslint-disable quotes */
const { BrowserWindow, app, ipcMain, IpcMainEvent } = require('electron')
const { exec } = require('child_process')
const path = require('path')
const ips = ['192.168.0.3', '192.168.0.9']
function handleChangeColor (event, { r, g, b }, dimming) {
  return __awaiter(this, void 0, void 0, function * () {
    return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"r":${r},"g":${g},"b":${b},"dimming": ${dimming}}}' | nc -u -w 1 ${ips[0]} 38899`)
  })
}
function handleSetTemp (event, temp, dimming) {
  return __awaiter(this, void 0, void 0, function * () {
    return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"temp":${temp},"dimming": ${dimming}}}' | nc -u -w 1 ${ips[0]} 38899`)
  })
}
function handleSetBulb (event, state) {
  return __awaiter(this, void 0, void 0, function * () {
    return execFunction(`echo -n '{"id":1,"method":"setState","params":{"state":${state}}}' | nc -u -w 1 ${ips[0]} 38899`)
  })
}
function handleGetBulbs (event) {
  return __awaiter(this, void 0, void 0, function * () {
    const bulbsRequests = ips.map(ip => execFunction(`echo -n '{"method":"getPilot","params":{}}' | nc -u -w 1 ${ip} 38899`))
    return Promise.all(bulbsRequests)
  })
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
function execFunction (functionStatement) {
  return new Promise((resolve, reject) => {
    exec(functionStatement, (error, stdout, stderr) => {
      if (error) {
        console.log(stderr)
        reject(error)
      }
      try {
        const parsedOutput = JSON.parse(stdout)
        if (parsedOutput.error) { throw new Error('Something went wrong') }
        resolve(parsedOutput)
      } catch (parseError) {
        reject(parseError)
      }
    })
  })
}
