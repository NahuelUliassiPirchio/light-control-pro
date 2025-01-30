const template = document.getElementById('bulb-template').content
const reloadButton = document.getElementById('reload-button')
const addRoomButton = document.getElementById('add-room-button')
const bulbsContainer = document.getElementById('bulbs-container')

window.updateUi.onUpdatedBulbs(() => location.reload())

document.getElementById('cancelBtn').addEventListener('click', function () {
  document.getElementById('myModal').style.display = 'none'
})

const modal = document.getElementById('save-status-modal')
function closeModal () {
  modal.style.display = 'none'
}
modal.children[0].addEventListener('click', () => closeModal())
function openModal (bulb) {
  modal.style.display = 'block'
  document.getElementById('hiddenInput').value = bulb
}
async function saveStatus () {
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
  location.reload()
}
modal.children[6].addEventListener('click', async () => await saveStatus())
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
    bulbsContainer.appendChild(getEntityHTML(room, 'room'))
  })

  const favsContainer = document.getElementById('fav-status')
  favStatus = await window.dataProcessing.getStatus()
  if (favStatus.length === 0) document.querySelector('.fav-status-container').remove()
  favStatus.forEach(status => {
    const statusItem = document.createElement('button')
    statusItem.className = 'status'
    statusItem.innerText = status.name

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
    statusItem.appendChild(deleteBtn)

    statusItem.addEventListener('click', async () => {
      let response
      try {
        await window.bulbNetworking.setStatus(status.ip, status)
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
    bulbTemplate.querySelector('.save-status-button').remove()
    bulbTemplate.querySelector('.bulb-switch').remove()
    bulbTemplate.querySelector('.mode-selector').remove()
    bulbTemplate.style.justifyContent = ''
    const noBulbMessage = document.createElement('p')
    noBulbMessage.innerHTML = "This room doesn't have any bulbs"
    bulbTemplate.insertBefore(noBulbMessage, bulbTemplate.querySelector('.floating-buttons'))

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
    sceneInput.checked = !isRoom && entity.result.scene
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

    if (!isRoom) {
      const saveStatusButton = bulbTemplate.querySelector('.floating-buttons .save-status-button')
      saveStatusButton.addEventListener('click', async () => {
        let properties = {
          state: bulbSwitch.checked,
          dimming: parseInt(dimmingRange.value)
        }
        const selectedMode = modeSelector.querySelector(`input[name="mode${entityId}"]:checked`).value
        if (selectedMode === 'temp') {
          properties.temp = parseInt(tempPicker.value)
        } else if (selectedMode === 'color') {
          properties = {
            ...properties,
            ...hexaToRGB(colorPicker.value)
          }
        } else {
          properties = {
            ...properties,
            sceneId: sceneSelector.value,
            speed: sceneSpeedRange.value
          }
        }
        openModal(JSON.stringify({
          ...properties,
          ip: entity.ip
        }))
      })

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
