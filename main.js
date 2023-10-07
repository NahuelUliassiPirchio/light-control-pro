const { exec } = require('child_process')
const { BrowserWindow, app } = require('electron')

const createWindow = () => {
  const window = new BrowserWindow({
    width: 600,
    height: 600
  })

  window.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
  console.log('hola')
})

function turnLightOn () {
  execFunction('echo -n \'{"id":1,"method":"setState","params":{"state":true}}\' | nc -u -w 1 192.168.0.3 38899')
}
function turnLightOff () {
  execFunction('echo -n \'{"id":1,"method":"setState","params":{"state":false}}\' | nc -u -w 1 192.168.0.3 38899')
}

function execFunction (functionStatement) {
  exec(functionStatement, (error, stdout, stderr) => {
    if (error) {
      console.error(error)
      console.log(stderr)
    }
    console.log(JSON.parse(stdout))
  })
}
