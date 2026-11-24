import { ref, computed } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

export function localToday() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in device timezone
}

const SERVICES = [
  { key: 'amc',    label: 'AMC',          col: Collections.AMC,              doc: r => r.contractNumber, },
  { key: 'bill',   label: 'Bill Invoice', col: Collections.PROFORMA_INVOICES, doc: r => r.docNumber },
  { key: 'tax',    label: 'Tax Invoice',  col: Collections.TAX_INVOICES,      doc: r => r.docNumber },
]

export function useTodayWork() {
  const loading = ref(false)
  const paymentGroups = ref([])
  const visits = ref([])

  async function load() {
    loading.value = true
    const today = localToday()
    try {
      const safe = (c) => getAll(c).catch(() => [])
      const [amc, bill, tax, maint, monthly] = await Promise.all([
        safe(Collections.AMC), safe(Collections.PROFORMA_INVOICES), safe(Collections.TAX_INVOICES),
        safe(Collections.MAINTENANCE), safe(Collections.AMC_MONTHLY),
      ])
      const byKey = { amc, bill, tax }
      paymentGroups.value = SERVICES.map(s => {
        const entries = []
        for (const r of byKey[s.key]) {
          for (const p of (r.paymentHistory || [])) {
            if ((p.date || '').slice(0, 10) === today) {
              entries.push({ ref: s.doc(r) || '', client: r.clientName || r.projectName || '', amount: Number(p.amount) || 0, mode: p.mode || p.method || '' })
            }
          }
        }
        return { key: s.key, label: s.label, entries, total: entries.reduce((a, e) => a + e.amount, 0) }
      })
      const v = []
      for (const m of maint) {
        if ((m.scheduledDate || '').slice(0, 10) === today) {
          v.push({ site: m.clientName || m.siteName || '', work: m.maintenanceType || m.workPerformed || 'Maintenance', tech: m.technicianName || '', status: m.status || 'scheduled' })
        }
      }
      for (const m of monthly) {
        if (((m.scheduledDate || m.date) || '').slice(0, 10) === today) {
          v.push({ site: m.clientName || m.siteName || '', work: m.workPerformed || m.notes || 'AMC monthly visit', tech: m.technicianName || '', status: m.status || 'scheduled' })
        }
      }
      visits.value = v
    } finally { loading.value = false }
  }

  const grandTotal = computed(() => paymentGroups.value.reduce((a, g) => a + g.total, 0))
  return { loading, paymentGroups, visits, grandTotal, load }
}
