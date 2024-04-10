const template = document.getElementById('bulb-template').content
const reloadButton = document.getElementById('reload-button')
const addRoomButton = document.getElementById('add-room-button')
const bulbsContainer = document.getElementById('bulbs-container')

const sceneColors = {
  // Static scenes
  6: [{ r: 255, g: 140, b: 0 }, { r: 255, g: 165, b: 0 }], // Cozy: Naranjas cálidos
  11: [{ r: 255, g: 222, b: 173 }, { r: 255, g: 239, b: 213 }], // Warm White: Blancos cálidos
  12: [{ r: 255, g: 255, b: 240 }, { r: 250, g: 250, b: 250 }], // Daylight: Luz diurna
  13: [{ r: 230, g: 230, b: 250 }, { r: 240, g: 248, b: 255 }], // Cool white: Blancos fríos
  14: [{ r: 255, g: 248, b: 220 }, { r: 255, g: 250, b: 205 }], // Night light: Tonos suaves de amarillo
  15: [{ r: 144, g: 238, b: 144 }, { r: 173, g: 216, b: 230 }], // Focus: Verdes y azules claros
  16: [{ r: 135, g: 206, b: 235 }, { r: 176, g: 224, b: 230 }], // Relax: Azules cielo y cian
  17: [{ r: 255, g: 160, b: 122 }, { r: 32, g: 178, b: 170 }], // True colors: Salmón y turquesa para vivacidad
  18: [{ r: 75, g: 0, b: 130 }, { r: 72, g: 61, b: 139 }], // TV time: Índigo y azul oscuro
  19: [{ r: 124, g: 252, b: 0 }, { r: 127, g: 255, b: 0 }], // Plantgrowth: Verdes vivos
  // Dynamic Scenes
  1: [{ r: 0, g: 105, b: 148 }, { r: 0, g: 128, b: 255 }], // Ocean
  2: [{ r: 255, g: 105, b: 180 }, { r: 255, g: 20, b: 147 }], // Romance
  3: [{ r: 255, g: 165, b: 0 }, { r: 255, g: 69, b: 0 }], // Sunset
  4: [{ r: 255, g: 0, b: 255 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }], // Party
  5: [{ r: 255, g: 140, b: 0 }, { r: 178, g: 34, b: 34 }], // Fireplace
  7: [{ r: 0, g: 100, b: 0 }, { r: 34, g: 139, b: 34 }], // Forest
  8: [{ r: 255, g: 182, b: 193 }, { r: 255, g: 105, b: 180 }], // Pastel Colors
  20: [{ r: 255, g: 192, b: 203 }, { r: 255, g: 182, b: 193 }], // Spring
  21: [{ r: 255, g: 215, b: 0 }, { r: 255, g: 165, b: 0 }], // Summer
  22: [{ r: 255, g: 69, b: 0 }, { r: 255, g: 99, b: 71 }], // Fall
  23: [{ r: 0, g: 0, b: 139 }, { r: 0, g: 191, b: 255 }], // Deepdive
  24: [{ r: 0, g: 100, b: 0 }, { r: 0, g: 128, b: 0 }], // Jungle
  25: [{ r: 50, g: 205, b: 50 }, { r: 173, g: 255, b: 47 }], // Mojito
  26: [{ r: 255, g: 20, b: 147 }, { r: 148, g: 0, b: 211 }], // Club
  27: [{ r: 255, g: 0, b: 0 }, { r: 255, g: 255, b: 0 }], // Christmas
  28: [{ r: 255, g: 140, b: 0 }, { r: 75, g: 0, b: 130 }], // Halloween
  29: [{ r: 255, g: 248, b: 220 }, { r: 255, g: 222, b: 173 }], // Candlelight
  30: [{ r: 245, g: 222, b: 179 }, { r: 255, g: 250, b: 205 }], // Golden white
  31: [{ r: 255, g: 0, b: 0 }, { r: 255, g: 105, b: 180 }], // Pulse
  32: [{ r: 112, g: 128, b: 144 }, { r: 119, g: 136, b: 153 }], // Steampunk
  // Miscellaneous
  9: [{ r: 255, g: 239, b: 213 }, { r: 255, g: 250, b: 240 }], // Wake up
  10: [{ r: 25, g: 25, b: 112 }, { r: 72, g: 61, b: 139 }], // Bedtime
  1000: [{ r: 255, g: 215, b: 0 }, { r: 218, g: 165, b: 32 }] // Rhythm
}

