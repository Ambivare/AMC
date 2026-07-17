/**
 * Sends event-driven push-notification requests to the Cloudflare Worker's
 * POST /notify endpoint (see /workers/src/notify.js for the event catalogue).
 *
 * This is separate from — and in addition to — the Worker's own cron jobs
 * (AMC expiry, AMC installment, monthly maintenance, billing overdue), which
 * run entirely server-side and need no client wiring at all.
 *
 * Fill in WORKER_URL and WORKER_SECRET below after deploying /workers with
 * `wrangler deploy` and `wrangler secret put WORKER_SECRET`. Until then this
 * silently no-ops so the app keeps working without a deployed Worker.
 */

const WORKER_URL    = 'https://sk.sid55036124.workers.dev'
const WORKER_SECRET = 'Qoptwppy'

const isConfigured = !WORKER_URL.includes('YOUR_SUBDOMAIN') && WORKER_SECRET !== 'YOUR_WORKER_SECRET'

/** Best-effort — never throws, never blocks the calling UI action. */
export async function notifyWorker(type, data = {}, before = {}) {
  if (!isConfigured) return
  try {
    await fetch(`${WORKER_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': WORKER_SECRET },
      body: JSON.stringify({ type, data, before }),
    })
  } catch (e) {
    console.warn('[notifyWorker]', type, e?.message || e)
  }
}
