const template = document.getElementById('bulb-template')
const reloadButton = document.getElementById('reload-button')

let bulbs
(async () => {
  bulbs = await window.bulbNetworking.getBulbs()
  console.log(bulbs)

  const bulbsContainer = document.getElementById('bulbs-container')
  bulbs.forEach(bulb => {
    bulbsContainer.appendChild(getBulbHTML(bulb))
  })
  template.remove()
})()

reloadButton.addEventListener('click', () => {
  location.reload()
})

function getBulbHTML (bulb) {
  const clone = template.cloneNode(true)
  const responseHeader = clone.querySelector('.response')

  const bulbSwitch = clone.querySelector('.bulb-switch')
  bulbSwitch.innerHTML = bulb.result.state ? 'Off' : 'On'

  const modeSelector = clone.querySelector('.mode-selector')
  const colorPicker = clone.querySelector('.color-picker')
  colorPicker.value = (bulb.result.r || bulb.result.g || bulb.result.b) ? rgbToHex(bulb.result.r, bulb.result.g, bulb.result.b) : colorPicker.value
  const tempPicker = clone.querySelector('.temp-picker')
  tempPicker.value = bulb.result.temp ?? tempPicker.value
  const dimmingRange = clone.querySelector('.dimming-range')
  dimmingRange.value = bulb.result.dimming

  const colorInput = document.createElement('input')
  colorInput.type = 'radio'
  colorInput.value = 'color'
  colorInput.id = 'color' + bulb.result.mac
  colorInput.name = 'mode' + bulb.result.mac
  colorInput.checked = bulb.result.r
  const colorLabel = document.createElement('label')
  colorLabel.htmlFor = 'color' + bulb.result.mac
  colorLabel.innerText = 'Color'
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
  tempLabel.innerText = 'Temperature'
  modeSelector.appendChild(tempInput)
  modeSelector.appendChild(tempLabel)

  bulbSwitch.addEventListener('click', async (event) => {
    const isBulbOn = event.target.innerHTML !== 'On'
    const response = await window.bulbNetworking.setBulb(bulb.ip, !isBulbOn)
    responseHeader.innerHTML = response.result.success && 'Bulb successfully updated'
    event.target.innerHTML = isBulbOn ? 'On' : 'Off'
  })

  if (bulb.result.temp) {
    modeSelector.querySelector(`#temp${bulb.result.mac}`).checked = true
    colorPicker.disabled = true
  } else {
    modeSelector.querySelector(`#color${bulb.result.mac}`).checked = true
    tempPicker.disabled = true
  }

  dimmingRange.addEventListener('change', async (event) => {
    if (!colorPicker.disabled) await window.bulbNetworking.changeColor(bulb.ip, hexaToRGB(colorPicker.value), event.target.value)
    else {
      await window.bulbNetworking.setTemp(bulb.ip, tempPicker.value, event.target.value)
    }
  })

  modeSelector.addEventListener('change', async (event) => {
    colorPicker.disabled = event.target.value !== 'color'
    tempPicker.disabled = event.target.value !== 'temp'
  })

  tempPicker.addEventListener('change', async (event) => {
    const response = await window.bulbNetworking.setTemp(bulb.ip, event.target.value, dimmingRange.value)
    responseHeader.innerHTML = response.result.success && 'Bulb successfully updated'
  })

  colorPicker.addEventListener('change', async (event) => {
    const rgbColor = hexaToRGB(event.target.value)
    const response = await window.bulbNetworking.changeColor(bulb.ip, rgbColor, dimmingRange.value)
    responseHeader.innerHTML = response.result.success && 'Bulb successfully updated'
  })

  return clone
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
