import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from './config'

// Backup sync is currently disabled.
// To re-enable: import { backupDb, backupCollectionName } from './backup-firebase'
// and uncomment the syncToBackup calls below.

// ─────────────────────────────────────────────────────────────────────────────
// Generic CRUD helpers (main Firestore)
// ─────────────────────────────────────────────────────────────────────────────

export const getAll = async (colName, constraints = []) => {
  const q = constraints.length
    ? query(collection(db, colName), ...constraints)
    : collection(db, colName)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getOne = async (colName, id) => {
  const snap = await getDoc(doc(db, colName, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const create = async (colName, data) => {
  const ref = await addDoc(collection(db, colName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export const update = async (colName, id, data) => {
  await updateDoc(doc(db, colName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export const remove = async (colName, id) => {
  await deleteDoc(doc(db, colName, id))
}

// Restore a document at a specific ID (used for undo — replaces entire document)
export const restore = async (colName, id, data) => {
  const { id: _id, ...cleanData } = { ...data }
  await setDoc(doc(db, colName, id), cleanData)
}

export const subscribe = (colName, callback, constraints = []) => {
  const q = constraints.length
    ? query(collection(db, colName), ...constraints)
    : collection(db, colName)
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, err => {
    console.error('[Firestore] onSnapshot error:', err)
  })
}

export { where, orderBy, Timestamp, serverTimestamp }
