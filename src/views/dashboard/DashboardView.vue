<template>
  <div>
  <div class="page-container">
    <!-- Greeting -->
    <div class="dash-greeting">
      <div>
        <h1 class="dash-title">{{ greeting }}, {{ firstName }} 👋</h1>
        <p class="dash-sub">{{ today }} · {{ roleLabel }}</p>
      </div>
      <div class="dash-actions">
        <button class="btn-secondary btn-sm" @click="refresh">
          <RefreshCw :size="13" :class="{ spin: refreshing }" /> Refresh
        </button>
      </div>
    </div>

    <!-- Stat cards -->
    <div class="stats-grid">
      <StatCard
        icon="Shield" color="cyan"
        :value="stats.activeAMC"
        label="Active AMC Contracts"
        :sub="`${stats.totalAMC} total contracts`"
        :alert="stats.expiringAMC || null" alertText="expiring soon"
        @expand="expandedCard = 'amc'"
      />
      <StatCard
        icon="Wrench" color="blue"
        :value="`${stats.loggedThisMonth}/${stats.activeAMC}`"
        label="Monthly Maintenance Logged"
        sub="visits logged this month"
        :alert="stats.pendingMaintenance || null" alertText="pending"
        @expand="expandedCard = 'maintenance'"
      />
      <StatCard
        icon="Receipt" color="emerald"
        :value="formatCurrency(stats.billingOutstanding)"
        label="Billing Outstanding"
        :sub="`${stats.overdueInvoices} overdue invoice(s)`"
        :alert="stats.overdueInvoices || null" alertText="overdue"
        valueLarge
        @expand="expandedCard = 'billing'"
      />
    </div>

    <!-- Due alerts -->
    <div class="alerts-row" v-if="dueAlerts.length">
      <div v-for="a in dueAlerts" :key="a.key" class="alert-card" :class="a.tone">
        <component :is="a.icon" :size="16" />
        <span>{{ a.text }}</span>
        <router-link :to="a.to" class="alert-link">Review →</router-link>
      </div>
    </div>

    <!-- Recent activity -->
    <div class="glass p-6 activity-card">
      <h3 class="chart-title">Recent Activity</h3>
      <div class="detail-list">
        <div v-for="a in recentActivity" :key="a.id" class="detail-row">
          <div class="detail-row-main">
            <span class="detail-name">{{ a.summary }}</span>
            <span class="detail-sub">{{ a.user }} · {{ timeAgo(a.timestamp) }}</span>
          </div>
          <span class="status-pill" :class="`sp-${a.action}`">{{ a.action }}</span>
        </div>
        <div v-if="!recentActivity.length" class="detail-empty">No recent activity yet</div>
      </div>
    </div>

    <!-- Configurations (password-gated) -->
    <div class="config-gate-row">
      <button class="btn-secondary btn-sm config-gate-btn" @click="openConfigGate">
        <Settings :size="13" /> Configurations
      </button>
    </div>
  </div>

  <!-- Configurations password gate -->
  <Teleport to="body">
    <div v-if="showConfigGate" class="modal-backdrop" @click.self="closeConfigGate" style="z-index:300;">
      <div class="modal-panel" style="max-width:360px;width:100%;">
        <div class="modal-header">
          <div>
            <h2 style="font-size:16px;font-weight:700;color:var(--ct-primary);margin:0;">Configurations Access</h2>
            <p style="font-size:12px;color:var(--ct-muted);margin:4px 0 0;">Enter password to continue</p>
          </div>
          <button @click="closeConfigGate" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.09);color:var(--ct-muted);cursor:pointer;">
            <X :size="16" />
          </button>
        </div>
        <div class="modal-body">
          <input
            v-model="configGatePassword"
            type="password"
            class="input"
            placeholder="Password"
            style="width:100%;"
            @keydown.enter="submitConfigGate"
            autofocus
          />
          <div v-if="configGateError" style="color:#f87171;font-size:12px;margin-top:8px;">{{ configGateError }}</div>
          <button class="btn-primary btn-sm" style="width:100%;margin-top:14px;" @click="submitConfigGate">Unlock</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Card Detail Modal -->
  <Teleport to="body">
    <transition name="modal">
      <div v-if="expandedCard" class="modal-backdrop" @click.self="expandedCard = null" style="z-index:200;">
        <div class="modal-panel" style="max-width:720px;width:100%;">
          <div class="modal-header">
            <div>
              <h2 style="font-size:18px;font-weight:700;color:var(--ct-primary);margin:0;">{{ cardTitles[expandedCard] }}</h2>
              <p style="font-size:13px;color:var(--ct-muted);margin:4px 0 0;">Detailed breakdown</p>
            </div>
            <button @click="expandedCard = null" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.09);color:var(--ct-muted);cursor:pointer;">
              <X :size="16" />
            </button>
          </div>
          <div class="modal-body">

            <!-- AMC -->
            <template v-if="expandedCard === 'amc'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#67e8f9"><div class="kpi-val">{{ stats.totalAMC }}</div><div class="kpi-lbl">Total</div></div>
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ stats.activeAMC }}</div><div class="kpi-lbl">Active</div></div>
                <div class="kpi-box" style="--kc:#fbbf24"><div class="kpi-val">{{ stats.expiringAMC }}</div><div class="kpi-lbl">Expiring (45d)</div></div>
              </div>
              <div class="detail-section-title">Contracts Expiring Soonest</div>
              <div class="detail-list">
                <div v-for="a in rawData.expiringAmcList.slice(0,8)" :key="a.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ a.clientName || '—' }}</span>
                    <span class="detail-sub">{{ a.contractNumber || '' }}</span>
                  </div>
                  <span class="detail-value" style="color:#fbbf24;">{{ a.daysLeft }}d left</span>
                </div>
                <div v-if="!rawData.expiringAmcList.length" class="detail-empty">No contracts expiring soon</div>
              </div>
              <div class="detail-footer"><router-link to="/amc" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open AMC →</router-link></div>
            </template>

            <!-- Maintenance -->
            <template v-else-if="expandedCard === 'maintenance'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#93c5fd"><div class="kpi-val">{{ stats.loggedThisMonth }}</div><div class="kpi-lbl">Logged</div></div>
                <div class="kpi-box" style="--kc:#f87171"><div class="kpi-val">{{ stats.pendingMaintenance }}</div><div class="kpi-lbl">Pending</div></div>
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ stats.activeAMC }}</div><div class="kpi-lbl">Active Contracts</div></div>
              </div>
              <div class="detail-section-title">Not Logged This Month</div>
              <div class="detail-list">
                <div v-for="c in rawData.pendingMaintenanceList.slice(0,8)" :key="c.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ c.clientName || '—' }}</span>
                    <span class="detail-sub">{{ c.contractNumber || '' }}</span>
                  </div>
                  <span class="status-pill sp-lost">Pending</span>
                </div>
                <div v-if="!rawData.pendingMaintenanceList.length" class="detail-empty">All contracts logged this month</div>
              </div>
              <div class="detail-footer"><router-link to="/maintenance" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open Maintenance →</router-link></div>
            </template>

            <!-- Billing -->
            <template v-else-if="expandedCard === 'billing'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#86efac;flex:1"><div class="kpi-val" style="font-size:20px;">{{ formatCurrency(stats.billingOutstanding) }}</div><div class="kpi-lbl">Outstanding</div></div>
                <div class="kpi-box" style="--kc:#f87171"><div class="kpi-val">{{ stats.overdueInvoices }}</div><div class="kpi-lbl">Overdue</div></div>
              </div>
              <div class="detail-section-title">Overdue Invoices</div>
              <div class="detail-list">
                <div v-for="inv in rawData.overdueInvoiceList.slice(0,8)" :key="inv.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ inv.clientName || '—' }}</span>
                    <span class="detail-sub">{{ inv.invoiceNumber || inv.docNumber || '' }} · due {{ fmtDate(inv.dueDate) }}</span>
                  </div>
                  <span class="detail-value" style="color:#f87171;font-weight:600;">{{ formatCurrency(inv.total) }}</span>
                </div>
                <div v-if="!rawData.overdueInvoiceList.length" class="detail-empty">No overdue invoices</div>
              </div>
              <div class="detail-footer"><router-link to="/billing" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open Billing →</router-link></div>
            </template>

          </div>
        </div>
      </div>
    </transition>
  </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore, ROLES } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { useActivityStore } from '@/stores/activity'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { RefreshCw, Shield, Wrench, Receipt, X, Settings } from 'lucide-vue-next'
