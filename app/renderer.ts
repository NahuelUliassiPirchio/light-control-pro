type BulbMode = 'color' | 'temp' | 'scene'

interface InferredBulbState {
  state: boolean
  dimming: number
  mode: BulbMode
  r?: number
  g?: number
  b?: number
  temp?: number
  sceneId?: number
  sceneSpeed?: number
  sceneName?: string
}

interface StatusSummaryItem {
  label: string
  swatchColor?: string
}

interface PerBulbSavedState {
  mac?: string
  ip?: string
  name?: string
  state?: boolean
  dimming?: number
  mode?: BulbMode
  r?: number
  g?: number
  b?: number
  temp?: number
  sceneId?: number
  sceneSpeed?: number
  sceneName?: string
  [key: string]: unknown
}

interface StatusDraft {
  targetType: 'room' | 'bulb'
  targetName: string
  state: boolean
  dimming: number
  mode: BulbMode
  bulbs: PerBulbSavedState[]
  ip?: string
  temp?: number
  r?: number
  g?: number
  b?: number
  sceneId?: number
  sceneSpeed?: number
  sceneName?: string
  [key: string]: unknown
}

interface StatusLike {
  state?: boolean
  dimming?: number
  mode?: string
  temp?: number
  r?: number
  g?: number
  b?: number
  sceneName?: string
  bulbs?: PerBulbSavedState[]
  targetType?: string
  targetName?: string
  [key: string]: unknown
}

interface BulbData extends BulbEntry {
  result?: BulbState & { name?: string }
}

interface RoomToggleRefs {
  bulbSwitch: HTMLInputElement
  slider: HTMLElement
  modeSelector: HTMLElement
  colorPicker: HTMLInputElement
  tempPicker: HTMLInputElement
  sceneSelector: HTMLSelectElement
  entityId: string
}

interface BuildStatusDraftParams {
  entity: BulbData
  isRoom: boolean
  roomBulbs: BulbEntry[]
  bulbSwitch: HTMLInputElement
  modeSelector: HTMLElement
  tempPicker: HTMLInputElement
  colorPicker: HTMLInputElement
  sceneSelector: HTMLSelectElement
  sceneSpeedRange: HTMLInputElement
  dimmingRange: HTMLInputElement
}

document.getElementById('minimizeBtn')!.addEventListener('click', () => window.windowControls.minimize())
document.getElementById('closeBtn')!.addEventListener('click', () => window.windowControls.close())

const template = (document.getElementById('bulb-template') as HTMLTemplateElement).content
const reloadButton = document.getElementById('reload-button')!
const addRoomButton = document.getElementById('add-room-button')!
const bulbsContainer = document.getElementById('bulbs-container')!

window.updateUi.onUpdatedBulbs(() => location.reload())

document.getElementById('cancelBtn')!.addEventListener('click', function () {
  document.getElementById('myModal')!.style.display = 'none'
})

const modal = document.getElementById('save-status-modal')!
const saveStatusCloseButton = document.getElementById('save-status-close')!
const saveStatusCancelButton = document.getElementById('save-status-cancel')!
const saveStatusConfirmButton = document.getElementById('save-status-confirm') as HTMLButtonElement
const saveStatusTitle = document.getElementById('save-status-title')!
const saveStatusDescription = document.getElementById('save-status-description')!
const saveStatusTargetType = document.getElementById('save-status-target-type')!
const saveStatusTargetName = document.getElementById('save-status-target-name')!
const saveStatusSummary = document.getElementById('save-status-summary')!
const saveStatusNameInput = document.getElementById('nameInput') as HTMLInputElement
const saveStatusHiddenInput = document.getElementById('hiddenInput') as HTMLInputElement
let pendingStatusDraft: StatusDraft | null = null
let currentDetailRoom: BulbEntry | null = null

const discoveredBulbStates = new Map<string, BulbState>()
const roomToggleMap = new Map<BulbEntry, RoomToggleRefs>()

const SCENE_SPEED_ADJUSTABLE = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33])
const SCENE_DIMMING_ADJUSTABLE = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33])

const SCENE_NAMES: Record<number, string> = {
  1: 'Ocean',
  2: 'Romance',
  3: 'Sunset',
  4: 'Party',
  5: 'Fireplace',
  6: 'Cozy',
  7: 'Forest',
  8: 'Pastel Colors',
  9: 'Wake up',
  10: 'Bedtime',
  11: 'Warm White',
  12: 'Daylight',
  13: 'Cool white',
  14: 'Night light',
  15: 'Focus',
  16: 'Relax',
  17: 'True colors',
  18: 'TV time',
  19: 'Plantgrowth',
  20: 'Spring',
  21: 'Summer',
  22: 'Fall',
  23: 'Deepdive',
  24: 'Jungle',
  25: 'Mojito',
  26: 'Club',
  27: 'Christmas',
  28: 'Halloween',
  29: 'Candlelight',
  30: 'Golden white',
  31: 'Pulse',
  32: 'Steampunk',
  1000: 'Rhythm'
}

function inferBulbStateFromLive (liveResult: BulbState | null | undefined): InferredBulbState {
  if (!liveResult) return { state: false, dimming: 100, mode: 'temp' }
  const base = { state: !!liveResult.state, dimming: liveResult.dimming ?? 100 }
  if (liveResult.sceneId > 0) {
    return {
      ...base,
      mode: 'scene',
      sceneId: liveResult.sceneId,
      sceneSpeed: liveResult.speed ?? 100,
      sceneName: SCENE_NAMES[liveResult.sceneId] || 'Scene'
    }
  }
  if (liveResult.r > 0 || liveResult.g > 0 || liveResult.b > 0) {
    return { ...base, mode: 'color', r: liveResult.r, g: liveResult.g, b: liveResult.b }
  }
  return { ...base, mode: 'temp', temp: liveResult.temp ?? 2700 }
}

function trackBulbState (bulb: BulbData, stateUpdate: Partial<BulbState>): void {
  const mac = bulb.mac ?? bulb.result?.mac
  if (!mac) return
  const current = discoveredBulbStates.get(mac) ?? ({} as BulbState)
  discoveredBulbStates.set(mac, { ...current, ...stateUpdate })
}

function closeModal (): void {
  modal.style.display = 'none'
  saveStatusNameInput.value = ''
  saveStatusHiddenInput.value = ''
  pendingStatusDraft = null
  saveStatusConfirmButton.disabled = false
  saveStatusConfirmButton.innerText = 'Save preset'
}

