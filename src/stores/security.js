import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

const DELETE_THRESHOLD  = 3
const MAX_FAILED_VERIFY = 3

export const useSecurityStore = defineStore('security', () => {
  const deleteCount        = ref(0)
  const failedVerifyCount  = ref(0)
  const sessionVerified    = ref(false)   // once true → free pass for the whole session
  const requiresVerification = ref(false)
  const suspiciousLocked   = ref(false)
  const actionLog          = ref([])      // context sent in the alert

  // Called before every delete in useCollection
  function trackDelete() {
    if (sessionVerified.value || suspiciousLocked.value) return
    deleteCount.value++
    actionLog.value.push({ type: 'delete', time: new Date().toISOString() })
    if (deleteCount.value >= DELETE_THRESHOLD) {
      requiresVerification.value = true
    }
  }

  // Returns true on success, false on wrong password
  async function verifyPassword(username, password) {
    try {
      const [employees, users] = await Promise.all([
        getAll(Collections.EMPLOYEES),
        getAll(Collections.USERS),
      ])
      const match = (list) => list.find(u =>
        u.username?.toLowerCase() === username?.toLowerCase() &&
        u.password === password &&
        u.role === 'admin' &&
        u.status !== 'inactive'
      )
      if (match(employees) || match(users)) {
        // Verified — unlock session for the rest of the session
        sessionVerified.value    = true
        requiresVerification.value = false
        deleteCount.value        = 0
        failedVerifyCount.value  = 0
        return true
      }

      failedVerifyCount.value++
      actionLog.value.push({ type: 'failed_verify', time: new Date().toISOString(), username })

      if (failedVerifyCount.value >= MAX_FAILED_VERIFY) {
        suspiciousLocked.value     = true
        requiresVerification.value = false
        await sendAlert(username)
      }
      return false
    } catch (e) {
      console.error('[Security] verifyPassword error:', e)
      return false
    }
  }

  async function sendAlert(attemptedUsername) {
    try {
      const alertId = `alert_${Date.now()}`
      await setDoc(doc(db, 'suspiciousActivity', alertId), {
        timestamp:            serverTimestamp(),
        attemptedUsername:    attemptedUsername || 'unknown',
        deleteCount:          deleteCount.value,
        failedVerifyAttempts: failedVerifyCount.value,
        actionLog:            actionLog.value,
        status:               'unresolved',
      })
    } catch (e) {
      console.error('[Security] sendAlert error:', e)
    }
  }

  return {
    deleteCount, failedVerifyCount, sessionVerified,
    requiresVerification, suspiciousLocked,
    trackDelete, verifyPassword, sendAlert,
  }
})
