document.getElementById('minimizeBtn').addEventListener('click', () => window.windowControls.minimize())
document.getElementById('closeBtn').addEventListener('click', () => window.windowControls.close())

const template = document.getElementById('bulb-template').content
const reloadButton = document.getElementById('reload-button')
const addRoomButton = document.getElementById('add-room-button')
const bulbsContainer = document.getElementById('bulbs-container')

window.updateUi.onUpdatedBulbs(() => location.reload())

document.getElementById('cancelBtn').addEventListener('click', function () {
  document.getElementById('myModal').style.display = 'none'
})

const modal = document.getElementById('save-status-modal')
const saveStatusCloseButton = document.getElementById('save-status-close')
const saveStatusCancelButton = document.getElementById('save-status-cancel')
const saveStatusConfirmButton = document.getElementById('save-status-confirm')
const saveStatusTitle = document.getElementById('save-status-title')
const saveStatusDescription = document.getElementById('save-status-description')
const saveStatusTargetType = document.getElementById('save-status-target-type')
const saveStatusTargetName = document.getElementById('save-status-target-name')
const saveStatusSummary = document.getElementById('save-status-summary')
const saveStatusNameInput = document.getElementById('nameInput')
const saveStatusHiddenInput = document.getElementById('hiddenInput')
let pendingStatusDraft = null

function closeModal () {
  modal.style.display = 'none'
  saveStatusNameInput.value = ''
  saveStatusHiddenInput.value = ''
  pendingStatusDraft = null
  saveStatusConfirmButton.disabled = false
  saveStatusConfirmButton.innerText = 'Save preset'
}

function getEntityDisplayName (entity, isRoom) {
  if (entity.name) return entity.name
  if (isRoom) return 'New room'
  return entity.result?.name || 'Bulb'
}

function getStatusSummaryItems (status) {
  const summary = []
  const bulbsAmount = Array.isArray(status.bulbs) ? status.bulbs.length : 0
  summary.push(status.state ? 'On' : 'Off')
  if (bulbsAmount > 0) {
    summary.push(`${bulbsAmount} bulb${bulbsAmount === 1 ? '' : 's'}`)
  }
  if (status.dimming !== undefined) {
    summary.push(`Brightness ${status.dimming}%`)
  }
  if (status.mode === 'temp' && status.temp !== undefined) {
    summary.push(`${status.temp}K`)
  }
  if (status.mode === 'color' && status.r !== undefined && status.g !== undefined && status.b !== undefined) {
    summary.push(rgbToHex(status.r, status.g, status.b))
  }
  if (status.mode === 'scene' && status.sceneName) {
    summary.push(status.sceneName)
  }
  return summary
}

function getTemperaturePreviewColor (temperature) {
  const minTemp = 2200
  const maxTemp = 6200
  const normalizedTemp = Math.min(Math.max(temperature, minTemp), maxTemp)
  const ratio = (normalizedTemp - minTemp) / (maxTemp - minTemp)
  const warmColor = { r: 255, g: 191, b: 120 }
  const coolColor = { r: 196, g: 228, b: 255 }
  const r = Math.round(warmColor.r + ((coolColor.r - warmColor.r) * ratio))
  const g = Math.round(warmColor.g + ((coolColor.g - warmColor.g) * ratio))
  const b = Math.round(warmColor.b + ((coolColor.b - warmColor.b) * ratio))
  return rgbToHex(r, g, b)
}

function getStatusPreviewItems (status) {
  const summary = getStatusSummaryItems(status).map(item => ({ label: item }))

  if (status.mode === 'color' && status.r !== undefined && status.g !== undefined && status.b !== undefined) {
    const colorValue = rgbToHex(status.r, status.g, status.b)
    return summary.map(item => item.label === colorValue ? { ...item, swatchColor: colorValue } : item)
  }

  if (status.mode === 'temp' && status.temp !== undefined) {
    const tempLabel = `${status.temp}K`
    return summary.map(item => item.label === tempLabel ? { ...item, swatchColor: getTemperaturePreviewColor(status.temp) } : item)
  }

  return summary
}

function renderStatusSummary (items, container, className) {
  container.innerHTML = ''
  items.forEach(item => {
    const chip = document.createElement('span')
    chip.className = className
    const itemConfig = typeof item === 'string' ? { label: item } : item
    if (itemConfig.swatchColor) {
      const swatch = document.createElement('span')
      swatch.className = 'status-summary-swatch'
      swatch.style.background = itemConfig.swatchColor
      chip.appendChild(swatch)
    }
    const label = document.createElement('span')
    label.innerText = itemConfig.label
    chip.appendChild(label)
    container.appendChild(chip)
  })
}