function getEntityDisplayName (entity: BulbData, isRoom: boolean): string {
  if (entity.name) return entity.name
  if (isRoom) return 'New room'
  return entity.result?.name || 'Bulb'
}

function getStatusSummaryItems (status: StatusLike): string[] {
  const summary: string[] = []
  const bulbsAmount = Array.isArray(status.bulbs) ? status.bulbs.length : 0
  summary.push(status.state ? 'On' : 'Off')
  if (bulbsAmount > 0) {
    summary.push(`${bulbsAmount} bulb${bulbsAmount === 1 ? '' : 's'}`)
  }
  if (status.dimming !== undefined) {
    summary.push(`Brightness ${status.dimming}%`)
  }
  if (status.mode === 'temp' && status.temp !== undefined) {
    summary.push(`${status.temp}K`)
  }
  if (status.mode === 'color' && status.r !== undefined && status.g !== undefined && status.b !== undefined) {
    summary.push(rgbToHex(status.r, status.g, status.b))
  }
  if (status.mode === 'scene' && status.sceneName) {
    summary.push(status.sceneName)
  }
  return summary
}

function updateSceneControls (sceneId: string | number, dimmingEl: HTMLElement, speedContainer: HTMLElement): void {
  const id = parseInt(String(sceneId))
  dimmingEl.style.display = SCENE_DIMMING_ADJUSTABLE.has(id) ? 'flex' : 'none'
  speedContainer.style.display = SCENE_SPEED_ADJUSTABLE.has(id) ? 'flex' : 'none'
}

const SCENE_COLORS: Record<number, string> = {
  1: '#00b4a0', // Ocean
  2: '#e91e8c', // Romance
  3: '#ff6b35', // Sunset
  4: '#e040fb', // Party
  5: '#ff4500', // Fireplace
  6: '#f59e0b', // Cozy
  7: '#2d6a4f', // Forest
  8: '#c9b1ff', // Pastel Colors
  9: '#ffe066', // Wake up
  10: '#f5a623', // Bedtime
  11: '#ffbf80', // Warm white
  12: '#cce7ff', // Daylight
  13: '#d0e8ff', // Cool white
  14: '#a89a3a', // Night light
  15: '#e0f0ff', // Focus
  16: '#f4a8c0', // Relax
  17: '#f5f5f0', // True colors
  18: '#5b7fff', // TV Time
  19: '#c084fc', // Plant growth
  20: '#b5ead7', // Spring
  21: '#ffd166', // Summer
  22: '#d4622a', // Fall
  23: '#1565c0', // Deep dive
  24: '#1b5e20', // Jungle
  25: '#76c442', // Mojito
  26: '#9c27b0', // Club
  27: '#cc0000', // Christmas
  28: '#ff6600', // Halloween
  29: '#ffb347', // Candlelight
  30: '#ffd700', // Golden white
  31: '#ffe600', // Pulse
  32: '#cd7f32', // Steampunk
  33: '#ff8c00' // Diwali
}

function getToggleColor (mode: BulbMode, colorPicker: HTMLInputElement, tempPicker: HTMLInputElement, sceneSelector: HTMLSelectElement): string {
  if (mode === 'color') return colorPicker.value
  if (mode === 'temp') return getTemperaturePreviewColor(parseInt(tempPicker.value))
  const sceneId = parseInt(sceneSelector?.value)
  return SCENE_COLORS[sceneId] || '#c8ddff'
}

function applyToggleGlow (slider: HTMLElement, isOn: boolean, color: string): void {
  if (!isOn) {
    slider.style.background = ''
    slider.style.boxShadow = ''
    return
  }
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  slider.style.background = color
  slider.style.boxShadow = `0 0 10px rgba(${r},${g},${b},0.75), 0 0 28px rgba(${r},${g},${b},0.35), inset 0 0 6px rgba(255,255,255,0.15)`
}

function getTemperaturePreviewColor (temperature: number): string {
  const minTemp = 2200
  const maxTemp = 6200
  const normalizedTemp = Math.min(Math.max(temperature, minTemp), maxTemp)
  const ratio = (normalizedTemp - minTemp) / (maxTemp - minTemp)
  const warmColor = { r: 255, g: 191, b: 120 }
  const coolColor = { r: 196, g: 228, b: 255 }
  const r = Math.round(warmColor.r + ((coolColor.r - warmColor.r) * ratio))
  const g = Math.round(warmColor.g + ((coolColor.g - warmColor.g) * ratio))
  const b = Math.round(warmColor.b + ((coolColor.b - warmColor.b) * ratio))
  return rgbToHex(r, g, b)
}

function getStatusPreviewItems (status: StatusLike): StatusSummaryItem[] {
  const summary = getStatusSummaryItems(status).map(item => ({ label: item }))

  if (status.mode === 'color' && status.r !== undefined && status.g !== undefined && status.b !== undefined) {
    const colorValue = rgbToHex(status.r, status.g, status.b)
    return summary.map(item => item.label === colorValue ? { ...item, swatchColor: colorValue } : item)
  }

  if (status.mode === 'temp' && status.temp !== undefined) {
    const tempLabel = `${status.temp}K`
    return summary.map(item => item.label === tempLabel ? { ...item, swatchColor: getTemperaturePreviewColor(status.temp!) } : item)
  }

  return summary
}

function isPerBulbRoomPreset (status: StatusLike): boolean {
  return status.targetType === 'room' &&
    Array.isArray(status.bulbs) && status.bulbs.length > 0 &&
    status.bulbs[0].state !== undefined
}

function renderPerBulbRoomSummary (bulbs: PerBulbSavedState[], container: HTMLElement): void {
  container.innerHTML = ''
  bulbs.forEach(bulbState => {
    const row = document.createElement('div')
    row.className = 'per-bulb-row'
    const nameSpan = document.createElement('span')
    nameSpan.className = 'per-bulb-name'
    nameSpan.innerText = bulbState.name || 'Bulb'
    row.appendChild(nameSpan)
    const chipsWrap = document.createElement('div')
    chipsWrap.className = 'per-bulb-chips'
    renderStatusSummary(getStatusPreviewItems(bulbState), chipsWrap, 'status-modal-summary-item')
    row.appendChild(chipsWrap)
    container.appendChild(row)
  })
}

