<template>
  <Teleport to="body">
    <div v-if="show" style="position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:16px;" @click.self="$emit('close')">
      <div style="background:var(--ct-surface,#1e293b);border:1px solid var(--ct-border,rgba(255,255,255,0.1));border-radius:16px;width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.4);">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--ct-border,rgba(255,255,255,0.08));">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;background:rgba(34,197,94,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#4ade80;">
              <Mail :size="16" />
            </div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--ct-primary);">Send Email</div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:1px;">{{ docLabel }}</div>
            </div>
          </div>
          <button @click="$emit('close')" style="background:none;border:none;cursor:pointer;color:var(--ct-muted);padding:4px;">
            <X :size="18" />
          </button>
        </div>

        <!-- Body (scrollable) -->
        <div style="flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:14px;">

          <!-- No email config warning -->
          <div v-if="configLoaded && !emailConfig" style="padding:14px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;font-size:13px;color:#fbbf24;display:flex;align-items:center;gap:8px;">
            <AlertTriangle :size="15" />
            Configure email settings in the Configurations tab first, then come back here.
          </div>

          <!-- Loading config -->
          <div v-if="!configLoaded" style="text-align:center;padding:20px;color:var(--ct-muted);font-size:13px;">
            <Loader2 :size="18" class="spin" style="display:inline-block;margin-right:6px;" />
            Loading email configuration…
          </div>

          <template v-if="configLoaded && emailConfig">
            <!-- To field -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">To *</label>
              <input v-model="form.to" class="input" type="email" placeholder="recipient@example.com" />
            </div>

            <!-- CC field -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">CC <span style="font-weight:400;text-transform:none;">(optional)</span></label>
              <input v-model="form.cc" class="input" type="email" placeholder="cc@example.com" />
            </div>

            <!-- Subject -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Subject *</label>
              <input v-model="form.subject" class="input" placeholder="Email subject…" />
            </div>

            <!-- Attachments -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px;">Attachments</label>
              <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ct-sub);cursor:pointer;padding:8px 12px;border:1px solid var(--ct-border,rgba(255,255,255,0.1));border-radius:8px;background:rgba(255,255,255,0.03);">
                  <input type="checkbox" v-model="form.attachPdf" style="margin:0;" />
                  <FileText :size="13" style="color:#f87171;" />
                  PDF
                </label>
                <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ct-sub);cursor:pointer;padding:8px 12px;border:1px solid var(--ct-border,rgba(255,255,255,0.1));border-radius:8px;background:rgba(255,255,255,0.03);">
                  <input type="checkbox" v-model="form.attachExcel" style="margin:0;" />
                  <FileSpreadsheet :size="13" style="color:#4ade80;" />
                  Excel
                </label>
              </div>
            </div>

            <!-- Template preview -->
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Email Body Preview</label>
              <div style="border:1px solid var(--ct-border,rgba(255,255,255,0.08));border-radius:10px;overflow:hidden;max-height:220px;overflow-y:auto;">
                <div style="background:#fff;padding:0;" v-html="sanitizeHtml(renderedTemplate)"></div>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div style="padding:16px 24px;border-top:1px solid var(--ct-border,rgba(255,255,255,0.08));display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn-secondary" @click="$emit('close')" :disabled="sending">Cancel</button>
          <button
            v-if="configLoaded && emailConfig"
            class="btn-primary"
            :disabled="sending || !form.to || !form.subject"
            @click="handleSend"
            style="display:inline-flex;align-items:center;gap:6px;min-width:110px;justify-content:center;"
          >
            <Send :size="14" />
            Send Email
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
import { Mail, X, Send, FileText, FileSpreadsheet, AlertTriangle, Loader2 } from 'lucide-vue-next'
import { useEmailSender } from '@/composables/useEmailSender'
import { loadBillingConfig, renderBillingHtml, getDocMeta } from '@/composables/useBillingPDF'
import { generateOrGetPdf } from '@/composables/usePdfApiService'
import { getExcelBuffer } from '@/composables/useBillingExcel'
import { useUIStore } from '@/stores/ui'
import EmailSendingOverlay from './EmailSendingOverlay.vue'

const props = defineProps({
  show: Boolean,
  row: Object,
  templateKey: {
    type: String,
    default: 'quotation',
  },
})
const emit = defineEmits(['close'])

const ui = useUIStore()
const { sending, loadEmailConfig, renderTemplate, sendEmail } = useEmailSender()

