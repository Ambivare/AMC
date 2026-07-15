<template>
  <Teleport to="body">
    <div v-if="show" style="position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:16px;" @click.self="$emit('close')">
      <div style="background:var(--ct-surface,#1e293b);border:1px solid var(--ct-border,rgba(255,255,255,0.1));border-radius:16px;width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.4);">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--ct-border,rgba(255,255,255,0.08));">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;background:rgba(99,102,241,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#818cf8;">
              <Mail :size="16" />
            </div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--ct-primary);">Send AMC Contract</div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:1px;">{{ row?.contractNumber }} — {{ row?.clientName }}</div>
            </div>
          </div>
          <button @click="$emit('close')" style="background:none;border:none;cursor:pointer;color:var(--ct-muted);padding:4px;">
            <X :size="18" />
          </button>
        </div>

        <!-- Body -->
        <div style="flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:14px;">

          <div v-if="configLoaded && !emailConfig" style="padding:14px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;font-size:13px;color:#fbbf24;display:flex;align-items:center;gap:8px;">
            <AlertTriangle :size="15" />
            Configure email settings in Configurations → Email Settings first.
          </div>

          <div v-if="!configLoaded" style="text-align:center;padding:20px;color:var(--ct-muted);font-size:13px;">
            <Loader2 :size="18" class="spin" style="display:inline-block;margin-right:6px;" />
            Loading email configuration…
          </div>

          <template v-if="configLoaded && emailConfig">
            <!-- To -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">To *</label>
              <input v-model="form.to" class="input" type="email" placeholder="client@example.com" />
            </div>

            <!-- CC -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">CC <span style="font-weight:400;text-transform:none;">(optional)</span></label>
              <input v-model="form.cc" class="input" type="email" placeholder="cc@example.com" />
            </div>

            <!-- Subject -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Subject *</label>
              <input v-model="form.subject" class="input" placeholder="Email subject…" />
            </div>

            <!-- Attachment indicator -->
            <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid var(--ct-border,rgba(255,255,255,0.1));border-radius:8px;background:rgba(255,255,255,0.03);font-size:13px;color:var(--ct-sub);">
              <FileText :size="14" style="color:#f87171;flex-shrink:0;" />
              AMC Contract PDF will be attached automatically
            </div>

            <!-- Email body preview (read-only) -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Email Body Preview</label>
              <div style="border:1px solid var(--ct-border,rgba(255,255,255,0.08));border-radius:10px;overflow:hidden;max-height:220px;overflow-y:auto;">
                <div style="background:#fff;padding:0;" v-html="sanitizeHtml(renderedTemplate)"></div>
              </div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">Template is configured in Configurations → Email Settings → AMC Contract Email Template.</div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div style="padding:16px 24px;border-top:1px solid var(--ct-border,rgba(255,255,255,0.08));display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn-secondary" @click="$emit('close')" :disabled="sending">Cancel</button>
          <button
            v-if="configLoaded && emailConfig"
            class="btn-primary"
            :disabled="sending || !form.to || !form.subject || !pdfBuffer"
            @click="handleSend"
            style="display:inline-flex;align-items:center;gap:6px;min-width:120px;justify-content:center;"
          >
            <Send :size="14" />
            Send Contract
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Full-screen sending overlay (unclosable during send) -->
  <EmailSendingOverlay
    :show="overlay.show"
    :step="overlay.step"
    :success="overlay.success"
    :error="overlay.error"
    @close="overlay.show = false"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Mail, X, Send, FileText, AlertTriangle, Loader2 } from 'lucide-vue-next'
import { useEmailSender } from '@/composables/useEmailSender'
import { useUIStore } from '@/stores/ui'
import EmailSendingOverlay from './EmailSendingOverlay.vue'

const props = defineProps({
  show:        Boolean,
  row:         Object,
  pdfBuffer:   Object,
  pdfFilename: String,
})
const emit = defineEmits(['close'])

const ui = useUIStore()
const { sending, loadEmailConfig, sendEmail } = useEmailSender()

function sanitizeHtml(html) {
  if (!html) return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, 'blocked:')
}

const configLoaded   = ref(false)
const emailConfig    = ref(null)
const companyConfig  = ref(null)

const overlay = ref({ show: false, step: '', success: false, error: '' })