function renderPerBulbCardTags (bulbs: PerBulbSavedState[], container: HTMLElement): void {
  container.innerHTML = ''
  const onCount = bulbs.filter(b => b.state).length
  const summaryChip = document.createElement('span')
  summaryChip.className = 'status-tag'
  summaryChip.innerText = `${onCount} on / ${bulbs.length - onCount} off`
  container.appendChild(summaryChip)
  bulbs.slice(0, 2).forEach(b => {
    const items = getStatusPreviewItems(b)
    const mainItem = items.find(i => i.swatchColor) || items[items.length - 1]
    if (!mainItem) return
    const chip = document.createElement('span')
    chip.className = 'status-tag'
    if (mainItem.swatchColor) {
      const swatch = document.createElement('span')
      swatch.className = 'status-summary-swatch'
      swatch.style.background = mainItem.swatchColor
      chip.appendChild(swatch)
    }
    const label = document.createElement('span')
    label.innerText = `${b.name}: ${mainItem.label}`
    chip.appendChild(label)
    container.appendChild(chip)
  })
  if (bulbs.length > 2) {
    const more = document.createElement('span')
    more.className = 'status-tag'
    more.innerText = `+${bulbs.length - 2} more`
    container.appendChild(more)
  }
}

function renderStatusSummary (items: (string | StatusSummaryItem)[], container: HTMLElement, className: string): void {
  container.innerHTML = ''
  items.forEach(item => {
    const chip = document.createElement('span')
    chip.className = className
    const itemConfig: StatusSummaryItem = typeof item === 'string' ? { label: item } : item
    if (itemConfig.swatchColor) {
      const swatch = document.createElement('span')
      swatch.className = 'status-summary-swatch'
      swatch.style.background = itemConfig.swatchColor
      chip.appendChild(swatch)
    }
    const label = document.createElement('span')
    label.innerText = itemConfig.label
    chip.appendChild(label)
    container.appendChild(chip)
  })
}

function openModal (statusDraft: StatusDraft): void {
  pendingStatusDraft = statusDraft
  saveStatusHiddenInput.value = JSON.stringify(statusDraft)
  saveStatusTitle.innerText = `Save ${statusDraft.targetType} preset`
  saveStatusDescription.innerText = `Store the current ${statusDraft.targetType} configuration so you can apply it again with a single click.`
  saveStatusTargetType.innerText = statusDraft.targetType
  saveStatusTargetName.innerText = statusDraft.targetName
  if (isPerBulbRoomPreset(statusDraft)) {
    renderPerBulbRoomSummary(statusDraft.bulbs, saveStatusSummary)
  } else {
    renderStatusSummary(getStatusPreviewItems(statusDraft), saveStatusSummary, 'status-modal-summary-item')
  }
  modal.style.display = 'block'
  saveStatusNameInput.focus()
  saveStatusNameInput.select()
}

async function saveStatus (): Promise<void> {
  const status: StatusDraft = pendingStatusDraft || JSON.parse(saveStatusHiddenInput.value)
  const name = saveStatusNameInput.value.trim()
  if (!name) return alert('Specify a name please')

  saveStatusConfirmButton.disabled = true
  saveStatusConfirmButton.innerText = 'Saving...'

  try {
    await window.dataProcessing.addStatus({
      ...status,
      name
    })
    alert('Status successfully saved')
    closeModal()
    location.reload()
  } catch {
    alert('There was an error saving the preset.')
    saveStatusConfirmButton.disabled = false
    saveStatusConfirmButton.innerText = 'Save preset'
  }
}

saveStatusCloseButton.addEventListener('click', closeModal)
saveStatusCancelButton.addEventListener('click', closeModal)
saveStatusConfirmButton.addEventListener('click', async () => await saveStatus())
saveStatusNameInput.addEventListener('keydown', async (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    await saveStatus()
  }
})
window.addEventListener('click', (event: MouseEvent) => {
  if (event.target === modal) {
    closeModal()
  }
})
window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && modal.style.display === 'block') {
    closeModal()
  }
})

function showMainView (): void {
  currentDetailRoom = null
  document.getElementById('room-detail-view')!.style.display = 'none'
  document.getElementById('main-view')!.style.display = 'block'
}

function showRoomDetail (room: BulbEntry): void {
  currentDetailRoom = room
  document.getElementById('main-view')!.style.display = 'none'
  document.getElementById('room-detail-view')!.style.display = 'block'

  // Swap input node to drop stale listeners
  const oldInput = document.getElementById('room-detail-name')!
  const nameInput = oldInput.cloneNode(true) as HTMLInputElement
  oldInput.parentNode!.replaceChild(nameInput, oldInput)
  nameInput.value = room.name || 'New room'
  nameInput.addEventListener('blur', async () => {
    room.name = nameInput.value
    await window.dataProcessing.addOrEditStoredBulbs({ ...room, name: nameInput.value })
  })
  nameInput.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') nameInput.blur() })

  const container = document.getElementById('room-bulbs-container')!
  container.innerHTML = ''
  const roomBulbs = storedBulbs.filter(b => room.bulbs?.includes(b.mac!))

  if (roomBulbs.length === 0) {
    const msg = document.createElement('p')
    msg.className = 'room-empty-msg'
    msg.textContent = 'This room has no bulbs yet. Add some using the + Bulb button above.'
    container.appendChild(msg)
  } else {
    roomBulbs.forEach(bulb => {
      const discovered = discoveredBulbStates.get(bulb.mac!)
      const bulbData: BulbData = {
        ip: bulb.ip,
        name: bulb.name,
        result: discovered
          ? { ...discovered, mac: bulb.mac! }
          : { mac: bulb.mac!, state: false, dimming: 100, temp: 2700, r: 0, g: 0, b: 0, c: 0, w: 0, sceneId: 0, speed: 100, rssi: 0, src: '', method: '' } as BulbState
      }
      const card = getEntityHTML(bulbData, 'bulb')
      card.dataset.mac = bulb.mac
      if (!discovered) card.classList.add('bulb-unreachable')
      container.appendChild(card)
    })
  }

  const replaceBtn = (id: string, handler: () => void): void => {
    const old = document.getElementById(id)!
    const btn = old.cloneNode(true) as HTMLElement
    old.parentNode!.replaceChild(btn, old)
    btn.addEventListener('click', handler)
  }

  replaceBtn('room-detail-add-bulb', () => {
    document.getElementById('myModal')!.style.display = 'block'
    populateList({
      allItems: storedBulbs.filter(b => !b.bulbs),
      selectedItemsMac: room.bulbs
    })
  })

  replaceBtn('room-detail-save', () => {
    openModal({
      targetType: 'room',
      targetName: room.name || 'New room',
      state: false,
      dimming: 100,
      mode: 'temp',
      bulbs: roomBulbs.map(b => ({
        mac: b.mac,
        ip: b.ip,
        name: b.name || 'Bulb',
        ...inferBulbStateFromLive(discoveredBulbStates.get(b.mac!))
      }))
    })
  })

  replaceBtn('room-detail-delete', async () => {
    if (confirm(`Delete room "${room.name || 'New Room'}"?`)) {
      await window.dataProcessing.removeStoredBulbs(room.mac!)
      location.reload()
    }
  })
}

