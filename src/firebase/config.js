import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
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
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const auth    = getAuth(app)
export const storage = getStorage(app)

// Firebase Cloud Messaging VAPID Key
// Get it from: Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates → Generate key pair
// Paste the key pair value below (the long Base64 string starting with "B...")
export const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'

export default app
