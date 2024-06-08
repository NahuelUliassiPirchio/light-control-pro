const runOnStartupCheckbox = document.getElementById('runOnStartup')
let isRecording = false
let pressedKeys = {}
let editingShortcutId = null
const statesList = document.getElementById('statesList')
const shortcutsContainer = document.getElementById('shortcutsContainer')
const recButton = document.getElementById('recordingButton')
const editIndicator = document.getElementById('editIndicator');

(async () => {
  await loadStates()
  await loadShortcuts()
})()

async function loadStates () {
  const settings = await window.dataProcessing.getSettings()
  if (settings) {
    settings.forEach(setting => {
      if (setting.id === 'startup') {
        runOnStartupCheckbox.checked = setting.runOnStartup
      }
    })
  } else {
    runOnStartupCheckbox.checked = false
  }

  const states = await window.dataProcessing.getStatus()
  states.forEach(state => {
    const stateOption = document.createElement('option')
    stateOption.innerText = state.name
    stateOption.value = state.id
    statesList.appendChild(stateOption)
  })
}

runOnStartupCheckbox.addEventListener('change', async (e) => {
  await window.dataProcessing.addOrEditSetting('startup', { runOnStartup: runOnStartupCheckbox.checked })
})

async function loadShortcuts () {
  const shortcuts = await window.dataProcessing.getShortcuts()
  shortcutsContainer.innerHTML = ''
  shortcuts.forEach(shortcut => {
    const statusName = getStateNameById(shortcut.statusId)
    const shortcutDisplay = document.createElement('li')
    shortcutDisplay.innerHTML = `${statusName}: ${shortcut.pressedKeys.join('+')}`
    const editBtn = document.createElement('button')
    editBtn.innerHTML = '<img src="../public/edit.svg" alt="Edit shortcut">'
    editBtn.onclick = () => startEditingShortcut(shortcut.id, shortcut.statusId)
    const deleteBtn = document.createElement('button')
    deleteBtn.innerHTML = '<img src="../public/delete.svg" alt="Delete shortcut">'
    deleteBtn.onclick = () => deleteShortcut(shortcut.id)
    shortcutDisplay.appendChild(editBtn)
    shortcutDisplay.appendChild(deleteBtn)
    shortcutsContainer.appendChild(shortcutDisplay)
  })
}

function getStateNameById (statusId) {
  for (const option of statesList.options) {
    if (option.value === statusId) {
      return option.text
    }
  }
  return ''
}

function startEditingShortcut (id, statusId) {
  editingShortcutId = id
  statesList.value = statusId
  editIndicator.style.display = 'block'
  editIndicator.textContent = `Editing Shortcut: ${id}`
  recButton.click()
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
      const selectedStateOption = statesList.options[statesList.selectedIndex]
      const shortcutData = {
        pressedKeys: Object.keys(pressedKeys),
        statusId: selectedStateOption.value
      }
      if (editingShortcutId !== null) {
        await window.dataProcessing.editShortcut(editingShortcutId, shortcutData)
        editingShortcutId = null
        editIndicator.style.display = 'none'
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
