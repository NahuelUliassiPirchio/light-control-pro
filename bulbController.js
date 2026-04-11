const { createSocket } = require('dgram')
const os = require('os')

function getSubnetBroadcasts () {
  const broadcasts = []
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.')
        const maskParts = iface.netmask.split('.')
        const broadcast = parts.map((part, i) =>
          (parseInt(part) | (~parseInt(maskParts[i]) & 255)).toString()
        ).join('.')
        broadcasts.push({ localIp: iface.address, broadcast })
      }
    }
  }
  return broadcasts.length > 0 ? broadcasts : [{ localIp: '0.0.0.0', broadcast: '255.255.255.255' }]
}

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
    const networkInterfaces = getSubnetBroadcasts()
    const localIp = networkInterfaces[0].localIp
    const discoveredMacs = new Set()

    // WiZ standard discovery: bulbs respond to registration requests
    const registrationMsg = Buffer.from(JSON.stringify({
      method: 'registration',
      params: { phoneMac: 'AAAAAAAAAAAA', register: false, phoneIp: localIp, id: '1' }
    }))
    // Fallback: getPilot broadcast (some bulbs respond to this)
    const getPilotMsg = Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }))

    // WiZ bulbs can respond to registration on port 38900 OR reply to our source port
    // We create two sockets: one on a random port (send+receive), one on 38900 (receive registration responses)
    const sockets = []
    let resolved = false

    function handleMessage (msg, rinfo) {
      try {
        const parsed = JSON.parse(msg.toString())
        const mac = parsed.result?.mac || parsed.params?.mac
        if (mac) {
          if (discoveredMacs.has(mac)) return
          discoveredMacs.add(mac)
        }

        // Registration response only has { mac, success } — fetch full state via getPilot
        if (parsed.method === 'registration') {
          sendCommandToBulb(rinfo.address, JSON.stringify({ method: 'getPilot', params: {} }))
            .then(response => {
              const pilotData = JSON.parse(response)
              const bulbData = { ip: rinfo.address, ...pilotData }
              console.log('Bombilla descubierta (estado completo):', bulbData)
              callback(bulbData)
            })
            .catch(err => console.error('Error obteniendo estado de bombilla tras registro:', err))
          return
        }

        const bulbData = { ip: rinfo.address, ...parsed }
        console.log('Bombilla descubierta:', bulbData)
        callback(bulbData)
      } catch (e) {
        console.error('Error al parsear respuesta de bombilla:', e)
      }
    }

    function closeAll () {
      if (resolved) return
      resolved = true
      sockets.forEach(s => { try { s.close() } catch (_) {} })
      resolve()
    }

    function createDiscoverySocket (port, onReady) {
      const sock = createSocket('udp4')
      sockets.push(sock)

      sock.on('error', (err) => {
        console.error(`Error en socket de descubrimiento (puerto ${port || 'aleatorio'}):`, err.message)
        // Don't reject — other socket may still work
      })

      sock.on('message', handleMessage)

      sock.on('listening', () => {
        sock.setBroadcast(true)
        if (onReady) onReady(sock)
      })

      sock.bind(port || 0)
    }

    function sendBroadcasts (sock) {
      networkInterfaces.forEach(({ broadcast }) => {
        sock.send(registrationMsg, 0, registrationMsg.length, 38899, broadcast, (err) => {
          if (err) console.error(`Error enviando registration a ${broadcast}:`, err.message)
        })
        sock.send(getPilotMsg, 0, getPilotMsg.length, 38899, broadcast, (err) => {
          if (err) console.error(`Error enviando getPilot a ${broadcast}:`, err.message)
        })
      })
    }

    // Main socket: send broadcasts and receive replies on random port
    createDiscoverySocket(null, (sock) => {
      sendBroadcasts(sock)
      console.log('Mensajes de descubrimiento enviados a:', networkInterfaces.map(n => n.broadcast))

      // Retry every 3s to catch bulbs that wake up late
      const retryInterval = setInterval(() => {
        if (resolved) { clearInterval(retryInterval); return }
        console.log('Reintentando descubrimiento...')
        sendBroadcasts(sock)
      }, 3000)
    })

    // Secondary socket on port 38900: receive registration responses WiZ bulbs send here
    createDiscoverySocket(38900, null)

    setTimeout(closeAll, 10000)
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
