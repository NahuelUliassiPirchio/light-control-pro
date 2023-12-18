const template = document.getElementById('bulb-template')
const reloadButton = document.getElementById('reload-button')

function updateBulb (container, bulbId, color, opacity) {
  const bulb = container.querySelector('#' + bulbId)
  if (typeof color === 'number') {
    bulb.style.backgroundColor = kelvinToHexColor(color)
    console.log(color)
  } else {
    const { r, g, b } = color
    bulb.style.backgroundColor = rgbToHex(r, g, b)
  }
  console.log(opacity)
  bulb.style.opacity = opacity / 100
}

let bulbs
(async () => {
  bulbs = await window.bulbNetworking.getBulbs()
  console.log(bulbs)

  const bulbsContainer = document.getElementById('bulbs-container')
  bulbs.forEach(bulb => {
    if (!bulb) return
    bulbsContainer.appendChild(getBulbHTML(bulb))
  })
  if (bulbsContainer.innerHTML === '') bulbsContainer.innerHTML = '<h2>No bulbs have been found</h2>'
  template.remove()
})()

reloadButton.addEventListener('click', () => {
  location.reload()
})

function getBulbHTML (bulb) {
  const bulbId = 'bulb' + bulb.result.mac

  const bulbTemplate = template.querySelector('.bulb-section').cloneNode(true)
  const errorContainer = bulbTemplate.querySelector('.error')

  const bulbSwitch = bulbTemplate.querySelector('.bulb-switch > input')
  bulbSwitch.checked = bulb.result.state

  const modeSelector = bulbTemplate.querySelector('.mode-selector')
  const colorPicker = bulbTemplate.querySelector('.color-picker')
  colorPicker.value = (bulb.result.r || bulb.result.g || bulb.result.b) ? rgbToHex(bulb.result.r, bulb.result.g, bulb.result.b) : colorPicker.value
  const tempPicker = bulbTemplate.querySelector('.temp-picker')
  tempPicker.value = bulb.result.temp ?? tempPicker.value
  const sceneSelector = bulbTemplate.querySelector('#scene-selector')
  sceneSelector.value = bulb.result.sceneId ?? sceneSelector.value
  const sceneSpeedRange = bulbTemplate.querySelector('.speed-range')
  sceneSpeedRange.value = bulb.result.speed ?? sceneSpeedRange.value
  const dimmingRange = bulbTemplate.querySelector('.dimming-range')
  dimmingRange.value = bulb.result.dimming

  const bulbContainer = bulbTemplate.querySelector('.bulb-container')
  bulbContainer.innerHTML = `<img class="bulb" id="${bulbId}" src="./public/bulb.svg" alt="Bulb">`

  updateBulb(bulbContainer, bulbId, parseInt(bulb.result.temp) || {
    r: bulb.result.r,
    g: bulb.result.g,
    b: bulb.result.b
  }, bulb.result.dimming)

  const colorInput = document.createElement('input')
  colorInput.type = 'radio'
  colorInput.value = 'color'
  colorInput.id = 'color' + bulb.result.mac
  colorInput.name = 'mode' + bulb.result.mac
  colorInput.checked = bulb.result.r
  const colorLabel = document.createElement('label')
  colorLabel.htmlFor = 'color' + bulb.result.mac
  colorLabel.innerHTML = '<img class="tab-selector" src="./public/color-picker.svg" alt="Color Picker tab">'
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
  tempLabel.innerHTML = '<img class="tab-selector" src="./public/temperature-picker.svg" alt="Temperature Picker tab">'
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
  sceneLabel.innerHTML = '<img class="tab-selector" src="./public/scene-picker.svg" alt="Scene Picker tab">'
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
    if (!response.result.success) updateError('There was an error updating the bulb.')
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
    updateBulb(bulbContainer, bulbId, parseInt(event.target.value), dimmingRange.value)
    if (!response.result.success) updateError('There was an error updating the bulb.')
  })

  colorPicker.addEventListener('input', async (event) => {
    const rgbColor = hexaToRGB(event.target.value)
    const response = await window.bulbNetworking.changeColor(bulb.ip, rgbColor, dimmingRange.value)
    updateBulb(bulbContainer, bulbId, { r: rgbColor.r, g: rgbColor.g, b: rgbColor.b }, dimmingRange.value)
    if (!response.result.success) updateError('There was an error updating the bulb.')
  })

  sceneSelector.addEventListener('change', async (event) => {
    const response = await window.bulbNetworking.setScene(bulb.ip, event.target.value, sceneSpeedRange.value, dimmingRange.value)
    if (!response.result.success) updateError('There was an error updating the bulb.')
  })

  sceneSpeedRange.addEventListener('change', async (event) => {
    const response = await window.bulbNetworking.setScene(bulb.ip, sceneSelector.value, event.target.value, dimmingRange.value)
    if (!response.result.success) updateError('There was an error updating the bulb.')
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
    updateBulb(bulbContainer, bulbId, selectedMode === 'temp' ? parseInt(tempPicker.value) : hexaToRGB(colorPicker.value), event.target.value)
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