document.getElementById('cancelBtn').addEventListener('click', function () {
  document.getElementById('myModal').style.display = 'none'
})

function updateBulb ({ container, bulbId, color, colorTemp, sceneId, opacity }) {
  const bulb = container.querySelector('#' + bulbId)
  if (colorTemp) {
    bulb.style.backgroundColor = kelvinToHexColor(colorTemp)
  } else if (sceneId && sceneColors[sceneId]) {
    const colors = sceneColors[sceneId]
    let gradient = 'linear-gradient(45deg'
    colors.forEach((color, index) => {
      gradient += `, ${rgbToHex(color.r, color.g, color.b)} ${index * (100 / colors.length)}%`
    })
    gradient += ')'
    bulb.style.backgroundImage = gradient
  } else if (color) {
    const { r, g, b } = color
    bulb.style.backgroundColor = rgbToHex(r, g, b)
  }
  bulb.style.opacity = opacity / 100
}

const modal = document.getElementById('save-status-modal')
function closeModal () {
  modal.style.display = 'none'
}
modal.children[0].addEventListener('click', () => closeModal())
function openModal (bulb) {
  modal.style.display = 'block'
  document.getElementById('hiddenInput').value = bulb
}
async function saveName () {
  const status = JSON.parse(document.getElementById('hiddenInput').value)
  const name = document.getElementById('nameInput').value
  if (!name) return alert('Specify a name please')
  const data = {
    ...status,
    name
  }
  await window.dataProcessing.addStatus(data)
  alert('Status successfully saved')
  closeModal()
}
modal.children[6].addEventListener('click', async () => await saveName())
window.onclick = function (event) {
  if (event.target === modal) {
    closeModal()
  }
}

let storedBulbs
let favStatus
(async () => {
  storedBulbs = await window.dataProcessing.getStoredBulbs()
  const rooms = storedBulbs.filter(bulb => bulb.bulbs)
  rooms.forEach(room => {
    bulbsContainer.appendChild(getRoomHTML(room))
  })

  const favsContainer = document.getElementById('fav-status')
  favStatus = await window.dataProcessing.getStatus()
  favStatus.forEach(status => {
    const statusItem = document.createElement('div')
    statusItem.className = 'status'
    statusItem.innerText = status.name

    const deleteBtn = document.createElement('button')
    deleteBtn.innerHTML = '🗑️'
    deleteBtn.className = 'delete-btn'
    deleteBtn.onclick = async (event) => {
      event.stopPropagation()
      const isConfirmed = confirm(`Are you sure you want to delete "${status.name}"?`)
      if (isConfirmed) {
        try {
          await window.dataProcessing.removeStatus(status.id)
          statusItem.remove()
        } catch (error) {
          alert('There was an error deleting the status.')
        }
      }
    }
    statusItem.appendChild(deleteBtn)

    statusItem.addEventListener('click', async () => {
      let response
      try {
        await window.bulbNetworking.setStatus(status.ip, status.result)
      } catch (error) {
        alert('there was an error')
      }
      console.log(response)
    })
    favsContainer.appendChild(statusItem)
  })

  addRoomButton.addEventListener('click', async () => {
    await window.dataProcessing.addOrEditStoredBulbs({
      name: 'New room'
    })
    location.reload()
  })
})()

