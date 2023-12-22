const { BrowserWindow, app, ipcMain } = require('electron')
const { exec } = require('child_process')
const path = require('path')

const ips = ['192.168.0.3', '192.168.0.9']

async function handleChangeColor (event, ip, { r, g, b }, dimming) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"r":${r},"g":${g},"b":${b},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetTemp (event, ip, temp, dimming) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"temp":${temp},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetScene (event, ip, sceneId, sceneSpeed, dimming) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"sceneId":${sceneId},"speed": ${sceneSpeed},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetBulb (event, ip, state) {
  return execFunction(`echo -n '{"id":1,"method":"setState","params":{"state":${state}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleGetBulbs (event) {
  const bulbsRequests = ips.map(ip => execFunction(`echo -n '{"method":"getPilot","params":{}}' | nc -u -w 1 ${ip} 38899`).catch(e => console.error(e)))
  const responses = await Promise.all(bulbsRequests)
  return responses.map((response, index) => {
    if (response instanceof Error || !response) return ''
    return { ...response, ip: ips[index] }
  })
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
  // window.webContents.openDevTools()
}

app.whenReady().then(() => {
  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.handle('getBulbs', handleGetBulbs)
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
  ipcMain.handle('setScene', handleSetScene)
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
        reject(error)
      } else {
        try {
          const parsedOutput = JSON.parse(stdout)
          if (parsedOutput.error) {
            reject(new Error('Something went wrong'))
          } else {
            resolve(parsedOutput)
          }
        } catch (error) {
          console.log('JSON parsing error:', error)
          reject(error)
        }
      }
    })
  })
}
