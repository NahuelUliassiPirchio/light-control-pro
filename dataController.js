const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

async function handleAddOrUpdateSetting (_event, settingId, data, filePath) {
  const fileExists = fs.existsSync(filePath)
  let existingData = []

  if (fileExists) {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    existingData = JSON.parse(fileContent)
  }

  const settingIndex = existingData.findIndex(item => item.id === settingId)

  if (settingIndex !== -1) {
    existingData[settingIndex] = { ...existingData[settingIndex], ...data }
  } else {
    const newData = { ...data, id: settingId }
    existingData.push(newData)
  }

  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8')
  console.log('Setting updated in', filePath)
}

async function handleAddOrUpdateStoredBulb (_event, data, filePath) {
  const fileExists = fs.existsSync(filePath)
  let existingData = []

  if (fileExists) {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    existingData = JSON.parse(fileContent)
  }

  const settingIndex = existingData.findIndex(item => item.mac === data.mac)

  if (settingIndex !== -1) {
    existingData[settingIndex] = { ...existingData[settingIndex], ...data }
  } else {
    if (!data.mac)data = { ...data, mac: uuidv4(), bulbs: [] }
    existingData.push(data)
  }

  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8')
  console.log('Setting updated in', filePath)
}

async function handleRemoveStoredBulb (_event, mac, filePath) {
  const fileExists = fs.existsSync(filePath)
  if (!fileExists) {
    console.log('File does not exist:', filePath)
    return
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const existingData = JSON.parse(fileContent)

  const settingIndex = existingData.findIndex(item => item.mac === mac)

  if (settingIndex !== -1) {
    existingData.splice(settingIndex, 1)
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8')
    console.log('Bulb removed from', filePath)
  } else {
    console.log('No bulb with the given MAC address found.')
  }
}

async function handleAddData (_event, data, filePath) {
  const fileExists = fs.existsSync(filePath)
  let existingData = []

  if (fileExists) {
    const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' })
    existingData = JSON.parse(fileContent)
  }

  const newData = { ...data, id: uuidv4() }
  existingData.push(newData)

  const updatedJsonData = JSON.stringify(existingData, null, 2)

  fs.writeFileSync(filePath, updatedJsonData, { encoding: 'utf-8' })

  console.log('Data added to', filePath)
}

async function handleEditData (_event, id, updatedData, filePath) {
  const dataExists = fs.existsSync(filePath)
  if (!dataExists) {
    console.log('File does not exist.')
    return
  }

  const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' })
  const existingData = JSON.parse(fileContent)

  const dataIndex = existingData.findIndex(item => item.id === id)
  if (dataIndex === -1) {
    console.log('Data not found.')
    return
  }

  existingData[dataIndex] = { ...existingData[dataIndex], ...updatedData }

  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), { encoding: 'utf-8' })

  console.log('Data updated for ID:', id)
}

async function handleRemoveData (_event, id, filePath) {
  const dataExists = fs.existsSync(filePath)
  if (!dataExists) {
    console.log('File does not exist.')
    return
  }

  const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' })
  const existingData = JSON.parse(fileContent)

  const filteredData = existingData.filter(item => item.id !== id)

  fs.writeFileSync(filePath, JSON.stringify(filteredData, null, 2), { encoding: 'utf-8' })

  console.log('Data removed for ID:', id)
}

async function handleGetData (_event, path) {
  const data = fs.readFileSync(path)
  return JSON.parse(data)
}

module.exports = {
  handleAddData,
  handleEditData,
  handleRemoveData,
  handleGetData,
  handleAddOrUpdateSetting,
  handleAddOrUpdateStoredBulb,
  handleRemoveStoredBulb
}
