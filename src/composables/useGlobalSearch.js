/**
 * Global search composable.
 * Searches across all major collections and returns grouped results.
 * Results are cached for 60s to avoid repeated Firestore reads.
 * Non-admin users only see records assigned to / created by them.
 */
import { ref } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

// ── In-memory cache (shared across all uses) ─────────────────────────────────
const cache = {}
const CACHE_TTL = 60_000 // 60s

async function fetchCached(col) {
  const now = Date.now()
  if (cache[col] && now - cache[col].ts < CACHE_TTL) return cache[col].data
  const data = await getAll(col)
  cache[col] = { data, ts: now }
  return data
}

// ── Search helpers ────────────────────────────────────────────────────────────
function matchAll(query, ...fields) {
  const q = query.toLowerCase()
  return fields.some(f => (f || '').toString().toLowerCase().includes(q))
}

/** Returns true if user should see this record (admin sees all) */
function canSee(record, user) {
  if (!user || user.role === 'admin') return true
  const name = (user.fullName || user.username || '').toLowerCase()
  const uid  = (user.id || '').toLowerCase()
  const fields = [
    record.assignedTo, record.createdBy, record.addedBy,
    record.technician, record.inspector, record.userId,
  ]
  return fields.some(f => f && (
    f.toLowerCase().includes(name) ||
    f.toLowerCase().includes(uid)
  ))
}

// ── Main search function ──────────────────────────────────────────────────────
export async function searchAll(query, user = null) {
  if (!query || query.trim().length < 2) return []
  const q = query.trim()
  const groups = []

  const [projects, amc, quotations, taxInvoices] =
    await Promise.allSettled([
      fetchCached(Collections.PROJECTS),
      fetchCached(Collections.AMC),
      fetchCached(Collections.QUOTATIONS),
      fetchCached(Collections.TAX_INVOICES),
    ]).then(r => r.map(p => p.status === 'fulfilled' ? p.value : []))

  const isAdmin = !user || user.role === 'admin'

  // Projects
  const projResults = projects
    .filter(p => (isAdmin || canSee(p, user)) && matchAll(q, p.projectName, p.clientName, p.city, p.type))
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      title: p.projectName || 'Unnamed Project',
      sub: [p.clientName, p.city, p.type].filter(Boolean).join(' · '),
      route: '/projects',
      icon: 'building',
      badge: p.status,
    }))
  if (projResults.length) groups.push({ group: 'Projects', icon: 'building', color: '#6366f1', items: projResults })

  // AMC
  const amcResults = amc
    .filter(a => (isAdmin || canSee(a, user)) &&
      matchAll(q, a.clientName, a.contractNumber, a.phone, a.location))
    .slice(0, 5)
    .map(a => ({
      id: a.id,
      title: a.clientName || 'Unknown',
      sub: [a.contractNumber, a.status].filter(Boolean).join(' · '),
      route: '/amc',
      icon: 'file',
      badge: a.status,
    }))
  if (amcResults.length) groups.push({ group: 'AMC Contracts', icon: 'file', color: '#06b6d4', items: amcResults })

  // Billing — quotations
  const quoteResults = quotations
    .filter(qt => (isAdmin || canSee(qt, user)) && matchAll(q, qt.clientName, qt.quotationNumber))
    .slice(0, 4)
    .map(qt => ({
      id: qt.id,
      title: qt.clientName || 'Unknown',
      sub: [qt.quotationNumber, qt.status].filter(Boolean).join(' · '),
      route: '/billing',
      icon: 'trending',
      badge: qt.status,
    }))
  if (quoteResults.length) groups.push({ group: 'Quotations', icon: 'trending', color: '#f43f5e', items: quoteResults })

  // Billing — tax invoices
  const invResults = taxInvoices
    .filter(inv => (isAdmin || canSee(inv, user)) && matchAll(q, inv.clientName, inv.invoiceNumber))
    .slice(0, 4)
    .map(inv => ({
      id: inv.id,
      title: inv.clientName || 'Unknown',
      sub: [inv.invoiceNumber, inv.status].filter(Boolean).join(' · '),
      route: '/billing',
      icon: 'check',
      badge: inv.status,
    }))
  if (invResults.length) groups.push({ group: 'Tax Invoices', icon: 'check', color: '#f97316', items: invResults })

  return groups
}

// ── Vue composable ────────────────────────────────────────────────────────────
export function useGlobalSearch() {
  const query    = ref('')
  const results  = ref([])
  const searching = ref(false)
  const open     = ref(false)

  let debounceTimer = null
  let _user = null

  function setUser(user) { _user = user }

  async function onQueryChange(val) {
    clearTimeout(debounceTimer)
    if (!val || val.trim().length < 2) {
      results.value = []
      open.value = false
      return
    }
    debounceTimer = setTimeout(async () => {
      searching.value = true
      try {
        results.value = await searchAll(val.trim(), _user)
        open.value = results.value.length > 0
      } catch (e) {
        console.error('[GlobalSearch]', e)
        results.value = []
      } finally {
        searching.value = false
      }
    }, 280)
  }

  function clear() {
    query.value = ''
    results.value = []
    open.value = false
    clearTimeout(debounceTimer)
  }

  return { query, results, searching, open, onQueryChange, clear, setUser }
}