document.getElementById('back-to-rooms')!.addEventListener('click', showMainView)
document.getElementById('room-detail-reload')!.addEventListener('click', () => {
  if (currentDetailRoom?.mac) sessionStorage.setItem('pendingRoomMac', currentDetailRoom.mac)
  location.reload()
})

document.getElementById('confirmBtn')!.addEventListener('click', async function () {
  if (!currentDetailRoom) return
  const selectedValues: string[] = []
  document.querySelectorAll('#valuesList input[type="checkbox"]:checked').forEach(cb => {
    selectedValues.push(cb.getAttribute('mac')!)
  })
  currentDetailRoom.bulbs = selectedValues
  await window.dataProcessing.addOrEditStoredBulbs(currentDetailRoom)
  location.reload()
})

let storedBulbs: BulbEntry[]
let favStatus: SavedStatus[]
;(async () => {
  storedBulbs = await window.dataProcessing.getStoredBulbs()
  const rooms = storedBulbs.filter(bulb => bulb.bulbs)
  rooms.forEach(room => {
    const card = getEntityHTML(room, 'room')

    // Darker section: bulb name pills + chevron navigation
    const listWrapper = document.createElement('div')
    listWrapper.className = 'room-bulb-list-wrapper'
    listWrapper.addEventListener('click', () => showRoomDetail(room))

    const bulbListEl = document.createElement('ul')
    bulbListEl.className = 'room-bulb-list'
    const roomBulbsList = storedBulbs.filter(b => room.bulbs?.includes(b.mac!))
    if (roomBulbsList.length > 0) {
      roomBulbsList.forEach(b => {
        const li = document.createElement('li')
        li.className = 'room-bulb-list-item'
        li.textContent = b.name || 'Bulb'
        bulbListEl.appendChild(li)
      })
    } else {
      const li = document.createElement('li')
      li.className = 'room-bulb-list-item room-bulb-list-empty'
      li.textContent = 'No bulbs'
      bulbListEl.appendChild(li)
    }
    listWrapper.appendChild(bulbListEl)

    const chevron = document.createElement('span')
    chevron.className = 'room-bulb-list-chevron'
    chevron.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M9 18l6-6-6-6"/></svg>'
    listWrapper.appendChild(chevron)

    const floatingBtns = card.querySelector('.floating-buttons')
    card.insertBefore(listWrapper, floatingBtns)

    // Set currentDetailRoom when add-bulb modal opens
    card.querySelector('.add-bulb-button')?.addEventListener('click', () => {
      currentDetailRoom = room
    })

    roomToggleMap.set(room, {
      bulbSwitch: card.querySelector<HTMLInputElement>('.bulb-switch > input')!,
      slider: card.querySelector<HTMLElement>('.slider')!,
      modeSelector: card.querySelector<HTMLElement>('.mode-selector')!,
      colorPicker: card.querySelector<HTMLInputElement>('.color-picker')!,
      tempPicker: card.querySelector<HTMLInputElement>('.temp-picker')!,
      sceneSelector: card.querySelector<HTMLSelectElement>('#scene-selector')!,
      entityId: room.mac || ''
    })

    bulbsContainer.appendChild(card)
  })

  const favsContainer = document.getElementById('fav-status')!
  favStatus = await window.dataProcessing.getStatus()
  if (favStatus.length === 0) document.querySelector('.fav-status-container')!.remove()
  favStatus.forEach(status => {
    favsContainer.appendChild(createSavedStatusCard(status))
  })

  const pendingRoomMac = sessionStorage.getItem('pendingRoomMac')
  if (pendingRoomMac) {
    sessionStorage.removeItem('pendingRoomMac')
    const room = storedBulbs.find(b => b.mac === pendingRoomMac)
    if (room) showRoomDetail(room)
  }

  addRoomButton.addEventListener('click', async () => {
    await window.dataProcessing.addOrEditStoredBulbs({
      name: 'New room'
    })
    location.reload()
  })
})()

function populateList ({ allItems, selectedItemsMac }: { allItems: BulbEntry[]; selectedItemsMac?: string[] }): void {
  const valuesList = document.getElementById('valuesList')!
  valuesList.innerHTML = ''
  allItems.forEach(item => {
    const listItem = document.createElement('li')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = item.name || ''
    if (selectedItemsMac) {
      checkbox.checked = selectedItemsMac.includes(item.mac!)
    }
    checkbox.setAttribute('mac', item.mac!)
    checkbox.setAttribute('data-name', item.name || '')

    listItem.appendChild(checkbox)
    listItem.append(item.name || '')
    valuesList.appendChild(listItem)
  })
}

function getStatusMetaLabel (status: StatusLike): string {
  const targetType = status.targetType === 'room' ? 'Room' : 'Bulb'
  const bulbsAmount = Array.isArray(status.bulbs) ? status.bulbs.length : 0
  if (status.targetType === 'room' && bulbsAmount > 0) {
    return `${targetType} • ${bulbsAmount} bulbs`
  }
  return targetType
}

function buildStatusDraft ({
  entity,
  isRoom,
  roomBulbs,
  bulbSwitch,
  modeSelector,
  tempPicker,
  colorPicker,
  sceneSelector,
  sceneSpeedRange,
  dimmingRange
}: BuildStatusDraftParams): StatusDraft {
  const selectedMode = modeSelector.querySelector<HTMLInputElement>(`input[name="mode${isRoom ? entity.mac : entity.result?.mac}"]:checked`)!.value as BulbMode
  const draft: StatusDraft = {
    targetType: isRoom ? 'room' : 'bulb',
    targetName: getEntityDisplayName(entity, isRoom),
    state: bulbSwitch.checked,
    dimming: parseInt(dimmingRange.value),
    mode: selectedMode,
    bulbs: roomBulbs.map(bulb => ({
      mac: bulb.mac,
      ip: bulb.ip,
      name: bulb.name || 'Bulb'
    }))
  }

  if (!isRoom && entity.ip) {
    draft.ip = entity.ip
  }

  if (selectedMode === 'temp') {
    draft.temp = parseInt(tempPicker.value)
    return draft
  }

  if (selectedMode === 'color') {
    return {
      ...draft,
      ...hexaToRGB(colorPicker.value)
    }
  }

  return {
    ...draft,
    sceneId: parseInt(sceneSelector.value),
    sceneSpeed: parseInt(sceneSpeedRange.value),
    sceneName: sceneSelector.options[sceneSelector.selectedIndex]?.textContent || 'Scene'
  }
}

