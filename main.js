const { BrowserWindow, app } = require('electron')

const createWindow = () => {
  const window = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  window.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
})
