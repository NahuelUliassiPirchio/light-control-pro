const $ = selector => document.querySelector(selector)
const $toggleBulbButton = $('.toggle-bulb-button')
const $responseHeader = document.querySelector('.response')
const $reloadButton = $('.reload-bulbs-button')
const $colorPicker = document.getElementById('color-picker')
const $tempPicker = document.getElementById('temp-picker')
const $modeSelector = document.getElementById('mode-selector')
const $dimmingRange = document.getElementById('dimming-range')

$tempPicker.disabled = true

$dimmingRange.addEventListener('change', async (event) => {
  if (!$colorPicker.disabled) await window.bulbNetworking.changeColor(hexaToRGB($colorPicker.value), event.target.value)
  else {
    await window.bulbNetworking.setTemp($tempPicker.value, event.target.value)
  }
})

$modeSelector.addEventListener('change', async (event) => {
  $colorPicker.disabled = event.target.value !== 'color'
  $tempPicker.disabled = event.target.value !== 'temp'
})

$reloadButton.addEventListener('click', async () => {
  const bulbs = await window.bulbNetworking.getBulbs()
  console.log(bulbs)
})

$tempPicker.addEventListener('change', async (event) => {
  const response = await window.bulbNetworking.setTemp(event.target.value, $dimmingRange.value)
  $responseHeader.innerHTML = response.result.success === true && 'Bulb successfully updated'
})

$toggleBulbButton.addEventListener('click', async () => {
  const isBulbOn = $toggleBulbButton.innerHTML !== 'On'
  const response = await window.bulbNetworking.setBulb(!isBulbOn)
  $responseHeader.innerHTML = response.result.success === true && 'Bulb successfully updated'
  $toggleBulbButton.innerHTML = isBulbOn ? 'On' : 'Off'
})

$colorPicker.addEventListener('change', async (event) => {
  const rgbColor = hexaToRGB(event.target.value)
  const response = await window.bulbNetworking.changeColor(rgbColor, $dimmingRange.value)
  $responseHeader.innerHTML = response.result.success === true && 'Bulb successfully updated'
})

function hexaToRGB (color) {
  const r = parseInt(color.substr(1, 2), 16)
  const g = parseInt(color.substr(3, 2), 16)
  const b = parseInt(color.substr(5, 2), 16)

  return {
    r,
    g,
    b
  }
}
