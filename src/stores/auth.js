import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { initFCM, removeFCMToken } from '@/firebase/fcm'
import { auth as firebaseAuth } from '@/firebase/config'
import { signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth'

const SESSION_KEY = 'me_session_v3'

// Role definitions — Admin (full access) and Technician (field service only)
export const ROLES = {
  admin: {
    label: 'Admin',
    tabs: ['dashboard', 'reminders', 'maintenance', 'amc', 'billing', 'projects', 'hr', 'configurations'],
    canDelete: true,
    canCreateTasks: true,
    canCreateService: true,
  },
  technician: {
    label: 'Technician',
    // Technicians only need the AMC tab's Monthly Maintenance section to log
    // visits — every other page (including the separate Maintenance tab) is
    // out of scope for this role.
    tabs: ['amc'],
    canDelete: false,
    canCreateTasks: false,
    canCreateService: false,
  },
}

export const useAuthStore = defineStore('auth', () => {
  const user    = ref(null)
  const loading = ref(false)
  const error   = ref('')

  const isLoggedIn  = computed(() => !!user.value)
  const role        = computed(() => user.value?.role || null)
  const permissions = computed(() => ROLES[role.value] || ROLES.technician)
  const canAccess   = (tab) => permissions.value.tabs?.includes(tab)
  const can         = (perm) => !!permissions.value[perm]
  // The router falls back here whenever the current/requested route isn't in
  // this role's tab list — must never point at a tab the role can't reach,
  // or a restricted role (e.g. technician, limited to just "amc") would
  // bounce in an infinite redirect loop against a hardcoded "/dashboard".
  const homePath    = computed(() => '/' + (permissions.value.tabs?.[0] || 'login'))

  function saveSession(u) {
    user.value = u
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
  }

  function clearSession() {
    user.value = null
    localStorage.removeItem(SESSION_KEY)
  }

  async function ensureFirebaseAuth() {
    if (!firebaseAuth.currentUser) {
      await signInAnonymously(firebaseAuth)
    }
  }

  async function login(username, password) {
    loading.value = true
    error.value = ''
    await new Promise(r => setTimeout(r, 0))
    try {
      try {
        await ensureFirebaseAuth()
      } catch {
        error.value = 'Auth service unavailable. Enable Anonymous Authentication in Firebase Console.'
        return { success: false }
      }

      // Check employees first (all staff, including admins)
      const employees = await getAll(Collections.EMPLOYEES)
      const emp = employees.find(e =>
        e.username?.toLowerCase() === username.trim().toLowerCase() &&
        e.password === password &&
        e.status !== 'inactive'
      )
      if (emp) {
        const { password: _, ...safe } = emp
        const session = { ...safe, role: safe.role || 'technician' }
        saveSession(session)
        initFCM(session.id, session.role, session.fullName || session.username).catch(e => console.warn('[FCM]', e))
        return { success: true }
      }

      // Fallback: legacy users collection
      const users = await getAll(Collections.USERS)
      const found = users.find(u =>
        u.username?.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password &&
        u.status !== 'inactive'
      )
      if (found) {
        const { password: _, ...safe } = found
        const session = { ...safe, role: safe.role || 'technician' }
        saveSession(session)
        initFCM(session.id, session.role, session.fullName || session.username).catch(e => console.warn('[FCM]', e))
        return { success: true }
      }

      error.value = 'Invalid credentials or account inactive.'
      return { success: false }
    } catch (e) {
      error.value = e?.code === 'permission-denied' || e?.message?.includes('permission')
        ? 'Permission denied. Check Firestore rules are published correctly.'
        : 'Login failed. Please try again.'
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) {
        user.value = JSON.parse(raw)
        ensureFirebaseAuth().catch(() => {})
        const u = user.value
        if (u?.id) {
          initFCM(u.id, u.role, u.fullName || u.username).catch(e => console.warn('[FCM]', e))
        }
      }
    } catch { /* ignore */ }
  }

  function logout() {
    const uid = user.value?.id
    clearSession()
    if (uid) removeFCMToken(uid).catch(() => {})
    firebaseSignOut(firebaseAuth).catch(() => {})
  }

  return {
    user, loading, error, isLoggedIn, role, permissions, canAccess, can, homePath,
    loadSession, login, logout,
  }
})
