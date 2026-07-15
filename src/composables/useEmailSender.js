import { ref } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

const MAILER_URL = 'https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1'
const MAILER_API_KEY = 'Ambivare@9822091922'

export function useEmailSender() {
  const sending = ref(false)

  async function loadEmailConfig() {
    const configs = await getAll(Collections.CONFIGURATIONS)
    if (!configs.length) return null
    const ec = configs[0].email || null
    if (ec) ec._company = configs[0].company || null
    return ec
  }

  /**
   * Replace {{client.name}}, {{doc.number}}, {{company.name}}, etc. in an HTML template.
   * The substitution is done client-side before sending, so the Lambda receives
   * fully rendered HTML — no templateData needed.
   */
  function renderTemplate(template, { row, company, docMeta }) {
    if (!template) return ''
    const formatDate = (ts) => {
      if (!ts) return ''
      const d = ts?.toDate ? ts.toDate() : new Date(ts)
      if (isNaN(d.getTime())) return ''
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    const formatCurrency = (v) => (v || v === 0 ? '₹' + Number(v).toLocaleString('en-IN') : '')

    return template
      .replace(/\{\{client\.name\}\}/g,    row.clientName    || '')
      .replace(/\{\{client\.email\}\}/g,   row.clientEmail   || '')
      .replace(/\{\{client\.address\}\}/g, row.clientAddress || '')
      .replace(/\{\{doc\.number\}\}/g,     docMeta?.number   || row.docNumber || '')
      .replace(/\{\{doc\.date\}\}/g,       docMeta?.date     || formatDate(row.date || row.createdAt))
      .replace(/\{\{doc\.total\}\}/g,      docMeta?.total    || formatCurrency(row.total))
      .replace(/\{\{company\.name\}\}/g,   company?.name     || '')
      .replace(/\{\{company\.email\}\}/g,  company?.email    || '')
      .replace(/\{\{company\.phone\}\}/g,  company?.phone    || '')
  }

  /**
   * Send an email via the AWS Lambda Universal SMTP Mailer.
   * The caller is responsible for rendering the HTML template before calling this.
   *
   * @param {object} opts
   *   emailConfig  - config object from CONFIGURATIONS.email (smtpUser, smtpPass, smtpProvider, fromName, fromEmail)
   *   to           - recipient email (string or array)
   *   cc           - optional CC email(s)
   *   subject      - email subject
   *   htmlBody     - fully rendered HTML body string ({{variables}} already substituted)
   *   attachments  - array of { filename, content (base64), type (mime) }
   */
  async function sendEmail({ emailConfig, to, cc, subject, htmlBody, attachments }) {
    sending.value = true
    try {
      const fromEmail = emailConfig.fromEmail || emailConfig.smtpUser || ''
      const fromName  = emailConfig.fromName  || ''
      const from      = fromName ? `${fromName} <${fromEmail}>` : fromEmail

      const mail = { from, to, subject, html: htmlBody }
      if (cc) mail.cc = cc
      if (attachments?.length) {
        mail.attachments = attachments.map(a => ({
          filename:    a.filename,
          content:     a.content,
          encoding:    'base64',
          contentType: a.type || 'application/octet-stream',
        }))
      }

      const payload = {
        credentials: {
          email:    emailConfig.smtpUser,
          password: emailConfig.smtpPass,
        },
        provider: emailConfig.smtpProvider || 'custom',
        mail,
      }

      const res  = await fetch(`${MAILER_URL}/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': MAILER_API_KEY },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`)
      return data
    } finally {
      sending.value = false
    }
  }

  return { sending, loadEmailConfig, renderTemplate, sendEmail }
}

export { MAILER_URL, MAILER_API_KEY }
