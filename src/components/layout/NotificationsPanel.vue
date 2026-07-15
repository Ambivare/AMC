<template>
  <!-- Backdrop -->
  <Transition name="backdrop">
    <div v-if="modelValue" class="notif-backdrop" @click="$emit('update:modelValue', false)" />
  </Transition>

  <!-- Slide-in Panel -->
  <Transition name="notif-slide">
    <div v-if="modelValue" class="notif-panel">
      <!-- Header -->
      <div class="notif-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;background:rgba(99,102,241,0.12);border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <Bell :size="16" style="color:var(--ct-accent);" />
          </div>
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--ct-primary);">Notifications</div>
            <div style="font-size:11px;color:var(--ct-muted);">{{ totalCount }} active alerts</div>
          </div>
        </div>
        <button class="notif-close" @click="$emit('update:modelValue', false)">
          <X :size="16" />
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" style="padding:48px;text-align:center;color:var(--ct-muted);">
        <Loader2 :size="24" style="animation:spin 1s linear infinite;margin:0 auto 10px;display:block;" />
        <p style="font-size:13px;">Loading notifications…</p>
      </div>

      <!-- Content -->
      <div v-else class="notif-scroll">

        <!-- AMC Renewals -->
        <div v-if="renewals.length" class="notif-section">
          <div class="notif-section-title">
            <RefreshCw :size="13" style="color:#fbbf24;" /> AMC Renewals
            <span class="notif-count warning">{{ renewals.length }}</span>
          </div>
          <div v-for="item in renewals" :key="item.id" class="notif-item warning" @click="navigate('amc')">
            <div class="notif-icon warning"><RefreshCw :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.clientName }}</div>
              <div class="notif-sub">Contract {{ item.contractNumber }} · expires in <strong>{{ item.daysLeft }}d</strong></div>
            </div>
            <div class="notif-badge warning">{{ item.daysLeft }}d</div>
          </div>
        </div>

        <!-- Monthly maintenance due -->
        <div v-if="maintenanceDue.length" class="notif-section">
          <div class="notif-section-title">
            <ClipboardList :size="13" style="color:#93c5fd;" /> Maintenance Due
            <span class="notif-count info">{{ maintenanceDue.length }}</span>
          </div>
          <div v-for="item in maintenanceDue" :key="item.id" class="notif-item info" @click="navigate('maintenance')">
            <div class="notif-icon info"><ClipboardList :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.clientName || 'Unknown' }}</div>
              <div class="notif-sub">Not logged this month · Contract {{ item.contractNumber }}</div>
            </div>
            <div class="notif-badge info">Due</div>
          </div>
        </div>

        <!-- Billing overdue -->
        <div v-if="billingDue.length" class="notif-section">
          <div class="notif-section-title">
            <Receipt :size="13" style="color:#f87171;" /> Billing Overdue
            <span class="notif-count danger">{{ billingDue.length }}</span>
          </div>
          <div v-for="item in billingDue" :key="item.id" class="notif-item danger" @click="navigate('billing')">
            <div class="notif-icon danger"><Receipt :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.clientName || 'Unknown' }}</div>
              <div class="notif-sub">Invoice {{ item.invoiceNumber || item.docNumber }} · due {{ formatDate(item.dueDate) }}</div>
            </div>
            <div class="notif-badge danger">₹{{ (item.total || 0).toLocaleString('en-IN') }}</div>
          </div>
        </div>

        <!-- All clear -->
        <div v-if="totalCount === 0" style="padding:48px 24px;text-align:center;">
          <div style="width:56px;height:56px;background:rgba(16,185,129,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
            <CheckCircle2 :size="26" style="color:var(--ct-green);" />
          </div>
          <div style="font-size:14px;font-weight:600;color:var(--ct-primary);margin-bottom:4px;">All Clear!</div>
          <div style="font-size:12px;color:var(--ct-muted);">No pending alerts or notifications.</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="notif-footer">
        <button class="btn-secondary btn-sm" style="width:100%;justify-content:center;" @click="loadData">
          <RefreshCw :size="13" /> Refresh
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bell, X, RefreshCw, ClipboardList, Receipt, CheckCircle2, Loader2,
} from 'lucide-vue-next'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'count'])
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const today = new Date()
const monthKey = today.toISOString().slice(0, 7) // YYYY-MM

const renewals = ref([])
const maintenanceDue = ref([])
const billingDue = ref([])

const totalCount = computed(() =>
  renewals.value.length + maintenanceDue.value.length + billingDue.value.length
)

watch(totalCount, (n) => emit('count', n), { immediate: true })

async function loadData() {
  loading.value = true

  try {
    const [amc, amcMonthly, taxInvoices] = await Promise.all([
      getAll(Collections.AMC),
      getAll(Collections.AMC_MONTHLY),
      getAll(Collections.TAX_INVOICES),
    ])

    // AMC renewals — contracts expiring within 45 days
    renewals.value = amc
      .filter(c => c.status === 'active' && c.endDate)
      .map(c => {
        const end = c.endDate?.toDate ? c.endDate.toDate() : new Date(c.endDate)
        const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
        return { ...c, daysLeft }
      })
      .filter(c => c.daysLeft >= 0 && c.daysLeft <= 45)
      .sort((a, b) => a.daysLeft - b.daysLeft)

    // Monthly maintenance not yet logged this month for active contracts
    const activeContracts = amc.filter(c => c.status === 'active')
    const loggedThisMonth = new Set(
      amcMonthly.filter(m => m.monthKey === monthKey).map(m => m.contractId)
    )
    maintenanceDue.value = activeContracts
      .filter(c => !loggedThisMonth.has(c.id))
      .slice(0, 15)

    // Billing overdue — sent invoices past due date
    billingDue.value = taxInvoices
      .filter(inv => (inv.status === 'overdue') || (inv.status === 'sent' && inv.dueDate && inv.dueDate < today.toISOString().slice(0, 10)))
      .slice(0, 15)
  } catch (e) {
    console.error('Failed to load notifications', e)
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) loadData()
}, { immediate: false })

