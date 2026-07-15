/**
 * Scheduled job handlers — called by the Workers cron scheduler.
 * Trimmed to AMC, Monthly Maintenance, and Billing reminders only.
 */

import { getAccessToken }                          from './auth.js'
import { queryEqual, queryWhere }                   from './firestore.js'
import { tokensByRole, tokensByUserName, tokensByUserNames } from './firestore.js'
import { send }                                    from './fcm.js'

// ── IST date helpers ─────────────────────────────────────────────────────────

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function toDate(val) {
  if (!val) return null
  if (val instanceof Date) return val
  if (val.toDate) return val.toDate()
  return new Date(val)
}

// ── AMC Expiry Reminder — daily 9:00 AM IST ──────────────────────────────────

export async function runAmcExpiryReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const today = new Date()
  const docs  = await queryEqual(token, pid, 'amc', 'status', 'active')
  const tokens = await tokensByRole(token, pid, 'admin')

  for (const amc of docs) {
    if (!amc.endDate) continue
    const end      = toDate(amc.endDate)
    if (!end) continue
    const daysLeft = Math.ceil((end - today) / 86_400_000)
    if (![1, 7, 30].includes(daysLeft)) continue
    const label = daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`
    await send(token, pid, tokens,
      { title: `⚠️ AMC Expiring ${label}`, body: `${amc.clientName || 'Client'} — ${amc.contractNumber || ''} expires ${label.toLowerCase()}` },
      { type: 'amc_expiry', docId: amc._id || '', daysLeft: String(daysLeft), channel: 'sk_reminders' })
  }
}

// ── AMC Installment Reminder — daily 9:05 AM IST ─────────────────────────────

const FREQ_MONTHS = { monthly: 1, 'bi-monthly': 2, quarterly: 3, '4-monthly': 4, 'half-yearly': 6, yearly: 12 }

export async function runAmcInstallmentReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const today = todayIST()
  const in3   = addDays(today, 3)
  const in7   = addDays(today, 7)

  // Query: paymentType == 'installments' AND status == 'active'
  const docs = await queryWhere(token, pid, 'amc', {
    compositeFilter: {
      op: 'AND',
      filters: [
        { fieldFilter: { field: { fieldPath: 'paymentType' }, op: 'EQUAL', value: { stringValue: 'installments' } } },
        { fieldFilter: { field: { fieldPath: 'status' },      op: 'EQUAL', value: { stringValue: 'active' } } },
      ],
    },
  })
  if (!docs.length) return

  const tokens = await tokensByRole(token, pid, 'admin')

  for (const c of docs) {
    const total     = c.totalWithGST || c.contractValue || 0
    const dur       = c.durationMonths || 12
    const freq      = FREQ_MONTHS[c.frequency] || 3
    const count     = Math.max(1, Math.ceil(dur / freq))
    const amount    = Math.round(total / count)
    const startDate = c.startDate ? new Date(c.startDate + 'T00:00:00Z') : null
    const paid      = (c.paymentHistory || []).length

    for (let i = paid; i < count; i++) {
      if (!startDate) continue
      const d = new Date(startDate)
      d.setUTCMonth(d.getUTCMonth() + i * freq)
      const dueStr = d.toISOString().slice(0, 10)
      if (dueStr !== in3 && dueStr !== in7) continue
      const label = dueStr === in3 ? '3 days' : '7 days'
      await send(token, pid, tokens,
        { title: `💳 AMC Installment Due in ${label}`, body: `${c.clientName || 'Client'} — Installment ${i+1}/${count} of Rs.${amount.toLocaleString('en-IN')} due on ${dueStr}` },
        { type: 'amc_installment_due', docId: c._id || '', installmentNo: String(i+1), dueDate: dueStr, channel: 'sk_reminders' })
    }
  }
}

// ── Monthly Maintenance Reminder — 1st of month 8:00 AM IST ─────────────────

export async function runMaintenanceReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const docs  = await queryEqual(token, pid, 'amcMonthlyMaintenance', 'status', 'pending')
  if (!docs.length) return

  const byTech = {}
  docs.forEach(d => {
    const tech = d.assignedTo || d.technician || '__unassigned__'
    ;(byTech[tech] = byTech[tech] || []).push(d)
  })

  for (const [techName, jobs] of Object.entries(byTech)) {
    if (techName === '__unassigned__') continue
    const tkns  = await tokensByUserName(token, pid, techName)
    const count = jobs.length
    await send(token, pid, tkns,
      { title: '🔧 Maintenance Jobs Due This Month', body: `You have ${count} AMC maintenance job${count > 1 ? 's' : ''} pending.` },
      { type: 'maintenance_due', count: String(count), channel: 'sk_reminders' })
  }

  const adminTokens = await tokensByRole(token, pid, 'admin')
  await send(token, pid, adminTokens,
    { title: 'Monthly Maintenance Summary', body: `${docs.length} maintenance job${docs.length > 1 ? 's' : ''} pending this month.` },
    { type: 'maintenance_summary', count: String(docs.length), channel: 'sk_reminders' })
}

// ── Invoice Overdue Reminder — daily 9:30 AM IST ────────────────────────────

export async function runInvoiceOverdueReminder(env) {
  const token  = await getAccessToken(env)
  const pid    = env.FIREBASE_PROJECT_ID
  const today  = todayIST()
  const tokens = await tokensByRole(token, pid, 'admin')

  for (const coll of ['taxInvoices', 'proformaInvoices']) {
    const docs = await queryWhere(token, pid, coll, {
      fieldFilter: { field: { fieldPath: 'dueDate' }, op: 'LESS_THAN', value: { stringValue: today } },
    })
    const overdue = docs.filter(d => !['paid','cancelled'].includes(d.status))
    if (!overdue.length) continue
    const total  = overdue.length
    const amount = overdue.reduce((s, d) => s + (d.grandTotal || d.total || 0), 0)
    await send(token, pid, tokens,
      { title: `⚠️ ${total} Overdue Invoice${total > 1 ? 's' : ''}`, body: `Total outstanding: Rs.${amount.toLocaleString('en-IN')} across ${total} invoice${total > 1 ? 's' : ''}.` },
      { type: 'invoice_overdue', count: String(total), amount: String(amount), collection: coll, channel: 'sk_reminders' })
  }
}

// ── Daily Preventive Maintenance Alert — daily 10:00 AM IST ────────────────
// Sends per-contract notifications to assigned technicians for any AMC whose
// monthly maintenance hasn't been logged yet for the current month.

export async function runDailyPreventiveAlert(env) {
  const token      = await getAccessToken(env)
  const pid        = env.FIREBASE_PROJECT_ID
  const now        = new Date(Date.now() + 5.5 * 3600_000)  // IST
  const monthKey   = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  const [allAmc, logsThisMonth] = await Promise.all([
    queryWhere(token, pid, 'amc', {
      fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } },
    }),
    queryWhere(token, pid, 'amcMonthlyMaintenance', {
      fieldFilter: { field: { fieldPath: 'monthKey' }, op: 'EQUAL', value: { stringValue: monthKey } },
    }),
  ])

  const doneIds = new Set(logsThisMonth.map(l => l.contractId).filter(Boolean))

  for (const amc of allAmc) {
    if (doneIds.has(amc._id)) continue   // already logged this month

    const techNames = [amc.technician, ...(amc.technicians || [])].filter(Boolean)
    if (!techNames.length) continue

    const techTokens = await tokensByUserNames(token, pid, techNames)
    if (!techTokens.length) continue

    const client  = amc.clientName || 'Client'
    const contractNo = amc.contractNumber || ''
    const freq    = amc.frequency || 'monthly'

    await send(token, pid, techTokens,
      {
        title: `🔧 Preventive Maintenance Due — ${client}`,
        body:  `${contractNo ? contractNo + ' · ' : ''}${freq} maintenance pending for ${client}. Please log your visit today.`,
      },
      { type: 'preventive_maintenance_due', docId: amc._id || '', monthKey, channel: 'sk_reminders' })
  }
}
