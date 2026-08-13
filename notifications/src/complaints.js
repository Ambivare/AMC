// Real-time complaint notifications. A VPS worker has no Cloud Functions
// triggers, so this uses a long-lived Firestore listener (onSnapshot) — the
// admin SDK auto-reconnects on network blips, same as the client SDK does.
import { db } from './firebase.js'
import { send, tokensByRole, tokensByUserNames } from './fcm.js'

const RESOLVED_STATUSES = ['resolved', 'closed']

// Tracks the last-seen { status, assignedTechnicians } per complaint so we
// can tell what actually changed on a 'modified' event — Firestore only
// hands us the new document, not a diff.
const prevState = new Map()

async function notifyNewComplaint(id, c) {
  const assigned = c.assignedTechnicians?.length ? c.assignedTechnicians : (c.assignedTo ? [c.assignedTo] : [])
  const priority = c.priority || 'normal'
  const body = `${c.clientName || 'Client'} — ${c.issueType || 'Issue'} (${priority} priority)`

  if (assigned.length) {
    const [techTokens, adminTokens] = await Promise.all([
      tokensByUserNames(assigned),
      tokensByRole('admin'),
    ])
    await send([...techTokens, ...adminTokens],
      { title: '🚨 New Complaint Assigned', body },
      { type: 'complaint_assigned', docId: id, channel: 'sk_alerts' }
    )
  } else {
    // Not assigned yet — alert admin + every technician so someone picks it up.
    const tokens = await tokensByRole('admin', 'technician')
    await send(tokens,
      { title: '🚨 New Complaint', body },
      { type: 'new_complaint', docId: id, channel: 'sk_alerts' }
    )
  }
  console.log(`[complaints] new complaint ${id} → notified ${assigned.length ? assigned.join(', ') : 'admin + all technicians'}`)
}

async function notifyAssignmentChange(id, after, before) {
  const beforeSet = new Set(before.assignedTechnicians || [])
  const newlyAssigned = (after.assignedTechnicians || []).filter(n => !beforeSet.has(n))
  if (!newlyAssigned.length) return
  const tokens = await tokensByUserNames(newlyAssigned)
  await send(tokens,
    { title: 'Complaint Assigned to You', body: `${after.clientName || 'Client'} — ${after.issueType || 'Issue'}. Please attend promptly.` },
    { type: 'complaint_assigned', docId: id, channel: 'sk_alerts' }
  )
  console.log(`[complaints] ${id} assigned → notified ${newlyAssigned.join(', ')}`)
}

async function notifyResolution(id, after, before) {
  const wasResolved = RESOLVED_STATUSES.includes(before.status)
  const isResolved = RESOLVED_STATUSES.includes(after.status)
  if (wasResolved || !isResolved) return
  const tokens = await tokensByRole('admin')
  const by = (after.assignedTechnicians || []).join(', ') || after.completedBy || 'team'
  await send(tokens,
    { title: 'Complaint Resolved ✓', body: `${after.clientName || 'Client'} complaint resolved by ${by}.` },
    { type: 'complaint_resolved', docId: id, channel: 'sk_updates' }
  )
  console.log(`[complaints] ${id} resolved → notified admin`)
}

export function startComplaintListener() {
  let initialized = false

  const unsubscribe = db.collection('complaintActivities').onSnapshot(async (snapshot) => {
    const changes = snapshot.docChanges()

    if (!initialized) {
      // The first callback reports the ENTIRE existing collection as
      // 'added' — seed the cache silently instead of notifying for every
      // complaint that already existed before this process started.
      changes.forEach(change => {
        const data = change.doc.data()
        prevState.set(change.doc.id, {
          status: data.status,
          assignedTechnicians: [...(data.assignedTechnicians || [])],
        })
      })
      initialized = true
      console.log(`[complaints] listener ready — tracking ${changes.length} existing complaint(s)`)
      return
    }

    for (const change of changes) {
      const id = change.doc.id
      if (change.type === 'removed') {
        prevState.delete(id)
        continue
      }

      const data = change.doc.data()
      const before = prevState.get(id)

      try {
        if (change.type === 'added') {
          await notifyNewComplaint(id, data)
        } else if (change.type === 'modified' && before) {
          await notifyAssignmentChange(id, data, before)
          await notifyResolution(id, data, before)
        }
      } catch (e) {
        console.error(`[complaints] notification failed for ${id}:`, e.message)
      }

      prevState.set(id, {
        status: data.status,
        assignedTechnicians: [...(data.assignedTechnicians || [])],
      })
    }
  }, (err) => {
    console.error('[complaints] listener error:', err.message)
  })

  return unsubscribe
}