function createSavedStatusCard (status: SavedStatus): HTMLButtonElement {
  const statusItem = document.createElement('button')
  statusItem.className = 'status'
  statusItem.type = 'button'

  const copyWrapper = document.createElement('div')
  copyWrapper.className = 'status-copy'

  const statusName = document.createElement('span')
  statusName.className = 'status-name'
  statusName.innerText = status.name || ''

  const statusMeta = document.createElement('span')
  statusMeta.className = 'status-meta'
  statusMeta.innerText = `${getStatusMetaLabel(status)}${status.targetName ? ` • ${status.targetName}` : ''}`

  const statusTags = document.createElement('div')
  statusTags.className = 'status-tags'
  if (isPerBulbRoomPreset(status)) {
    renderPerBulbCardTags(status.bulbs as PerBulbSavedState[], statusTags)
  } else {
    renderStatusSummary(getStatusPreviewItems(status), statusTags, 'status-tag')
  }

  copyWrapper.appendChild(statusName)
  copyWrapper.appendChild(statusMeta)
  copyWrapper.appendChild(statusTags)

  const deleteBtn = document.createElement('img')
  deleteBtn.src = '../public/delete-icon.svg'
  deleteBtn.alt = 'Delete saved status'
  deleteBtn.className = 'delete-status-button'
  deleteBtn.onclick = async (event: MouseEvent) => {
    event.stopPropagation()
    const isConfirmed = confirm(`Are you sure you want to delete "${status.name}"?`)
    if (isConfirmed) {
      try {
        await window.dataProcessing.removeStatus(status.id!)
        statusItem.remove()
      } catch {
        alert('There was an error deleting the status.')
      }
    }
  }

  statusItem.appendChild(copyWrapper)
  statusItem.appendChild(deleteBtn)
  statusItem.addEventListener('click', async () => {
    try {
      await window.bulbNetworking.setStatus(status.ip!, status)
    } catch {
      alert('There was an error applying the preset.')
    }
  })

  return statusItem
}

document.addEventListener('DOMContentLoaded', () => {
  window.bulbNetworking.startDiscovery()

  window.bulbNetworking.onBulbDiscovered(async (bulbData) => {
    if (bulbData.result?.mac) {
      unreachableToast.hidden = true
      discoveredBulbStates.set(bulbData.result.mac, bulbData.result)

      for (const [room, refs] of roomToggleMap) {
        if (room.bulbs?.includes(bulbData.result.mac)) {
          const anyOn = room.bulbs.some(mac => discoveredBulbStates.get(mac)?.state)
          refs.bulbSwitch.checked = anyOn
          const mode = (refs.modeSelector?.querySelector<HTMLInputElement>(`input[name="mode${refs.entityId}"]:checked`)?.value || 'temp') as BulbMode
          applyToggleGlow(refs.slider, anyOn, getToggleColor(mode, refs.colorPicker, refs.tempPicker, refs.sceneSelector))
          break
        }
      }

      const detailCard = document.querySelector<HTMLElement>(`#room-bulbs-container [data-mac="${bulbData.result.mac}"]`)
      if (detailCard) detailCard.classList.remove('bulb-unreachable')
    }
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
    const isInRoom = storedBulbs?.some(entity => entity.bulbs?.includes(bulbData.result?.mac))
    if (!isInRoom) {
      bulbsContainer.appendChild(getEntityHTML(bulbData as unknown as BulbData, 'bulb'))
    }
  })
})

reloadButton.addEventListener('click', () => {
  location.reload()
})

document.getElementById('config-button')!.addEventListener('click', () => {
  location.href = './config.html'
})

const unreachableToast = document.getElementById('unreachable-toast') as HTMLElement & { hidden: boolean }
document.getElementById('unreachable-toast-retry')!.addEventListener('click', () => {
  unreachableToast.hidden = true
  window.bulbNetworking.startDiscovery()
})

function reportBulbErrors (results: PromiseSettledResult<unknown>[]): boolean {
  const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
  if (failures.length === 0) return true
  failures.forEach(f => console.error('Bulb command failed:', f.reason?.message ?? f.reason))
  const hasUnreachable = failures.some(f => /EHOSTUNREACH/i.test(f.reason?.message ?? ''))
  if (hasUnreachable) unreachableToast.hidden = false
  return failures.length < results.length
}

// --- Audio Reactive Mode ---
let audioActive = false
let audioStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let animFrameId: number | null = null
let lastCommandTime = 0
const THROTTLE_MS = 200
const TEMP_THRESHOLD = 150 // K — minimum temp change to send command
const DIMMING_THRESHOLD = 8 // % — minimum brightness change to send command
let audioTargetBulbs: BulbEntry[] = []
let lastSentTemp: number | null = null
let lastSentDimming: number | null = null

const audioButton = document.getElementById('audio-button')!
const audioSyncModal = document.getElementById('audio-sync-modal')!

audioButton.addEventListener('click', () => {
  if (audioActive) {
    stopAudioMode()
  } else {
    openAudioSyncModal()
  }
})

function openAudioSyncModal (): void {
  const list = document.getElementById('audio-sync-list')!
  list.innerHTML = ''

  const rooms = (storedBulbs || []).filter(b => b.bulbs)
  const bulbs = (storedBulbs || []).filter(b => b.ip && !b.bulbs)

  ;[...rooms, ...bulbs].forEach(entity => {
    const isRoom = !!entity.bulbs
    const li = document.createElement('li')
    const label = document.createElement('label')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.value = entity.mac || ''
    checkbox.dataset.entityType = isRoom ? 'room' : 'bulb'

    const nameSpan = document.createElement('span')
    nameSpan.textContent = entity.name || (isRoom ? 'Room' : 'Bulb')

    const badge = document.createElement('span')
    badge.className = isRoom ? 'audio-sync-type-badge room' : 'audio-sync-type-badge'
    badge.textContent = isRoom ? `Room · ${entity.bulbs!.length}` : 'Bulb'

    label.appendChild(checkbox)
    label.appendChild(nameSpan)
    label.appendChild(badge)
    li.appendChild(label)
    list.appendChild(li)
  })

  audioSyncModal.style.display = 'block'
}

function closeAudioSyncModal (): void {
  audioSyncModal.style.display = 'none'
}

