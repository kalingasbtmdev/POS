import initSqlJs from 'sql.js'

const DB_NAME = 'sqldelight-db'
const STORE_NAME = 'files'

async function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadFromStorage() {
  const db = await openStore()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(0)
    getReq.onsuccess = () => resolve(getReq.result ? new Uint8Array(getReq.result) : null)
    getReq.onerror = () => resolve(null)
  })
}

async function saveToStorage(data) {
  const db = await openStore()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const putReq = store.put(data, 0)
    putReq.onsuccess = () => resolve()
    putReq.onerror = () => reject(putReq.error)
  })
}

let db = null
async function createDatabase() {
  let SQL = await initSqlJs({ locateFile: file => 'sql-wasm.wasm' })
  const existing = await loadFromStorage()
  db = existing ? new SQL.Database(existing) : new SQL.Database()
}

async function persist() {
  if (db) {
    await saveToStorage(db.export())
  }
}

function onModuleReady() {
  const data = this.data
  switch (data && data.action) {
    case 'exec':
      if (!data['sql']) {
        throw new Error('exec: Missing query string')
      }
      const result = db.exec(data.sql, data.params)[0] ?? { values: [] }
      persist()
      return postMessage({ id: data.id, results: result })
    case 'begin_transaction':
      return postMessage({ id: data.id, results: db.exec('BEGIN TRANSACTION;') })
    case 'end_transaction':
      const endRes = db.exec('END TRANSACTION;')
      persist()
      return postMessage({ id: data.id, results: endRes })
    case 'rollback_transaction':
      const rollRes = db.exec('ROLLBACK TRANSACTION;')
      persist()
      return postMessage({ id: data.id, results: rollRes })
    default:
      throw new Error(`Unsupported action: ${data && data.action}`)
  }
}

function onError(err) {
  return postMessage({ id: this.data.id, error: err })
}

if (typeof importScripts === 'function') {
  db = null
  const sqlModuleReady = createDatabase()
  self.onmessage = (event) => {
    return sqlModuleReady
      .then(onModuleReady.bind(event))
      .catch(onError.bind(event))
  }
}