function openModal (statusDraft) {
  pendingStatusDraft = statusDraft
  saveStatusHiddenInput.value = JSON.stringify(statusDraft)
  saveStatusTitle.innerText = `Save ${statusDraft.targetType} preset`
  saveStatusDescription.innerText = `Store the current ${statusDraft.targetType} configuration so you can apply it again with a single click.`
  saveStatusTargetType.innerText = statusDraft.targetType
  saveStatusTargetName.innerText = statusDraft.targetName
  renderStatusSummary(getStatusPreviewItems(statusDraft), saveStatusSummary, 'status-modal-summary-item')
  modal.style.display = 'block'
  saveStatusNameInput.focus()
  saveStatusNameInput.select()
}

async function saveStatus () {
  const status = pendingStatusDraft || JSON.parse(saveStatusHiddenInput.value)
  const name = saveStatusNameInput.value.trim()
  if (!name) return alert('Specify a name please')

  saveStatusConfirmButton.disabled = true
  saveStatusConfirmButton.innerText = 'Saving...'

  try {
    await window.dataProcessing.addStatus({
      ...status,
      name
    })
    alert('Status successfully saved')
    closeModal()
    location.reload()
  } catch (error) {
    alert('There was an error saving the preset.')
    saveStatusConfirmButton.disabled = false
    saveStatusConfirmButton.innerText = 'Save preset'
  }
}

saveStatusCloseButton.addEventListener('click', closeModal)
saveStatusCancelButton.addEventListener('click', closeModal)
saveStatusConfirmButton.addEventListener('click', async () => await saveStatus())
saveStatusNameInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    await saveStatus()
  }
})
window.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal()
  }
})
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal.style.display === 'block') {
    closeModal()
  }
})

