// Daily cron jobs for AMC payment-due and AMC maintenance-due reminders.
// Runs inside this long-lived process via node-cron — no Cloud Scheduler,
// no separate hosting needed.
import cron from 'node-cron'
import { db } from './firebase.js'
import { send, tokensByRole, tokensByUserNames } from './fcm.js'
import {
  todayIST, daysBetween, installmentCount, stepDate,
  paymentFrequencyOf, durationMonthsOf, contractServicePeriods,
} from './dates.js'

function parseDaysEnv(name, fallback) {
  const raw = process.env[name]
  if (!raw) return fallback
  return raw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n))
}

const PAYMENT_REMINDER_DAYS = parseDaysEnv('AMC_PAYMENT_REMINDER_DAYS', [7, 3, 1])
const MAINTENANCE_REMINDER_DAYS = parseDaysEnv('AMC_MAINTENANCE_REMINDER_DAYS', [0, 3, 7])

// ── AMC payment (installment) due reminder ─────────────────────────────────
async function checkAmcPaymentsDue() {
  const today = todayIST()
  const snap = await db.collection('amc').where('status', '==', 'active').get()
  if (snap.empty) return

  const adminTokens = await tokensByRole('admin')
  let notified = 0

  for (const docSnap of snap.docs) {
    const c = docSnap.data()
    if (c.paymentType === 'full') continue // single lump-sum payment, no schedule to remind about
    if (!c.startDate) continue

    const freq = paymentFrequencyOf(c)
    const dur = durationMonthsOf(c)
    const count = installmentCount(freq, dur)
    const total = c.totalWithGST || c.contractValue || 0
    const amount = Math.round(total / count)
    const paid = (c.paymentHistory || []).length

    for (let i = paid; i < count; i++) {
      const dueDate = stepDate(c.startDate, freq, i)
      const daysUntil = daysBetween(today, dueDate)
      if (!PAYMENT_REMINDER_DAYS.includes(daysUntil)) continue

      const label = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
      await send(adminTokens,
        { title: '💳 AMC Installment Due', body: `${c.clientName || 'Client'} — Installment ${i + 1}/${count} of Rs.${amount.toLocaleString('en-IN')} due ${label} (${dueDate}).` },
        { type: 'amc_installment_due', docId: docSnap.id, installmentNo: i + 1, dueDate, channel: 'sk_reminders' }
      )
      notified++
      break // one reminder per contract per run is enough
    }
  }
  console.log(`[schedule] AMC payment due check — ${notified} reminder(s) sent`)
}

// ── AMC maintenance due reminder ────────────────────────────────────────────
async function checkAmcMaintenanceDue() {
  const today = todayIST()
  const snap = await db.collection('amc').where('status', '==', 'active').get()
  if (snap.empty) return

  const adminTokens = await tokensByRole('admin')
  let notified = 0

  for (const docSnap of snap.docs) {
    const contract = { id: docSnap.id, ...docSnap.data() }
    const periods = contractServicePeriods(contract)
    if (!periods.length) continue

    const logsSnap = await db.collection('amcMonthlyMaintenance')
      .where('contractId', '==', contract.id).get()
    const loggedKeys = new Set(logsSnap.docs.map(d => d.data().monthKey))

    // Find the earliest period that's due (today or in the past) and not yet logged.
    const pending = periods.find(p => p.date <= today && !loggedKeys.has(p.key))
    if (!pending) continue

    const daysOverdue = daysBetween(pending.date, today)
    if (!MAINTENANCE_REMINDER_DAYS.includes(daysOverdue)) continue

    const label = daysOverdue === 0 ? 'due today' : `overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`
    const techNames = contract.technicians || []
    const techTokens = await tokensByUserNames(techNames)

    const body = `${contract.clientName || 'Client'} — maintenance visit for ${pending.key} is ${label}.`
    await send([...techTokens, ...adminTokens],
      { title: '🔧 AMC Maintenance Due', body },
      { type: 'amc_monthly_due', docId: contract.id, monthKey: pending.key, channel: 'sk_reminders' }
    )
    notified++
  }
  console.log(`[schedule] AMC maintenance due check — ${notified} reminder(s) sent`)
}

export function startSchedules() {
  // Daily 9:00 AM IST (03:30 UTC) — payments.
  cron.schedule('30 3 * * *', () => {
    checkAmcPaymentsDue().catch(e => console.error('[schedule] payment check failed:', e.message))
  }, { timezone: 'UTC' })

  // Daily 8:00 AM IST (02:30 UTC) — maintenance.
  cron.schedule('30 2 * * *', () => {
    checkAmcMaintenanceDue().catch(e => console.error('[schedule] maintenance check failed:', e.message))
  }, { timezone: 'UTC' })

  console.log('[schedule] cron jobs registered — AMC payments daily 09:00 IST, AMC maintenance daily 08:00 IST')
}

// Exported for the manual test script / first-run sanity check.
export { checkAmcPaymentsDue, checkAmcMaintenanceDue }
