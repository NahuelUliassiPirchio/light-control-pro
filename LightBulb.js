/* eslint-disable no-useless-escape */
/* eslint-disable quotes */
/* eslint-disable semi */
const { exec } = require('child_process');

class LightBulb {
  constructor (ip) {
    this.ip = ip
  }

  turnOn () {
    return execFunction(`echo -n '{"id":1,"method":"setState","params":{"state":true}}' | nc -u -w 1 ${this.ip} 38899`)
  }

  turnOff () {
    return execFunction(`echo -n '{"id":1,"method":"setState","params":{"state":false}}' | nc -u -w 1 ${this.ip} 38899`)
  }

  setRhythm () {
    return execFunction(`echo -n "{\"id\":1,\"method\":\"setPilot\",\"params\":{\"sceneId\":1000,\"dimming\":75}}" | nc -u -w 1 ${this.ip} 38899`)
  }

  getStatus () {
    return execFunction(`echo -n "{"id":1,"method":"setPilot","params":{"sceneId":0,"speed":125,"dimming":75}}" | nc -u -w 1 ${this.ip} 38899`)
  }
}

function execFunction (functionStatement) {
  return new Promise((resolve, reject) => {
    exec(functionStatement, (error, stdout, stderr) => {
      if (error) {
        console.log(stderr)
        reject(error)
      }
      try {
        const parsedOutput = JSON.parse(stdout);
        resolve(parsedOutput);
      } catch (parseError) {
        reject(parseError);
      }
    })
  })
}

module.exports = LightBulb
