/**
 * FCM (Firebase Cloud Messaging) service.
 *
 * Works in two modes:
 *  - Native (Android APK via Capacitor): uses @capacitor/push-notifications
 *  - Web browser: uses firebase/messaging with a background service worker
 *
 * Call initFCM(userId, role, userName) after login.
 * Call removeFCMToken(userId) on logout.
 *
 * Tokens are stored per-user in Firestore `fcmTokens/{userId}`.
 * Cloud Functions read this collection to send targeted notifications.
 *
 * Android notification channels:
 *  - sk_alerts     : urgent issues (billing overdue) — high importance
 *  - sk_reminders  : scheduled reminders (AMC expiry, monthly maintenance, payment due dates)
 *  - sk_updates    : status changes, completions, approvals
 *  - sk_general    : routine check-ins, new records
 */

import { doc, setDoc, deleteDoc, getDocs, query, collection, where, serverTimestamp } from 'firebase/firestore'
import { db, VAPID_KEY } from './config'

// Guard so listeners are only registered once per app session (prevents duplicate toasts)
let _nativeListenersAdded = false

// ── Notification channel definitions ─────────────────────────────────────────

const CHANNELS = [
  {
    id: 'sk_alerts',
    name: 'Alerts',
    description: 'Overdue payments and urgent issues',
    importance: 5,
    sound: 'default',
    vibration: true,
    lightColor: '#0a2540',
  },
  {
    id: 'sk_reminders',
    name: 'Reminders',
    description: 'AMC renewals, monthly maintenance, payment due dates',
    importance: 4,
    sound: 'default',
    vibration: true,
    lightColor: '#0a2540',
  },
  {
    id: 'sk_updates',
    name: 'Updates',
    description: 'Status changes, completions, approvals',
    importance: 3,
    sound: 'default',
    vibration: false,
    lightColor: '#0a2540',
  },
  {
    id: 'sk_general',
    name: 'General',
    description: 'Check-ins, new records',
    importance: 2,
    sound: 'default',
    vibration: false,
    lightColor: '#0a2540',
  },
]

// ── Token persistence ─────────────────────────────────────────────────────────

async function saveToken(userId, token, platform, role = 'user', userName = '') {
  try {
    // Remove the same push token from any OTHER user's doc so one device = one user at a time
    try {
      const stale = await getDocs(query(collection(db, 'fcmTokens'), where('token', '==', token)))
      for (const d of stale.docs) {
        if (d.id !== userId) await deleteDoc(d.ref)
      }
    } catch { /* ignore dedup errors — don't block token save */ }

    await setDoc(doc(db, 'fcmTokens', userId), {
      token,
      userId,
      platform,
      role,
      userName,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  } catch (e) {
    console.warn('[FCM] saveToken failed:', e)
  }
}

// ── Route tap action to the correct app view ─────────────────────────────────

function handleNotificationTap(data) {
  if (!data?.type) return
  const routes = {
    amc_created:             '/amc',
    amc_payment:             '/amc',
    amc_expiry:              '/amc',
    amc_installment_due:     '/amc',
    maintenance_due:         '/maintenance',
    job_scheduled:           '/maintenance',
    quotation_created:       '/billing',
    invoice_created:         '/billing',
    invoice_overdue:         '/billing',
    po_created:              '/billing',
    project_created:         '/projects',
  }
  const path = routes[data.type]
  if (path && window.__vueRouter) {
    window.__vueRouter.push(path).catch(() => {})
  }
}

// ── Native (Capacitor Android) ────────────────────────────────────────────────

async function createAndroidChannels() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    for (const ch of CHANNELS) {
      await PushNotifications.createChannel(ch).catch(() => {})
    }
  } catch { /* ignore on web */ }
}

async function initNativeFCM(userId, role, userName) {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    await createAndroidChannels()

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return null

    // Remove all listeners before re-adding to prevent duplicate toasts across
    // multiple initFCM calls (loadSession + login, or user switching)
    if (_nativeListenersAdded) {
      await PushNotifications.removeAllListeners().catch(() => {})
    }
    _nativeListenersAdded = true

    await PushNotifications.register()

    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 12000)

      PushNotifications.addListener('registration', async ({ value: token }) => {
        clearTimeout(timer)
        await saveToken(userId, token, 'android', role, userName)
        resolve(token)
      })

      PushNotifications.addListener('registrationError', () => {
        clearTimeout(timer)
        resolve(null)
      })

      // Foreground notification — show an in-app toast using the UI store
      PushNotifications.addListener('pushNotificationReceived', (n) => {
        try {
          const title = n.title || n.notification?.title || ''
          const body  = n.body  || n.notification?.body  || ''
          if (title || body) {
            const store = window.__uiStore
            if (store?.info) store.info(`${title}${body ? ' — ' + body : ''}`)
          }
        } catch { /* ignore */ }
      })

      // Tap on notification — navigate to relevant screen
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification?.data || {}
        handleNotificationTap(data)
      })
    })
  } catch (e) {
    console.warn('[FCM] Native init failed:', e)
    return null
  }
}

// ── Web browser ───────────────────────────────────────────────────────────────

async function initWebFCM(userId, role, userName) {
  if (!('Notification' in window)) return null
  if (Notification.permission === 'denied') return null

  const vapidKey = VAPID_KEY
  if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
    console.warn('[FCM] VAPID_KEY not set — web push disabled.')
    return null
  }

  try {
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging')
    const { default: app } = await import('./config')

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey })
    if (!token) return null

    await saveToken(userId, token, 'web', role, userName)

    onMessage(messaging, (payload) => {
      const { title = '', body = '' } = payload.notification || {}
      // In-app toast
      try {
        const store = window.__uiStore
        if (store?.info) store.info(`${title}${body ? ' — ' + body : ''}`)
      } catch { /* ignore */ }
      // Also show OS notification if page is visible
      if (title && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.png',
          tag: payload.data?.type || 'tab-elevators',
          data: payload.data,
        })
      }
    })

    return token
  } catch (e) {
    console.warn('[FCM] Web init failed:', e)
    return null
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise FCM for the logged-in user.
 * Also registers the UI store and router on window so notification handlers
 * can show toasts and navigate without circular imports.
 */
export async function initFCM(userId, role, userName) {
  if (!userId) return null
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      return await initNativeFCM(userId, role, userName)
    }
  } catch {
    // @capacitor/core not available — pure web
  }
  return initWebFCM(userId, role, userName)
}

/** Call once after creating the Vue app so notification taps can navigate. */
export function registerFCMRouter(router) {
  window.__vueRouter = router
}

/** Call once after creating the UI store so foreground notifications show toasts. */
export function registerFCMUIStore(uiStore) {
  window.__uiStore = uiStore
}

/** Remove FCM token from Firestore on logout. */
export async function removeFCMToken(userId) {
  if (!userId) return
  try {
    await deleteDoc(doc(db, 'fcmTokens', userId))
  } catch { /* ignore */ }
}
