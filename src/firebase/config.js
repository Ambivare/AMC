import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

// ── Firebase Configuration (avantelevators-dff70) ────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAvcfIgVWTB8c_s1-mP2w5jCHzEvvqaxIs',
  authDomain:        'avantelevators-dff70.firebaseapp.com',
  projectId:         'avantelevators-dff70',
  storageBucket:     'avantelevators-dff70.firebasestorage.app',
  messagingSenderId: '29570477853',
  appId:             '1:29570477853:web:0ec91c39c6fa19ad50bbf4',
  measurementId:     'G-NFJEYX8Z3Z',
}

const app = initializeApp(firebaseConfig)

export const db      = initializeFirestore(app, {
  // persistentMultipleTabManager() negotiates a "primary tab" lease across
  // browser tabs via IndexedDB/BroadcastChannel — a single Capacitor WebView
  // is never a real multi-tab environment, and that lease negotiation can
  // hang forever there, which is why every page depending on Firestore reads
  // got stuck loading permanently. Single-tab manager avoids that entirely.
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
  // Android WebView and some restrictive networks can't sustain the default
  // streaming connection either — Firestore hangs retrying it forever instead
  // of failing fast. Auto-detecting long-polling makes it fall back reliably.
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
})
export const auth    = getAuth(app)
export const storage = getStorage(app)

// Firebase Cloud Messaging VAPID Key
// Get it from: Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates → Generate key pair
// Paste the key pair value below (the long Base64 string starting with "B...")
export const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'

export default app