let storedBulbs
let favStatus
(async () => {
  storedBulbs = await window.dataProcessing.getStoredBulbs()
  const rooms = storedBulbs.filter(bulb => bulb.bulbs)
  rooms.forEach(room => {
    bulbsContainer.appendChild(getEntityHTML(room, 'room'))
  })

  const favsContainer = document.getElementById('fav-status')
  favStatus = await window.dataProcessing.getStatus()
  if (favStatus.length === 0) document.querySelector('.fav-status-container').remove()
  favStatus.forEach(status => {
    favsContainer.appendChild(createSavedStatusCard(status))
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

function getStatusMetaLabel (status) {
  const targetType = status.targetType === 'room' ? 'Room' : 'Bulb'
  const bulbsAmount = Array.isArray(status.bulbs) ? status.bulbs.length : 0
  if (status.targetType === 'room' && bulbsAmount > 0) {
    return `${targetType} • ${bulbsAmount} bulbs`
  }
  return targetType
}

function buildStatusDraft ({
  entity,
  isRoom,
  roomBulbs,
  bulbSwitch,
  modeSelector,
  tempPicker,
  colorPicker,
  sceneSelector,
  sceneSpeedRange,
  dimmingRange
}) {
  const selectedMode = modeSelector.querySelector(`input[name="mode${isRoom ? entity.mac : entity.result.mac}"]:checked`).value
  let draft = {
    targetType: isRoom ? 'room' : 'bulb',
    targetName: getEntityDisplayName(entity, isRoom),
    state: bulbSwitch.checked,
    dimming: parseInt(dimmingRange.value),
    mode: selectedMode,
    bulbs: roomBulbs.map(bulb => ({
      mac: bulb.mac,
      ip: bulb.ip,
      name: bulb.name || 'Bulb'
    }))
  }

  if (!isRoom && entity.ip) {
    draft.ip = entity.ip
  }

  if (selectedMode === 'temp') {
    draft.temp = parseInt(tempPicker.value)
    return draft
  }

  if (selectedMode === 'color') {
    return {
      ...draft,
      ...hexaToRGB(colorPicker.value)
    }
  }

  return {
    ...draft,
    sceneId: parseInt(sceneSelector.value),
    sceneSpeed: parseInt(sceneSpeedRange.value),
    sceneName: sceneSelector.options[sceneSelector.selectedIndex]?.textContent || 'Scene'
  }
}

function createSavedStatusCard (status) {
  const statusItem = document.createElement('button')
  statusItem.className = 'status'
  statusItem.type = 'button'

  const copyWrapper = document.createElement('div')
  copyWrapper.className = 'status-copy'

  const statusName = document.createElement('span')
  statusName.className = 'status-name'
  statusName.innerText = status.name

  const statusMeta = document.createElement('span')
  statusMeta.className = 'status-meta'
  statusMeta.innerText = `${getStatusMetaLabel(status)}${status.targetName ? ` • ${status.targetName}` : ''}`

  const statusTags = document.createElement('div')
  statusTags.className = 'status-tags'
  renderStatusSummary(getStatusPreviewItems(status), statusTags, 'status-tag')

  copyWrapper.appendChild(statusName)
  copyWrapper.appendChild(statusMeta)
  copyWrapper.appendChild(statusTags)

  const deleteBtn = document.createElement('img')
  deleteBtn.src = '../public/delete-icon.svg'
  deleteBtn.alt = 'Delete saved status'
  deleteBtn.className = 'delete-status-button'
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

  statusItem.appendChild(copyWrapper)
  statusItem.appendChild(deleteBtn)
  statusItem.addEventListener('click', async () => {
    try {
      await window.bulbNetworking.setStatus(status.ip, status)
    } catch (error) {
      alert('There was an error applying the preset.')
    }
  })

  return statusItem
}

document.addEventListener('DOMContentLoaded', () => {
  window.bulbNetworking.startDiscovery()

  window.bulbNetworking.onBulbDiscovered(async (bulbData) => {
    if (storedBulbs) {
      const bulb = storedBulbs.filter(bulb => bulbData.result.mac === bulb.mac)
      if (bulb.length > 0) {
        if (bulb[0].ip !== bulbData.ip) {
          await window.dataProcessing.addOrEditStoredBulbs({
            name: bulb[0].name,
            mac: bulbData.result.mac,
            ip: bulbData.ip
          })
          location.reload()
        } else {
          bulbData = {
            ...bulbData,
            name: bulb[0].name
          }
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
    bulbsContainer.appendChild(getEntityHTML(bulbData, 'bulb'))
  })
})

reloadButton.addEventListener('click', () => {
  location.reload()
})

document.getElementById('config-button').addEventListener('click', () => {
  location.href = './config.html'
})

// --- Audio Reactive Mode ---
let audioActive = false
let audioStream = null
let audioContext = null
let animFrameId = null
let lastCommandTime = 0
const THROTTLE_MS = 200

const audioButton = document.getElementById('audio-button')

audioButton.addEventListener('click', async () => {
  if (audioActive) {
    stopAudioMode()
  } else {
    await startAudioMode()
  }
})

async function startAudioMode () {
  try {
    const sources = await window.audioCapture.getDesktopSources()
    if (!sources.length) throw new Error('No desktop sources found')

    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sources[0].id } },
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sources[0].id } }
    })

    // Drop video tracks — only need audio
    audioStream.getVideoTracks().forEach(t => t.stop())

    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(audioStream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount) // 128 bins

    audioActive = true
    audioButton.classList.add('active')

    function tick () {
      if (!audioActive) return
      animFrameId = requestAnimationFrame(tick)

      analyser.getByteFrequencyData(dataArray)

      const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
      const bass = avg(dataArray.slice(0, 5))    // ~0-860Hz
      const treble = avg(dataArray.slice(20, 60)) // ~3440-10320Hz
      const overall = avg(dataArray)

      const dimming = Math.max(10, Math.round((overall / 255) * 100))
      const bassRatio = bass / (bass + treble + 1)
      const temp = Math.round(2200 + (1 - bassRatio) * 4000) // warm=bass, cool=treble

      const now = Date.now()
      if (now - lastCommandTime < THROTTLE_MS) return
      lastCommandTime = now

      // Send to all discovered bulbs
      if (storedBulbs) {
        storedBulbs
          .filter(b => b.ip && !b.bulbs)
          .forEach(b => {
            window.bulbNetworking.setTemp(b.ip, temp, dimming).catch(() => {})
          })
      }
    }

    tick()
  } catch (err) {
    console.error('Error starting audio mode:', err)
    alert('Could not capture system audio: ' + err.message)
  }
}

function stopAudioMode () {
  audioActive = false
  audioButton.classList.remove('active')
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (audioContext) { audioContext.close(); audioContext = null }
  if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null }
}

