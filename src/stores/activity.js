import { defineStore } from 'pinia'
import { ref } from 'vue'
import { create, getAll, update, remove, restore } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

const SESSION_KEY = 'me_session_v3'
const UNDO_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function deriveAction(msg) {
  const m = (msg || '').toLowerCase()
  if (m.startsWith('added') || m.startsWith('created') || m.startsWith('generated') || m.startsWith('imported')) return 'created'
  if (m.startsWith('updated') || m.startsWith('edited') || m.startsWith('modified')) return 'updated'
  if (m.startsWith('deleted') || m.startsWith('removed')) return 'deleted'
  return 'action'
}

export const useActivityStore = defineStore('activity', () => {
  const activities = ref([])

  /**
   * Log an activity.
   * Accepts two call signatures:
   *  1. log(summaryString, module, detailsObj)           — legacy/simple
   *  2. log({ action, module, tab, summary, details, undoData })  — rich
   */
  async function log(actionOrOpts, module, details = {}, undoData = null) {
    try {
      const session = getSession()
      let entry
      if (actionOrOpts && typeof actionOrOpts === 'object') {
        const o = actionOrOpts
        const snap = o.undoData || undoData
        const hasUndo = !!snap
        entry = {
          action:         o.action  || 'action',
          module:         o.module  || module || '',
          tab:            o.tab     || '',
          summary:        o.summary || '',
          details:        o.details || {},
          user:           session.fullName || session.username || 'System',
          userId:         session.id   || null,
          role:           session.role || null,
          timestamp:      new Date().toISOString(),
          undoable:       hasUndo,
          undoExpiresAt:  hasUndo ? Date.now() + UNDO_TTL_MS : null,
          undoData:       snap || null,
          undone:         false,
        }
      } else {
        const summaryStr = actionOrOpts || ''
        const hasUndo = !!undoData
        entry = {
          action:         deriveAction(summaryStr),
          module:         module || '',
          tab:            details.tab     || '',
          summary:        details.summary || summaryStr,
          details:        (() => { const d = { ...details }; delete d.tab; delete d.summary; return d })(),
          user:           session.fullName || session.username || 'System',
          userId:         session.id   || null,
          role:           session.role || null,
          timestamp:      new Date().toISOString(),
          undoable:       hasUndo,
          undoExpiresAt:  hasUndo ? Date.now() + UNDO_TTL_MS : null,
          undoData:       undoData || null,
          undone:         false,
        }
      }
      await create(Collections.ACTIVITIES, entry)
    } catch { /* non-blocking */ }
  }

  async function load() {
    activities.value = await getAll(Collections.ACTIVITIES)
    activities.value.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
  }

  /**
   * Undo a previously logged action.
   * Requires the activity doc ID and its stored undoData.
   * Returns { success, error }.
   */
  async function executeUndo(activityId, undoData) {
    try {
      const { collection: colName, operation, docId, previousState } = undoData

      if (operation === 'create') {
        // Undo a creation = delete the document that was created
        await remove(colName, docId)
      } else if (operation === 'update' || operation === 'delete') {
        // Undo an edit or restore a deleted document — full replace
        const { id: _id, ...data } = { ...(previousState || {}) }
        await restore(colName, docId, data)
      }

      // Mark this activity entry as undone
      const session = getSession()
      await update(Collections.ACTIVITIES, activityId, {
        undone:    true,
        undoneAt:  new Date().toISOString(),
        undoneBy:  session.fullName || session.username || 'Admin',
      })

      await load()
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message || 'Undo failed' }
    }
  }

  return { activities, log, load, executeUndo }
})
