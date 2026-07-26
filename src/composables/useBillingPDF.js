import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getLogoDataUri, getSignatureDataUri, getStampDataUri } from '@/utils/pdfLogo'

// ─── Cache ───────────────────────────────────────────────────────────────────

let cachedConfig = null

export function clearBillingPDFCache() {
  cachedConfig = null
}

// Exported aliases used by PDFDownloadButton (API-based generation)
export async function loadBillingConfig() { return loadConfig() }
export function renderBillingHtml(row, templateKey, config) { return renderTemplate(row, templateKey, config) }

/**
 * Renders a quotation HTML immediately followed by BOM HTML (page-break separated).
 * The combined HTML is sent as a single string to the PDF API.
 */
export function renderQuotationWithBomHtml(quotationRow, bomRow, config) {
  const quotHtml = renderTemplate(quotationRow, 'quotation', config)
  const bomHtml  = renderTemplate(bomRow, 'bom', config)

  // Strip <!DOCTYPE...><html...><head>...</head><body> wrappers so we can combine
  function extractBody(html) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    return bodyMatch ? bodyMatch[1] : html
  }
  function extractHeadStyles(html) {
    const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    return styleMatches.map(m => `<style>${m[1]}</style>`).join('\n')
  }

  const isFullQuot = /<!DOCTYPE/i.test(quotHtml) || /<html/i.test(quotHtml)
  const isFullBom  = /<!DOCTYPE/i.test(bomHtml)  || /<html/i.test(bomHtml)

  const quotStyles = extractHeadStyles(isFullQuot ? quotHtml : '')
  const bomStyles  = extractHeadStyles(isFullBom  ? bomHtml  : '')
  const quotBody   = isFullQuot ? extractBody(quotHtml) : quotHtml
  const bomBody    = isFullBom  ? extractBody(bomHtml)  : bomHtml

  if (!isFullQuot && !isFullBom) {
    return `${quotHtml}<div style="page-break-before:always;break-before:page;display:block;"></div>${bomHtml}`
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
${quotStyles}
${bomStyles}
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0 !important; padding: 0 !important; }
  .pdf-page {
    width: 210mm;
    min-height: 297mm;
    page-break-after: always;
    break-after: page;
    /* No padding — each template manages its own internal layout */
  }
  .pdf-page:last-of-type {
    page-break-after: avoid;
    break-after: avoid;
  }
  @media print {
    .pdf-page { page-break-after: always; }
    .pdf-page:last-of-type { page-break-after: avoid; }
  }
</style>
</head>
<body>
<div class="pdf-page">${quotBody}</div>
<div class="pdf-page">${bomBody}</div>
</body>
</html>`
}

function tsMs(ts) {
  if (!ts) return 0
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).getTime()
  return 0
}

async function loadConfig() {
  if (cachedConfig) return cachedConfig
  const [signatureUrl, stampUrl] = await Promise.all([getSignatureDataUri(), getStampDataUri()])
  try {
    const configs = await getAll(Collections.CONFIGURATIONS)
    if (configs.length) {
      // Always use the most recently saved config doc to handle duplicate docs gracefully
      const latest = configs.sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt))[0]
      const logoFallback = latest.company?.logoUrl || await getLogoDataUri()
      cachedConfig = { ...latest, company: { ...(latest.company || {}), logoUrl: logoFallback, signatureUrl, stampUrl } }
      return cachedConfig
    }
  } catch (e) {
    console.error('[BillingPDF] Failed to load config:', e)
  }
  const logoFallback = await getLogoDataUri()
  return { company: { logoUrl: logoFallback, signatureUrl, stampUrl } }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TITLE_MAP = {
  quotation: 'QUOTATION',
  proforma: 'PROFORMA INVOICE',
  invoice: 'INVOICE',
  taxInvoice: 'TAX INVOICE',
  purchaseOrder: 'PURCHASE ORDER',
  bom: 'BILL OF MATERIALS',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// All amounts use "Rs." — no rupee symbol so any font works
function fc(v) {
  if (!v && v !== 0) return '—'
  return 'Rs. ' + Number(v).toLocaleString('en-IN')
}

// Indian currency number to words
export function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function two(n) { return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') }
  function three(n) { return n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n) }
  const n = Math.round(amount)
  if (!n) return 'Zero Rupees Only'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thou = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  let w = ''
  if (crore) w += three(crore) + ' Crore '
  if (lakh) w += two(lakh) + ' Lakh '
  if (thou) w += two(thou) + ' Thousand '
  if (rest) w += three(rest)
  return 'Rupees ' + w.trim() + ' Only'
}

function getBOMTotal(row) {
  return (row.items || []).reduce((s, i) => s + (i.qty || 0) * (i.unitCost || 0), 0)
}

export function getDocMeta(row, templateKey) {
  const docTitle = DOC_TITLE_MAP[templateKey] || 'DOCUMENT'
  const docNumber = templateKey === 'bom' ? (row.bomNumber || 'BOM') : (row.docNumber || 'DOC')
  const filename = `${docNumber}-${docTitle.replace(/\s+/g, '-')}.pdf`
  return { docTitle, docNumber, filename }
}

// Load a logo URL as a base64 data-URL (for jsPDF addImage)
async function loadLogoDataUrl(logoUrl) {
  if (!logoUrl) return null
  try {
    const resp = await fetch(logoUrl)
    if (!resp.ok) return null
    const buf = await resp.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let b64 = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      b64 += String.fromCharCode(...bytes.slice(i, i + 8192))
    }
    const ext = (logoUrl.split('?')[0].split('.').pop() || '').toLowerCase()
    const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,` + btoa(b64)
  } catch {
    return null
  }
}