function populateList ({ allItems, selectedItemsMac }) {
  const valuesList = document.getElementById('valuesList')
  valuesList.innerHTML = ''
  allItems.forEach(item => {
    const listItem = document.createElement('li')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = item.name
    if (selectedItemsMac) {
      checkbox.checked = selectedItemsMac.includes(item.mac)
    }
    checkbox.setAttribute('mac', item.mac)
    checkbox.setAttribute('data-name', item.name)

    listItem.appendChild(checkbox)
    listItem.append(item.name)
    valuesList.appendChild(listItem)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  window.bulbNetworking.startDiscovery()

  window.bulbNetworking.onBulbDiscovered(async (bulbData) => {
    if (storedBulbs) {
      const bulb = storedBulbs.filter(bulb => bulbData.result.mac === bulb.mac)
      if (bulb.length > 0) {
        bulbData = {
          ...bulbData,
          name: bulb[0].name
        }
      } else {
        await window.dataProcessing.addOrEditStoredBulbs({
          name: 'Bulb',
          mac: bulbData.result.mac,
          ip: bulbData.ip
        })
        bulbData = {
          ...bulbData,
          name: 'Bulb'
        }
      }
    }
    bulbsContainer.appendChild(getBulbHTML(bulbData))
  })
})

reloadButton.addEventListener('click', () => {
  location.reload()
})

function getRoomHTML (room) {
  const roomId = 'room' + room.mac

  const bulbTemplate = template.querySelector('.bulb-section').cloneNode(true)
  const errorContainer = bulbTemplate.querySelector('.error')

  const bulbSwitch = bulbTemplate.querySelector('.bulb-switch > input')

  if (room.name) {
    const bulbNameInput = document.createElement('input')
    bulbNameInput.className = 'bulb-name'
    bulbNameInput.value = room.name

    const bulbContainer = bulbTemplate.querySelector('.bulb-container')
    bulbContainer.appendChild(bulbNameInput)

    async function handleNameChange () {
      const newName = bulbNameInput.value
      const macAddress = roomId
      await window.dataProcessing.addOrEditStoredBulbs({
        ...room,
        name: newName,
        mac: macAddress
      })
    }

    bulbNameInput.addEventListener('blur', handleNameChange)

    bulbNameInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        bulbNameInput.blur()
      }
    })
  }

  if (!room.bulbs.length > 0) {
    const tabs = bulbTemplate.querySelectorAll('.tab-content')
    tabs.forEach(tab => {
      tab.parentNode.removeChild(tab)
    })
    bulbTemplate.querySelector('.dimming').remove()
    bulbTemplate.querySelector('.save-status').remove()
    bulbTemplate.querySelector('.bulb-switch').remove()
    bulbTemplate.querySelector('.mode-selector').remove()
    bulbTemplate.style.justifyContent = ''
    const noBulbMessage = document.createElement('p')
    noBulbMessage.innerHTML = "This room doesn't have any bulbs"
    bulbTemplate.appendChild(noBulbMessage)

    const addBulbsButton = document.createElement('button')
    addBulbsButton.textContent = 'Add bulb'
    addBulbsButton.addEventListener('click', async (e) => {
      document.getElementById('myModal').style.display = 'block'
      populateList({
        allItems: storedBulbs.filter(bulb => !bulb.bulbs)
      })
    })
    bulbTemplate.appendChild(addBulbsButton)
  } else {
    const roomBulbs = storedBulbs.filter(obj => room.bulbs.includes(obj.mac))

    const roomSwitch = bulbTemplate.querySelector('.bulb-switch > input')
    roomSwitch.checked = false

    const modeSelector = bulbTemplate.querySelector('.mode-selector')
    const colorPicker = bulbTemplate.querySelector('.color-picker')
    const tempPicker = bulbTemplate.querySelector('.temp-picker')
    const sceneSelector = bulbTemplate.querySelector('#scene-selector')
    const sceneSpeedRange = bulbTemplate.querySelector('.speed-range')
    const dimmingRange = bulbTemplate.querySelector('.dimming-range')

    const colorInput = document.createElement('input')
    colorInput.type = 'radio'
    colorInput.value = 'color'
    colorInput.id = 'color' + roomId
    colorInput.name = 'mode' + roomId
    colorInput.checked = false
    const colorLabel = document.createElement('label')
    colorLabel.htmlFor = 'color' + roomId
    colorLabel.innerHTML = '<img class="tab-selector" src="../public/color-picker.svg" alt="Color Picker tab">'
    colorLabel.title = 'color picker'
    modeSelector.appendChild(colorInput)
    modeSelector.appendChild(colorLabel)

    const tempInput = document.createElement('input')
    tempInput.type = 'radio'
    tempInput.value = 'temp'
    tempInput.id = 'temp' + roomId
    tempInput.name = 'mode' + roomId
    tempInput.checked = true
    const tempLabel = document.createElement('label')
    tempLabel.htmlFor = 'temp' + roomId
    tempLabel.innerHTML = '<img class="tab-selector" src="../public/temperature-picker.svg" alt="Temperature Picker tab">'
    tempLabel.title = 'temperature picker'
    modeSelector.appendChild(tempInput)
    modeSelector.appendChild(tempLabel)

    const sceneInput = document.createElement('input')
    sceneInput.type = 'radio'
    sceneInput.value = 'scene'
    sceneInput.id = 'scene' + roomId
    sceneInput.name = 'mode' + roomId
    const sceneLabel = document.createElement('label')
    sceneLabel.htmlFor = 'scene' + roomId
    sceneLabel.innerText = 'Scene'
    sceneLabel.innerHTML = '<img class="tab-selector" src="../public/scene-picker.svg" alt="Scene Picker tab">'
    sceneLabel.title = 'scene picker'
    modeSelector.appendChild(sceneInput)
    modeSelector.appendChild(sceneLabel)

    const updateTabs = (bulbContainer) => {
      const tabs = bulbTemplate.querySelectorAll('.tab-content')
      tabs.forEach(tab => {
        const selectedMode = modeSelector.querySelector(`input[name="mode${roomId}"]:checked`).value
        if (selectedMode === tab.id) {
          tab.style.display = 'flex'
          return
        }
        tab.style.display = 'none'
      })
    }

    function updateError (message) {
      errorContainer.innerHTML = message
    }

    modeSelector.querySelector(`#temp${roomId}`).checked = true
    updateTabs(bulbTemplate)

    modeSelector.addEventListener('change', async (event) => {
      updateTabs(bulbTemplate)
    })

    roomSwitch.addEventListener('change', async (event) => {
      const isBulbOn = !event.target.checked
      const promises = roomBulbs.map(bulb => window.bulbNetworking.setBulb(bulb.ip, !isBulbOn))
      await Promise.allSettled(promises)
      event.target.innerHTML = !isBulbOn
    })

    tempPicker.addEventListener('change', async (event) => {
      const promises = roomBulbs.map(bulb => window.bulbNetworking.setTemp(bulb.ip, event.target.value, dimmingRange.value))
      await Promise.allSettled(promises)

      // if (!response.result.success) return updateError('There was an error updating the bulb.')
      bulbSwitch.checked = true
    })

    colorPicker.addEventListener('input', async (event) => {
      const rgbColor = hexaToRGB(event.target.value)
      const promises = roomBulbs.map(bulb => window.bulbNetworking.changeColor(bulb.ip, rgbColor, dimmingRange.value))
      await Promise.allSettled(promises)
      // if (!response.result.success) return updateError('There was an error updating the bulb.')
      bulbSwitch.checked = true
    })

    sceneSelector.addEventListener('change', async (event) => {
      const promises = roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip, event.target.value, sceneSpeedRange.value, dimmingRange.value))
      await Promise.allSettled(promises)
      // if (!response.result.success) return updateError('There was an error updating the bulb.')
      bulbSwitch.checked = true
    })

    sceneSpeedRange.addEventListener('change', async (event) => {
      const promises = roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip, sceneSelector.value, event.target.value, dimmingRange.value))
      await Promise.allSettled(promises)
      // if (!response.result.success) return updateError('There was an error updating the bulb.')
      bulbSwitch.checked = true
    })

    dimmingRange.addEventListener('change', async (event) => {
      const selectedMode = modeSelector.querySelector(`input[name="mode${roomId}"]:checked`).value
      let response
      let promises
      switch (selectedMode) {
        case 'color':
          promises = roomBulbs.map(bulb => window.bulbNetworking.changeColor(bulb.ip, hexaToRGB(colorPicker.value), event.target.value))
          break
        case 'temp':
          promises = roomBulbs.map(bulb => window.bulbNetworking.setTemp(bulb.ip, tempPicker.value, event.target.value))
          break
        case 'scene':
          promises = roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip, sceneSelector.value, sceneSpeedRange.value, event.target.value))
          break
      }
      await Promise.allSettled(promises)
      if (!response.result.success) return updateError('There was an error updating the bulb.')
      bulbSwitch.checked = true
    })

    const addBulbsButton = document.createElement('button')
    addBulbsButton.textContent = 'Add bulb'
    addBulbsButton.addEventListener('click', async (e) => {
      document.getElementById('myModal').style.display = 'block'
      populateList({
        allItems: storedBulbs.filter(bulb => !bulb.bulbs),
        selectedItemsMac: room.bulbs
      })
    })
    bulbTemplate.appendChild(addBulbsButton)
  }

  document.getElementById('confirmBtn').addEventListener('click', async function () {
    const selectedValues = []
    document.querySelectorAll('#valuesList input[type="checkbox"]:checked').forEach(checkbox => {
      selectedValues.push(checkbox.getAttribute('mac'))
    })

    room.bulbs = selectedValues
    await window.dataProcessing.addOrEditStoredBulbs(room)
    document.getElementById('myModal').style.display = 'none'
  })

  return bulbTemplate
}

