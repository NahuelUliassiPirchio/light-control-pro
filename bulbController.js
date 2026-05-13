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

function validateWizResponse (parsed) {
  if (parsed.result?.success === false) {
    throw new Error(`Bulb error (code: ${parsed.result.errorCode ?? 'unknown'})`)
  }
  return parsed
}

function clamp (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistent command socket
//
// On macOS, a fresh UDP socket bound to 0.0.0.0 returns EHOSTUNREACH for
// unicast packets to local-subnet IPs unless it has first received a packet
// from that subnet (routing context is per-socket, not global).
//
// Binding the socket to the local interface IP instead of 0.0.0.0 tells macOS
// which interface to route through immediately, eliminating EHOSTUNREACH even
// for bulbs that never respond to broadcast probes (e.g. some LED strips).
// ─────────────────────────────────────────────────────────────────────────────
const pendingByIp = new Map() // ip → [{resolve, reject, timer, id}]

let cmdSocket = null
let cmdSocketReady = null
let cachedInterfaces = null // refreshed each time the socket is (re)created
let msgId = 0

function makeProbe (interfaces) {
  return Buffer.from(JSON.stringify({
    method: 'registration',
    params: { phoneMac: 'AAAAAAAAAAAA', register: false, phoneIp: interfaces[0].localIp, id: '1' }
  }))
}

function makePilotProbe () {
  return Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }))
}

function createCmdSocket () {
  // Resolve interfaces before creating the socket so we can bind to the local IP.
  // Binding to the specific local IP (instead of 0.0.0.0) lets macOS associate the
  // socket with the correct interface immediately, avoiding EHOSTUNREACH on unicast.
  cachedInterfaces = getSubnetBroadcasts()
  const bindIp = cachedInterfaces[0].localIp !== '0.0.0.0' ? cachedInterfaces[0].localIp : undefined

  const sock = createSocket('udp4')

  sock.on('message', (msg, rinfo) => {
    const queue = pendingByIp.get(rinfo.address)
    if (!queue || queue.length === 0) return
    let idx = 0
    try {
      // eslint-disable-next-line eqeqeq
      const responseId = JSON.parse(msg.toString()).id
      if (responseId != null) {
        // Use == to handle firmware that echoes id as a different type (e.g. string vs number)
        // eslint-disable-next-line eqeqeq
        const matched = queue.findIndex(p => p.id == responseId)
        if (matched !== -1) idx = matched
        // If matched === -1 the response is unsolicited or stale; fall through to FIFO
      }
    } catch (_) { /* unparseable — fall through to FIFO */ }
    const pending = queue.splice(idx, 1)[0]
    if (queue.length === 0) pendingByIp.delete(rinfo.address)
    clearTimeout(pending.timer)
    pending.resolve(msg.toString())
  })

  sock.on('error', (err) => {
    console.error('Command socket error:', err.message)
    cmdSocket = null
    cmdSocketReady = null
    for (const [, queue] of pendingByIp) {
      queue.forEach(p => { clearTimeout(p.timer); p.reject(err) })
    }
    pendingByIp.clear()
  })

  cmdSocketReady = new Promise((resolve) => {
    sock.once('listening', () => {
      sock.setBroadcast(true)

      // Send both registration and getPilot probes: some devices (e.g. LED strips)
      // only respond to one or the other. 3 rounds spaced 1.5s apart handle slow
      // devices and cases where the Mac's WiFi just came up and drops the first packet.
      // Resolves immediately on any reply, or after 5s fallback if all bulbs are off.
      const regProbe = makeProbe(cachedInterfaces)
      const pilotProbe = makePilotProbe()

      let done = false
      const finish = () => { if (!done) { done = true; resolve() } }
      sock.once('message', finish)
      const fallback = setTimeout(finish, 5000)
      sock._primingFallback = fallback

      const sendProbes = () => cachedInterfaces.forEach(({ broadcast }) => {
        sock.send(regProbe, 0, regProbe.length, 38899, broadcast, () => {})
        sock.send(pilotProbe, 0, pilotProbe.length, 38899, broadcast, () => {})
      })
      sendProbes()
      const r1 = setTimeout(sendProbes, 1500)
      const r2 = setTimeout(sendProbes, 3000)
      sock._primingRetries = [r1, r2]
    })
    sock.bind(0, bindIp)
  })

  return sock
}

