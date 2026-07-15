/**
 * Event-based notification dispatcher.
 *
 * Called from the Vue client after each Firestore write:
 *   POST /notify  { type: 'amc_created', data: { ... } }
 *
 * Trimmed to AMC, Monthly Maintenance, Billing, and Project events only.
 * All failures are swallowed — notifications are best-effort.
 */

import { getAccessToken }                          from './auth.js'
import { tokensByRole, tokenByUserId, tokensByUserName, tokensByUserNames } from './firestore.js'
import { send }                                    from './fcm.js'

export async function handleNotify(request, env) {
  let body
  try { body = await request.json() } catch { return ok() }

  const { type, data = {}, before = {} } = body

  try {
    const token = await getAccessToken(env)
    const pid   = env.FIREBASE_PROJECT_ID
    await dispatch(token, pid, type, data, before)
  } catch (e) {
    console.error('[notify] dispatch error:', e.message)
  }

  return ok()
}

// ── Token helpers bound to a request's access token ──────────────────────────

function makeFs(token, pid) {
  return {
    byRole:  (...roles)  => tokensByRole(token, pid, ...roles),
    byId:    (id)        => tokenByUserId(token, pid, id),
    byName:  (name)      => tokensByUserName(token, pid, name),
    byNames: (names)     => tokensByUserNames(token, pid, names),
    send:    (tokens, notification, data) => send(token, pid, tokens, notification, data),
  }
}

// ── Event dispatcher ──────────────────────────────────────────────────────────

async function dispatch(token, pid, type, d, b) {
  const fs = makeFs(token, pid)

  switch (type) {

    // ── Project Assignment ─────────────────────────────────────────────────
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

    // ── Maintenance ────────────────────────────────────────────────────────
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

    // ── AMC ────────────────────────────────────────────────────────────────
    case 'amc_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New AMC Contract', body: `${d.clientName || 'Client'} — ${d.contractNumber || ''} | Value: Rs.${Number(d.totalWithGST || d.contractValue || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'amc_payment': {
      const prevLen = (b.paymentHistory || []).length
      const newLen  = (d.paymentHistory || []).length
      if (newLen <= prevLen) return
      const latest = d.paymentHistory[newLen - 1]
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'AMC Payment Received 💰', body: `${d.clientName || 'Client'} — Rs.${Number(latest?.amount || 0).toLocaleString('en-IN')} via ${latest?.method || 'cash'}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    // ── AMC Monthly Maintenance ────────────────────────────────────────────
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

    // ── Quotations & Invoices ──────────────────────────────────────────────
    case 'quotation_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New Quotation Created', body: `${d.clientName || 'Client'} — ${d.docNumber || ''} | Rs.${Number(d.grandTotal || d.total || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    case 'proforma_created':
    case 'tax_invoice_created':
    case 'invoice_created': {
      const label  = type === 'proforma_created' ? 'Proforma Invoice' : type === 'tax_invoice_created' ? 'Tax Invoice' : 'Invoice'
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: `New ${label}`, body: `${d.clientName || 'Client'} — ${d.docNumber || ''} | Rs.${Number(d.grandTotal || d.total || 0).toLocaleString('en-IN')}` },
        { type: 'invoice_created', docId: d.id || '', channel: 'sk_updates' })
    }

    // ── Purchase Orders ────────────────────────────────────────────────────
    case 'po_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New Purchase Order', body: `PO ${d.poNumber || ''} — ${d.vendorName || d.vendor || 'Vendor'} | Rs.${Number(d.total || d.grandTotal || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'sk_updates' })
    }

    // ── Security alert ─────────────────────────────────────────────────────
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

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    status:  200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
