// Token lookups + FCM sending — mirrors the logic the app's frontend already
// relies on (src/firebase/fcm.js writes fcmTokens/{userId} docs shaped like
// { token, userId, platform, role, userName, updatedAt }).
import { db, messaging } from './firebase.js'

/** All FCM tokens for users with any of the given roles (e.g. 'admin', 'technician'). */
export async function tokensByRole(...roles) {
  const snap = await db.collection('fcmTokens').get()
  return snap.docs
    .filter(d => roles.includes(d.data().role))
    .map(d => d.data().token)
    .filter(Boolean)
}

/** FCM token for a specific Firestore userId (employees/{id} doc id). */
export async function tokenByUserId(userId) {
  if (!userId) return null
  try {
    const snap = await db.collection('fcmTokens').doc(userId).get()
    return snap.exists ? snap.data().token || null : null
  } catch {
    return null
  }
}

/** All FCM tokens for a given display name (matches the userName field). */
export async function tokensByUserName(userName) {
  if (!userName) return []
  const snap = await db.collection('fcmTokens').where('userName', '==', userName).get()
  return snap.docs.map(d => d.data().token).filter(Boolean)
}

/** All FCM tokens for any of the given display names (e.g. assignedTechnicians). */
export async function tokensByUserNames(names = []) {
  const unique = [...new Set(names.filter(Boolean))]
  if (!unique.length) return []
  const results = await Promise.all(unique.map(n => tokensByUserName(n)))
  return results.flat()
}

/**
 * Send an FCM multicast push. Deduplicates tokens and batches at 500 (FCM's
 * per-call limit). `data.channel` must be one of the Android channel ids
 * already created by the app's frontend (src/firebase/fcm.js): sk_alerts,
 * sk_reminders, sk_updates, sk_general.
 */
export async function send(tokens, notification, data = {}) {
  const clean = [...new Set((tokens || []).filter(Boolean))]
  if (!clean.length) return { sent: 0 }

  const strData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v ?? '')])
  )

  let sent = 0
  for (let i = 0; i < clean.length; i += 500) {
    const batch = clean.slice(i, i + 500)
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification,
        data: strData,
        android: {
          priority: 'high',
          notification: { channelId: strData.channel || 'sk_general', sound: 'default' },
        },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      })
      sent += res.successCount
      if (res.failureCount) {
        res.responses.forEach((r, idx) => {
          if (!r.success) console.warn('[FCM] send failed for token', batch[idx].slice(0, 12) + '…', r.error?.message)
        })
      }
    } catch (e) {
      console.error('[FCM] sendEachForMulticast error:', e.message)
    }
  }
  return { sent }
}

/** Shorthand: send to a role + optionally an extra name-based token list (dedup'd). */
export async function sendToRoleAndUser(roles, extraNames, notification, data) {
  const [roleTokens, nameTokens] = await Promise.all([
    tokensByRole(...roles),
    tokensByUserNames(extraNames),
  ])
  return send([...roleTokens, ...nameTokens], notification, data)
}