function getBulbHTML (bulb) {
  const bulbId = 'bulb' + bulb.result.mac

  const bulbTemplate = template.querySelector('.bulb-section').cloneNode(true)
  const errorContainer = bulbTemplate.querySelector('.error')

  const bulbSwitch = bulbTemplate.querySelector('.bulb-switch > input')
  bulbSwitch.checked = bulb.result.state

  const modeSelector = bulbTemplate.querySelector('.mode-selector')
  const colorPicker = bulbTemplate.querySelector('.color-picker')
  if (bulb.result.r || bulb.result.g || bulb.result.b) {
    colorPicker.value = rgbToHex(bulb.result.r, bulb.result.g, bulb.result.b)
  }
  const tempPicker = bulbTemplate.querySelector('.temp-picker')
  tempPicker.value = bulb.result.temp ?? tempPicker.value
  const sceneSelector = bulbTemplate.querySelector('#scene-selector')
  sceneSelector.value = bulb.result.sceneId ?? sceneSelector.value
  const sceneSpeedRange = bulbTemplate.querySelector('.speed-range')
  sceneSpeedRange.value = bulb.result.speed ?? sceneSpeedRange.value
  const dimmingRange = bulbTemplate.querySelector('.dimming-range')
  dimmingRange.value = bulb.result.dimming

  const saveStatusButton = bulbTemplate.querySelector('.save-status')
  saveStatusButton.addEventListener('click', async () => {
    let properties = {
      state: bulbSwitch.checked,
      dimming: dimmingRange.value
    }
    const selectedMode = modeSelector.querySelector(`input[name="mode${bulb.result.mac}"]:checked`).value
    if (selectedMode === 'temp') {
      properties.temp = parseInt(tempPicker.value)
    } else if (selectedMode === 'color') {
      properties = {
        ...properties,
        ...hexaToRGB(colorPicker.value)
      }
    }

    openModal(JSON.stringify({
      ...properties,
      ...bulb
    }))
  })

  const bulbContainer = bulbTemplate.querySelector('.bulb-container')
  bulbContainer.innerHTML = `<img class="bulb" id="${bulbId}" src="../public/bulb.svg" alt="Bulb">`
  if (bulb.name) {
    const bulbNameInput = document.createElement('input')
    bulbNameInput.className = 'bulb-name'
    bulbNameInput.value = bulb.name
    bulbContainer.appendChild(bulbNameInput)

    async function handleNameChange () {
      const newName = bulbNameInput.value
      const macAddress = bulb.result.mac
      await window.dataProcessing.addOrEditStoredBulbs({
        name: newName,
        mac: macAddress
      })
    }

    bulbNameInput.addEventListener('blur', handleNameChange)

    bulbNameInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        bulbNameInput.blur()
      }
    })
  }

  updateBulb({
    container: bulbContainer,
    bulbId,
    colorTemp: parseInt(bulb.result.temp),
    color: {
      r: bulb.result.r,
      g: bulb.result.g,
      b: bulb.result.b
    },
    sceneId: bulb.result.sceneId,
    opacity: bulb.result.dimming
  })

  const colorInput = document.createElement('input')
  colorInput.type = 'radio'
  colorInput.value = 'color'
  colorInput.id = 'color' + bulb.result.mac
  colorInput.name = 'mode' + bulb.result.mac
  colorInput.checked = bulb.result.r
  const colorLabel = document.createElement('label')
  colorLabel.htmlFor = 'color' + bulb.result.mac
  colorLabel.innerHTML = '<img class="tab-selector" src="../public/color-picker.svg" alt="Color Picker tab">'
  colorLabel.title = 'color picker'
  modeSelector.appendChild(colorInput)
  modeSelector.appendChild(colorLabel)

  const tempInput = document.createElement('input')
  tempInput.type = 'radio'
  tempInput.value = 'temp'
  tempInput.id = 'temp' + bulb.result.mac
  tempInput.name = 'mode' + bulb.result.mac
  tempInput.checked = bulb.result.temp
  const tempLabel = document.createElement('label')
  tempLabel.htmlFor = 'temp' + bulb.result.mac
  tempLabel.innerHTML = '<img class="tab-selector" src="../public/temperature-picker.svg" alt="Temperature Picker tab">'
  tempLabel.title = 'temperature picker'
  modeSelector.appendChild(tempInput)
  modeSelector.appendChild(tempLabel)

  const sceneInput = document.createElement('input')
  sceneInput.type = 'radio'
  sceneInput.value = 'scene'
  sceneInput.id = 'scene' + bulb.result.mac
  sceneInput.name = 'mode' + bulb.result.mac
  sceneInput.checked = bulb.result.scene
  const sceneLabel = document.createElement('label')
  sceneLabel.htmlFor = 'scene' + bulb.result.mac
  sceneLabel.innerText = 'Scene'
  sceneLabel.innerHTML = '<img class="tab-selector" src="../public/scene-picker.svg" alt="Scene Picker tab">'
  sceneLabel.title = 'scene picker'
  modeSelector.appendChild(sceneInput)
  modeSelector.appendChild(sceneLabel)

  const updateTabs = (bulbContainer) => {
    const tabs = bulbTemplate.querySelectorAll('.tab-content')
    tabs.forEach(tab => {
      const selectedMode = modeSelector.querySelector(`input[name="mode${bulb.result.mac}"]:checked`).value
      if (selectedMode === tab.id) {
        tab.style.display = 'flex'
        return
      }
      tab.style.display = 'none'
    })
  }

  bulbSwitch.addEventListener('change', async (event) => {
    const isBulbOn = !event.target.checked
    const response = await window.bulbNetworking.setBulb(bulb.ip, !isBulbOn)
    if (!response.result.success) return updateError('There was an error updating the bulb.')
    event.target.innerHTML = !isBulbOn
  })

  function updateError (message) {
    errorContainer.innerHTML = message
  }

  if (bulb.result.temp) {
    modeSelector.querySelector(`#temp${bulb.result.mac}`).checked = true
  } else if (bulb.result.r) {
    modeSelector.querySelector(`#color${bulb.result.mac}`).checked = true
  } else if (bulb.result.sceneId) {
    modeSelector.querySelector(`#scene${bulb.result.mac}`).checked = true
  }
  updateTabs(bulbTemplate)

  modeSelector.addEventListener('change', async (event) => {
    updateTabs(bulbTemplate)
  })

  tempPicker.addEventListener('change', async (event) => {
    const response = await window.bulbNetworking.setTemp(bulb.ip, event.target.value, dimmingRange.value)
    updateBulb({ container: bulbContainer, bulbId, colorTemp: parseInt(event.target.value), opacity: dimmingRange.value })
    if (!response.result.success) return updateError('There was an error updating the bulb.')
    bulbSwitch.checked = true
  })

  colorPicker.addEventListener('input', async (event) => {
    const rgbColor = hexaToRGB(event.target.value)
    const response = await window.bulbNetworking.changeColor(bulb.ip, rgbColor, dimmingRange.value)
    updateBulb({ container: bulbContainer, bulbId, color: { r: rgbColor.r, g: rgbColor.g, b: rgbColor.b }, opacity: dimmingRange.value })
    if (!response.result.success) return updateError('There was an error updating the bulb.')
    bulbSwitch.checked = true
  })

  sceneSelector.addEventListener('change', async (event) => {
    const response = await window.bulbNetworking.setScene(bulb.ip, event.target.value, sceneSpeedRange.value, dimmingRange.value)
    if (!response.result.success) return updateError('There was an error updating the bulb.')
    updateBulb({ container: bulbContainer, bulbId, sceneId: event.target.value, opacity: dimmingRange.value })
    bulbSwitch.checked = true
  })

  sceneSpeedRange.addEventListener('change', async (event) => {
    const response = await window.bulbNetworking.setScene(bulb.ip, sceneSelector.value, event.target.value, dimmingRange.value)
    if (!response.result.success) return updateError('There was an error updating the bulb.')
    bulbSwitch.checked = true
  })

  dimmingRange.addEventListener('change', async (event) => {
    const selectedMode = modeSelector.querySelector(`input[name="mode${bulb.result.mac}"]:checked`).value
    let response
    switch (selectedMode) {
      case 'color':
        response = await window.bulbNetworking.changeColor(bulb.ip, hexaToRGB(colorPicker.value), event.target.value)
        break
      case 'temp':
        response = await window.bulbNetworking.setTemp(bulb.ip, tempPicker.value, event.target.value)
        break
      case 'scene':
        response = await window.bulbNetworking.setScene(bulb.ip, sceneSelector.value, sceneSpeedRange.value, event.target.value)
        break
    }
    if (!response.result.success) return updateError('There was an error updating the bulb.')
    const updateBulbProps = { container: bulbContainer, bulbId, opacity: event.target.value }
    if (selectedMode === 'temp') {
      updateBulbProps.colorTemp = parseInt(tempPicker.value)
    } else if (selectedMode === 'color') {
      updateBulbProps.color = hexaToRGB(colorPicker.value)
    } else if (selectedMode === 'scene') {
      updateBulbProps.sceneId = sceneSelector.value
    }
    updateBulb(updateBulbProps)
    bulbSwitch.checked = true
  })

  return bulbTemplate
}

function hexaToRGB (hexaColor) {
  const r = parseInt(hexaColor.substr(1, 2), 16)
  const g = parseInt(hexaColor.substr(3, 2), 16)
  const b = parseInt(hexaColor.substr(5, 2), 16)
  return {
    r,
    g,
    b
  }
}
function componentToHex (c) {
  const hex = c.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}
function rgbToHex (r, g, b) {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b)
}
function kelvinToHexColor (kelvin) {
  const colorScale = [
    { temp: 1000, color: '#FF4500' }, // Red
    { temp: 3000, color: '#FFA07A' }, // LightSalmon
    { temp: 5000, color: '#FFFACD' }, // LemonChiffon
    { temp: 7000, color: '#FFFFFF' }, // White
    { temp: 10000, color: '#D3D3D3' } // LightGray
  ]

  let color = ''
  for (let i = 0; i < colorScale.length; i++) {
    if (kelvin < colorScale[i].temp) {
      color = colorScale[i].color
      break
    }
  }

  return color
}