function sanitizeHtml(html) {
  if (!html) return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, 'blocked:')
}

const configLoaded  = ref(false)
const emailConfig   = ref(null)
const billingConfig = ref(null)

const overlay = ref({ show: false, step: '', success: false, error: '' })

const form = ref({
  to:          '',
  cc:          '',
  subject:     '',
  attachPdf:   true,
  attachExcel: true,
})

const DOC_LABEL_MAP = {
  quotation:     'Quotation',
  proforma:      'Proforma Invoice',
  taxInvoice:    'Tax Invoice',
  purchaseOrder: 'Purchase Order',
  invoice:       'Invoice',
}

const docLabel = computed(() => {
  const row   = props.row
  const label = DOC_LABEL_MAP[props.templateKey] || props.templateKey
  return row ? `${label} — ${row.docNumber || ''}` : label
})

const renderedTemplate = computed(() => {
  if (!emailConfig.value?.template || !props.row) {
    return '<p style="color:#64748b;font-size:12px;padding:12px;">No email template configured.</p>'
  }
  const company = billingConfig.value?.company || {}
  const row     = props.row
  const docMeta = getDocMeta ? getDocMeta(row, props.templateKey) : null

  let date = ''
  if (row.date) {
    try {
      const d = row.date?.toDate ? row.date.toDate() : new Date(row.date)
      date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {}
  }

  const formatCurrency = (v) => (v || v === 0 ? '₹' + Number(v).toLocaleString('en-IN') : '')

  return renderTemplate(emailConfig.value.template, {
    row,
    company,
    docMeta: {
      number: row.docNumber || '',
      date,
      total: formatCurrency(row.total),
    },
  })
})

async function init() {
  if (!props.show || !props.row) return
  configLoaded.value = false

  try {
    const [ec, bc] = await Promise.all([loadEmailConfig(), loadBillingConfig()])
    emailConfig.value   = ec
    billingConfig.value = bc

    const row     = props.row
    const company = bc?.company || {}
    form.value.to          = row.clientEmail || ''
    form.value.cc          = ''
    form.value.subject     = `${DOC_LABEL_MAP[props.templateKey] || 'Document'} ${row.docNumber || ''} — ${company.name || 'S.K Elevators'}`
    form.value.attachPdf   = true
    form.value.attachExcel = true
  } catch (e) {
    console.error('[EmailModal] init error', e)
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
  if (!form.value.to)      { ui.error('Recipient email is required.');    return }
  if (!form.value.subject) { ui.error('Subject is required.');            return }
  if (!emailConfig.value)  { ui.error('Email not configured.');           return }

  const ec = emailConfig.value
  if (!ec.smtpUser || !ec.smtpPass) {
    ui.error('SMTP credentials are not configured. Go to Configurations → Email Settings.')
    return
  }

  overlay.value = { show: true, step: 'Starting…', success: false, error: '' }

  try {
    const row         = props.row
    const bc          = billingConfig.value || {}
    const attachments = []

    if (form.value.attachPdf) {
      overlay.value.step = 'Generating PDF…'
      try {
        const html    = renderBillingHtml(row, props.templateKey, bc)
        const { filename } = getDocMeta(row, props.templateKey)
        const pdfUrl  = await generateOrGetPdf(row, props.templateKey, html, filename, bc.updatedAt)
        const pdfRes  = await fetch(pdfUrl)
        if (pdfRes.ok) {
          const b64 = arrayBufferToBase64(await pdfRes.arrayBuffer())
          attachments.push({ filename, content: b64, type: 'application/pdf' })
        }
      } catch (e) {
        console.warn('[EmailModal] PDF generation failed:', e)
      }
    }

    if (form.value.attachExcel) {
      overlay.value.step = 'Generating Excel…'
      try {
        const { buffer, filename } = await getExcelBuffer(row, props.templateKey)
        const b64 = arrayBufferToBase64(buffer)
        attachments.push({ filename, content: b64, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      } catch (e) {
        console.warn('[EmailModal] Excel generation failed:', e)
      }
    }

    overlay.value.step = 'Sending email…'

    await sendEmail({
      emailConfig: ec,
      to:          form.value.to,
      cc:          form.value.cc || undefined,
      subject:     form.value.subject,
      htmlBody:    renderedTemplate.value,
      attachments,
    })

    overlay.value.success = true
    overlay.value.step    = ''
    ui.success('Email sent!')
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