function ensureCmdSocket () {
  if (!cmdSocket) cmdSocket = createCmdSocket()
  return cmdSocketReady
}

async function sendCommandToBulb (ip, message, retry = true) {
  await ensureCmdSocket()

  const id = ++msgId
  const withId = JSON.stringify(Object.assign(JSON.parse(message), { id }))
  const messageBuffer = Buffer.from(withId)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      removePending(ip, id)
      reject(new Error('No response received from bulb'))
    }, 5000)

    if (!pendingByIp.has(ip)) pendingByIp.set(ip, [])
    pendingByIp.get(ip).push({ resolve, reject, timer, id })

    cmdSocket.send(messageBuffer, 0, messageBuffer.length, 38899, ip, (err) => {
      if (err) {
        removePending(ip, id)
        clearTimeout(timer)
        // On EHOSTUNREACH the routing context was lost (e.g. network interface changed
        // after the socket was created). Reset and retry once with a fresh socket.
        // We close the old socket without rejecting other pending commands — those will
        // time out naturally rather than getting an immediate "App closing" error.
        if (err.code === 'EHOSTUNREACH' && retry) {
          const old = cmdSocket
          if (old) {
            if (old._primingFallback) clearTimeout(old._primingFallback)
            if (old._primingRetries) old._primingRetries.forEach(clearTimeout)
            try { old.close() } catch (_) {}
          }
          cmdSocket = null
          cmdSocketReady = null
          ensureCmdSocket().then(() => sendCommandToBulb(ip, message, false)).then(resolve).catch(reject)
        } else {
          reject(err)
        }
      }
    })
  })
}

function removePending (ip, id) {
  const queue = pendingByIp.get(ip)
  if (!queue) return
  const idx = queue.findIndex(p => p.id === id)
  if (idx !== -1) queue.splice(idx, 1)
  if (queue.length === 0) pendingByIp.delete(ip)
}

function closeCmdSocket () {
  if (cmdSocket) {
    if (cmdSocket._primingFallback) clearTimeout(cmdSocket._primingFallback)
    if (cmdSocket._primingRetries) cmdSocket._primingRetries.forEach(clearTimeout)
    try { cmdSocket.close() } catch (_) {}
    cmdSocket = null
    cmdSocketReady = null
  }
  for (const [, queue] of pendingByIp) {
    queue.forEach(p => { clearTimeout(p.timer); p.reject(new Error('App closing')) })
  }
  pendingByIp.clear()
}

// Prime the socket early so it's ready before the first command
ensureCmdSocket()

// Periodic heartbeat to keep the macOS per-socket routing context alive.
// ARP entries expire after ~1200s (macOS default); 120s gives a 10x safety
// margin against early eviction under memory pressure, with minimal traffic.
// Also detects network interface changes (e.g. WiFi reconnect with new IP)
// and resets the socket so the next command primes against the new subnet.
setInterval(() => {
  if (!cmdSocket) return

  const currentInterfaces = getSubnetBroadcasts()
  const interfacesChanged = !cachedInterfaces ||
    cachedInterfaces.length !== currentInterfaces.length ||
    cachedInterfaces.some((iface, i) =>
      iface.localIp !== currentInterfaces[i]?.localIp ||
      iface.broadcast !== currentInterfaces[i]?.broadcast
    )

  if (interfacesChanged) {
    console.log('Network interface changed, resetting command socket')
    closeCmdSocket()
    ensureCmdSocket()
    return
  }

  const probe = makeProbe(cachedInterfaces)
  cachedInterfaces.forEach(({ broadcast }) => {
    cmdSocket.send(probe, 0, probe.length, 38899, broadcast, () => {})
  })
}, 120000)

