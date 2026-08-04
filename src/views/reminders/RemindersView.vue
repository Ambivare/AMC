<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Bell :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Reminders
        </h1>
        <p class="page-sub">Stay ahead of AMC renewals, monthly maintenance, and payments.</p>
      </div>
    </div>

    <!-- Sub-tabs -->
    <div class="tabs-nav" style="margin-bottom:24px;flex-wrap:wrap;gap:4px;">
      <button v-for="tab in tabs" :key="tab.key"
        :class="['tab-btn', activeTab === tab.key && 'active']"
        @click="activeTab = tab.key">
        {{ tab.label }}
        <span v-if="tab.count > 0" class="badge" :class="tab.urgentCount > 0 ? 'badge-danger' : 'badge-info'" style="margin-left:4px;">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="text-align:center;padding:60px;color:var(--ct-muted);">
      <div style="font-size:14px;">Loading reminders…</div>
    </div>

    <!-- Empty -->
    <div v-else-if="!currentReminders.length" class="glass empty-state" style="padding:60px;">
      <CheckCircle2 :size="36" style="margin:0 auto 16px;opacity:.3;color:var(--ct-green);" />
      <p>No reminders in this category.</p>
    </div>

    <!-- Reminder cards grid -->
    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">
      <div
        v-for="r in currentReminders"
        :key="r.key"
        class="glass reminder-card"
        :class="{ 'is-navigating': navigatingKey === r.key, 'is-dimmed': navigatingKey && navigatingKey !== r.key }"
        style="padding:18px;border-radius:16px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden;"
        @click="navigate(r)"
      >
        <!-- Urgency accent bar -->
        <div style="position:absolute;left:0;top:0;bottom:0;width:4px;" :style="`background:${urgencyColor(r)};`"></div>

        <!-- Loading overlay -->
        <div v-if="navigatingKey === r.key" class="nav-overlay">
          <Loader2 :size="20" class="spin" style="color:var(--ct-accent);" />
          <span style="font-size:12px;color:var(--ct-muted);margin-left:8px;">Opening…</span>
        </div>

        <div style="padding-left:10px;" :style="navigatingKey === r.key ? 'opacity:.45;pointer-events:none;' : ''">
          <!-- Category + Priority row -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;">
            <span class="badge" :style="`background:${r.categoryColor}22;color:${r.categoryColor};border:1px solid ${r.categoryColor}33;font-size:10px;`">{{ r.categoryLabel }}</span>
            <span :class="['badge', priorityBadge(r.priority)]" style="font-size:10px;">{{ r.priority || 'medium' }}</span>
          </div>
          <!-- Title -->
          <div style="font-weight:600;color:var(--ct-primary);font-size:14px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ r.title }}</div>
          <div v-if="r.subtitle" style="font-size:12px;color:var(--ct-muted);margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ r.subtitle }}</div>
          <!-- Due date -->
          <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
            <Clock :size="12" :style="`color:${urgencyColor(r)};flex-shrink:0;`" />
            <span style="font-size:12px;font-weight:600;" :style="`color:${urgencyColor(r)};`">{{ dueDateLabel(r) }}</span>
          </div>
          <!-- Extra info -->
          <div v-if="r.extra" style="font-size:11px;color:var(--ct-muted);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ r.extra }}</div>
          <!-- Navigate hint -->
          <div style="display:flex;align-items:center;justify-content:flex-end;margin-top:10px;">
            <span style="font-size:11px;color:var(--ct-muted);">Open {{ r.routeLabel }} <ArrowRight :size="10" style="display:inline;vertical-align:-1px;" /></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Bell, Clock, ArrowRight, CheckCircle2, Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useCollection } from '@/composables/useCollection'
import { useTabBackHandler } from '@/composables/useTabBackHandler'
import { useUIStore } from '@/stores/ui'
import { Collections } from '@/firebase/collections'

const router = useRouter()
const ui = useUIStore()