// ─── Template rendering (Methods 2 & 3) ──────────────────────────────────────

// Build <tr> rows for template {{items}} placeholder
function buildItemsHtml(row, templateKey) {
  const isBOM = templateKey === 'bom'

  if (isBOM) {
    const items = row.items || []
    if (!items.length) return '<tr><td colspan="8" style="text-align:center;padding:12px;color:#888;">No items</td></tr>'
    return items.map((item, i) => {
      const total = (item.qty || 0) * (item.unitCost || 0)
      return `<tr>
        <td>${i + 1}</td>
        <td>${item.partName || ''}</td>
        <td>${item.partDescription || ''}</td>
        <td>${item.partNumber || '—'}</td>
        <td style="text-align:center;">${item.qty || 0}</td>
        <td>${item.unit || ''}</td>
        <td style="text-align:right;">${fc(item.unitCost)}</td>
        <td style="text-align:right;">${fc(total)}</td>
      </tr>`
    }).join('')
  }

  const isLines = Array.isArray(row.lines) && row.lines.length
  const items = isLines ? row.lines : (row.items || [])
  if (!items.length) return '<tr><td colspan="6" style="text-align:center;padding:12px;color:#888;">No items</td></tr>'

  return items.map((item, i) => {
    const qty = isLines ? (item.qty || 0) : (item.quantity || 0)
    const rate = isLines ? (item.unitPrice || 0) : (item.rate || 0)
    const isLast = i === items.length - 1

    if (templateKey === 'taxInvoice') {
      // 6 cols: S.No | Description | HSN/SAC | Qty | Rate | Total
      const lastStyle = isLast ? 'border-bottom:2px solid #000;' : ''
      return `<tr class="data-row" style="${lastStyle}">
        <td style="text-align:center;">${i + 1}</td>
        <td>${item.description || ''}</td>
        <td style="text-align:center;">${item.hsnCode || ''}</td>
        <td style="text-align:center;">${qty}</td>
        <td style="text-align:right;">${fc(rate)}</td>
        <td style="text-align:right;">${fc(qty * rate)}</td>
      </tr>`
    }

    if (templateKey === 'invoice') {
      // 5 cols: S.No | Particulars | QTY | Rate | Amount
      const borderBottom = isLast ? '2px solid #000' : '1px solid #000'
      return `<tr>
        <td style="text-align:center;padding:5px;border-bottom:${borderBottom};">${i + 1}</td>
        <td style="padding:5px;border-bottom:${borderBottom};">${item.description || ''}</td>
        <td style="text-align:center;padding:5px;border-bottom:${borderBottom};">${qty}</td>
        <td style="text-align:right;padding:5px;border-bottom:${borderBottom};">${fc(rate)}</td>
        <td style="text-align:right;padding:5px;border-bottom:${borderBottom};">${fc(qty * rate)}</td>
      </tr>`
    }

    // quotation & proforma: 6 cols: Sr.No | Description | Unit Price | Qty | Unit | Total Price
    return `<tr>
      <td style="text-align:center;border:1px solid #000;padding:5px 8px;">${i + 1}</td>
      <td style="border:1px solid #000;padding:5px 8px;">${item.description || ''}</td>
      <td style="text-align:right;border:1px solid #000;padding:5px 8px;">${fc(rate)}</td>
      <td style="text-align:center;border:1px solid #000;padding:5px 8px;">${qty}</td>
      <td style="border:1px solid #000;padding:5px 8px;">${item.unit || ''}</td>
      <td style="text-align:right;border:1px solid #000;padding:5px 8px;">${fc(qty * rate)}</td>
    </tr>`
  }).join('')
}