function discoverBulbs (callback) {
  return new Promise((resolve, reject) => {
    const networkInterfaces = getSubnetBroadcasts()
    const localIp = networkInterfaces[0].localIp
    const discoveredMacs = new Set()

    const registrationMsg = Buffer.from(JSON.stringify({
      method: 'registration',
      params: { phoneMac: 'AAAAAAAAAAAA', register: false, phoneIp: localIp, id: '1' }
    }))
    const getPilotMsg = Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }))

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

        if (parsed.method === 'registration') {
          sendCommandToBulb(rinfo.address, JSON.stringify({ method: 'getPilot', params: {} }))
            .then(response => {
              const pilotData = JSON.parse(response)
              const bulbData = { ip: rinfo.address, ...pilotData }
              console.log('Bulb discovered (full state):', bulbData)
              callback(bulbData)
            })
            .catch(err => console.error('Error getting bulb state after registration:', err.message))
          return
        }

        const bulbData = { ip: rinfo.address, ...parsed }
        console.log('Bulb discovered:', bulbData)
        callback(bulbData)
      } catch (e) {
        console.error('Error parsing bulb response:', e)
      }
    }

    function closeAll () {
      if (resolved) return
      resolved = true
      sockets.forEach(s => { try { s.close() } catch (_) {} })
      resolve([])
    }

    function createDiscoverySocket (port, onReady) {
      const sock = createSocket('udp4')
      sockets.push(sock)

      sock.on('error', (err) => {
        console.error(`Discovery socket error (port ${port || 'random'}):`, err.message)
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
          if (err) console.error(`Error sending registration to ${broadcast}:`, err.message)
        })
        sock.send(getPilotMsg, 0, getPilotMsg.length, 38899, broadcast, (err) => {
          if (err) console.error(`Error sending getPilot to ${broadcast}:`, err.message)
        })
      })
    }

    createDiscoverySocket(null, (sock) => {
      sendBroadcasts(sock)
      console.log('Discovery messages sent to:', networkInterfaces.map(n => n.broadcast))

      const retryInterval = setInterval(() => {
        if (resolved) { clearInterval(retryInterval); return }
        console.log('Retrying discovery...')
        sendBroadcasts(sock)
      }, 3000)
    })

    createDiscoverySocket(38900, null)

    setTimeout(closeAll, 10000)
  })
}

async function handleGetBulbs (callback) {
  try {
    const bulbs = await discoverBulbs(callback)
    console.log(`Bulbs discovered: ${bulbs.length}`)
    return bulbs
  } catch (error) {
    console.error('Error discovering bulbs:', error)
    throw error
  }
}

async function handleGetBulbState (event, ip) {
  try {
    const message = '{"method":"getPilot","params":{}}'
    const response = await sendCommandToBulb(ip, message)
    return validateWizResponse(JSON.parse(response))
  } catch (error) {
    console.error('Error getting bulb state:', error.message)
    throw error
  }
}

async function handleSetBulbStatus (mainWindow, _event, ip, commandParams, options = {}) {
  console.log(commandParams)
  const params = {}

  if (commandParams.state !== undefined) {
    params.state = commandParams.state
  }

  if (commandParams.dimming !== undefined) {
    params.dimming = clamp(Math.round(Number(commandParams.dimming)), 10, 100)
  }

  if (commandParams.r !== undefined && commandParams.g !== undefined && commandParams.b !== undefined) {
    params.r = clamp(Math.round(commandParams.r), 0, 255)
    params.g = clamp(Math.round(commandParams.g), 0, 255)
    params.b = clamp(Math.round(commandParams.b), 0, 255)
  }

  if (commandParams.temp !== undefined) {
    params.temp = clamp(Math.round(Number(commandParams.temp)), 2200, 6500)
  }

  const sceneId = commandParams.sceneId !== undefined ? Number(commandParams.sceneId) : undefined
  if (sceneId !== undefined && !Number.isNaN(sceneId) && sceneId !== 0) {
    params.sceneId = sceneId
    const sceneSpeed = commandParams.sceneSpeed ?? commandParams.speed
    if (sceneSpeed !== undefined) {
      params.speed = Number(sceneSpeed)
    }
  }

  const messageString = JSON.stringify({ method: 'setPilot', params })
  try {
    const response = await sendCommandToBulb(ip, messageString)
    const parsed = validateWizResponse(JSON.parse(response))
    if (!options.skipUiRefresh && mainWindow) {
      mainWindow.webContents.send('updatedBulbs', true)
    }
    console.log('Command response:', response)
    return parsed
  } catch (error) {
    console.error('Error sending command to bulb:', error.message)
    throw error
  }
}

module.exports = {
  handleSetBulbStatus,
  handleGetBulbState,
  handleGetBulbs,
  closeCmdSocket
}