document.getElementById('audio-sync-close')!.addEventListener('click', closeAudioSyncModal)
document.getElementById('audio-sync-cancel')!.addEventListener('click', closeAudioSyncModal)
audioSyncModal.addEventListener('click', (e: MouseEvent) => { if (e.target === audioSyncModal) closeAudioSyncModal() })

document.getElementById('audio-sync-confirm')!.addEventListener('click', async () => {
  const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('#audio-sync-list input[type="checkbox"]:checked'))
  const selectedMacs = new Set(checkboxes.map(cb => cb.value))
  const selectedTypes: Record<string, string> = Object.fromEntries(checkboxes.map(cb => [cb.value, cb.dataset.entityType!]))

  const resolved: BulbEntry[] = []
  const added = new Set<string>()

  selectedMacs.forEach(mac => {
    if (selectedTypes[mac] === 'room') {
      const room = storedBulbs.find(b => b.mac === mac && b.bulbs)
      if (room) {
        room.bulbs!.forEach(bulbMac => {
          if (!added.has(bulbMac)) {
            const bulb = storedBulbs.find(b => b.mac === bulbMac && b.ip)
            if (bulb) { resolved.push(bulb); added.add(bulbMac) }
          }
        })
      }
    } else {
      if (!added.has(mac)) {
        const bulb = storedBulbs.find(b => b.mac === mac && b.ip)
        if (bulb) { resolved.push(bulb); added.add(mac) }
      }
    }
  })

  audioTargetBulbs = resolved
  closeAudioSyncModal()
  await startAudioMode()
})

async function startAudioMode (): Promise<void> {
  try {
    const sources = await window.audioCapture.getDesktopSources()
    if (!sources.length) throw new Error('No desktop sources found')

    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sources[0].id } } as MediaTrackConstraints,
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sources[0].id } } as MediaTrackConstraints
    })

    // Drop video tracks — only need audio
    audioStream.getVideoTracks().forEach(t => t.stop())

    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(audioStream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount) // 128 bins

    audioActive = true
    audioButton.classList.add('active')

    function tick (): void {
      if (!audioActive) return
      animFrameId = requestAnimationFrame(tick)

      analyser.getByteFrequencyData(dataArray)

      const avg = (arr: Uint8Array): number => arr.reduce((a, b) => a + b, 0) / arr.length
      const bass = avg(dataArray.slice(0, 5)) // ~0-860Hz
      const treble = avg(dataArray.slice(20, 60)) // ~3440-10320Hz
      const overall = avg(dataArray)

      const dimming = Math.max(10, Math.round((overall / 255) * 100))
      const bassRatio = bass / (bass + treble + 1)
      const temp = Math.round(2200 + (1 - bassRatio) * 4000) // warm=bass, cool=treble

      const now = Date.now()
      if (now - lastCommandTime < THROTTLE_MS) return

      const tempChanged = lastSentTemp === null || Math.abs(temp - lastSentTemp) >= TEMP_THRESHOLD
      const dimmingChanged = lastSentDimming === null || Math.abs(dimming - lastSentDimming) >= DIMMING_THRESHOLD
      if (!tempChanged && !dimmingChanged) return

      lastCommandTime = now
      lastSentTemp = temp
      lastSentDimming = dimming

      audioTargetBulbs.forEach(b => {
        window.bulbNetworking.setTemp(b.ip!, temp, dimming).catch(() => {})
      })
    }

    tick()
  } catch (err) {
    console.error('Error starting audio mode:', err)
    alert('Could not capture system audio: ' + (err as Error).message)
  }
}

function stopAudioMode (): void {
  audioActive = false
  audioButton.classList.remove('active')
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (audioContext) { audioContext.close(); audioContext = null }
  if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null }
  lastSentTemp = null
  lastSentDimming = null
}