function getEntityHTML (entity, type) {
  const isRoom = type === 'room'
  const entityId = isRoom ? entity.mac : entity.result.mac
  const bulbTemplate = template.querySelector('.bulb-section').cloneNode(true)
  const bulbSwitch = bulbTemplate.querySelector('.bulb-switch > input')

  if (entity.name || (isRoom && entity.name)) {
    const bulbNameInput = bulbTemplate.querySelector('.bulb-name')
    bulbNameInput.value = entity.name || entity.result.name

    async function handleNameChange () {
      const newName = bulbNameInput.value
      const macAddress = entityId
      await window.dataProcessing.addOrEditStoredBulbs({
        ...entity,
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

  if (isRoom && (!entity.bulbs.length > 0)) {
    const tabs = bulbTemplate.querySelectorAll('.tab-content')
    tabs.forEach(tab => {
      tab.parentNode.removeChild(tab)
    })
    bulbTemplate.querySelector('.dimming').remove()
    bulbTemplate.querySelector('.bulb-switch').remove()
    bulbTemplate.querySelector('.mode-selector').remove()
    bulbTemplate.style.justifyContent = ''
    const noBulbMessage = document.createElement('p')
    noBulbMessage.innerHTML = "This room doesn't have any bulbs"
    bulbTemplate.insertBefore(noBulbMessage, bulbTemplate.querySelector('.floating-buttons'))

    const saveStatusButton = bulbTemplate.querySelector('.save-status-button')
    saveStatusButton.disabled = true
    saveStatusButton.title = 'Add bulbs before saving a room preset'

    const addBulbsButton = bulbTemplate.querySelector('.add-bulb-button')
    addBulbsButton.addEventListener('click', async (e) => {
      document.getElementById('myModal').style.display = 'block'
      populateList({
        allItems: storedBulbs.filter(bulb => !bulb.bulbs)
      })
    })
  } else {
    const roomBulbs = isRoom ? storedBulbs.filter(obj => entity.bulbs.includes(obj.mac)) : [entity]
    bulbSwitch.checked = isRoom ? false : entity.result.state

    const modeSelector = bulbTemplate.querySelector('.mode-selector')
    const colorPicker = bulbTemplate.querySelector('.color-picker')
    const tempPicker = bulbTemplate.querySelector('.temp-picker')
    const sceneSelector = bulbTemplate.querySelector('#scene-selector')
    const sceneSpeedRange = bulbTemplate.querySelector('.speed-range')
    const dimmingRange = bulbTemplate.querySelector('.dimming-range')
    const saveStatusButton = bulbTemplate.querySelector('.floating-buttons .save-status-button')

    if (!isRoom && (entity.result.r || entity.result.g || entity.result.b)) {
      colorPicker.value = rgbToHex(entity.result.r, entity.result.g, entity.result.b)
    }
    if (!isRoom) {
      tempPicker.value = entity.result.temp ?? tempPicker.value
      sceneSelector.value = entity.result.sceneId ?? sceneSelector.value
      sceneSpeedRange.value = entity.result.speed ?? sceneSpeedRange.value
      dimmingRange.value = entity.result.dimming
    }

    const colorInput = document.createElement('input')
    colorInput.type = 'radio'
    colorInput.value = 'color'
    colorInput.id = 'color' + entityId
    colorInput.name = 'mode' + entityId
    colorInput.checked = !isRoom && entity.result.r
    const colorLabel = document.createElement('label')
    colorLabel.htmlFor = 'color' + entityId
    colorLabel.innerHTML = '<img class="tab-selector" src="../public/color-picker.svg" alt="Color Picker tab">'
    colorLabel.title = 'color picker'
    modeSelector.appendChild(colorInput)
    modeSelector.appendChild(colorLabel)

    const tempInput = document.createElement('input')
    tempInput.type = 'radio'
    tempInput.value = 'temp'
    tempInput.id = 'temp' + entityId
    tempInput.name = 'mode' + entityId
    tempInput.checked = isRoom || (!isRoom && entity.result.temp)
    const tempLabel = document.createElement('label')
    tempLabel.htmlFor = 'temp' + entityId
    tempLabel.innerHTML = '<img class="tab-selector" src="../public/temperature-picker.svg" alt="Temperature Picker tab">'
    tempLabel.title = 'temperature picker'
    modeSelector.appendChild(tempInput)
    modeSelector.appendChild(tempLabel)

    const sceneInput = document.createElement('input')
    sceneInput.type = 'radio'
    sceneInput.value = 'scene'
    sceneInput.id = 'scene' + entityId
    sceneInput.name = 'mode' + entityId
    sceneInput.checked = !isRoom && !!entity.result.sceneId
    const sceneLabel = document.createElement('label')
    sceneLabel.htmlFor = 'scene' + entityId
    sceneLabel.innerHTML = '<img class="tab-selector" src="../public/scene-picker.svg" alt="Scene Picker tab">'
    sceneLabel.title = 'scene picker'
    modeSelector.appendChild(sceneInput)
    modeSelector.appendChild(sceneLabel)

    const updateTabs = (container) => {
      const tabs = bulbTemplate.querySelectorAll('.tab-content')
      tabs.forEach(tab => {
        const selectedMode = modeSelector.querySelector(`input[name="mode${entityId}"]:checked`).value
        if (selectedMode === tab.id) {
          tab.style.display = 'flex'
          return
        }
        tab.style.display = 'none'
      })
    }

    modeSelector.querySelector(`#temp${entityId}`).checked = isRoom || (!isRoom && entity.result.temp)
    updateTabs(bulbTemplate)

    modeSelector.addEventListener('change', async (event) => {
      updateTabs(bulbTemplate)
    })

    bulbSwitch.addEventListener('change', async (event) => {
      const isBulbOn = !event.target.checked
      let promises
      if (isBulbOn) {
        promises = roomBulbs.map(bulb => window.bulbNetworking.setBulb(bulb.ip, !isBulbOn))
      } else {
        const selectedMode = modeSelector.querySelector(`input[name="mode${entityId}"]:checked`).value
        switch (selectedMode) {
          case 'color':
            promises = roomBulbs.map(bulb => window.bulbNetworking.changeColor(bulb.ip, hexaToRGB(colorPicker.value), dimmingRange.value))
            break
          case 'temp':
            promises = roomBulbs.map(bulb => window.bulbNetworking.setTemp(bulb.ip, tempPicker.value, dimmingRange.value))
            break
          case 'scene':
            promises = roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip, sceneSelector.value, sceneSpeedRange.value, dimmingRange.value))
            break
        }
      }
      await Promise.allSettled(promises)

      event.target.innerHTML = !isBulbOn
    })

    tempPicker.addEventListener('change', async (event) => {
      const promises = roomBulbs.map(bulb => window.bulbNetworking.setTemp(bulb.ip, event.target.value, dimmingRange.value))
      await Promise.allSettled(promises)
      bulbSwitch.checked = true
    })

    colorPicker.addEventListener('input', async (event) => {
      const rgbColor = hexaToRGB(event.target.value)
      const promises = roomBulbs.map(bulb => window.bulbNetworking.changeColor(bulb.ip, rgbColor, dimmingRange.value))
      await Promise.allSettled(promises)
      bulbSwitch.checked = true
    })

    sceneSelector.addEventListener('change', async (event) => {
      const promises = roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip, event.target.value, sceneSpeedRange.value, dimmingRange.value))
      await Promise.allSettled(promises)
      bulbSwitch.checked = true
    })

    sceneSpeedRange.addEventListener('change', async (event) => {
      const promises = roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip, sceneSelector.value, event.target.value, dimmingRange.value))
      await Promise.allSettled(promises)
      bulbSwitch.checked = true
    })

    dimmingRange.addEventListener('change', async (event) => {
      const selectedMode = modeSelector.querySelector(`input[name="mode${entityId}"]:checked`).value
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
      bulbSwitch.checked = true
    })

    saveStatusButton.addEventListener('click', async () => {
      openModal(buildStatusDraft({
        entity,
        isRoom,
        roomBulbs,
        bulbSwitch,
        modeSelector,
        tempPicker,
        colorPicker,
        sceneSelector,
        sceneSpeedRange,
        dimmingRange
      }))
    })

    if (!isRoom) {
      bulbTemplate.querySelector('.floating-buttons .add-bulb-button').remove()
      bulbTemplate.querySelector('.floating-buttons .delete-room-button').remove()
    }

    if (isRoom) {
      const addBulbsButton = bulbTemplate.querySelector('.add-bulb-button')
      addBulbsButton.addEventListener('click', async (e) => {
        document.getElementById('myModal').style.display = 'block'
        populateList({
          allItems: storedBulbs.filter(bulb => !bulb.bulbs),
          selectedItemsMac: entity.bulbs
        })
      })
    }
  }
  if (isRoom) {
    const deleteRoomButton = bulbTemplate.querySelector('.delete-room-button')
    deleteRoomButton.addEventListener('click', () => {
      event.stopPropagation()
      const isConfirmed = confirm(`Are you sure you want to delete the room "${entity.name || 'New Room'}"?`)
      if (isConfirmed) {
        window.dataProcessing.removeStoredBulbs(entity.mac)
        location.reload()
      }
    })

    document.getElementById('confirmBtn').addEventListener('click', async function () {
      const selectedValues = []
      document.querySelectorAll('#valuesList input[type="checkbox"]:checked').forEach(checkbox => {
        selectedValues.push(checkbox.getAttribute('mac'))
      })

      entity.bulbs = selectedValues
      await window.dataProcessing.addOrEditStoredBulbs(entity)
      location.reload()
    })
  }

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