// ── Data sources ─────────────────────────────────────────────────────────────
const { items: amcContracts, loading: amcLoading } = useCollection(Collections.AMC)
const { items: monthlyLogs, loading: logsLoading } = useCollection(Collections.AMC_MONTHLY)
const { items: projects } = useCollection(Collections.PROJECTS)

const loading = computed(() => amcLoading.value || logsLoading.value)

// ── Helpers ───────────────────────────────────────────────────────────────────
function tsToDate(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return ts.toDate()
  if (ts instanceof Date) return ts
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000)
  const d = new Date(ts)
  return isNaN(d.getTime()) ? null : d
}

function toIso(ts) {
  const d = tsToDate(ts)
  return d ? d.toISOString().slice(0, 10) : null
}

function daysFromToday(dateStr) {
  if (!dateStr) return null
  const due = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((due - today) / 86400000)
}

function getProjectName(id) {
  if (!id) return ''
  return projects.value.find(p => p.id === id)?.projectName || ''
}

// ── AMC Installment helper (mirrors AMCView logic) ────────────────────────────
const FREQ_TO_MONTHS = { monthly: 1, 'bi-monthly': 2, quarterly: 3, '4-monthly': 4, 'half-yearly': 6, yearly: 12 }

// Payment Type doubles as the payment schedule's frequency ("Full Payment"
// or the same frequency choices as Service Frequency). Contracts saved
// before that change stored the generic value "installments", with the
// cadence coming from the contract's own Frequency field instead.
function paymentFrequencyOf(contract) {
  if (contract.paymentType === 'installments') return contract.frequency || 'quarterly'
  return contract.paymentType
}
function installmentCountForFrequency(frequency, durationMonths) {
  const dur = durationMonths || 12
  if (frequency === 'every-45-days') return Math.max(1, Math.ceil((dur * 30) / 45))
  const freqMonths = FREQ_TO_MONTHS[frequency] || 3
  return Math.max(1, Math.ceil(dur / freqMonths))
}
function stepDateByFrequency(startDate, frequency, times) {
  const d = new Date(startDate)
  if (frequency === 'every-45-days') {
    d.setDate(d.getDate() + times * 45)
  } else {
    const freqMonths = FREQ_TO_MONTHS[frequency] || 3
    d.setMonth(d.getMonth() + times * freqMonths)
  }
  return d
}