import StatCard from './StatCard.vue'

const CONFIG_GATE_PASSWORD = '102005'

const auth = useAuthStore()
const ui = useUIStore()
const settings = useSettingsStore()
const activityStore = useActivityStore()
const route = useRoute()
const router = useRouter()

const showConfigGate = ref(false)
const configGatePassword = ref('')
const configGateError = ref('')

function openConfigGate() {
  configGatePassword.value = ''
  configGateError.value = ''
  showConfigGate.value = true
}
function closeConfigGate() {
  showConfigGate.value = false
}
function submitConfigGate() {
  if (configGatePassword.value === CONFIG_GATE_PASSWORD) {
    showConfigGate.value = false
    router.push('/configurations')
  } else {
    configGateError.value = 'Incorrect password.'
  }
}

const roleLabel = computed(() => ROLES[auth.user?.role]?.label || 'User')
const firstName = computed(() => (auth.user?.fullName || auth.user?.username || '').split(' ')[0])

const stats = ref({
  totalAMC: 0, activeAMC: 0, expiringAMC: 0,
  loggedThisMonth: 0, pendingMaintenance: 0,
  billingOutstanding: 0, overdueInvoices: 0,
})
const rawData = ref({ expiringAmcList: [], pendingMaintenanceList: [], overdueInvoiceList: [] })
const refreshing = ref(false)
const expandedCard = ref(null)

