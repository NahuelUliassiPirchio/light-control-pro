const { BrowserWindow, app, ipcMain } = require('electron')
const fs = require('fs')
const { exec } = require('child_process')
const path = require('path')

const ips = ['192.168.0.3', '192.168.0.9']

async function handleChangeColor (_event, ip, { r, g, b }, dimming) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"r":${r},"g":${g},"b":${b},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetTemp (_event, ip, temp, dimming) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"temp":${temp},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetScene (_event, ip, sceneId, sceneSpeed, dimming) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"sceneId":${sceneId},"speed": ${sceneSpeed},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetBulb (_event, ip, state) {
  return execFunction(`echo -n '{"id":1,"method":"setState","params":{"state":${state}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleGetBulbs (_event) {
  const bulbsRequests = ips.map(ip => execFunction(`echo -n '{"method":"getPilot","params":{}}' | nc -u -w 1 ${ip} 38899`).catch(e => console.error(e)))
  const responses = await Promise.all(bulbsRequests)
  return responses.map((response, index) => {
    if (response instanceof Error || !response) return ''
    return { ...response, ip: ips[index] }
  })
}

async function handleAddData (_event, data, filePath) {
  const fileExists = fs.existsSync(filePath)
  let existingData = []

  if (fileExists) {
    const fileContent = fs.readFileSync(filePath, {
      encoding: 'utf-8'
    })
    existingData = JSON.parse(fileContent)
  }

  existingData.push(data)

  const updatedJsonData = JSON.stringify(existingData)

  fs.writeFileSync(filePath, updatedJsonData, {
    encoding: 'utf-8'
  })

  console.log('Data added to', filePath)
}
// async function handleSaveData (_event, data, path) {
//   const jsonData = JSON.stringify(data)
//   console.log(path)
//   fs.writeFileSync(path, jsonData)
//   console.log('data saved')
// }
async function handleGetData (_event, path) {
  const data = fs.readFileSync(path)
  return JSON.parse(data)
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
  const userDataFilePath = app.getPath('userData')

  ipcMain.handle('setBulb', handleSetBulb)
  ipcMain.handle('getBulbs', handleGetBulbs)
  ipcMain.handle('changeColor', handleChangeColor)
  ipcMain.handle('setTemp', handleSetTemp)
  ipcMain.handle('setScene', handleSetScene)

  ipcMain.handle('addStatus', (event, ...args) => handleAddData(event, args, path.join(userDataFilePath, 'status.json')))
  ipcMain.handle('getStatus', (event, ..._args) => handleGetData(event, path.join(userDataFilePath, 'status.json')))

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
    exec(functionStatement, (error, stdout, _stderr) => {
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