function getNextInstallment(contract) {
  if (contract.paymentType === 'full') return null
  const freq = paymentFrequencyOf(contract)
  const total = contract.totalWithGST || contract.contractValue || 0
  const count = installmentCountForFrequency(freq, contract.durationMonths)
  const amount = Math.round(total / count)
  const startDate = contract.startDate ? new Date(contract.startDate + 'T00:00:00') : null
  const payments = [...(contract.paymentHistory || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const paidCount = payments.filter(p => p.installmentNo != null).length
  const nextIdx = paidCount
  if (nextIdx >= count) return null
  let dueDate = null
  if (startDate) {
    const d = stepDateByFrequency(startDate, freq, nextIdx)
    dueDate = d.toISOString().split('T')[0]
  }
  return { amount, dueDate, installmentNo: nextIdx + 1, total: count }
}

// ── Computed reminders per category ──────────────────────────────────────────

const amcPaymentReminders = computed(() => {
  const out = []
  for (const c of amcContracts.value) {
    if (c.status === 'cancelled' || c.status === 'expired') continue
    if (c.paymentType !== 'full') {
      const next = getNextInstallment(c)
      if (!next) continue
      const days = daysFromToday(next.dueDate)
      if (days === null || days > 30) continue
      out.push({
        key: 'amcpay-' + c.id,
        id: c.id,
        category: 'amc-payment',
        categoryLabel: 'AMC Payment',
        categoryColor: '#6366f1',
        title: c.projectId ? (getProjectName(c.projectId) || c.clientName) : c.clientName,
        subtitle: `${c.contractNumber} · Payment ${next.installmentNo}/${next.total} · ₹${Number(next.amount).toLocaleString('en-IN')}`,
        dueDate: next.dueDate,
        daysUntil: days,
        priority: days < 0 ? 'high' : days <= 3 ? 'high' : 'medium',
        status: c.status,
        extra: `Contract value: ₹${Number(c.totalWithGST || c.contractValue || 0).toLocaleString('en-IN')}`,
        routePath: '/amc',
        routeLabel: 'AMC',
        autoOpen: { collection: 'amc', recordId: c.id, tab: 'contracts' },
        record: c,
      })
    } else {
      // Full payment — show if paidAmount < total
      const total = c.totalWithGST || c.contractValue || 0
      const paid = c.paidAmount || 0
      if (paid >= total) continue
      const renewalDays = daysFromToday(toIso(c.endDate))
      if (renewalDays !== null && renewalDays > 60) continue
      out.push({
        key: 'amcpay-' + c.id,
        id: c.id,
        category: 'amc-payment',
        categoryLabel: 'AMC Payment',
        categoryColor: '#6366f1',
        title: c.projectId ? (getProjectName(c.projectId) || c.clientName) : c.clientName,
        subtitle: `${c.contractNumber} · Full payment pending`,
        dueDate: toIso(c.endDate),
        daysUntil: renewalDays,
        priority: renewalDays !== null && renewalDays <= 7 ? 'high' : 'medium',
        status: c.status,
        extra: `Outstanding: ₹${Number(total - paid).toLocaleString('en-IN')}`,
        routePath: '/amc',
        routeLabel: 'AMC',
        autoOpen: { collection: 'amc', recordId: c.id, tab: 'contracts' },
        record: c,
      })
    }
  }
  return out.sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999))
})

const amcRenewalReminders = computed(() => {
  const out = []
  for (const c of amcContracts.value) {
    if (c.status === 'cancelled') continue
    const days = daysFromToday(toIso(c.endDate))
    if (days === null || days > 60) continue
    out.push({
      key: 'amcren-' + c.id,
      id: c.id,
      category: 'amc-renewal',
      categoryLabel: 'AMC Renewal',
      categoryColor: '#f59e0b',
      title: c.projectId ? (getProjectName(c.projectId) || c.clientName) : c.clientName,
      subtitle: `${c.contractNumber} · ${c.frequency}`,
      dueDate: toIso(c.endDate),
      daysUntil: days,
      priority: days < 0 ? 'high' : days <= 7 ? 'high' : days <= 30 ? 'medium' : 'low',
      status: c.status,
      extra: `Value: ₹${Number(c.totalWithGST || c.contractValue || 0).toLocaleString('en-IN')}`,
      routePath: '/amc',
      routeLabel: 'AMC',
      autoOpen: { collection: 'amc', recordId: c.id, tab: 'renewals' },
      record: c,
    })
  }
  return out.sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999))
})

const monthlyMaintenanceReminders = computed(() => {
  const today = new Date()
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const loggedContractIds = new Set(
    monthlyLogs.value
      .filter(l => {
        const d = tsToDate(l.date || l.createdAt)
        if (!d) return false
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return k === currentMonthKey
      })
      .map(l => l.contractId)
  )

  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const daysLeftInMonth = Math.ceil((endOfMonth - today) / 86400000)

  return amcContracts.value
    .filter(c => c.status === 'active' && !loggedContractIds.has(c.id))
    .map(c => ({
      key: 'amcmnt-' + c.id,
      id: c.id,
      category: 'monthly-maintenance',
      categoryLabel: 'Monthly Maintenance',
      categoryColor: '#10b981',
      title: c.projectId ? (getProjectName(c.projectId) || c.clientName) : c.clientName,
      subtitle: `${c.contractNumber} · ${c.frequency}`,
      dueDate: endOfMonth.toISOString().slice(0, 10),
      daysUntil: daysLeftInMonth,
      priority: daysLeftInMonth <= 3 ? 'high' : daysLeftInMonth <= 10 ? 'medium' : 'low',
      status: 'pending',
      extra: `Technicians: ${(c.technicians || []).join(', ') || '—'}`,
      routePath: '/amc',
      routeLabel: 'AMC',
      autoOpen: { collection: 'amc', recordId: c.id, tab: 'monthly' },
      record: c,
    }))
    .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999))
})

