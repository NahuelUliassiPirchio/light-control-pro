import { existsSync, readFileSync, writeFileSync, promises, PathLike } from 'fs'
import { IpcMainInvokeEvent } from 'electron'
import { v4 as uuidv4 } from 'uuid'

interface Setting {
  id: string
  [key: string]: unknown
}

interface StoredBulb {
  mac?: string
  ip?: string
  name?: string
  bulbs?: string[]
  [key: string]: unknown
}

interface DataItem {
  id: string
  [key: string]: unknown
}

async function handleAddOrUpdateSetting (_event: IpcMainInvokeEvent | null, settingId: string, data: Omit<Setting, 'id'>, filePath: PathLike) {
  const fileExists = existsSync(filePath)
  let existingData: Setting[] = []

  if (fileExists) {
    const fileContent = readFileSync(filePath, 'utf-8')
    existingData = JSON.parse(fileContent)
  }

  const settingIndex = existingData.findIndex(item => item.id === settingId)

  if (settingIndex !== -1) {
    existingData[settingIndex] = { ...existingData[settingIndex], ...data }
  } else {
    const newData = { ...data, id: settingId }
    existingData.push(newData)
  }

  writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8')
  console.log('Setting updated in', filePath)
}

async function handleAddOrUpdateStoredBulb (_event: IpcMainInvokeEvent | null, data: StoredBulb, filePath: PathLike) {
  const fileExists = existsSync(filePath)
  let existingData: StoredBulb[] = []

  if (fileExists) {
    const fileContent = readFileSync(filePath, 'utf-8')
    existingData = JSON.parse(fileContent)
  }

  const settingIndex = existingData.findIndex(item => item.mac === data.mac)

  if (settingIndex !== -1) {
    existingData[settingIndex] = { ...existingData[settingIndex], ...data }
  } else {
    if (!data.mac) data = { ...data, mac: uuidv4(), bulbs: [] }
    existingData.push(data)
  }

  writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8')
  console.log('Setting updated in', filePath)
}

async function handleRemoveStoredBulb (_event: IpcMainInvokeEvent | null, mac: string, filePath: PathLike) {
  const fileExists = existsSync(filePath)
  if (!fileExists) {
    console.log('File does not exist:', filePath)
    return
  }

  const fileContent = readFileSync(filePath, 'utf-8')
  const existingData: StoredBulb[] = JSON.parse(fileContent)

  const settingIndex = existingData.findIndex(item => item.mac === mac)

  if (settingIndex !== -1) {
    existingData.splice(settingIndex, 1)
    writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8')
    console.log('Bulb removed from', filePath)
  } else {
    console.log('No bulb with the given MAC address found.')
  }
}

async function handleAddData (_event: IpcMainInvokeEvent | null, data: Omit<DataItem, 'id'>, filePath: PathLike) {
  const fileExists = existsSync(filePath)
  let existingData: DataItem[] = []

  if (fileExists) {
    const fileContent = readFileSync(filePath, { encoding: 'utf-8' })
    existingData = JSON.parse(fileContent)
  }

  const newData: DataItem = { ...data, id: uuidv4() }
  existingData.push(newData)

  const updatedJsonData = JSON.stringify(existingData, null, 2)

  writeFileSync(filePath, updatedJsonData, { encoding: 'utf-8' })

  console.log('Data added to', filePath)
}

async function handleEditData (_event: IpcMainInvokeEvent | null, id: string, updatedData: Partial<DataItem>, filePath: PathLike) {
  const dataExists = existsSync(filePath)
  if (!dataExists) {
    console.log('File does not exist.')
    return
  }

  const fileContent = readFileSync(filePath, { encoding: 'utf-8' })
  const existingData: DataItem[] = JSON.parse(fileContent)

  const dataIndex = existingData.findIndex(item => item.id === id)
  if (dataIndex === -1) {
    console.log('Data not found.')
    return
  }

  existingData[dataIndex] = { ...existingData[dataIndex], ...updatedData }

  writeFileSync(filePath, JSON.stringify(existingData, null, 2), { encoding: 'utf-8' })

  console.log('Data updated for ID:', id)
}

async function handleRemoveData (_event: IpcMainInvokeEvent | null, id: string, filePath: PathLike) {
  const dataExists = existsSync(filePath)
  if (!dataExists) {
    console.log('File does not exist.')
    return
  }

  const fileContent = readFileSync(filePath, { encoding: 'utf-8' })
  const existingData: DataItem[] = JSON.parse(fileContent)

  const filteredData = existingData.filter(item => item.id !== id)

  writeFileSync(filePath, JSON.stringify(filteredData, null, 2), { encoding: 'utf-8' })

  console.log('Data removed for ID:', id)
}

async function handleGetData (_event: IpcMainInvokeEvent| null, path: PathLike) {
  let data: unknown
  try {
    const fileContent = await promises.readFile(path, 'utf-8')
    data = JSON.parse(fileContent)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await promises.writeFile(path, JSON.stringify(data))
    } else {
      throw error
    }
  }

  return data
}

export {
  handleAddData,
  handleEditData,
  handleRemoveData,
  handleGetData,
  handleAddOrUpdateSetting,
  handleAddOrUpdateStoredBulb,
  handleRemoveStoredBulb
}