// Render the configured template (or fallback HTML) with all placeholders replaced
function renderTemplate(row, templateKey, config) {
  const company = config.company || {}
  const storedTemplate = config.templates?.[templateKey] || ''

  const { docNumber } = getDocMeta(row, templateKey)
  const isBOM = templateKey === 'bom'
  const gst = row.gstPercent || 0
  const half = Math.round((row.gstAmount || 0) / 2)
  const docTotal = isBOM ? getBOMTotal(row) : (row.total || 0)
  const lifts = (!isBOM && row.numberOfLifts) ? (Number(row.numberOfLifts) || 1) : 1
  const grandTotal = lifts > 1 ? (Number(row.grandTotal) || docTotal * lifts) : docTotal
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')
  const regAddr = company.regAddress || addr

  const logoImgTag = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="Logo" style="max-height:44px;max-width:130px;object-fit:contain;display:block;">`
    : ''
  const headerImgTag = company.headerUrl
    ? `<img src="${company.headerUrl}" alt="Header" style="width:100%;height:auto;display:block;">`
    : ''

  let templateHtml = storedTemplate.trim() || buildFallbackHtml(row, templateKey, company)

  // ── Auto-migrate stored templates that have hardcoded terms/payment/schedule sections
  // Replaces the static sec-hdr blocks with dynamic placeholders so form data is used.
  if (!templateHtml.includes('{{termsBlock}}') && templateHtml.includes('sec-hdr">Terms')) {
    templateHtml = templateHtml.replace(
      /<div class="sec-hdr">Terms[\s\S]*?(?=<div class="sec-hdr">PAYMENT TERMS|<div class="gap"|<div class="sig-hdr")/,
      '{{termsBlock}}\n\n    '
    )
  }
  if (!templateHtml.includes('{{paymentTermsBlock}}') && templateHtml.includes('sec-hdr">PAYMENT TERMS')) {
    templateHtml = templateHtml.replace(
      /<div class="sec-hdr">PAYMENT TERMS<\/div>[\s\S]*?(?=<div class="sec-hdr">WORK SCHEDULE|<div class="gap"|<div class="sig-hdr")/,
      '{{paymentTermsBlock}}\n\n    '
    )
  }
  if (!templateHtml.includes('{{workScheduleBlock}}') && templateHtml.includes('sec-hdr">WORK SCHEDULE')) {
    templateHtml = templateHtml.replace(
      /<div class="sec-hdr">WORK SCHEDULE<\/div>[\s\S]*?(?=<div class="gap"|<div class="sig-hdr")/,
      '{{workScheduleBlock}}\n\n    '
    )
  }

  // ── Dynamic section blocks (quotation terms / payment / schedule) ─────────────
  const validityStr = row.validUntil ? formatDate(row.validUntil) : '—'

  const termsBlock = (() => {
    const lines = row.termsConditions?.filter(Boolean)
    if (lines?.length) {
      return `<div class="sec-hdr">Terms &amp; Condition</div>` +
        lines.map((l, i) => `<div class="sec-row">${i + 1}.&nbsp;&nbsp;${l}</div>`).join('')
    }
    return `<div class="sec-hdr">Terms &amp; Condition</div>
<div class="sec-row">1.&nbsp;&nbsp;Procuring of working License from PWD Department is must. For PWD License, All documents provided by client &amp; necessary miscellaneous expenses Rs.30,000/- per Lift Extra</div>
<div class="sec-row">2.&nbsp;&nbsp;Validity of this offer : ${validityStr}</div>
<div class="sec-row">3.&nbsp;&nbsp;This quotation is based on the cost of materials and spares ruling on the date of quotation and subject to revision on any change in cost.</div>
<div class="sec-row">4.&nbsp;&nbsp;Any additional work not included in the quotation, if found necessary at the time of actual execution, will be intimated to the owner about extra charges.</div>
<div class="sec-row">Warranty: 5 Years Warranty for any/all the items will be only given if the items are provided by us (except V3F Unit — 1 year warranty) if the AMC contract is given to us for the next 5 years.</div>
${row.freeAmc ? '<div class="sec-row">Free AMC: 1 Year</div>' : ''}`
  })()

  const paymentTermsBlock = (() => {
    const lines = row.paymentTerms?.filter(Boolean)
    if (lines?.length) {
      return `<div class="sec-hdr">PAYMENT TERMS</div>` +
        lines.map((l, i) => `<div class="sec-row">${i + 1}.&nbsp;&nbsp;${l}</div>`).join('')
    }
    return `<div class="sec-hdr">PAYMENT TERMS</div>
<div class="sec-row">1.&nbsp;&nbsp;50% Advance at the time of Acceptance of this Quotation</div>
<div class="sec-row">2.&nbsp;&nbsp;35% On intimation of materials ready to Dispatch (within 10-15 days from advance payment)</div>
<div class="sec-row">3.&nbsp;&nbsp;15% On Completion of work</div>`
  })()

  const workScheduleBlock = (() => {
    const lines = row.workSchedule?.filter(Boolean)
    if (lines?.length) {
      return `<div class="sec-hdr">WORK SCHEDULE</div>` +
        lines.map((l, i) => `<div class="sec-row">${i + 1}.&nbsp;&nbsp;${l}</div>`).join('')
    }
    return `<div class="sec-hdr">WORK SCHEDULE</div>
<div class="sec-row">1.&nbsp;&nbsp;Materials will reach at site within 15 to 20 working days from the clearance of Advance Payment</div>
<div class="sec-row">2.&nbsp;&nbsp;Work will be completed within 15 to 20 working days from the date of all the Materials reached at site</div>`
  })()

  let html = templateHtml
    // Company
    .replace(/\{\{company\.logo\}\}/g, logoImgTag)
    .replace(/\{\{company\.headerImg\}\}/g, headerImgTag)
    .replace(/\{\{company\.name\}\}/g, company.name || '')
    .replace(/\{\{company\.tagline\}\}/g, company.tagline || '')
    .replace(/\{\{company\.address\}\}/g, addr)
    .replace(/\{\{company\.regAddress\}\}/g, regAddr)
    .replace(/\{\{company\.city\}\}/g, company.city || '')
    .replace(/\{\{company\.state\}\}/g, company.state || '')
    .replace(/\{\{company\.pincode\}\}/g, company.pincode || '')
    .replace(/\{\{company\.gst\}\}/g, company.gst || '')
    .replace(/\{\{company\.pan\}\}/g, company.pan || '')
    .replace(/\{\{company\.cin\}\}/g, company.cin || '')
    .replace(/\{\{company\.phone\}\}/g, company.phone || '')
    .replace(/\{\{company\.email\}\}/g, company.email || '')
    .replace(/\{\{company\.website\}\}/g, company.website || '')
    .replace(/\{\{company\.bankName\}\}/g, '')
    .replace(/\{\{company\.bankBranch\}\}/g, '')
    .replace(/\{\{company\.accountNo\}\}/g, '')
    .replace(/\{\{company\.ifsc\}\}/g, '')
    // Document
    .replace(/\{\{document\.number\}\}/g, docNumber)
    .replace(/\{\{document\.date\}\}/g, formatDate(row.date || row.createdAt))
    .replace(/\{\{document\.dueDate\}\}/g, row.dueDate ? formatDate(row.dueDate) : '—')
    .replace(/\{\{document\.validity\}\}/g, row.validUntil ? formatDate(row.validUntil) : '—')
    .replace(/\{\{document\.contractNo\}\}/g, row.contractNo || '')
    .replace(/\{\{document\.refNo\}\}/g, row.refNo || row.sourceQuotation || '')
    .replace(/\{\{document\.refDate\}\}/g, row.refDate ? formatDate(row.refDate) : '—')
    // Client
    .replace(/\{\{client\.name\}\}/g, row.clientName || '')
    .replace(/\{\{client\.societyName\}\}/g, row.projectName || row.clientSocietyName || '')
    .replace(/\{\{client\.email\}\}/g, row.clientEmail || '')
    .replace(/\{\{client\.address\}\}/g, row.clientAddress || '')
    .replace(/\{\{client\.gst\}\}/g, row.clientGST || '')
    .replace(/\{\{client\.state\}\}/g, row.clientState || '')
    .replace(/\{\{client\.gstCode\}\}/g, row.clientGSTCode || '')
    .replace(/\{\{client\.siteAddress\}\}/g, row.siteAddress || '')
    .replace(/\{\{client\.contactPerson\}\}/g, row.contactPerson || '')
    .replace(/\{\{client\.phone\}\}/g, row.clientPhone || '')
    .replace(/\{\{client\.contactPerson2\}\}/g, row.contactPerson2 || '')
    .replace(/\{\{client\.phone2\}\}/g, row.clientPhone2 || '')
    // Project
    .replace(/\{\{project\.name\}\}/g, row.projectName || '')
    // Items
    .replace(/\{\{items\}\}/g, buildItemsHtml(row, templateKey))
    // Lift info
    .replace(/\{\{numberOfLifts\}\}/g, String(row.numberOfLifts || 1))
    .replace(/\{\{liftDescription\}\}/g, row.liftDescription || '')
    // Discount
    .replace(/\{\{discountAmount\}\}/g, (row.discountEnabled && row.discountAmount) ? fc(row.discountAmount) : 'Rs. 0')
    .replace(/\{\{discountedSubtotal\}\}/g, fc(row.discountedSubtotal || row.subtotal || 0))
    // Amounts — always "Rs." never ₹
    .replace(/\{\{subtotal\}\}/g, fc(row.subtotal))
    .replace(/\{\{cgst\}\}/g, fc(half))
    .replace(/\{\{sgst\}\}/g, fc(half))
    .replace(/\{\{gst\}\}/g, `${gst}%`)
    .replace(/\{\{gstHalf\}\}/g, String(gst / 2))
    .replace(/\{\{gstAmount\}\}/g, fc(row.gstAmount || 0))
    .replace(/\{\{total\}\}/g, fc(grandTotal))
    .replace(/\{\{perLiftTotal\}\}/g, fc(docTotal))
    .replace(/\{\{grandTotal\}\}/g, fc(grandTotal))
    .replace(/\{\{amountInWords\}\}/g, numberToWords(grandTotal))
    .replace(/\{\{grandTotalInWords\}\}/g, numberToWords(grandTotal))
    .replace(/\{\{notes\}\}/g, row.notes || '')
    // Dynamic section blocks (quotation-specific)
    .replace(/\{\{termsBlock\}\}/g, termsBlock)
    .replace(/\{\{paymentTermsBlock\}\}/g, paymentTermsBlock)
    .replace(/\{\{workScheduleBlock\}\}/g, workScheduleBlock)
    // Misc
    .replace(/\{\{terms\}\}/g, 'Payment within 30 days of invoice date.')
    .replace(/\{\{prepared_by\}\}/g, '')
    .replace(/\{\{approved_by\}\}/g, '')
    // Strip any leftover ₹ symbols — replace with Rs.
    .replace(/₹/g, 'Rs.')

  return html
}

// ─── Fallback HTML (when no template is configured) ───────────────────────────

// Quotation & Proforma — bordered A4 "bill invoice" letterhead format
function buildQuotationStyleHtml(row, templateKey, company) {
  const { docTitle, docNumber } = getDocMeta(row, templateKey)
  const docTotal = row.total || 0
  const lifts = row.numberOfLifts ? (Number(row.numberOfLifts) || 1) : 1
  const grandTotal = lifts > 1 ? (Number(row.grandTotal) || docTotal * lifts) : docTotal
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; }
  .doc-page { width: 210mm; min-height: 297mm; padding: 12mm 14mm; }
  .box { border: 1.5px solid #000; }
  .co-hdr { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px 2px; }
  .co-hdr-left { display: flex; align-items: center; gap: 12px; }
  .co-hdr img { height: 40px; width: 40px; object-fit: contain; flex-shrink: 0; }
  .co-name { font-size: 25px; font-weight: 800; color: #1d4ed8; }
  .co-contact { text-align: right; font-size: 10px; font-weight: 700; color: #c2410c; line-height: 1.5; }
  .title-bar { text-align: center; font-weight: 700; font-size: 14px; padding: 5px; border-top: 1px solid #000; letter-spacing: .5px; }
  .info-grid { display: flex; border-top: 1px solid #000; }
  .info-left, .info-right { flex: 1; padding: 7px 12px; font-size: 12px; line-height: 1.6; }
  .info-right { border-left: 1px solid #000; }
  .meta-row { display: flex; border-top: 1px solid #000; font-size: 12px; font-weight: 700; }
  .meta-cell { flex: 1; padding: 5px 12px; border-left: 1px solid #000; }
  .meta-cell:first-child { border-left: none; }
  .dear { padding: 6px 12px; border-top: 1px solid #000; font-size: 12px; }
  table.items { width: 100%; border-collapse: collapse; border-top: 1px solid #000; }
  table.items th { border: 1px solid #000; padding: 6px 8px; font-size: 11.5px; font-weight: 700; text-align: center; }
  .amount-words { border-top: 1px solid #000; padding: 8px 12px; font-weight: 700; font-size: 12.5px; }
  .footer-sig { display: flex; justify-content: space-between; align-items: flex-end; padding: 10px 12px 12px; border-top: 1px solid #000; }
  .footer-sig-left { display: flex; align-items: center; gap: 10px; }
  .footer-sig-left img { height: 32px; object-fit: contain; }
  .footer-sig-name { font-weight: 700; color: #1d4ed8; font-size: 13px; }
  .footer-stamp img { height: 46px; object-fit: contain; opacity: .9; }
  .footer-website { text-align: center; font-size: 10px; padding: 4px 12px 8px; border-top: 1px solid #000; }
  .footer-website a { color: #1d4ed8; text-decoration: none; font-weight: 700; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="doc-page">
  <div class="box">
    <div class="co-hdr">
      <div class="co-hdr-left">
        ${company.logoUrl ? `<img src="${company.logoUrl}" alt="Logo">` : ''}
        <div class="co-name">${company.name || ''}</div>
      </div>
      <div class="co-contact">
        ${addr}<br>
        Mob: ${company.phone || ''} &nbsp;|&nbsp; info@tabelevators.in
      </div>
    </div>
    <div class="title-bar">${docTitle}</div>
    <div class="info-grid">
      <div class="info-left">
        <strong>THE CHAIRMAN / SECRETARY,</strong><br>
        <strong>${row.projectName || row.clientName || ''}</strong><br>
        ${row.clientAddress || ''}
      </div>
      <div class="info-right">
        <strong>${docTitle} NO:</strong> ${docNumber}<br>
        <strong>DATE:</strong> ${formatDate(row.date || row.createdAt)}<br>
        <strong>KIND ATTN.:</strong> ${row.contactPerson || row.clientName || ''}
      </div>
    </div>
    ${(row.liftDescription || lifts) ? `<div class="meta-row">
      <div class="meta-cell">LIFT DESCRIPTION: ${row.liftDescription || '—'}</div>
      <div class="meta-cell">NO. OF LIFTS: ${lifts}</div>
    </div>` : ''}
    <div class="dear">Dear Sir,</div>
    <table class="items">
      <thead><tr>
        <th style="width:36px;">Sr.<br>No.</th>
        <th>Description</th>
        <th style="width:80px;">Unit Price</th>
        <th style="width:44px;">Qty</th>
        <th style="width:56px;">Unit</th>
        <th style="width:90px;">Total Price</th>
      </tr></thead>
      <tbody>${buildItemsHtml(row, templateKey)}</tbody>
      <tfoot>
        <tr><td colspan="5" style="text-align:right;font-weight:700;border:1px solid #000;padding:5px 8px;">TOTAL</td><td style="text-align:right;font-weight:700;border:1px solid #000;padding:5px 8px;">${fc(docTotal)}</td></tr>
        <tr><td colspan="5" style="text-align:right;font-weight:700;border:1px solid #000;padding:5px 8px;">BALANCE TOTAL</td><td style="text-align:right;font-weight:700;border:1px solid #000;padding:5px 8px;">${fc(grandTotal)}</td></tr>
      </tfoot>
    </table>
    <div class="amount-words">${numberToWords(grandTotal).toUpperCase()}</div>
    ${row.notes ? `<div style="padding:8px 12px;border-top:1px solid #000;font-size:11.5px;">${row.notes}</div>` : ''}
    <div class="footer-sig">
      <div class="footer-sig-left">
        ${company.signatureUrl ? `<img src="${company.signatureUrl}" alt="Signature">` : ''}
        <div class="footer-sig-name">${company.name || ''}</div>
      </div>
      <div class="footer-stamp">${company.stampUrl ? `<img src="${company.stampUrl}" alt="Stamp">` : ''}</div>
    </div>
    <div class="footer-website"><a href="https://www.tabelevators.in">www.tabelevators.in</a></div>
  </div>
</div>
</body>
</html>`
}

