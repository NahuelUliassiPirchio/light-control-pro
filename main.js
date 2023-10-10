/* eslint-disable quotes */
const { BrowserWindow, app, ipcMain } = require('electron')
const { exec } = require('child_process')
const path = require('path')

async function handleSetBulb (event, state) {
  return execFunction(`echo -n '{"id":1,"method":"setState","params":{"state":${state}}}' | nc -u -w 1 192.168.0.3 38899`)
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
        if (parsedOutput.error) throw new Error('Something went wrong')
        resolve(parsedOutput)
      } catch (parseError) {
        reject(parseError)
      }
    })
  })
}