function getEntityHTML (entity: BulbData, type: 'room' | 'bulb'): HTMLElement {
  const isRoom = type === 'room'
  const entityId = isRoom ? entity.mac! : entity.result!.mac
  const bulbTemplate = template.querySelector('.bulb-section')!.cloneNode(true) as HTMLElement
  const bulbSwitch = bulbTemplate.querySelector<HTMLInputElement>('.bulb-switch > input')!

  if (entity.name || (isRoom && entity.name)) {
    const bulbNameInput = bulbTemplate.querySelector<HTMLInputElement>('.bulb-name')!
    bulbNameInput.value = entity.name || entity.result?.name || ''

    async function handleNameChange (): Promise<void> {
      const newName = bulbNameInput.value
      const macAddress = entityId
      await window.dataProcessing.addOrEditStoredBulbs({
        ...entity,
        name: newName,
        mac: macAddress
      })
    }

    bulbNameInput.addEventListener('blur', handleNameChange)
    bulbNameInput.addEventListener('keydown', function (event: KeyboardEvent) {
      if (event.key === 'Enter') {
        bulbNameInput.blur()
      }
    })
  }

  if (isRoom && (!entity.bulbs || entity.bulbs.length === 0)) {
    const tabs = bulbTemplate.querySelectorAll('.tab-content')
    tabs.forEach(tab => {
      tab.parentNode!.removeChild(tab)
    })
    bulbTemplate.querySelector('.dimming')!.remove()
    bulbTemplate.querySelector('.bulb-switch')!.remove()
    bulbTemplate.querySelector('.mode-selector')!.remove()
    bulbTemplate.style.justifyContent = ''
    const noBulbMessage = document.createElement('p')
    noBulbMessage.innerHTML = "This room doesn't have any bulbs"
    bulbTemplate.insertBefore(noBulbMessage, bulbTemplate.querySelector('.floating-buttons'))

    const saveStatusButton = bulbTemplate.querySelector<HTMLButtonElement>('.save-status-button')!
    saveStatusButton.disabled = true
    saveStatusButton.title = 'Add bulbs before saving a room preset'

    const addBulbsButton = bulbTemplate.querySelector('.add-bulb-button')!
    addBulbsButton.addEventListener('click', async () => {
      document.getElementById('myModal')!.style.display = 'block'
      populateList({
        allItems: storedBulbs.filter(bulb => !bulb.bulbs)
      })
    })
  } else {
    const roomBulbs = isRoom ? storedBulbs.filter(obj => entity.bulbs!.includes(obj.mac!)) : [entity]
    bulbSwitch.checked = isRoom ? false : !!entity.result!.state

    const modeSelector = bulbTemplate.querySelector<HTMLElement>('.mode-selector')!
    const colorPicker = bulbTemplate.querySelector<HTMLInputElement>('.color-picker')!
    const tempPicker = bulbTemplate.querySelector<HTMLInputElement>('.temp-picker')!
    const sceneSelector = bulbTemplate.querySelector<HTMLSelectElement>('#scene-selector')!
    const sceneSpeedRange = bulbTemplate.querySelector<HTMLInputElement>('.speed-range')!
    const dimmingRange = bulbTemplate.querySelector<HTMLInputElement>('.dimming-range')!
    const saveStatusButton = bulbTemplate.querySelector<HTMLButtonElement>('.floating-buttons .save-status-button')!
    const slider = bulbTemplate.querySelector<HTMLElement>('.slider')!
    const dimmingEl = bulbTemplate.querySelector<HTMLElement>('.dimming')!
    const speedContainer = bulbTemplate.querySelector<HTMLElement>('.speed-container')!

    if (!isRoom && (entity.result!.r || entity.result!.g || entity.result!.b)) {
      colorPicker.value = rgbToHex(entity.result!.r, entity.result!.g, entity.result!.b)
    }
    if (!isRoom) {
      tempPicker.value = String(entity.result!.temp ?? tempPicker.value)
      sceneSelector.value = String(entity.result!.sceneId ?? sceneSelector.value)
      sceneSpeedRange.value = String(entity.result!.speed ?? sceneSpeedRange.value)
      dimmingRange.value = String(entity.result!.dimming)
    }

    const colorInput = document.createElement('input')
    colorInput.type = 'radio'
    colorInput.value = 'color'
    colorInput.id = 'color' + entityId
    colorInput.name = 'mode' + entityId
    colorInput.checked = !isRoom && !!entity.result?.r
    const colorLabel = document.createElement('label')
    colorLabel.htmlFor = 'color' + entityId
    colorLabel.textContent = 'Color'
    modeSelector.appendChild(colorInput)
    modeSelector.appendChild(colorLabel)

    const tempInput = document.createElement('input')
    tempInput.type = 'radio'
    tempInput.value = 'temp'
    tempInput.id = 'temp' + entityId
    tempInput.name = 'mode' + entityId
    tempInput.checked = isRoom || (!isRoom && !!entity.result?.temp)
    const tempLabel = document.createElement('label')
    tempLabel.htmlFor = 'temp' + entityId
    tempLabel.textContent = 'Temp'
    modeSelector.appendChild(tempInput)
    modeSelector.appendChild(tempLabel)

    const sceneInput = document.createElement('input')
    sceneInput.type = 'radio'
    sceneInput.value = 'scene'
    sceneInput.id = 'scene' + entityId
    sceneInput.name = 'mode' + entityId
    sceneInput.checked = !isRoom && !!entity.result?.sceneId
    const sceneLabel = document.createElement('label')
    sceneLabel.htmlFor = 'scene' + entityId
    sceneLabel.textContent = 'Scene'
    modeSelector.appendChild(sceneInput)
    modeSelector.appendChild(sceneLabel)

    const updateTabs = (_container: HTMLElement): void => {
      const tabs = bulbTemplate.querySelectorAll('.tab-content')
      tabs.forEach(tab => {
        const selectedMode = modeSelector.querySelector<HTMLInputElement>(`input[name="mode${entityId}"]:checked`)!.value
        if (selectedMode === (tab as HTMLElement).id) {
          (tab as HTMLElement).style.display = 'flex'
          return
        }
        (tab as HTMLElement).style.display = 'none'
      })
    }

    modeSelector.querySelector<HTMLInputElement>(`#temp${entityId}`)!.checked = isRoom || (!isRoom && !!entity.result?.temp)
    // Fallback: if no mode radio ended up checked (e.g. firmware returns no temp/scene/r),
    // default to temp so updateTabs never reads a null value.
    if (!modeSelector.querySelector(`input[name="mode${entityId}"]:checked`)) {
      modeSelector.querySelector<HTMLInputElement>(`#temp${entityId}`)!.checked = true
    }
    updateTabs(bulbTemplate)

    const initialMode = (modeSelector.querySelector<HTMLInputElement>(`input[name="mode${entityId}"]:checked`)?.value || 'temp') as BulbMode
    applyToggleGlow(slider, bulbSwitch.checked, getToggleColor(initialMode, colorPicker, tempPicker, sceneSelector))
    if (initialMode === 'scene') {
      updateSceneControls(sceneSelector.value, dimmingEl, speedContainer)
    }

    modeSelector.addEventListener('change', async () => {
      updateTabs(bulbTemplate)
      const mode = (modeSelector.querySelector<HTMLInputElement>(`input[name="mode${entityId}"]:checked`)?.value || 'temp') as BulbMode
      if (mode === 'scene') {
        updateSceneControls(sceneSelector.value, dimmingEl, speedContainer)
      } else {
        dimmingEl.style.display = 'flex'
      }
      if (bulbSwitch.checked) {
        applyToggleGlow(slider, true, getToggleColor(mode, colorPicker, tempPicker, sceneSelector))
      }
    })

    bulbSwitch.addEventListener('change', async (event: Event) => {
      const isNowOn = (event.target as HTMLInputElement).checked
      const selectedMode = modeSelector.querySelector<HTMLInputElement>(`input[name="mode${entityId}"]:checked`)!.value as BulbMode
      let promises: Promise<void>[]
      if (!isNowOn) {
        promises = roomBulbs.map(bulb => window.bulbNetworking.setBulb(bulb.ip!, false))
      } else {
        switch (selectedMode) {
          case 'color':
            promises = roomBulbs.map(bulb => window.bulbNetworking.changeColor(bulb.ip!, hexaToRGB(colorPicker.value), parseInt(dimmingRange.value)))
            break
          case 'temp':
            promises = roomBulbs.map(bulb => window.bulbNetworking.setTemp(bulb.ip!, parseInt(tempPicker.value), parseInt(dimmingRange.value)))
            break
          case 'scene':
            promises = roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip!, parseInt(sceneSelector.value), parseInt(sceneSpeedRange.value), parseInt(dimmingRange.value)))
            break
          default:
            promises = []
        }
      }
      const results = await Promise.allSettled(promises)
      if (!isNowOn) {
        roomBulbs.forEach(b => trackBulbState(b, { state: false }))
      } else {
        switch (selectedMode) {
          case 'color': {
            const { r, g, b } = hexaToRGB(colorPicker.value)
            roomBulbs.forEach(bl => trackBulbState(bl, { state: true, r, g, b, dimming: parseInt(dimmingRange.value), temp: 0, sceneId: 0 }))
            break
          }
          case 'temp':
            roomBulbs.forEach(bl => trackBulbState(bl, { state: true, temp: parseInt(tempPicker.value), dimming: parseInt(dimmingRange.value), r: 0, g: 0, b: 0, sceneId: 0 }))
            break
          case 'scene':
            roomBulbs.forEach(bl => trackBulbState(bl, { state: true, sceneId: parseInt(sceneSelector.value), speed: parseInt(sceneSpeedRange.value), dimming: parseInt(dimmingRange.value), r: 0, g: 0, b: 0, temp: 0 }))
            break
        }
      }
      if (!reportBulbErrors(results)) {
        (event.target as HTMLInputElement).checked = !isNowOn
      }
      applyToggleGlow(slider, bulbSwitch.checked, getToggleColor(selectedMode, colorPicker, tempPicker, sceneSelector))
    })

    tempPicker.addEventListener('change', async (event: Event) => {
      const target = event.target as HTMLInputElement
      const results = await Promise.allSettled(roomBulbs.map(bulb => window.bulbNetworking.setTemp(bulb.ip!, parseInt(target.value), parseInt(dimmingRange.value))))
      reportBulbErrors(results)
      roomBulbs.forEach(b => trackBulbState(b, { state: true, temp: parseInt(target.value), dimming: parseInt(dimmingRange.value), r: 0, g: 0, b: 0, sceneId: 0 }))
      bulbSwitch.checked = true
      applyToggleGlow(slider, true, getToggleColor('temp', colorPicker, tempPicker, sceneSelector))
    })

    colorPicker.addEventListener('input', async (event: Event) => {
      const rgbColor = hexaToRGB((event.target as HTMLInputElement).value)
      const results = await Promise.allSettled(roomBulbs.map(bulb => window.bulbNetworking.changeColor(bulb.ip!, rgbColor, parseInt(dimmingRange.value))))
      reportBulbErrors(results)
      roomBulbs.forEach(b => trackBulbState(b, { state: true, ...rgbColor, dimming: parseInt(dimmingRange.value), temp: 0, sceneId: 0 }))
      bulbSwitch.checked = true
      applyToggleGlow(slider, true, getToggleColor('color', colorPicker, tempPicker, sceneSelector))
    })

    sceneSelector.addEventListener('change', async (event: Event) => {
      const target = event.target as HTMLSelectElement
      updateSceneControls(target.value, dimmingEl, speedContainer)
      const results = await Promise.allSettled(roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip!, parseInt(target.value), parseInt(sceneSpeedRange.value), parseInt(dimmingRange.value))))
      reportBulbErrors(results)
      roomBulbs.forEach(b => trackBulbState(b, { state: true, sceneId: parseInt(target.value), speed: parseInt(sceneSpeedRange.value), dimming: parseInt(dimmingRange.value), r: 0, g: 0, b: 0, temp: 0 }))
      bulbSwitch.checked = true
      applyToggleGlow(slider, true, getToggleColor('scene', colorPicker, tempPicker, sceneSelector))
    })

    sceneSpeedRange.addEventListener('change', async (event: Event) => {
      const target = event.target as HTMLInputElement
      const results = await Promise.allSettled(roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip!, parseInt(sceneSelector.value), parseInt(target.value), parseInt(dimmingRange.value))))
      reportBulbErrors(results)
      roomBulbs.forEach(b => trackBulbState(b, { speed: parseInt(target.value) }))
      bulbSwitch.checked = true
    })

    dimmingRange.addEventListener('change', async (event: Event) => {
      const target = event.target as HTMLInputElement
      const selectedMode = modeSelector.querySelector<HTMLInputElement>(`input[name="mode${entityId}"]:checked`)!.value as BulbMode
      let promises: Promise<void>[]
      switch (selectedMode) {
        case 'color':
          promises = roomBulbs.map(bulb => window.bulbNetworking.changeColor(bulb.ip!, hexaToRGB(colorPicker.value), parseInt(target.value)))
          break
        case 'temp':
          promises = roomBulbs.map(bulb => window.bulbNetworking.setTemp(bulb.ip!, parseInt(tempPicker.value), parseInt(target.value)))
          break
        case 'scene':
          promises = roomBulbs.map(bulb => window.bulbNetworking.setScene(bulb.ip!, parseInt(sceneSelector.value), parseInt(sceneSpeedRange.value), parseInt(target.value)))
          break
        default:
          promises = []
      }
      const results = await Promise.allSettled(promises)
      reportBulbErrors(results)
      roomBulbs.forEach(b => trackBulbState(b, { dimming: parseInt(target.value) }))
      bulbSwitch.checked = true
    })

    saveStatusButton.addEventListener('click', async () => {
      openModal(buildStatusDraft({
        entity,
        isRoom,
        roomBulbs,
        bulbSwitch,
        modeSelector,
        tempPicker,
        colorPicker,
        sceneSelector,
        sceneSpeedRange,
        dimmingRange
      }))
    })

    if (!isRoom) {
      const addBulbBtn = bulbTemplate.querySelector('.floating-buttons .add-bulb-button')
      if (addBulbBtn) addBulbBtn.remove()
      const deleteBtn = bulbTemplate.querySelector('.floating-buttons .delete-room-button')
      if (deleteBtn) deleteBtn.remove()
    }

    if (isRoom) {
      const addBulbsButton = bulbTemplate.querySelector('.add-bulb-button')!
      addBulbsButton.addEventListener('click', async () => {
        document.getElementById('myModal')!.style.display = 'block'
        populateList({
          allItems: storedBulbs.filter(bulb => !bulb.bulbs),
          selectedItemsMac: entity.bulbs
        })
      })
    }
  }
  if (isRoom) {
    const deleteRoomButton = bulbTemplate.querySelector('.delete-room-button')!
    deleteRoomButton.addEventListener('click', (event: Event) => {
      event.stopPropagation()
      const isConfirmed = confirm(`Are you sure you want to delete the room "${entity.name || 'New Room'}"?`)
      if (isConfirmed) {
        window.dataProcessing.removeStoredBulbs(entity.mac!)
        location.reload()
      }
    })
  }

  return bulbTemplate
}

function hexaToRGB (hexaColor: string): RGBColor {
  const r = parseInt(hexaColor.substr(1, 2), 16)
  const g = parseInt(hexaColor.substr(3, 2), 16)
  const b = parseInt(hexaColor.substr(5, 2), 16)
  return { r, g, b }
}

function componentToHex (c: number): string {
  const hex = c.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}

function rgbToHex (r: number, g: number, b: number): string {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b)
}