function buildFallbackHtml(row, templateKey, company) {
  if (templateKey === 'quotation' || templateKey === 'proforma') {
    return buildQuotationStyleHtml(row, templateKey, company)
  }

  const { docTitle, docNumber } = getDocMeta(row, templateKey)
  const isBOM = templateKey === 'bom'
  const gst = row.gstPercent || 0
  const half = Math.round((row.gstAmount || 0) / 2)
  const docTotal = isBOM ? getBOMTotal(row) : (row.total || 0)
  const fbLifts = (!isBOM && row.numberOfLifts) ? (Number(row.numberOfLifts) || 1) : 1
  const fbGrandTotal = fbLifts > 1 ? (Number(row.grandTotal) || docTotal * fbLifts) : docTotal
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')

  const itemCols = isBOM
    ? `<th>#</th><th>Part Name</th><th>Description</th><th>Part No.</th><th style="text-align:center;">Qty</th><th>Unit</th><th style="text-align:right;">Unit Cost</th><th style="text-align:right;">Total</th>`
    : `<th>#</th><th>Description</th><th style="text-align:center;">Qty</th><th>Unit</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th>`

  const hasDiscount = !isBOM && row.discountEnabled && (row.discountAmount || 0) > 0
  const discountedSub = row.discountedSubtotal || row.subtotal || 0

  const totalsHtml = isBOM ? `
    <tr class="grand-total"><td>TOTAL</td><td style="text-align:right;">${fc(docTotal)}</td></tr>` : `
    <tr><td>Subtotal</td><td style="text-align:right;">${fc(row.subtotal)}</td></tr>
    ${hasDiscount ? `<tr><td style="color:#b45309;">Discount${row.discountType === 'percent' ? ` (${row.discountValue}%)` : ''}</td><td style="text-align:right;color:#b45309;">− ${fc(row.discountAmount)}</td></tr>
    <tr><td>After Discount</td><td style="text-align:right;">${fc(discountedSub)}</td></tr>` : ''}
    <tr><td>CGST (${gst / 2}%)</td><td style="text-align:right;">${fc(half)}</td></tr>
    <tr><td>SGST (${gst / 2}%)</td><td style="text-align:right;">${fc(half)}</td></tr>
    ${fbLifts > 1 ? `<tr><td style="color:#64748b;font-style:italic;">Per Lift Total</td><td style="text-align:right;color:#64748b;">${fc(docTotal)}</td></tr>
    <tr><td colspan="2" style="text-align:right;color:#64748b;font-style:italic;">× ${fbLifts} Lifts</td></tr>` : ''}
    <tr class="grand-total"><td>GRAND TOTAL</td><td style="text-align:right;">${fc(fbGrandTotal)}</td></tr>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; }
  .doc-page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; }
  .doc-body { flex: 1; padding: 14px 20mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #dc2626; padding-bottom: 14px; margin-bottom: 20px; }
  .company-name { font-size: 20px; font-weight: 700; color: #b91c1c; margin-top: 8px; }
  .company-info { font-size: 11px; color: #64748b; margin-top: 3px; }
  .doc-title { font-size: 26px; font-weight: 700; color: #dc2626; text-align: right; }
  .doc-meta { font-size: 12px; color: #64748b; text-align: right; margin-top: 3px; }
  .bill-box { padding: 12px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; margin-bottom: 20px; display: inline-block; min-width: 260px; }
  .bill-label { font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: 600; margin-bottom: 4px; letter-spacing: .05em; }
  .bill-name { font-size: 14px; font-weight: 700; }
  .bill-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #dc2626; color: #fff; padding: 8px 10px; font-size: 11px; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  tr:nth-child(even) td { background: #fff5f5; }
  .totals { width: 260px; margin-left: auto; border-collapse: collapse; }
  .totals td { padding: 5px 10px; border-bottom: 1px solid #fecaca; }
  .grand-total td { background: #dc2626; color: #fff; font-weight: 700; font-size: 14px; }
  .notes { margin-top: 12px; padding: 10px 14px; background: #fef2f2; border-radius: 6px; font-size: 12px; color: #64748b; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #fecaca; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #94a3b8; }
  .footer-left { display: flex; align-items: center; gap: 10px; }
  .footer-left img.sig { height: 30px; object-fit: contain; }
  .footer-stamp img { height: 42px; object-fit: contain; opacity: .9; }
  .footer-website { text-align: center; font-size: 10px; margin-top: 10px; }
  .footer-website a { color: #dc2626; text-decoration: none; font-weight: 700; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="doc-page">
<div class="doc-body">
<div class="header">
  <div>
    ${company.logoUrl ? '<img src="' + company.logoUrl + '" alt="" style="max-height:44px;max-width:130px;object-fit:contain;display:block;">' : ''}
    <div class="company-name">${company.name || ''}</div>
    ${company.gst ? `<div class="company-info">GST: ${company.gst}</div>` : ''}
  </div>
  <div style="text-align:right;">
    <div class="company-info">${addr}</div>
    <div class="company-info">Mob: ${company.phone || ''} | info@tabelevators.in</div>
    <div class="doc-title">${docTitle}</div>
    <div class="doc-meta">No: ${docNumber}</div>
    <div class="doc-meta">Date: ${formatDate(row.date || row.createdAt)}</div>
    ${row.dueDate ? `<div class="doc-meta">Due: ${formatDate(row.dueDate)}</div>` : ''}
  </div>
</div>
<div class="bill-box">
  <div class="bill-label">Bill To</div>
  <div class="bill-name">${row.clientName || ''}</div>
  ${row.clientAddress ? `<div class="bill-sub">${row.clientAddress}</div>` : ''}
  ${row.clientGST ? `<div class="bill-sub">GST: ${row.clientGST}</div>` : ''}
</div>
${!isBOM && (row.numberOfLifts || row.liftDescription) ? `<div style="display:flex;gap:16px;margin-bottom:14px;padding:10px 14px;background:#fff5f5;border:1px solid #fecaca;border-radius:6px;align-items:center;">
  ${row.numberOfLifts ? `<div><span style="font-size:10px;text-transform:uppercase;color:#9ca3af;font-weight:600;letter-spacing:.05em;display:block;">Number of Lifts</span><span style="font-size:18px;font-weight:700;color:#dc2626;">${row.numberOfLifts}</span></div>` : ''}
  ${row.liftDescription ? `<div style="border-left:1px solid #fecaca;padding-left:16px;"><span style="font-size:10px;text-transform:uppercase;color:#9ca3af;font-weight:600;letter-spacing:.05em;display:block;">Lift Description</span><span style="font-size:13px;font-weight:600;color:#1e293b;">${row.liftDescription}</span></div>` : ''}
</div>` : ''}
<table>
  <thead><tr>${itemCols}</tr></thead>
  <tbody>${buildItemsHtml(row, templateKey)}</tbody>
</table>
<table class="totals">${totalsHtml}</table>
${row.notes ? `<div class="notes"><strong>Notes:</strong> ${row.notes}</div>` : ''}
<div class="footer">
  <div class="footer-left">
    ${company.signatureUrl ? `<img class="sig" src="${company.signatureUrl}" alt="Signature">` : ''}
    <div>For ${company.name || ''}<br><span style="border-top:1px solid #dc2626;padding-top:4px;display:inline-block;">Authorised Signatory</span></div>
  </div>
  <div class="footer-stamp">${company.stampUrl ? `<img src="${company.stampUrl}" alt="Stamp">` : ''}</div>
</div>
<div class="footer-website"><a href="https://www.tabelevators.in">www.tabelevators.in</a></div>
</div>
</div>
</body>
</html>`
}

