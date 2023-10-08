const LightBulb = require('./LightBulb')

const $ = selector => document.querySelector(selector)
const $turnLightOffButton = $('.turn-off-button')
const $turnLightOnButton = $('.turn-on-button')
const $rhythmButton = $('.rhythm')
const $responseHeader = $('.response')

const room = new LightBulb('192.168.0.3')

room.getStatus().then(value => {
  $responseHeader.innerHTML = value.env
})

$turnLightOnButton.addEventListener('click', async () => {
  const value = await room.turnOn()
  $turnLightOnButton.innerHTML = value.method
  $responseHeader.innerHTML = 'On'
})
$turnLightOffButton.addEventListener('click', () => {
  room.turnOff().then(value => {
    $turnLightOffButton.innerHTML = value.method
    $responseHeader.innerHTML = 'Off'
  })
})

$rhythmButton.addEventListener('click', () => {
  room.setRhythm().then(value => {
    $responseHeader.innerHTML = 'rhythm'
  })
})
