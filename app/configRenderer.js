let isRecording = false
let pressedKeys = {}

const statesList = document.getElementById('statesList')
let states;
(async () => {
  states = await window.dataProcessing.getStatus()
  states.forEach(state => {
    const stateOption = document.createElement('option')
    stateOption.innerText = state[0].name
    stateOption.value = state[0].name
    statesList.appendChild(stateOption)
  })
})()

const shortcutForm = document.getElementById('shortcutForm')
const recButton = document.getElementById('recordingButton')
recButton.addEventListener('click', _event => {
  recButton.innerText = 'Recording...'
  toggleRecording()
})

function toggleRecording () {
  isRecording = !isRecording

  if (isRecording) {
    pressedKeys = {}
    document.addEventListener('keydown', keyDown)
    document.addEventListener('keyup', keyUp)

    const stopRecordingShortcut = document.createElement('button')
    stopRecordingShortcut.innerHTML = 'Stop Recording'
    stopRecordingShortcut.addEventListener('click', _event => {
      pressedKeys = {}
      recButton.innerText = 'Recording...'
      toggleRecording()
    })
    shortcutForm.appendChild(stopRecordingShortcut)
  } else {
    document.removeEventListener('keydown', keyDown)
    document.removeEventListener('keyup', keyUp)
    if (Object.values(pressedKeys).length > 0) {
      // guardar shortcut
      const deleteShortcut = document.createElement('button')
      deleteShortcut.innerHTML = 'Delete shortcut'
      deleteShortcut.addEventListener('click', _event => {
        pressedKeys = {}
        recButton.innerText = 'Recording...'
      })
      shortcutForm.appendChild(deleteShortcut)
    }
  }
}

function updateKeyInfo () {
  const keys = Object.keys(pressedKeys)
  recButton.innerHTML = keys.length > 0 ? `${keys.join('+')}` : 'Recording...'
}

function keyDown (event) {
  event.preventDefault()
  const key = event.key.toLowerCase()
  const isModifierKey = key === 'shift' || key === 'control' || key === 'alt'
  if (!isModifierKey) {
    if (Object.values(pressedKeys).length > 0) {
      toggleRecording()
    } else {
      return
    }
  }
  pressedKeys[key] = true
  updateKeyInfo()
}

function keyUp (event) {
  const key = event.key.toLowerCase()
  delete pressedKeys[key]
  updateKeyInfo()
}