const form = ref({ to: '', cc: '', subject: '' })

const renderedTemplate = computed(() => {
  if (!emailConfig.value?.amcTemplate || !props.row) {
    return '<p style="color:#64748b;font-size:12px;padding:12px;">No AMC email template configured. Add one in Configurations → Email Settings.</p>'
  }
  const row     = props.row
  const company = companyConfig.value || {}

  const formatDate = (d) => {
    if (!d) return ''
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
  }
  const formatCurrency = (v) => (v || v === 0 ? '₹' + Number(v).toLocaleString('en-IN') : '')

  return emailConfig.value.amcTemplate
    .replace(/\{\{client\.name\}\}/g,      row.clientName       || '')
    .replace(/\{\{client\.email\}\}/g,     row.clientEmail      || '')
    .replace(/\{\{contract\.number\}\}/g,  row.contractNumber   || '')
    .replace(/\{\{contract\.startDate\}\}/g, formatDate(row.startDate))
    .replace(/\{\{contract\.endDate\}\}/g,   formatDate(row.endDate))
    .replace(/\{\{contract\.value\}\}/g,   formatCurrency(row.totalWithGST || row.contractValue))
    .replace(/\{\{contract\.duration\}\}/g,  row.durationMonths ? `${row.durationMonths} months` : '')
    .replace(/\{\{contract\.type\}\}/g,    row.isComprehensive ? 'Comprehensive' : 'Non-Comprehensive')
    .replace(/\{\{company\.name\}\}/g,     company.name    || '')
    .replace(/\{\{company\.email\}\}/g,    company.email   || '')
    .replace(/\{\{company\.phone\}\}/g,    company.phone   || '')
})

async function init() {
  if (!props.show || !props.row) return
  configLoaded.value = false
  try {
    const ec = await loadEmailConfig()
    emailConfig.value   = ec
    companyConfig.value = ec?._company || null

    if (!companyConfig.value) {
      try {
        const { getAll }       = await import('@/firebase/firestore')
        const { Collections }  = await import('@/firebase/collections')
        const configs          = await getAll(Collections.CONFIGURATIONS)
        companyConfig.value    = configs[0]?.company || null
      } catch {}
    }

    const row     = props.row
    const company = companyConfig.value || {}
    form.value.to      = row.clientEmail || ''
    form.value.cc      = ''
    form.value.subject = `AMC Contract ${row.contractNumber || ''} — ${company.name || 'S.K Elevators'}`
  } catch (e) {
    console.error('[AmcEmailModal] init error', e)
  } finally {
    configLoaded.value = true
  }
}

watch(() => props.show, (val) => {
  if (val) {
    overlay.value = { show: false, step: '', success: false, error: '' }
    init()
  }
})

async function handleSend() {
  if (!form.value.to)      { ui.error('Recipient email is required.'); return }
  if (!form.value.subject) { ui.error('Subject is required.');         return }
  if (!emailConfig.value)  { ui.error('Email not configured.');        return }
  if (!props.pdfBuffer)    { ui.error('PDF is not ready yet. Please try again.'); return }

  const ec = emailConfig.value
  if (!ec.smtpUser || !ec.smtpPass) {
    ui.error('SMTP credentials not configured. Go to Configurations → Email Settings.')
    return
  }

  overlay.value = { show: true, step: 'Preparing contract PDF…', success: false, error: '' }

  try {
    const b64      = arrayBufferToBase64(props.pdfBuffer)
    const filename = props.pdfFilename || `AMC-Contract-${props.row?.contractNumber || 'contract'}.pdf`

    overlay.value.step = 'Sending email…'

    await sendEmail({
      emailConfig: ec,
      to:          form.value.to,
      cc:          form.value.cc || undefined,
      subject:     form.value.subject,
      htmlBody:    renderedTemplate.value,
      attachments: [{ filename, content: b64, type: 'application/pdf' }],
    })

    overlay.value.success = true
    overlay.value.step    = ''
    ui.success('AMC contract emailed successfully!')
    setTimeout(() => {
      overlay.value.show = false
      emit('close')
    }, 1800)
  } catch (e) {
    overlay.value.error = e?.message || String(e)
  }
}

function arrayBufferToBase64(buffer) {
  const bytes  = new Uint8Array(buffer)
  let   binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
</script>

<style scoped>
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
