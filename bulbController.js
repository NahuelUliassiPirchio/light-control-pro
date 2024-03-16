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

exports.handleChangeColor = async (event, ip, { r, g, b }, dimming) => {
  const message = `{"id":1,"method":"setPilot","params":{"r":${r},"g":${g},"b":${b},"dimming": ${dimming}}}`
  const response = await sendCommandToBulb(ip, message)
  console.log(response)
  return JSON.parse(response)
}

exports.handleSetTemp = async (event, ip, temp, dimming) => {
  const message = `{"id":1,"method":"setPilot","params":{"temp":${temp},"dimming": ${dimming}}}`
  const response = await sendCommandToBulb(ip, message)
  console.log(response)
  return JSON.parse(response)
}

exports.handleSetScene = async (event, ip, sceneId, sceneSpeed, dimming) => {
  const message = `{"id":1,"method":"setPilot","params":{"sceneId":${sceneId},"speed": ${sceneSpeed},"dimming": ${dimming}}}`
  const response = await sendCommandToBulb(ip, message)
  console.log(response)
  return JSON.parse(response)
}

exports.handleSetBulb = async (event, ip, state) => {
  const message = `{"id":1,"method":"setState","params":{"state":${state}}}`
  try {
    const response = await sendCommandToBulb(ip, message)
    return JSON.parse(response)
  } catch (error) {
    console.error('Error al cambiar el estado del bulb:', error)
    throw error
  }
}

function discoverBulbs () {
  return new Promise((resolve, reject) => {
    const client = createSocket('udp4')
    const message = Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }))
    const bulbs = []

    client.on('listening', () => {
      client.setBroadcast(true)
    })

    client.on('message', (msg, rinfo) => {
      console.log(`Bombilla descubierta: ${rinfo.address} - ${msg}`)
      bulbs.push({ ip: rinfo.address, data: JSON.parse(msg.toString()) })
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

exports.handleGetBulbs = async (event) => {
  try {
    const bulbs = await discoverBulbs()
    console.log(`Bombillas descubiertas: ${bulbs.length}`)
    return bulbs
  } catch (error) {
    console.error('Error al descubrir bombillas:', error)
    throw error
  }
}