const cardTitles = { amc: 'AMC Contracts Overview', maintenance: 'Monthly Maintenance Overview', billing: 'Billing Overview' }

const today = computed(() => new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
})

function formatCurrency(val) {
  return `${settings.settings.currency || '₹'}${Number(val || 0).toLocaleString('en-IN')}`
}
function fmtDate(d) {
  if (!d) return '—'
  const dt = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function timeAgo(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const diffMin = Math.round((Date.now() - d) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.round(diffHr / 24)}d ago`
}

const ACTIVITY_MODULES = new Set(['amc', 'amcMonthlyMaintenance', 'maintenance', 'quotations', 'purchaseOrders', 'proformaInvoices', 'taxInvoices', 'projects'])
const recentActivity = computed(() =>
  activityStore.activities.filter(a => ACTIVITY_MODULES.has(a.module)).slice(0, 8)
)

const dueAlerts = computed(() => {
  const list = []
  if (stats.value.expiringAMC > 0) {
    list.push({ key: 'amc', tone: 'amber', icon: Shield, to: '/amc', text: `${stats.value.expiringAMC} AMC contract(s) expiring within 45 days` })
  }
  if (stats.value.pendingMaintenance > 0) {
    list.push({ key: 'maint', tone: 'blue', icon: Wrench, to: '/maintenance', text: `${stats.value.pendingMaintenance} contract(s) not yet serviced this month` })
  }
  if (stats.value.overdueInvoices > 0) {
    list.push({ key: 'bill', tone: 'rose', icon: Receipt, to: '/billing', text: `${stats.value.overdueInvoices} invoice(s) overdue for payment` })
  }
  return list
})

async function loadStats() {
  try {
    const [amc, amcMonthly, taxInvoices] = await Promise.all([
      getAll(Collections.AMC),
      getAll(Collections.AMC_MONTHLY),
      getAll(Collections.TAX_INVOICES),
    ])

    const now = new Date()
    const monthKey = now.toISOString().slice(0, 7)

    const activeContracts = amc.filter(a => a.status === 'active')
    const expiringAmcList = activeContracts
      .filter(a => a.endDate)
      .map(a => {
        const end = a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate)
        const daysLeft = Math.ceil((end - now) / 86400000)
        return { ...a, daysLeft }
      })
      .filter(a => a.daysLeft >= 0 && a.daysLeft <= 45)
      .sort((a, b) => a.daysLeft - b.daysLeft)

    const loggedThisMonth = new Set(amcMonthly.filter(m => m.monthKey === monthKey).map(m => m.contractId))
    const pendingMaintenanceList = activeContracts.filter(c => !loggedThisMonth.has(c.id))

    const overdueInvoiceList = taxInvoices.filter(inv =>
      inv.status === 'overdue' || (inv.status === 'sent' && inv.dueDate && inv.dueDate < now.toISOString().slice(0, 10))
    )
    const billingOutstanding = taxInvoices
      .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
      .reduce((sum, inv) => sum + Number(inv.total || 0), 0)

    stats.value = {
      totalAMC: amc.length,
      activeAMC: activeContracts.length,
      expiringAMC: expiringAmcList.length,
      loggedThisMonth: loggedThisMonth.size,
      pendingMaintenance: pendingMaintenanceList.length,
      billingOutstanding,
      overdueInvoices: overdueInvoiceList.length,
    }
    rawData.value = { expiringAmcList, pendingMaintenanceList, overdueInvoiceList }
  } catch {
    ui.error('Failed to load dashboard data.')
  }
}

async function refresh() {
  refreshing.value = true
  await Promise.all([loadStats(), activityStore.load()])
  refreshing.value = false
}

onMounted(() => { loadStats(); activityStore.load() })

watch(() => route.path, (path) => {
  if (path === '/dashboard') loadStats()
})
</script>

<style scoped>
.dash-greeting {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.dash-title { font-size: 22px; font-weight: 700; color: #f1f5f9; margin: 0 0 4px; letter-spacing: -0.4px; }
.dash-sub { font-size: 13px; color:var(--ct-muted); margin: 0; }
.dash-actions { display: flex; gap: 8px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.config-gate-row { display: flex; justify-content: center; margin-top: 24px; }
.config-gate-btn { opacity: 0.55; }
.config-gate-btn:hover { opacity: 1; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px; }

.alerts-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.alert-card {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-radius: 12px;
  font-size: 13px; flex-wrap: wrap;
}
.alert-card.amber { background: rgba(245,158,11,0.08); color: #fbbf24; border: 1px solid rgba(245,158,11,0.18); }
.alert-card.rose  { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.18); }
.alert-card.blue  { background: rgba(59,130,246,0.08); color: #93c5fd; border: 1px solid rgba(59,130,246,0.18); }
.alert-link { margin-left: auto; font-size: 12px; font-weight: 600; text-decoration: none; opacity: 0.8; color: inherit; }
.alert-link:hover { opacity: 1; }

.activity-card { margin-top: 4px; }
.chart-title { font-size: 14px; font-weight: 600; color:var(--ct-sub); margin: 0 0 16px; }

.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 20px; }
.kpi-box {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 14px 16px; text-align: center;
  border-top: 3px solid var(--kc, #6366f1);
}
.kpi-val { font-size: 26px; font-weight: 800; color: var(--kc, #818cf8); line-height: 1.1; }
.kpi-lbl { font-size: 11px; color: var(--ct-muted); margin-top: 5px; font-weight: 500; }

.detail-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; color: var(--ct-muted);
  padding: 0 0 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 10px;
}
.detail-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.detail-list::-webkit-scrollbar { width: 3px; }
.detail-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
.detail-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05);
  transition: background .15s;
}
.detail-row:hover { background: rgba(255,255,255,0.045); }
.detail-row-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.detail-name { font-size: 13px; font-weight: 600; color: var(--ct-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detail-sub { font-size: 11px; color: var(--ct-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detail-value { font-size: 12px; color: var(--ct-sub); }
.detail-empty { text-align: center; padding: 24px; color: #334155; font-size: 13px; }
.detail-footer { padding-top: 16px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 16px; }

.status-pill { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; text-transform: capitalize; white-space: nowrap; }
.sp-created { background: rgba(52,211,153,.15); color: #34d399; }
.sp-updated { background: rgba(96,165,250,.15); color: #60a5fa; }
.sp-deleted,.sp-lost { background: rgba(248,113,113,.15); color: #f87171; }
.sp-payment,.sp-converted { background: rgba(251,191,36,.15); color: #fbbf24; }
.sp-action { background: rgba(148,163,184,.15); color: #94a3b8; }

@media (max-width: 600px) {
  .dash-title { font-size: 18px; }
  .dash-sub { font-size: 12px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}

[data-theme="light"] .dash-title { color: #1e293b; }
[data-theme="light"] .dash-sub { color:var(--ct-muted); }
</style>
