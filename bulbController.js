const { createSocket } = require('dgram')

async function sendCommandToBulb (ip, message) {
  return new Promise((resolve, reject) => {
    const client = createSocket('udp4')
    const messageBuffer = Buffer.from(message)
    let responseReceived = false

    client.on('message', (msg, info) => {
      if (info.address === ip) {
        console.log(`Respuesta recibida de ${info.address}: ${msg}`)
        responseReceived = true
        client.close()
        resolve(msg.toString())
      }
    })

    client.send(messageBuffer, 0, messageBuffer.length, 38899, ip, (err) => {
      if (err) {
        client.close()
        reject(err)
      }
      console.log('Comando enviado, esperando respuesta...')
    })

    setTimeout(() => {
      if (!responseReceived) {
        client.close()
        reject(new Error('No se recibió respuesta del bulb'))
      }
    }, 5000)
  })
}

async function handleChangeColor (event, ip, { r, g, b }, dimming) {
  const message = `{"id":1,"method":"setPilot","params":{"r":${r},"g":${g},"b":${b},"dimming": ${dimming}}}`
  const response = await sendCommandToBulb(ip, message)
  console.log(response)
  return JSON.parse(response)
}

async function handleSetTemp (event, ip, temp, dimming) {
  const message = `{"id":1,"method":"setPilot","params":{"temp":${temp},"dimming": ${dimming}}}`
  const response = await sendCommandToBulb(ip, message)
  console.log(response)
  return JSON.parse(response)
}

async function handleSetScene (event, ip, sceneId, sceneSpeed, dimming) {
  const message = `{"id":1,"method":"setPilot","params":{"sceneId":${sceneId},"speed": ${sceneSpeed},"dimming": ${dimming}}}`
  const response = await sendCommandToBulb(ip, message)
  console.log(response)
  return JSON.parse(response)
}

async function handleSetBulb (event, ip, state) {
  const message = `{"id":1,"method":"setState","params":{"state":${state}}}`
  try {
    const response = await sendCommandToBulb(ip, message)
    return JSON.parse(response)
  } catch (error) {
    console.error('Error al cambiar el estado del bulb:', error)
    throw error
  }
}

function discoverBulbs (callback) {
  return new Promise((resolve, reject) => {
    const client = createSocket('udp4')
    const message = Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }))
    const bulbs = []

    client.on('listening', () => {
      client.setBroadcast(true)
    })

    client.on('message', (msg, rinfo) => {
      const bulbData = { ip: rinfo.address, ...JSON.parse(msg.toString()) }
      console.log(bulbData)
      callback(bulbData)
    })

    client.bind(() => {
      client.send(message, 0, message.length, 38899, '255.255.255.255', (err) => {
        if (err) {
          client.close()
          reject(err)
        }
        console.log('Mensaje de descubrimiento enviado a la red.')

        setTimeout(() => {
          client.close()
          resolve(bulbs)
        }, 5000)
      })
    })
  })
}

async function handleGetBulbs (callback) {
  try {
    const bulbs = await discoverBulbs(callback)
    console.log(`Bombillas descubiertas: ${bulbs.length}`)
    return bulbs
  } catch (error) {
    console.error('Error al descubrir bombillas:', error)
    throw error
  }
}

async function handleGetBulbState (event, ip) {
  const message = '{"method":"getPilot","params":{}}'
  const response = await sendCommandToBulb(ip, message)
  return JSON.parse(response)
}

async function handleSetBulbStatus (mainWindow, _event, ip, commandParams) {
  console.log(commandParams)
  const params = {}

  if (commandParams.state !== undefined) {
    params.state = commandParams.state
  }

  if (commandParams.dimming !== undefined) {
    params.dimming = commandParams.dimming
  }

  if (commandParams.r) {
    params.r = commandParams.r
    params.g = commandParams.g
    params.b = commandParams.b
  }

  if (commandParams.temp !== undefined) {
    params.temp = commandParams.temp
  }

  if (commandParams.sceneId !== 0) {
    params.sceneId = commandParams.sceneId
    if (commandParams.sceneSpeed !== undefined) {
      params.speed = commandParams.sceneSpeed
    }
  }

  const message = {
    method: 'setPilot',
    params
  }

  const messageString = JSON.stringify(message)
  try {
    const response = await sendCommandToBulb(ip, messageString)
    mainWindow.webContents.send('updatedBulbs', true)
    console.log('Respuesta del comando enviado:', response)
    return JSON.parse(response)
  } catch (error) {
    console.error('Error al enviar el comando a la bombilla:', error)
    throw error
  }
}

module.exports = {
  handleSetBulbStatus,
  handleGetBulbState,
  handleGetBulbs,
  handleSetBulb,
  handleSetTemp,
  handleChangeColor,
  handleSetScene
}
