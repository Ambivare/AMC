/**
 * S.K Elevators — Cloudflare Worker (single-file bundle for dashboard paste-in)
 *
 * This is the exact same logic as the files in /workers/src/, combined into
 * one file with no imports/exports, for pasting directly into the Cloudflare
 * dashboard's Quick Edit code editor (which only supports a single JS file).
 * If you ever deploy with `wrangler` instead, use /workers/src/index.js.
 *
 * HTTP endpoints (called from the Vue app):
 *   POST /notify  — send an FCM push notification after a Firestore write
 *
 * Cron triggers (set these in the dashboard's Triggers tab — see below):
 *   AMC expiry, AMC installment due, monthly maintenance, billing overdue,
 *   and daily preventive maintenance alerts.
 *
 * Required secrets/variables (Worker → Settings → Variables and Secrets):
 *   WORKER_SECRET         — shared key the Vue app sends in X-API-Key header
 *   SA_EMAIL              — Firebase service account email
 *   SA_PRIVATE_KEY        — Firebase service account private key (PEM, keep \n's)
 *   FIREBASE_PROJECT_ID   — avantelevators-dff70
 */

// ═══════════════════════════════════════════════════════════════════════════
// auth.js — Google service account → short-lived OAuth2 access token
// ═══════════════════════════════════════════════════════════════════════════

let _cachedToken = null
let _cacheExpiry = 0

async function getAccessToken(env) {
  if (_cachedToken && Date.now() < _cacheExpiry) return _cachedToken

  const cryptoKey = await importPrivateKey(env.SA_PRIVATE_KEY)

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: env.SA_EMAIL,
    scope: [
      'https://www.googleapis.com/auth/firebase.messaging',
      'https://www.googleapis.com/auth/datastore',
    ].join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const toSign = `${header}.${payload}`
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(toSign),
  )
  const jwt = `${toSign}.${b64urlBuf(sigBuf)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`)

  _cachedToken = json.access_token
  _cacheExpiry = Date.now() + ((json.expires_in || 3600) - 300) * 1000
  return _cachedToken
}

async function importPrivateKey(pem) {
  const clean = pem.replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = Uint8Array.from(atob(clean), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function b64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlBuf(buf) {
  const bytes = new Uint8Array(buf)
  let raw = ''
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i])
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ═══════════════════════════════════════════════════════════════════════════
// firestore.js — minimal Firestore REST API client
// ═══════════════════════════════════════════════════════════════════════════

function fsBase(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
}

async function runQuery(token, projectId, structuredQuery) {
  const res = await fetch(`${fsBase(projectId)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  })
  if (!res.ok) return []
  const rows = await res.json()
  return (Array.isArray(rows) ? rows : [])
    .filter(r => r.document)
    .map(r => ({ _id: r.document.name.split('/').pop(), ...docToObj(r.document) }))
}

async function getDoc(token, projectId, collection, docId) {
  const res = await fetch(`${fsBase(projectId)}/${collection}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const doc = await res.json()
  return { _id: docId, ...docToObj(doc) }
}

async function tokensByRole(token, projectId, ...roles) {
  const unique = [...new Set(roles)]
  const lists = await Promise.all(unique.map(role =>
    runQuery(token, projectId, {
      from: [{ collectionId: 'fcmTokens' }],
      where: fieldEq('role', role),
      select: { fields: [{ fieldPath: 'token' }] },
    })
  ))
  return [...new Set(lists.flat().map(d => d.token).filter(Boolean))]
}

async function tokenByUserId(token, projectId, userId) {
  if (!userId) return null
  const doc = await getDoc(token, projectId, 'fcmTokens', userId)
  return doc?.token || null
}

async function tokensByUserName(token, projectId, userName) {
  if (!userName) return []
  const docs = await runQuery(token, projectId, {
    from: [{ collectionId: 'fcmTokens' }],
    where: fieldEq('userName', userName),
    select: { fields: [{ fieldPath: 'token' }] },
  })
  return docs.map(d => d.token).filter(Boolean)
}

async function tokensByUserNames(token, projectId, names = []) {
  const unique = [...new Set(names.filter(Boolean))]
  if (!unique.length) return []
  const lists = await Promise.all(unique.map(n => tokensByUserName(token, projectId, n)))
  return [...new Set(lists.flat())]
}

async function queryEqual(token, projectId, collection, field, value) {
  return runQuery(token, projectId, {
    from: [{ collectionId: collection }],
    where: fieldEq(field, value),
  })
}

async function queryWhere(token, projectId, collection, where, limit) {
  const q = { from: [{ collectionId: collection }] }
  if (where) q.where = where
  if (limit) q.limit = limit
  return runQuery(token, projectId, q)
}

function fieldEq(path, value) {
  return {
    fieldFilter: {
      field: { fieldPath: path },
      op: 'EQUAL',
      value: valueToFS(value),
    },
  }
}

function valueToFS(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val }
  if (val instanceof Date) return { timestampValue: val.toISOString() }
  return { stringValue: String(val) }
}

function fsToVal(field) {
  if (!field) return null
  if ('nullValue' in field) return null
  if ('booleanValue' in field) return field.booleanValue
  if ('integerValue' in field) return Number(field.integerValue)
  if ('doubleValue' in field) return field.doubleValue
  if ('timestampValue' in field) return new Date(field.timestampValue)
  if ('stringValue' in field) return field.stringValue
  if ('mapValue' in field) return docToObj({ fields: field.mapValue.fields || {} })
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(fsToVal)
  return null
}

function docToObj(doc) {
  if (!doc?.fields) return {}
  return Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, fsToVal(v)]))
}

