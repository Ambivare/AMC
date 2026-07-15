import { create } from '@/firebase/firestore'

/**
 * Log a timeline entry to a module-specific collection.
 * @param {string} collection - Firestore collection name (e.g. Collections.REPAIRS)
 * @param {string} recordId   - ID of the parent record
 * @param {string} type       - Event type: 'created'|'updated'|'status_change'|'note'|'assigned'|'completed'
 * @param {string} message    - Human-readable description
 * @param {object} meta       - Optional extra data
 */
export async function logTimeline(collection, recordId, type, message, meta = {}) {
  try {
    const sessionRaw = localStorage.getItem('me_session_v2')
    const session = sessionRaw ? JSON.parse(sessionRaw) : {}
    await create(collection, {
      recordId,
      type,
      message,
      meta,
      user: session.fullName || session.username || 'System',
      userId: session.id || null,
      timestamp: new Date().toISOString(),
    })
  } catch { /* non-blocking */ }
}
