/**
 * Offline-first sync layer using IndexedDB.
 * When the device is offline, create/update/remove operations are queued.
 * When the network comes back online, the queue is automatically flushed to Firestore.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { create, update, remove } from '@/firebase/firestore'

// ── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME = 'me-offline-sync'
const DB_VERSION = 1
const STORE = 'pending_ops'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbEnqueue(op) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).add({ ...op, ts: Date.now() })
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbGetAll() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbDelete(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

async function idbCount() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ── Reactive state (module-level singleton) ──────────────────────────────────
export const isOnline = ref(navigator.onLine)
export const pendingCount = ref(0)
export const isSyncing = ref(false)

async function refreshPendingCount() {
  try { pendingCount.value = await idbCount() } catch {}
}

// ── Flush queue → Firestore ──────────────────────────────────────────────────
export async function flushQueue() {
  if (!navigator.onLine || isSyncing.value) return
  isSyncing.value = true
  try {
    const ops = await idbGetAll()
    for (const op of ops) {
      try {
        if (op.type === 'create') {
          await create(op.collection, op.data)
        } else if (op.type === 'update') {
          await update(op.collection, op.docId, op.data)
        } else if (op.type === 'remove') {
          await remove(op.collection, op.docId)
        }
        await idbDelete(op.id)
      } catch (err) {
        // Leave in queue if Firestore is still unreachable
        console.warn('[OfflineSync] Failed to sync op:', op, err)
      }
    }
  } finally {
    isSyncing.value = false
    await refreshPendingCount()
  }
}

// ── Network event listeners (attached once globally) ────────────────────────
let listenersAttached = false
let flushDebounceTimer = null
function attachListeners() {
  if (listenersAttached) return
  listenersAttached = true
  window.addEventListener('online', () => {
    isOnline.value = true
    clearTimeout(flushDebounceTimer)
    flushDebounceTimer = setTimeout(flushQueue, 300)
  })
  window.addEventListener('offline', () => {
    isOnline.value = false
    clearTimeout(flushDebounceTimer)
  })
}
attachListeners()
refreshPendingCount()

// ── Offline-aware Firestore wrappers ────────────────────────────────────────
/**
 * Like `create()` from firestore.js but queues when offline.
 * Returns a temp local id prefixed with 'offline_' when queued.
 */
export async function oaCreate(colName, data) {
  if (navigator.onLine) {
    return create(colName, data)
  }
  const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await idbEnqueue({ type: 'create', collection: colName, data: { ...data, _tempId: tempId } })
  await refreshPendingCount()
  return tempId
}

/**
 * Like `update()` but queues when offline.
 */
export async function oaUpdate(colName, id, data) {
  if (navigator.onLine) {
    return update(colName, id, data)
  }
  await idbEnqueue({ type: 'update', collection: colName, docId: id, data })
  await refreshPendingCount()
}

/**
 * Like `remove()` but queues when offline.
 */
export async function oaRemove(colName, id) {
  if (navigator.onLine) {
    return remove(colName, id)
  }
  await idbEnqueue({ type: 'remove', collection: colName, docId: id })
  await refreshPendingCount()
}

// ── Vue composable ───────────────────────────────────────────────────────────
/**
 * Use inside components to get reactive online status and pending count.
 */
export function useOfflineSync() {
  onMounted(refreshPendingCount)
  return { isOnline, pendingCount, isSyncing, flushQueue, oaCreate, oaUpdate, oaRemove }
}
