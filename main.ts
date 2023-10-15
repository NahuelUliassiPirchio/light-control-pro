/* eslint-disable quotes */
const { BrowserWindow, app, ipcMain, IpcMainEvent } = require('electron')
const { exec } = require('child_process')
const path = require('path')

const ips = ['192.168.0.3', '192.168.0.9']

async function handleChangeColor (event: typeof IpcMainEvent, ip:number, { r, g, b }:RGBColor, dimming:number) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"r":${r},"g":${g},"b":${b},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetTemp (event: typeof IpcMainEvent, ip:number, temp: number, dimming: number) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"temp":${temp},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetScene (event: typeof IpcMainEvent, ip:number, sceneId: number, sceneSpeed: number, dimming: number) {
  return execFunction(`echo -n '{"id":1,"method":"setPilot","params":{"sceneId":${sceneId},"speed": ${sceneSpeed},"dimming": ${dimming}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleSetBulb (event: typeof IpcMainEvent, ip:number, state: boolean) {
  return execFunction(`echo -n '{"id":1,"method":"setState","params":{"state":${state}}}' | nc -u -w 1 ${ip} 38899`)
}

async function handleGetBulbs (event: typeof IpcMainEvent) {
  const bulbsRequests = ips.map(ip => execFunction(`echo -n '{"method":"getPilot","params":{}}' | nc -u -w 1 ${ip} 38899`).catch(e => console.error(e)))
  const responses = await Promise.all(bulbsRequests)
  return responses.map((response,index)=> {
    if(response instanceof Error || !response) return
    return {...response, ip: ips[index]}
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
  window.webContents.openDevTools()
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

function execFunction(functionStatement: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    exec(functionStatement, (error: Error, stdout: string, stderr: string) => {
      if (error) {
        reject(error);
      } else {
        try {
          const parsedOutput = JSON.parse(stdout);
          if (parsedOutput.error) {
            reject(new Error('Something went wrong'));
          } else {
            resolve(parsedOutput);
          }
        } catch (error) {
          console.log('JSON parsing error:', error);
          reject(error);
        }
      }
    });
  });
}