// ═══════════════════════════════════════════════════════════════════════════
// fcm.js — FCM HTTP v1 API sender
// ═══════════════════════════════════════════════════════════════════════════

async function send(accessToken, projectId, tokens, notification, data = {}) {
  const clean = [...new Set(tokens.filter(Boolean))]
  if (!clean.length) return

  const strData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')]))
  const channelId = strData.channel || 'sk_general'
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

  await Promise.all(clean.map(token =>
    fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification,
          data: strData,
          android: {
            priority: 'high',
            notification: { channel_id: channelId, sound: 'default' },
          },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        },
      }),
    }).catch(e => console.error('[FCM] send error for token:', token.slice(-8), e.message))
  ))
}

// ═══════════════════════════════════════════════════════════════════════════
// notify.js — POST /notify event dispatcher
// ═══════════════════════════════════════════════════════════════════════════

async function handleNotify(request, env) {
  let body
  try { body = await request.json() } catch { return notifyOk() }

  const { type, data = {}, before = {} } = body

  try {
    const token = await getAccessToken(env)
    const pid = env.FIREBASE_PROJECT_ID
    await dispatchNotify(token, pid, type, data, before)
  } catch (e) {
    console.error('[notify] dispatch error:', e.message)
  }

  return notifyOk()
}

function makeFs(token, pid) {
  return {
    byRole: (...roles) => tokensByRole(token, pid, ...roles),
    byId: (id) => tokenByUserId(token, pid, id),
    byName: (name) => tokensByUserName(token, pid, name),
    byNames: (names) => tokensByUserNames(token, pid, names),
    send: (tokens, notification, data) => send(token, pid, tokens, notification, data),
  }
}

