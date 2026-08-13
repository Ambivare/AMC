// Initializes firebase-admin once for the whole process. Works the same way
// Firebase Cloud Functions would, except we supply our own credentials
// (a service account key) since we're not running inside GCP.
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

function loadServiceAccount() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (inlineJson && inlineJson.trim()) {
    return JSON.parse(inlineJson)
  }
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json'
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(
      `Could not load Firebase service account from "${path}". ` +
      `Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in .env — see setup.md. (${e.message})`
    )
  }
}

const serviceAccount = loadServiceAccount()

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
})

export const db = getFirestore(app)
export const messaging = getMessaging(app)
