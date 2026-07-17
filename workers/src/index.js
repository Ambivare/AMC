/**
 * TAB Elevators — Cloudflare Worker
 *
 * HTTP endpoints (called from Vue client):
 *   POST /notify       — send FCM push notification after a Firestore write
 *
 * Cron triggers (wrangler.toml [triggers].crons):
 *   Scheduled jobs: AMC expiry, AMC installment due, monthly maintenance,
 *   billing overdue, and daily preventive maintenance alerts.
 *
 * Required secrets (wrangler secret put <NAME>):
 *   WORKER_SECRET         — shared key Vue app sends in X-API-Key header
 *   SA_EMAIL              — Firebase service account email
 *   SA_PRIVATE_KEY        — Firebase service account private key (PEM, \n as literal \\n)
 *   FIREBASE_PROJECT_ID   — avantelevators-dff70
 */

import { handleNotify } from './notify.js'
import {
  runAmcExpiryReminder,
  runAmcInstallmentReminder,
  runMaintenanceReminder,
  runInvoiceOverdueReminder,
  runDailyPreventiveAlert,
} from './schedule.js'

export default {

  // ── HTTP requests ───────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    const url    = new URL(request.url)
    const method = request.method.toUpperCase()

    // CORS pre-flight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        },
      })
    }

    if (method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    // Authenticate every request with the shared Worker secret
    const key = request.headers.get('X-API-Key') || ''
    if (!env.WORKER_SECRET || key !== env.WORKER_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (url.pathname === '/notify') return handleNotify(request, env)

    return new Response('Not Found', { status: 404 })
  },

  // ── Cron triggers ───────────────────────────────────────────────────────────
  async scheduled(controller, env, ctx) {
    const { cron } = controller
    console.log('[cron] trigger:', cron)

    const run = (fn) => ctx.waitUntil(fn(env).catch(e => console.error('[cron] error:', e.message)))

    // cron strings must match wrangler.toml exactly
    if (cron === '30 2 1 * *')  { run(runMaintenanceReminder);     return }
    if (cron === '30 3 * * *')  { run(runAmcExpiryReminder);       return }
    if (cron === '35 3 * * *')  { run(runAmcInstallmentReminder);  return }
    if (cron === '0 4 * * *')   { run(runInvoiceOverdueReminder);  return }
    if (cron === '30 4 * * *')  { run(runDailyPreventiveAlert);    return }

    console.warn('[cron] unrecognised cron expression:', cron)
  },
}