function navigate(path) {
  router.push('/' + path)
  emit('update:modelValue', false)
}

function formatDate(val) {
  if (!val) return '—'
  const d = val?.toDate ? val.toDate() : new Date(val)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.notif-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
}
.notif-panel {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 201;
  width: 400px; max-width: 100vw;
  display: flex; flex-direction: column;
  background: rgba(10,10,20,0.97);
  border-left: 1px solid rgba(255,255,255,0.08);
  box-shadow: -20px 0 60px rgba(0,0,0,0.5);
}
.notif-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.notif-close {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 9px; background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08); color:var(--ct-muted); cursor: pointer;
  transition: all .18s;
}
.notif-close:hover { background: rgba(255,255,255,0.1); color:var(--ct-sub); }

.notif-scroll { flex: 1; overflow-y: auto; padding: 12px 0; }

.notif-section { padding: 0 12px 4px; margin-bottom: 4px; }
.notif-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color:var(--ct-muted); padding: 10px 8px 8px;
}
.notif-count {
  margin-left: auto; padding: 2px 7px; border-radius: 99px; font-size: 10px; font-weight: 700;
}
.notif-count.warning  { background: rgba(245,158,11,0.15); color: #fbbf24; }
.notif-count.danger   { background: rgba(239,68,68,0.12);  color: #f87171; }
.notif-count.info     { background: rgba(59,130,246,0.12); color: #93c5fd; }
.notif-count.indigo   { background: rgba(99,102,241,0.12); color:var(--ct-accent); }
.notif-count.green    { background: rgba(52,211,153,0.15); color: #34d399; }

.notif-item {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 10px; border-radius: 10px; cursor: pointer;
  margin-bottom: 3px; transition: all .15s;
}
.notif-item:hover { background: rgba(255,255,255,0.04); }
.notif-item.warning:hover  { background: rgba(245,158,11,0.06); }
.notif-item.danger:hover   { background: rgba(239,68,68,0.06); }
.notif-item.info:hover     { background: rgba(59,130,246,0.06); }
.notif-item.indigo:hover   { background: rgba(99,102,241,0.06); }
.notif-item.green:hover    { background: rgba(52,211,153,0.06); }

.notif-icon {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.notif-icon.warning  { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.18); }
.notif-icon.danger   { background: rgba(239,68,68,0.1);   color: #f87171; border: 1px solid rgba(239,68,68,0.15); }
.notif-icon.info     { background: rgba(59,130,246,0.1);  color: #93c5fd; border: 1px solid rgba(59,130,246,0.15); }
.notif-icon.indigo   { background: rgba(99,102,241,0.1);  color:var(--ct-accent); border: 1px solid rgba(99,102,241,0.15); }
.notif-icon.green    { background: rgba(52,211,153,0.1);  color: #34d399; border: 1px solid rgba(52,211,153,0.18); }

.notif-body { flex: 1; min-width: 0; }
.notif-title { font-size: 13px; font-weight: 600; color:var(--ct-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notif-sub   { font-size: 11px; color:var(--ct-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.notif-badge {
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; flex-shrink: 0;
}
.notif-badge.warning  { background: rgba(245,158,11,0.15);  color: #fbbf24; }
.notif-badge.danger   { background: rgba(239,68,68,0.12);   color: #f87171; }
.notif-badge.info     { background: rgba(59,130,246,0.12);  color: #93c5fd; }
.notif-badge.indigo   { background: rgba(99,102,241,0.12);  color:var(--ct-accent); }
.notif-badge.green    { background: rgba(52,211,153,0.15);  color: #34d399; }

.notif-footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

/* Light theme */
[data-theme="light"] .notif-panel {
  background: rgba(255,255,255,0.99);
  border-left-color: rgba(0,0,0,0.09);
  box-shadow: -20px 0 60px rgba(0,0,0,0.15);
}
[data-theme="light"] .notif-header { border-bottom-color: rgba(0,0,0,0.07); }
[data-theme="light"] .notif-close { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.08); color:var(--ct-muted); }
[data-theme="light"] .notif-close:hover { background: rgba(0,0,0,0.09); }
[data-theme="light"] .notif-title { color: #1e293b; }
[data-theme="light"] .notif-section-title { color:var(--ct-sub); }
[data-theme="light"] .notif-footer { border-top-color: rgba(0,0,0,0.07); }
[data-theme="light"] .notif-item:hover { background: rgba(0,0,0,0.03); }

/* Transitions */
.notif-slide-enter-active, .notif-slide-leave-active { transition: transform 0.28s cubic-bezier(0.16,1,0.3,1); }
.notif-slide-enter-from, .notif-slide-leave-to { transform: translateX(100%); }
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 0.22s ease; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }

@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
</style>
