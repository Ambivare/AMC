// Date/frequency helpers ported from the frontend's AMC contract logic
// (src/views/amc/AMCView.vue) so payment/maintenance due dates computed here
// match what the app itself shows. Kept intentionally simple — this drives
// reminder pings, not the source of truth for billing.

export const FREQ_TO_MONTHS = {
  monthly: 1,
  'bi-monthly': 2,
  quarterly: 3,
  '4-monthly': 4,
  'half-yearly': 6,
  yearly: 12,
}

/** Today's date as YYYY-MM-DD in IST (matches the app's date-string fields). */
export function todayIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

/** Add days to a YYYY-MM-DD string, return YYYY-MM-DD. */
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Whole days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(aStr, bStr) {
  const a = new Date(aStr + 'T00:00:00Z')
  const b = new Date(bStr + 'T00:00:00Z')
  return Math.round((b - a) / 86_400_000)
}

/** Number of installments/service visits a contract gets over its duration. */
export function installmentCount(frequency, durationMonths) {
  if (frequency === 'every-45-days') return Math.max(1, Math.ceil((durationMonths * 30) / 45))
  const months = FREQ_TO_MONTHS[frequency] || 3
  return Math.max(1, Math.ceil(durationMonths / months))
}

/** The `times`-th cadence step after startDate (YYYY-MM-DD), as YYYY-MM-DD. */
export function stepDate(startDate, frequency, times) {
  const d = new Date(startDate + 'T00:00:00Z')
  if (frequency === 'every-45-days') {
    d.setUTCDate(d.getUTCDate() + times * 45)
  } else {
    const months = FREQ_TO_MONTHS[frequency] || 3
    d.setUTCMonth(d.getUTCMonth() + times * months)
  }
  return d.toISOString().slice(0, 10)
}

/** Legacy-compat: old records stored paymentType:'installments' and used the
 *  separate `frequency` field for cadence; new records store the cadence
 *  directly in paymentType. */
export function paymentFrequencyOf(contract) {
  if (contract.paymentType === 'installments') return contract.frequency || 'quarterly'
  return contract.paymentType
}

/** Contract duration in months, derived from stored value or start/end dates. */
export function durationMonthsOf(contract) {
  if (contract.durationMonths) return Number(contract.durationMonths)
  if (contract.startDate && contract.endDate) {
    const s = new Date(contract.startDate + 'T00:00:00Z')
    const e = new Date(contract.endDate + 'T00:00:00Z')
    return Math.max(1, Math.round((e - s) / (30 * 86_400_000)))
  }
  return 12
}

/**
 * Service due periods for a contract, stepped by its maintenance frequency
 * from startDate to endDate. Each period is keyed YYYY-MM (matching how
 * amcMonthlyMaintenance logs store `monthKey`) — safe even for the 45-day
 * cadence since 45 days always crosses into a new calendar month.
 */
export function contractServicePeriods(contract) {
  const freq = contract.frequency || 'quarterly'
  if (!contract.startDate || !contract.endDate) return []
  const end = contract.endDate
  const periods = []
  for (let i = 0; i < 60; i++) {
    const date = stepDate(contract.startDate, freq, i)
    if (date > end) break
    periods.push({ key: date.slice(0, 7), date })
  }
  return periods
}
