const $ = selector => document.querySelector(selector)
const $toggleBulbButton = $('.toggle-bulb-button')
const $responseHeader = document.querySelector('.response')

$toggleBulbButton.addEventListener('click', async () => {
  const isBulbOn = $toggleBulbButton.innerHTML === 'On'
  const response = await window.bulbNetworking.setBulb(!isBulbOn)
  $responseHeader.innerHTML = response.method
  $toggleBulbButton.innerHTML = isBulbOn ? 'Off' : 'On'
})