async function dispatchNotify(token, pid, type, d, b) {
  const fs = makeFs(token, pid)

  switch (type) {

    case 'project_assigned': {
      const newTechs = [d.assignedTechnician, d.installedBy, ...(d.technicians || [])].filter(Boolean)
      const oldTechs = [b.assignedTechnician, b.installedBy, ...(b.technicians || [])].filter(Boolean)
      const added = newTechs.filter(n => !oldTechs.includes(n))
      if (!added.length) return
      const tech = await fs.byNames(added)
      return fs.send(tech,
        { title: '🏗️ Project Assigned to You', body: `${d.projectName || d.clientName || 'Project'} — ${d.projectType || d.type || 'Project'} has been assigned to you.` },
        { type: 'project_assigned', docId: d.id || '', channel: 'sk_reminders' })
    }

    case 'project_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New Project Added', body: `${d.projectName || d.name || 'New Project'} — ${d.clientName || ''}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'project_status_changed': {
      if (d.status === b.status) return
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: `Project: ${d.status}`, body: `${d.projectName || d.name || 'Project'} status changed to ${d.status}.` },
        { type: 'project_status', docId: d.id || '', channel: 'sk_updates' })
    }

    case 'maintenance_created': {
      const names = [d.technicianName, d.assignedTo, d.assignedTechnician].filter(Boolean)
      const dateStr = d.scheduledDate ? ` on ${d.scheduledDate}` : ''
      const project = d.projectName || d.clientName || 'Site'
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole('admin')])
      if (tech.length) await fs.send(tech,
        { title: '🔧 Maintenance Scheduled for You', body: `${project}${dateStr} — ${d.maintenanceType || 'Routine'} maintenance.` },
        { type: 'job_scheduled', docId: d.id || '', channel: 'sk_reminders' })
      return fs.send(admin,
        { title: 'Maintenance Scheduled', body: `${project} — ${d.maintenanceType || 'Maintenance'} scheduled${dateStr}.` },
        { type: 'maintenance_scheduled', docId: d.id || '', channel: 'sk_updates' })
    }

    case 'amc_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New AMC Contract', body: `${d.clientName || 'Client'} — ${d.contractNumber || ''} | Value: Rs.${Number(d.totalWithGST || d.contractValue || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'amc_payment': {
      const prevLen = (b.paymentHistory || []).length
      const newLen = (d.paymentHistory || []).length
      if (newLen <= prevLen) return
      const latest = d.paymentHistory[newLen - 1]
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'AMC Payment Received 💰', body: `${d.clientName || 'Client'} — Rs.${Number(latest?.amount || 0).toLocaleString('en-IN')} via ${latest?.method || 'cash'}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'amc_monthly_log_created': {
      const tokens = await fs.byRole('admin')
      const loc = [d.buildingName, d.wingName, d.liftNo ? 'Lift ' + d.liftNo : ''].filter(Boolean).join(' · ')
      return fs.send(tokens,
        { title: 'Maintenance Logged ✓', body: `${d.clientName || 'Contract'} — ${d.monthKey || ''}${loc ? ' | ' + loc : ''} by ${d.technician || d.completedBy || 'Tech'}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'amc_monthly_completed': {
      const done = ['completed', 'done']
      if (!done.includes(d.status) || done.includes(b.status)) return
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'Monthly Maintenance Done ✓', body: `${d.projectName || d.clientName || 'Maintenance'} completed by ${d.technician || d.assignedTo || 'technician'}.` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'quotation_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New Quotation Created', body: `${d.clientName || 'Client'} — ${d.docNumber || ''} | Rs.${Number(d.grandTotal || d.total || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'proforma_created':
    case 'tax_invoice_created':
    case 'invoice_created': {
      const label = type === 'proforma_created' ? 'Proforma Invoice' : type === 'tax_invoice_created' ? 'Tax Invoice' : 'Invoice'
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: `New ${label}`, body: `${d.clientName || 'Client'} — ${d.docNumber || ''} | Rs.${Number(d.grandTotal || d.total || 0).toLocaleString('en-IN')}` },
        { type: 'invoice_created', docId: d.id || '', channel: 'sk_updates' })
    }

    case 'po_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New Purchase Order', body: `PO ${d.poNumber || ''} — ${d.vendorName || d.vendor || 'Vendor'} | Rs.${Number(d.total || d.grandTotal || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'security_alert': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: '🚨 Suspicious Activity Detected', body: `${d.failedVerifyAttempts || 0} failed verifications after ${d.deleteCount || 0} deletes. User: ${d.attemptedUsername || 'Unknown'}.` },
        { type, alertId: d.alertId || '', channel: 'sk_alerts' })
    }

    default:
      console.warn('[notify] unknown event type:', type)
  }
}

function notifyOk() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// schedule.js — cron job handlers
// ═══════════════════════════════════════════════════════════════════════════

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

async function runAmcExpiryReminder(env) {
  const token = await getAccessToken(env)
  const pid = env.FIREBASE_PROJECT_ID
  const today = new Date()
  const docs = await queryEqual(token, pid, 'amc', 'status', 'active')
  const tokens = await tokensByRole(token, pid, 'admin')

  for (const amc of docs) {
    if (!amc.endDate) continue
    const end = toDate(amc.endDate)
    if (!end) continue
    const daysLeft = Math.ceil((end - today) / 86_400_000)
    if (![1, 7, 30].includes(daysLeft)) continue
    const label = daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`
    await send(token, pid, tokens,
      { title: `⚠️ AMC Expiring ${label}`, body: `${amc.clientName || 'Client'} — ${amc.contractNumber || ''} expires ${label.toLowerCase()}` },
      { type: 'amc_expiry', docId: amc._id || '', daysLeft: String(daysLeft), channel: 'sk_reminders' })
  }
}

const FREQ_MONTHS = { monthly: 1, 'bi-monthly': 2, quarterly: 3, '4-monthly': 4, 'half-yearly': 6, yearly: 12 }

async function runAmcInstallmentReminder(env) {
  const token = await getAccessToken(env)
  const pid = env.FIREBASE_PROJECT_ID
  const today = todayIST()
  const in3 = addDays(today, 3)
  const in7 = addDays(today, 7)

  const docs = await queryWhere(token, pid, 'amc', {
    compositeFilter: {
      op: 'AND',
      filters: [
        { fieldFilter: { field: { fieldPath: 'paymentType' }, op: 'EQUAL', value: { stringValue: 'installments' } } },
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
      ],
    },
  })
  if (!docs.length) return

  const tokens = await tokensByRole(token, pid, 'admin')

  for (const c of docs) {
    const total = c.totalWithGST || c.contractValue || 0
    const dur = c.durationMonths || 12
    const freq = FREQ_MONTHS[c.frequency] || 3
    const count = Math.max(1, Math.ceil(dur / freq))
    const amount = Math.round(total / count)
    const startDate = c.startDate ? new Date(c.startDate + 'T00:00:00Z') : null
    const paid = (c.paymentHistory || []).length

    for (let i = paid; i < count; i++) {
      if (!startDate) continue
      const d = new Date(startDate)
      d.setUTCMonth(d.getUTCMonth() + i * freq)
      const dueStr = d.toISOString().slice(0, 10)
      if (dueStr !== in3 && dueStr !== in7) continue
      const label = dueStr === in3 ? '3 days' : '7 days'
      await send(token, pid, tokens,
        { title: `💳 AMC Installment Due in ${label}`, body: `${c.clientName || 'Client'} — Installment ${i + 1}/${count} of Rs.${amount.toLocaleString('en-IN')} due on ${dueStr}` },
        { type: 'amc_installment_due', docId: c._id || '', installmentNo: String(i + 1), dueDate: dueStr, channel: 'sk_reminders' })
    }
  }
}

async function runMaintenanceReminder(env) {
  const token = await getAccessToken(env)
  const pid = env.FIREBASE_PROJECT_ID
  const docs = await queryEqual(token, pid, 'amcMonthlyMaintenance', 'status', 'pending')
  if (!docs.length) return

  const byTech = {}
  docs.forEach(d => {
    const tech = d.assignedTo || d.technician || '__unassigned__'
    ;(byTech[tech] = byTech[tech] || []).push(d)
  })

  for (const [techName, jobs] of Object.entries(byTech)) {
    if (techName === '__unassigned__') continue
    const tkns = await tokensByUserName(token, pid, techName)
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

async function runInvoiceOverdueReminder(env) {
  const token = await getAccessToken(env)
  const pid = env.FIREBASE_PROJECT_ID
  const today = todayIST()
  const tokens = await tokensByRole(token, pid, 'admin')

  for (const coll of ['taxInvoices', 'proformaInvoices']) {
    const docs = await queryWhere(token, pid, coll, {
      fieldFilter: { field: { fieldPath: 'dueDate' }, op: 'LESS_THAN', value: { stringValue: today } },
    })
    const overdue = docs.filter(d => !['paid', 'cancelled'].includes(d.status))
    if (!overdue.length) continue
    const total = overdue.length
    const amount = overdue.reduce((s, d) => s + (d.grandTotal || d.total || 0), 0)
    await send(token, pid, tokens,
      { title: `⚠️ ${total} Overdue Invoice${total > 1 ? 's' : ''}`, body: `Total outstanding: Rs.${amount.toLocaleString('en-IN')} across ${total} invoice${total > 1 ? 's' : ''}.` },
      { type: 'invoice_overdue', count: String(total), amount: String(amount), collection: coll, channel: 'sk_reminders' })
  }
}

async function runDailyPreventiveAlert(env) {
  const token = await getAccessToken(env)
  const pid = env.FIREBASE_PROJECT_ID
  const now = new Date(Date.now() + 5.5 * 3600_000) // IST
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

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
    if (doneIds.has(amc._id)) continue

    const techNames = [amc.technician, ...(amc.technicians || [])].filter(Boolean)
    if (!techNames.length) continue

    const techTokens = await tokensByUserNames(token, pid, techNames)
    if (!techTokens.length) continue

    const client = amc.clientName || 'Client'
    const contractNo = amc.contractNumber || ''
    const freq = amc.frequency || 'monthly'

    await send(token, pid, techTokens,
      {
        title: `🔧 Preventive Maintenance Due — ${client}`,
        body: `${contractNo ? contractNo + ' · ' : ''}${freq} maintenance pending for ${client}. Please log your visit today.`,
      },
      { type: 'preventive_maintenance_due', docId: amc._id || '', monthKey, channel: 'sk_reminders' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// index.js — entry point
// ═══════════════════════════════════════════════════════════════════════════

export default {

  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        },
      })
    }

    if (method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const key = request.headers.get('X-API-Key') || ''
    if (!env.WORKER_SECRET || key !== env.WORKER_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (url.pathname === '/notify') return handleNotify(request, env)

    return new Response('Not Found', { status: 404 })
  },

  async scheduled(controller, env, ctx) {
    const { cron } = controller
    console.log('[cron] trigger:', cron)

    const run = (fn) => ctx.waitUntil(fn(env).catch(e => console.error('[cron] error:', e.message)))

    if (cron === '30 2 1 * *') { run(runMaintenanceReminder); return }
    if (cron === '30 3 * * *') { run(runAmcExpiryReminder); return }
    if (cron === '35 3 * * *') { run(runAmcInstallmentReminder); return }
    if (cron === '0 4 * * *') { run(runInvoiceOverdueReminder); return }
    if (cron === '30 4 * * *') { run(runDailyPreventiveAlert); return }

    console.warn('[cron] unrecognised cron expression:', cron)
  },
}
