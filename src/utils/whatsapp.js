/**
 * WhatsApp click-to-chat helpers for sharing monthly maintenance completion receipts.
 *
 * WhatsApp's public wa.me link can deep-link straight to a contact's chat with a
 * pre-filled message, but it cannot attach a file (no public WhatsApp API supports
 * that). So the flow here is: trigger the receipt PDF download, then open the
 * contact's WhatsApp chat with the message pre-filled — the user attaches the
 * just-downloaded file from their device inside the chat that opens.
 */

/** "2026-07" → "July 2026" */
export function formatMonthLabel(monthKey) {
  if (!monthKey) return ''
  const [year, month] = String(monthKey).split('-')
  if (!year || !month) return monthKey
  const d = new Date(Number(year), Number(month) - 1, 1)
  if (isNaN(d)) return monthKey
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function buildCompletionMessage(monthKey) {
  const monthLabel = formatMonthLabel(monthKey)
  return `Hello Sir,\n\nPlease find attached completion report of ${monthLabel} from S.K Elevators.`
}

/** Normalizes an Indian phone number to WhatsApp's digits-only, country-code-prefixed format. Returns null if invalid. */
export function normalizeWhatsAppPhone(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return '91' + digits
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1)
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 13 && digits.startsWith('091')) return '91' + digits.slice(3)
  if (digits.length >= 10) return digits
  return null
}

/** Builds a wa.me chat URL, or null if the phone number is invalid. */
export function whatsAppChatUrl(phone, message) {
  const normalized = normalizeWhatsAppPhone(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