// ── All (high priority + overdue/due soon) ────────────────────────────────────
const allReminders = computed(() => {
  const all = [
    ...amcPaymentReminders.value,
    ...amcRenewalReminders.value,
    ...monthlyMaintenanceReminders.value,
  ]
  return all
    .filter(r => r.priority === 'high' || (r.daysUntil !== null && r.daysUntil <= 7))
    .sort((a, b) => {
      const urgA = a.daysUntil ?? 999
      const urgB = b.daysUntil ?? 999
      return urgA - urgB
    })
})

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref('all')
useTabBackHandler(activeTab, 'all')

const tabs = computed(() => [
  { key: 'all',                label: 'All',                 count: allReminders.value.length,                urgentCount: allReminders.value.filter(r => r.daysUntil !== null && r.daysUntil < 0).length },
  { key: 'amcPayments',        label: 'AMC Payments',        count: amcPaymentReminders.value.length,         urgentCount: amcPaymentReminders.value.filter(r => r.daysUntil !== null && r.daysUntil < 0).length },
  { key: 'amcRenewals',        label: 'AMC Renewals',        count: amcRenewalReminders.value.length,         urgentCount: amcRenewalReminders.value.filter(r => r.daysUntil !== null && r.daysUntil < 0).length },
  { key: 'monthlyMaintenance', label: 'Monthly Maintenance', count: monthlyMaintenanceReminders.value.length, urgentCount: monthlyMaintenanceReminders.value.filter(r => r.daysUntil !== null && r.daysUntil <= 3).length },
])

const currentReminders = computed(() => {
  const map = {
    all: allReminders.value,
    amcPayments: amcPaymentReminders.value,
    amcRenewals: amcRenewalReminders.value,
    monthlyMaintenance: monthlyMaintenanceReminders.value,
  }
  return map[activeTab.value] || []
})

const totalDue = computed(() => allReminders.value.length)

// ── Display helpers ───────────────────────────────────────────────────────────
function urgencyColor(r) {
  const d = r.daysUntil
  if (d === null) return '#64748b'
  if (d < 0) return '#ef4444'
  if (d === 0) return '#f97316'
  if (d <= 3) return '#f59e0b'
  if (d <= 7) return '#eab308'
  return '#64748b'
}

function dueDateLabel(r) {
  const d = r.daysUntil
  if (d === null) return 'No due date'
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''} overdue`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `Due in ${d} days`
}

function priorityBadge(p) {
  const m = { high: 'badge-danger', critical: 'badge-danger', medium: 'badge-warning', low: 'badge-inactive' }
  return m[p] || 'badge-inactive'
}

// ── Navigation ────────────────────────────────────────────────────────────────
const navigatingKey = ref(null)

function navigate(reminder) {
  if (navigatingKey.value) return
  navigatingKey.value = reminder.key
  if (reminder.autoOpen) ui.setPendingAutoOpen(reminder.autoOpen)
  router.push(reminder.routePath).finally(() => {
    navigatingKey.value = null
  })
}
</script>

<style scoped>
.reminder-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.reminder-card.is-navigating {
  cursor: wait;
}
.reminder-card.is-dimmed {
  opacity: 0.5;
  pointer-events: none;
}

.nav-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  background: var(--ct-bg, rgba(255,255,255,0.04));
  border-radius: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 0.8s linear infinite;
}
</style>
