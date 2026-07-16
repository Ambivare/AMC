import { ref, onUnmounted } from 'vue'
import { subscribe, getAll, create, update, remove, getOne } from '@/firebase/firestore'
import { useActivityStore } from '@/stores/activity'
import { useUIStore } from '@/stores/ui'
import { useSecurityStore } from '@/stores/security'
import { useAuthStore } from '@/stores/auth'
import { notifyWorker } from '@/utils/notifyWorker'

// Maps { collection: { logInfo.action: workerNotifyType } } — see /workers/src/notify.js
const NOTIFY_TYPES = {
  amc:              { created: 'amc_created' },
  maintenance:      { created: 'maintenance_created' },
  quotations:       { created: 'quotation_created' },
  proformaInvoices: { created: 'proforma_created' },
  taxInvoices:      { created: 'tax_invoice_created' },
  purchaseOrders:   { created: 'po_created' },
  projects:         { created: 'project_created' },
}

export function useCollection(colName, { autoLoad = true, orderByField = null } = {}) {
  const items = ref([])
  const loading = ref(false)
  const activity = useActivityStore()
  const ui = useUIStore()
  let unsub = null
  let loadVersion = 0

  async function load() {
    const version = ++loadVersion
    loading.value = true
    try {
      const data = await getAll(colName)
      if (version !== loadVersion) return
      items.value = data
      if (orderByField) {
        items.value.sort((a, b) => (b[orderByField] || '').localeCompare(a[orderByField] || ''))
      }
    } finally {
      if (version === loadVersion) loading.value = false
    }
  }

  function listenLive() {
    if (unsub) { unsub(); unsub = null }
    loading.value = true
    unsub = subscribe(colName, (data) => {
      items.value = data
      if (orderByField) {
        items.value.sort((a, b) => (b[orderByField] || '').localeCompare(a[orderByField] || ''))
      }
      loading.value = false
    })
  }

  function _doLog(logInfo, id, undoData = null) {
    if (!logInfo) return
    if (typeof logInfo === 'string') {
      activity.log(logInfo, colName, { id }, undoData)
    } else {
      activity.log({ ...logInfo, details: { id, ...(logInfo.details || {}) }, undoData })
    }
  }

  async function add(data, logInfo = null) {
    const id = await create(colName, data)
    // Create undo data for any logged add (undo = delete the created doc)
    const undoData = logInfo
      ? { collection: colName, operation: 'create', docId: id, previousState: null }
      : null
    _doLog(logInfo, id, undoData)
    const notifyType = logInfo && NOTIFY_TYPES[colName]?.[logInfo.action]
    if (notifyType) notifyWorker(notifyType, { ...data, id })
    await load()
    return id
  }

  async function edit(id, data, logInfo = null) {
    let undoData = null
    if (logInfo) {
      try {
        const prev = await getOne(colName, id)
        if (prev) {
          const { id: _id, ...prevData } = prev
          undoData = { collection: colName, operation: 'update', docId: id, previousState: prevData }
        }
      } catch { /* undo unavailable for this op */ }
    }
    await update(colName, id, data)
    _doLog(logInfo, id, undoData)
    await load()
  }

  async function del(id, logInfo = null) {
    const auth     = useAuthStore()
    const security = useSecurityStore()

    if (auth.role === 'admin') {
      if (security.suspiciousLocked) {
        ui.error('Session locked due to suspicious activity.')
        return
      }
      if (!security.sessionVerified) {
        security.trackDelete()
        if (security.requiresVerification) {
          ui.warning('Please verify your admin password to continue.')
          return
        }
      }
    }

    let undoData = null
    if (logInfo) {
      try {
        const prev = await getOne(colName, id)
        if (prev) {
          const { id: _id, ...prevData } = prev
          undoData = { collection: colName, operation: 'delete', docId: id, previousState: prevData }
        }
      } catch { /* undo unavailable */ }
    }
    await remove(colName, id)
    _doLog(logInfo, id, undoData)
    await load()
  }

  if (autoLoad) load()

  onUnmounted(() => { if (unsub) unsub() })

  return { items, loading, load, add, edit, del }
}
