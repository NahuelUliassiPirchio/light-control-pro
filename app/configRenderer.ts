document.getElementById('minimizeBtn')!.addEventListener('click', () => window.windowControls.minimize())
document.getElementById('closeBtn')!.addEventListener('click', () => window.windowControls.close())

document.getElementById('backButton')!.addEventListener('click', () => {
  location.href = './index.html'
})

const runOnStartupCheckbox = document.getElementById('runOnStartup') as HTMLInputElement
const openOnStartupCheckbox = document.getElementById('openOnStartup') as HTMLInputElement
let isRecording = false
let pressedKeys: Record<string, boolean> = {}
let editingShortcutId: string | null = null
const statesList = document.getElementById('statesList') as HTMLSelectElement
const shortcutsContainer = document.getElementById('shortcutsContainer') as HTMLElement
const recButton = document.getElementById('recordingButton') as HTMLButtonElement
const editIndicator = document.getElementById('editIndicator') as HTMLElement

;(async () => {
  await loadStates()
  await loadShortcuts()
})()

async function loadStates (): Promise<void> {
  const settings = await window.dataProcessing.getSettings()
  if (settings) {
    settings.forEach(setting => {
      if (setting.id === 'startup') {
        runOnStartupCheckbox.checked = setting.runOnStartup ?? false
      }
      if (setting.id === 'openOnStartup') {
        openOnStartupCheckbox.checked = (setting.openOnStartup as boolean) ?? true
      }
    })
  } else {
    runOnStartupCheckbox.checked = false
    openOnStartupCheckbox.checked = true
  }

  const states = await window.dataProcessing.getStatus()
  states.forEach(state => {
    const stateOption = document.createElement('option')
    stateOption.innerText = state.name ?? ''
    stateOption.value = state.id ?? ''
    statesList.appendChild(stateOption)
  })
}

runOnStartupCheckbox.addEventListener('change', async () => {
  await window.dataProcessing.addOrEditSetting('startup', { runOnStartup: runOnStartupCheckbox.checked })
})

openOnStartupCheckbox.addEventListener('change', async () => {
  await window.dataProcessing.addOrEditSetting('openOnStartup', { openOnStartup: openOnStartupCheckbox.checked })
})

async function loadShortcuts (): Promise<void> {
  const shortcuts = await window.dataProcessing.getShortcuts()
  shortcutsContainer.innerHTML = ''

  if (shortcuts.length === 0) {
    shortcutsContainer.innerHTML = '<li style="opacity:0.4; font-size:0.85rem; border:none; background:none;">No shortcuts yet.</li>'
  } else {
    shortcuts.forEach(shortcut => {
      const statusName = getStateNameById(shortcut.statusId)
      const li = document.createElement('li')

      const nameSpan = document.createElement('span')
      nameSpan.className = 'shortcut-status-name'
      nameSpan.textContent = statusName

      const keysSpan = document.createElement('span')
      keysSpan.className = 'shortcut-keys'
      shortcut.pressedKeys.forEach((key, i) => {
        if (i > 0) {
          const sep = document.createElement('span')
          sep.className = 'key-separator'
          sep.textContent = '+'
          keysSpan.appendChild(sep)
        }
        const kbd = document.createElement('kbd')
        kbd.textContent = key.charAt(0).toUpperCase() + key.slice(1)
        keysSpan.appendChild(kbd)
      })

      const editBtn = document.createElement('button')
      editBtn.innerHTML = '<img src="../public/edit.svg" alt="Edit shortcut">'
      editBtn.title = 'Edit'
      editBtn.onclick = () => startEditingShortcut(shortcut.id, shortcut.statusId)

      const deleteBtn = document.createElement('button')
      deleteBtn.innerHTML = '<img src="../public/delete-icon.svg" alt="Delete shortcut">'
      deleteBtn.title = 'Delete'
      deleteBtn.onclick = () => deleteShortcut(shortcut.id)

      li.appendChild(nameSpan)
      li.appendChild(keysSpan)
      li.appendChild(editBtn)
      li.appendChild(deleteBtn)
      shortcutsContainer.appendChild(li)
    })
  }
}

function getStateNameById (statusId: string): string {
  for (const option of Array.from(statesList.options)) {
    if (option.value === statusId) {
      return option.text
    }
  }
  return ''
}

function startEditingShortcut (id: string, statusId: string): void {
  editingShortcutId = id
  statesList.value = statusId
  editIndicator.style.display = 'block'
  editIndicator.textContent = `Editing: ${getStateNameById(statusId)}`
  recButton.click()
}

async function deleteShortcut (id: string): Promise<void> {
  await window.dataProcessing.removeShortcut(id)
  await loadShortcuts()
}

async function toggleRecording (): Promise<void> {
  isRecording = !isRecording
  recButton.classList.toggle('recording', isRecording)
  recButton.innerHTML = isRecording
    ? '<span class="rec-dot"></span> Recording...'
    : '<span class="rec-dot"></span> Record'

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

function keyDown (event: KeyboardEvent): void {
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

function keyUp (event: KeyboardEvent): void {
  const key = event.key.toLowerCase()
  delete pressedKeys[key]
  updateKeyInfo()
}

function updateKeyInfo (): void {
  const keys = Object.keys(pressedKeys)
  recButton.innerHTML = keys.length > 0
    ? `<span class="rec-dot"></span> ${keys.join(' + ')}`
    : '<span class="rec-dot"></span> Recording...'
}

recButton.addEventListener('click', toggleRecording)
