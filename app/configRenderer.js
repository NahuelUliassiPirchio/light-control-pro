let isRecording = false
let pressedKeys = {}
let editingShortcutId = null // Used to identify if we are editing an existing shortcut
const statesList = document.getElementById('statesList')
const shortcutsContainer = document.getElementById('shortcutsContainer')
const recButton = document.getElementById('recordingButton')
const editIndicator = document.getElementById('editIndicator'); // Assume this is added to your HTML

(async () => {
  await loadStates()
  await loadShortcuts()
})()

async function loadStates () {
  const states = await window.dataProcessing.getStatus()
  states.forEach(state => {
    const stateOption = document.createElement('option')
    stateOption.innerText = state.name
    stateOption.value = state.name
    statesList.appendChild(stateOption)
  })
}

async function loadShortcuts () {
  const shortcuts = await window.dataProcessing.getShortcuts()
  shortcutsContainer.innerHTML = '<h2>Existing Shortcuts</h2>'
  shortcuts.forEach(shortcut => {
    const shortcutDisplay = document.createElement('div')
    shortcutDisplay.innerHTML = `${shortcut.pressedKeys.join('+')} - ${shortcut.status}`
    const editBtn = document.createElement('button')
    editBtn.textContent = 'Edit'
    editBtn.onclick = () => startEditingShortcut(shortcut.id, shortcut.status)
    const deleteBtn = document.createElement('button')
    deleteBtn.textContent = 'Delete'
    deleteBtn.onclick = () => deleteShortcut(shortcut.id)
    shortcutDisplay.appendChild(editBtn)
    shortcutDisplay.appendChild(deleteBtn)
    shortcutsContainer.appendChild(shortcutDisplay)
  })
}

function startEditingShortcut (id, status) {
  editingShortcutId = id
  statesList.value = status
  editIndicator.style.display = 'block'
  editIndicator.textContent = `Editing Shortcut: ${id}`
  recButton.click() // Simulate a click to start recording/editing
}

async function deleteShortcut (id) {
  await window.dataProcessing.removeShortcut(id)
  await loadShortcuts()
}

async function toggleRecording () {
  isRecording = !isRecording
  recButton.innerText = isRecording ? 'Stop Recording' : 'Record'

  if (!isRecording) {
    document.removeEventListener('keydown', keyDown)
    document.removeEventListener('keyup', keyUp)
    if (Object.keys(pressedKeys).length > 0) {
      const shortcutData = {
        pressedKeys: Object.keys(pressedKeys),
        status: statesList.value
      }
      if (editingShortcutId !== null) {
        await window.dataProcessing.editShortcut(editingShortcutId, shortcutData)
        editingShortcutId = null
        editIndicator.style.display = 'none' // Hide edit indicator
      } else {
        await window.dataProcessing.addShortcut(shortcutData)
      }
      await loadShortcuts()
    }
  } else {
    pressedKeys = {}
    document.addEventListener('keydown', keyDown)
    document.addEventListener('keyup', keyUp)
  }
}

// Your original keyDown function
function keyDown (event) {
  event.preventDefault()
  const key = event.key.toLowerCase()
  const isModifierKey = key === 'shift' || key === 'control' || key === 'alt'
  if (!isModifierKey) {
    if (Object.values(pressedKeys).length > 0) {
      pressedKeys[key] = true
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

function updateKeyInfo () {
  const keys = Object.keys(pressedKeys)
  recButton.innerText = keys.length > 0 ? `${keys.join(' + ')}` : 'Record'
}

recButton.addEventListener('click', toggleRecording)