// ─── Method 1: jsPDF programmatic — Red themed, one-page ─────────────────────

export async function downloadMethod1(row, templateKey) {
  const config = await loadConfig()
  const company = config.company || {}
  const { docTitle, docNumber, filename } = getDocMeta(row, templateKey)
  const isBOM = templateKey === 'bom'
  const isLines = Array.isArray(row.lines) && row.lines.length
  const items = isBOM ? (row.items || []) : (isLines ? row.lines : (row.items || []))
  const docTotal = isBOM ? getBOMTotal(row) : (row.total || 0)
  const gst = row.gstPercent || 0
  const half = Math.round((row.gstAmount || 0) / 2)
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')

  // Red theme
  const RED   = [220, 38, 38]   // #dc2626
  const DKRED = [185, 28, 28]   // #b91c1c
  const LTRED = [254, 226, 226] // #fee2e2
  const DARK  = [30, 41, 59]    // #1e293b
  const GREY  = [100, 116, 139] // #64748b

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW = 180 // printable width (210 - 15*2)
  const ML = 15  // left margin
  const MR = 195 // right margin x

  // ── Logo ────────────────────────────────────────────────────────────────────
  const logoData = await loadLogoDataUrl(company.logoUrl)
  const logoFormat = logoData?.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
  let headerTop = 18
  if (logoData) {
    try {
      doc.addImage(logoData, logoFormat, ML, 12, 30, 14, '', 'FAST')
      headerTop = 12
    } catch {}
  }

  // ── Company info (left) ──────────────────────────────────────────────────────
  const companyTop = logoData ? 28 : headerTop
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...DKRED)
  doc.text(company.name || '', ML, companyTop)

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY)
  let cy = companyTop + 5
  if (addr) { doc.text(addr, ML, cy); cy += 4 }
  if (company.phone || company.email) {
    doc.text([company.phone, company.email].filter(Boolean).join('  |  '), ML, cy); cy += 4
  }
  if (company.gst) { doc.text('GST: ' + company.gst, ML, cy) }

  // ── Document title + meta (right) ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...RED)
  doc.text(docTitle, MR, headerTop + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...DARK)
  doc.text('#' + docNumber, MR, headerTop + 10, { align: 'right' })
  doc.setTextColor(...GREY)
  doc.text('Date: ' + formatDate(row.date || row.createdAt), MR, headerTop + 15, { align: 'right' })
  if (row.dueDate) doc.text('Due: ' + formatDate(row.dueDate), MR, headerTop + 20, { align: 'right' })

  // ── Red divider ───────────────────────────────────────────────────────────────
  const dividerY = Math.max(companyTop + 16, headerTop + 25)
  doc.setDrawColor(...RED).setLineWidth(0.6).line(ML, dividerY, MR, dividerY)

  // ── Client info box ───────────────────────────────────────────────────────────
  const clientY = dividerY + 4
  doc.setFillColor(...LTRED).roundedRect(ML, clientY, 90, 20, 2, 2, 'F')
  doc.setDrawColor(...RED).setLineWidth(0.2).roundedRect(ML, clientY, 90, 20, 2, 2, 'S')
  doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...GREY)
  doc.text('BILL TO', ML + 4, clientY + 5)
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...DARK)
  doc.text((row.clientName || '').substring(0, 42), ML + 4, clientY + 10)
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY)
  if (row.clientAddress) doc.text(row.clientAddress.substring(0, 55), ML + 4, clientY + 15)
  if (row.clientGST) doc.text('GST: ' + row.clientGST, ML + 4, clientY + 19)

  // ── Items table ───────────────────────────────────────────────────────────────
  const tableStartY = clientY + 24

  let head, body
  if (isBOM) {
    head = [['#', 'Part Name', 'Description', 'Part No.', 'Qty', 'Unit', 'Unit Cost', 'Total']]
    body = items.map((item, i) => [
      i + 1,
      item.partName || '',
      item.partDescription || '',
      item.partNumber || '—',
      item.qty || 0,
      item.unit || '',
      fc(item.unitCost),
      fc((item.qty || 0) * (item.unitCost || 0)),
    ])
  } else {
    const lifts = row.numberOfLifts || 1
    head = [['#', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']]
    body = items.map((item, i) => {
      const qty  = isLines ? (item.qty || 0) : (item.quantity || 0)
      const rate = isLines ? (item.unitPrice || 0) : (item.rate || 0)
      const uom  = lifts > 1 ? `${lifts} Nos` : (item.unit || '')
      return [i + 1, item.description || '', qty, uom, fc(rate), fc(qty * rate * lifts)]
    })
  }

  // Scale rows to keep everything on one page
  const availableForTable = 267 - (tableStartY - 15) - 30 // 30mm reserved for totals
  const rowH = Math.max(5, Math.min(8, availableForTable / (body.length + 1)))
  const fontSize = rowH <= 5.5 ? 7 : 8.5

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    headStyles: {
      fillColor: RED,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize,
      textColor: DARK,
      cellPadding: { top: rowH <= 5.5 ? 1.5 : 2.5, bottom: rowH <= 5.5 ? 1.5 : 2.5, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: [255, 249, 249] },
    margin: { left: ML, right: ML },
    tableLineColor: [254, 202, 202],
    tableLineWidth: 0.1,
    columnStyles: isBOM
      ? { 4: { halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
      : { 2: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    didParseCell(data) {
      if (data.section === 'body' && (data.column.index === 1 || (isBOM && data.column.index === 2))) {
        data.cell.styles.minCellWidth = isBOM ? 30 : 50
      }
    },
  })

  // ── Totals ────────────────────────────────────────────────────────────────────
  const fy = doc.lastAutoTable.finalY + 5
  const totX = 130

  doc.setDrawColor(...RED).setLineWidth(0.2).line(totX, fy - 1, MR, fy - 1)

  if (!isBOM) {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GREY)
    doc.text('Subtotal:', totX, fy + 4)
    doc.text(fc(row.subtotal), MR, fy + 4, { align: 'right' })
    doc.text('CGST (' + (gst / 2) + ')%:', totX, fy + 9)
    doc.text(fc(half), MR, fy + 9, { align: 'right' })
    doc.text('SGST (' + (gst / 2) + ')%:', totX, fy + 14)
    doc.text(fc(half), MR, fy + 14, { align: 'right' })
    doc.setDrawColor(...RED).setLineWidth(0.3).line(totX, fy + 16, MR, fy + 16)
    // Grand total highlight
    doc.setFillColor(...RED).rect(totX - 2, fy + 18, MR - totX + 4, 9, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(255, 255, 255)
    doc.text('TOTAL', totX + 1, fy + 24)
    doc.text(fc(docTotal), MR - 1, fy + 24, { align: 'right' })
  } else {
    doc.setFillColor(...RED).rect(totX - 2, fy + 1, MR - totX + 4, 9, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(255, 255, 255)
    doc.text('TOTAL', totX + 1, fy + 7)
    doc.text(fc(docTotal), MR - 1, fy + 7, { align: 'right' })
  }

  // ── Notes ─────────────────────────────────────────────────────────────────────
  if (row.notes) {
    const noteY = isBOM ? fy + 18 : fy + 34
    doc.setFillColor(...LTRED).roundedRect(ML, noteY, PW, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...GREY)
    doc.text('Notes:', ML + 3, noteY + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(row.notes, PW - 20)[0], ML + 18, noteY + 5)
  }

  // ── Footer bar ────────────────────────────────────────────────────────────────
  doc.setFillColor(...RED).rect(ML, 280, PW, 5, 'F')
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(255, 255, 255)
  doc.text(company.name || '', ML + 2, 283.5)
  if (company.website) doc.text(company.website, MR, 283.5, { align: 'right' })

  const { savePDF } = await import('@/utils/saveFile')
  await savePDF(doc, filename, undefined)
}

// ─── Method 2: Configured template → window.print() ──────────────────────────

export async function downloadMethod2(row, templateKey) {
  const config = await loadConfig()
  const { filename } = getDocMeta(row, templateKey)
  const html = renderTemplate(row, templateKey, config)

  const win = window.open('', '_blank')
  if (!win) throw new Error('Popup blocked — please allow popups and try again.')

  // If template is a full document, write it directly; otherwise wrap it
  const isFullDoc = /<!DOCTYPE/i.test(html) || /<html/i.test(html)
  const content = isFullDoc ? html : `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${filename}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; }
  @media print {
    @page { size: A4; margin: 15mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>${html}</body>
</html>`

  win.document.open()
  win.document.write(content)
  win.document.close()
  win.focus()
  await new Promise(r => setTimeout(r, 700))
  win.print()
}

// ─── Method 3: Configured template → isolated iframe → html2canvas → jsPDF ───

export async function downloadMethod3(row, templateKey) {
  const config = await loadConfig()
  const { filename } = getDocMeta(row, templateKey)
  const html = renderTemplate(row, templateKey, config)

  const isFullDoc = /<!DOCTYPE/i.test(html) || /<html/i.test(html)
  const fullDoc = isFullDoc ? html : `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; width: 794px; }
  @page { size: A4; margin: 15mm; }
</style>
</head>
<body>${html}</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1px;border:none;visibility:hidden;'
  document.body.appendChild(iframe)

  try {
    iframe.contentDocument.open()
    iframe.contentDocument.write(fullDoc)
    iframe.contentDocument.close()

    // Wait for all images (logo) to load
    await new Promise(r => setTimeout(r, 1000))

    const html2pdf = (await import('html2pdf.js')).default
    await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794,
          logging: false,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(iframe.contentDocument.body)
      .save()
  } finally {
    document.body.removeChild(iframe)
  }
}
