// Hardcoded "Installation Proposal" PDF template — based on the reference
// ERRECTION_O_FORMAT.docx. Only a small set of fields are editable per proposal
// (remarks, elevator specification/pricing, GST toggle, client-scope Yes/No +
// remarks, payment-split percentages); everything else here is fixed copy.
//
// Rendered via the external PDF-converter Lambda (usePdfApiService.convertHtmlToPdf),
// using actual header.jpg / footer.jpg images (not a CSS-built header) per page.

import { numberToWords } from '@/composables/useBillingPDF'

export const LIFT_SPEC_ITEMS = [
  { label: 'Type', spec: 'Manual Passenger Lift' },
  { label: 'Load', spec: '4 Passenger – 408 Kg' },
  { label: 'Speed', spec: 'Variable Speed – V3F Drive' },
  { label: 'Micro-Controller', spec: 'Integrated Collective System' },
  { label: 'Power Supply', spec: '415 Volt, 3 Phase, 50 Hz AC' },
  { label: 'Travel', spec: 'G+5' },
  { label: 'Height', spec: '19.5 Meter' },
  { label: 'Stops / Openings', spec: '06 Stops / 06 Openings' },
  { label: 'Stop Details', spec: 'G, 1, 2, 3, 4, 5' },
  { label: 'Machine', spec: 'Geared traction machine placed above hoist way (MRL)' },
  { label: 'Head Room Required', spec: '4200 mm' },
  { label: 'Hoist Way', spec: 'Wide: 1160 mm (approx.) · Deep: 1200 mm' },
  { label: 'Car Size (Internal)', spec: 'Wide: 850 mm · Deep: 900 mm · Height: 2100 mm (approx.)' },
  { label: 'Car Enclosure', spec: 'Powder-coated MS cabin, PVC flooring, decorative fall ceiling with fan & LED light' },
  { label: 'Car Entrance', spec: 'Collapsible Door' },
  { label: 'Car Opening', spec: '700 mm X 2000 mm' },
  { label: 'Hoist Way Entrance', spec: 'Swing Door – 1 Qty, Collapsible Door – 5 Qty' },
  { label: 'Pit Required', spec: '1500 mm' },
  { label: 'Hoist Way Opening', spec: '700 mm X 2000 mm' },
  { label: 'Rope', spec: '13 mm X 3 Nos.' },
]

export const DEFAULT_LIFT_SPEC_REMARKS = LIFT_SPEC_ITEMS.map((_, i) => (i === 4 ? 'By Client' : i === 19 ? 'Usha Martin' : ''))

// Starting template for a new proposal's Lift Specification table — every
// row (label, spec, remarks) is freely editable per-proposal from here on,
// this is only the seed data a fresh form is pre-filled with.
export function DEFAULT_LIFT_SPEC_ITEMS() {
  return LIFT_SPEC_ITEMS.map((it, i) => ({ label: it.label, spec: it.spec, remarks: DEFAULT_LIFT_SPEC_REMARKS[i] || '' }))
}

export const ADDITIONAL_FEATURES = [
  'Up / Down Direction Indicator',
  'Floor Indications',
  'Door Open Voice Announcement',
  'Switch – Fan, Stop, LED Lights & Alarm',
  'Stainless Steel C.O.P & L.O.P',
  'Door Locking System for Each Floor',
  'Manual Rescue Operation System',
  'Over Speed Governor',
  'ARD or UPS',
  'Emergency Light',
]

export const CLIENT_SCOPE_WORK_ITEMS = [
  { label: 'Automatic Rescue Device (ARD)', default: 'No' },
  { label: 'PWD License Fee & Document', default: 'Yes' },
  { label: 'Electrical & Shaft Lighting', default: 'Yes' },
  { label: 'Scaffolding', default: 'Yes' },
  { label: 'Civil Work', default: 'Yes' },
]

export const CLIENT_SCOPE_OF_WORK_DETAILED = [
  'Store to be provided for material on site by you. If a store room is not provided, the client is fully responsible for any theft or misplacement of material.',
  'Scaffolding, civil work / structural work — such as shaft making, frame fixing, grouting, pocket holes, whitewash for the shaft, buffer column & miscellaneous work — to be done by the client.',
  'Three-phase & single-phase electrical cabling in the shaft from meter room to machine room, with necessary switches and light points at the corner of the hoist way on every floor (equidistant), as per the given drawing.',
  'Scaffolding in the shaft to be provided.',
  'Hoisting (load) hook in the machine room ceiling.',
  'Permanent staircase (ladder) must be provided for approach from the final slab at roof level to the machine room.',
  'Smoke window for all elevators to be provided.',
  'For the lift license, the customer needs to provide the entire documentation — owner applications, RCC & architect certificate, approved plan, commencement certificate, and any other document requested by the competent authority. These documents are mandatory for the license process.',
]

export const DEFAULT_ELEVATOR_ITEM = () => ({
  description: 'Manual Passenger Lift (G+5)\nLoad: 408 Kg\nCar: MS Cabin\nCar Door: Collapsible Door\nHoist Door: Collapsible Door\nVVVF Drive\nMicro Controller Down Collective Panel',
  rate: 550000,
  qty: 1,
})

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function nl2br(v) {
  return esc(v).replace(/\n/g, '<br>')
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('en-GB')
}
function fmtMoney(v) {
  return '₹' + Number(v || 0).toLocaleString('en-IN')
}

const CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; }
.page { width:210mm; height:297mm; position:relative; overflow:hidden; page-break-after:always; background:#fff; }
.page:last-child { page-break-after:avoid; }
.ip-header { width:210mm; height:30mm; overflow:hidden; }
.ip-header img { width:100%; display:block; }
.ip-footer { width:210mm; height:18mm; overflow:hidden; position:absolute; bottom:0; left:0; }
.ip-footer img { width:100%; display:block; }
.ip-content { padding:8mm 13mm 4mm; height:249mm; overflow:hidden; font-size:12px; line-height:1.55; }
.ip-title-bar { background:#0f172a; color:#fff; padding:9px 14px; font-size:14px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; border-radius:4px; margin:12px 0 9px; }
.ip-ref-box { border:1.5px solid #0f172a; border-radius:6px; padding:13px 18px; margin:12px 0; }
.ip-ref-box .ref { color:#b8860b; font-size:12.5px; font-weight:700; margin-bottom:5px; }
.ip-ref-box .ttl { font-size:16.5px; font-weight:800; text-align:center; }
table.ip-table { width:100%; border-collapse:collapse; font-size:11.3px; }
table.ip-table th { background:#0f172a; color:#fff; padding:6px 8px; text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.02em; }
table.ip-table td { padding:5.5px 7px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
table.ip-table tr:nth-child(even) td { background:#f8fafc; }
.ip-p { margin-bottom:9px; text-align:justify; }
.ip-list { margin:0 0 9px 20px; }
.ip-list li { margin-bottom:6px; text-align:justify; }
.ip-feat-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px 18px; margin:8px 0 6px; }
.ip-feat-grid div { font-size:11.3px; padding:3px 0; }
.ip-feat-grid div:before { content:'▸ '; color:#b8860b; font-weight:700; }
.ip-total-row td { background:#f59e0b !important; color:#0f172a; font-weight:800; font-size:13px; }
.ip-words { font-style:italic; font-weight:700; margin:10px 0; font-size:13px; }
.ip-note { font-size:11px; color:#7c2d12; font-weight:600; margin-top:5px; }
.ip-sig-row { display:flex; justify-content:space-between; margin-top:24px; }
.ip-sig-row .col { width:45%; }
.ip-sig-row .line { border-top:1.5px solid #0f172a; margin-top:36px; padding-top:6px; font-weight:700; font-size:12px; }
.ip-stamp-img img { width:26mm; margin-bottom:-18px; opacity:.92; }
`

function pageWrap(headerImg, footerImg, contentHtml) {
  return `<div class="page">
    <div class="ip-header">${headerImg ? `<img src="${headerImg}" alt="">` : ''}</div>
    <div class="ip-content">${contentHtml}</div>
    <div class="ip-footer">${footerImg ? `<img src="${footerImg}" alt="">` : ''}</div>
  </div>`
}

export function renderInstallationProposalHtml(row, headerImg, footerImg, stampImg, company) {
  const companyName = esc(company?.name || '')
  // liftSpecItems is the current per-proposal editable table (label, spec, remarks
  // all dynamic). Older saved proposals only have liftSpecRemarks against the
  // fixed LIFT_SPEC_ITEMS list — fall back to pairing them up for those.
  const specItems = row.liftSpecItems?.length
    ? row.liftSpecItems
    : LIFT_SPEC_ITEMS.map((it, i) => ({ label: it.label, spec: it.spec, remarks: (row.liftSpecRemarks || DEFAULT_LIFT_SPEC_REMARKS)[i] || '' }))
  const items = row.items?.length ? row.items : [DEFAULT_ELEVATOR_ITEM()]
  const scope = row.clientScope?.length ? row.clientScope : CLIENT_SCOPE_WORK_ITEMS.map(i => ({ label: i.label, value: i.default, remarks: '' }))
  const pct = row.paymentSplit || { adv: 60, dispatch: 30, completion: 10 }

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0)
  const gstPercent = row.gstEnabled ? (Number(row.gstPercent) || 0) : 0
  const gstAmount = Math.round(subtotal * gstPercent / 100)
  const total = subtotal + gstAmount

  // Page 1 — Cover letter
  const page1 = `
    <div style="text-align:right;font-size:10px;color:#475569;">Date: ${fmtDate(row.date)}</div>
    <div style="margin-top:6px;">To,</div>
    <div style="font-weight:700;font-size:12px;margin-top:2px;">${esc(row.clientName) || '—'}${row.contactPerson ? `, ${esc(row.contactPerson)}` : ''}</div>
    <div style="color:#475569;">${esc(row.clientAddress) || ''}</div>

    <div class="ip-ref-box">
      <div class="ref">PROPOSAL NO: ${esc(row.proposalNo) || '—'}</div>
      <div class="ttl">INSTALLATION PROPOSAL FOR SUPPLY &amp; INSTALLATION OF ELEVATOR${(row.numberOfLifts || 1) > 1 ? 'S' : ''}</div>
    </div>

    <p class="ip-p">Sub: Requirement of passenger lift${(row.numberOfLifts || 1) > 1 ? 's' : ''} for your prestigious project${row.city ? ` at ${esc(row.city)}` : ''}.</p>
    <p class="ip-p">Thank you for the opportunity to provide a proposal for the supply and installation of an elevator at your prestigious project.</p>
    <p class="ip-p">We are pleased to introduce ourselves as one of the leading and dynamic manufacturers of elevators. The company has extensive experience in the maintenance and installation of all types and makes of lifts.</p>
    <p class="ip-p">${companyName} is committed to providing customers with the highest quality maintenance service anywhere in Maharashtra State.</p>
    <p class="ip-p">We offer customers a quality product with the latest technology at an affordable price. We also have a fully-fledged service department, with trained and experienced personnel capable of giving satisfactory after-sales service.</p>
    <p class="ip-p">We thank you once again for the interest shown by you in our company, and look forward to receiving your valued order.</p>
    <p class="ip-p">Thanking You,</p>

    <div class="ip-sig-row">
      <div class="col">
        <div class="line">Proposed By<br>${companyName}</div>
      </div>
    </div>
  `

  // Page 2 — Lift specification + additional features
  const specRows = specItems.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600;">${esc(it.label)}</td>
      <td>${esc(it.spec)}</td>
      <td>${esc(it.remarks || '')}</td>
    </tr>
  `).join('')

  const page2 = `
    <div class="ip-title-bar">Lift Specification</div>
    <table class="ip-table">
      <thead><tr><th style="width:26px;">Sr.</th><th style="width:140px;">Description</th><th>Specification</th><th style="width:100px;">Remarks</th></tr></thead>
      <tbody>${specRows}</tbody>
    </table>

    <div class="ip-title-bar" style="margin-top:12px;">Additional Features</div>
    <div class="ip-feat-grid">
      ${ADDITIONAL_FEATURES.map(f => `<div>${esc(f)}</div>`).join('')}
    </div>
  `

  // Page 3 — Price schedule + client scope work
  const priceRows = items.map((it, i) => {
    const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0)
    return `
    <tr>
      <td>${i + 1}</td>
      <td>${nl2br(it.description)}</td>
      <td style="text-align:right;">${fmtMoney(it.rate)}</td>
      <td style="text-align:right;">${esc(it.qty)}</td>
      <td style="text-align:right;">${fmtMoney(amt)}</td>
    </tr>`
  }).join('')

  const page3 = `
    <div class="ip-title-bar">Price Schedule</div>
    <p class="ip-p">Dear Sir,</p>
    <p class="ip-p">Quotation prices for supply &amp; installation of ${items.length > 1 ? `the (${items.length}) elevators` : 'one (01) elevator'}, as given in our enclosed specifications:</p>
    <table class="ip-table">
      <thead><tr><th style="width:26px;">No.</th><th>Specification of Elevator${items.length > 1 ? 's' : ''}</th><th style="width:80px;">Rate / Unit</th><th style="width:40px;">Qty</th><th style="width:90px;">Amount</th></tr></thead>
      <tbody>
        ${priceRows}
        <tr class="ip-total-row"><td colspan="4" style="text-align:right;">Subtotal</td><td style="text-align:right;">${fmtMoney(subtotal)}</td></tr>
        ${row.gstEnabled ? `<tr><td colspan="4" style="text-align:right;color:#7c2d12;font-weight:600;">GST @ ${gstPercent}% Extra</td><td style="text-align:right;">${fmtMoney(gstAmount)}</td></tr>` : ''}
        <tr class="ip-total-row"><td colspan="4" style="text-align:right;">Total ${row.gstEnabled ? '(Incl. GST)' : ''}</td><td style="text-align:right;">${fmtMoney(total)}</td></tr>
      </tbody>
    </table>
    ${row.gstEnabled ? `<div class="ip-note">NOTE: GST @ ${gstPercent}% EXTRA ON BASIC COST</div>` : `<div class="ip-note">NOTE: Prices quoted are exclusive of taxes.</div>`}
    <div class="ip-words">In Words: ${numberToWords(total).toUpperCase()}</div>

    <div class="ip-title-bar" style="margin-top:10px;">Client Scope Work</div>
    <table class="ip-table">
      <thead><tr><th style="width:26px;">Sr.</th><th>Particulars</th><th style="width:70px;">Client Scope</th><th style="width:140px;">Remarks</th></tr></thead>
      <tbody>
        ${scope.map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(s.label)}</td>
          <td style="font-weight:700;${s.value === 'Yes' ? 'color:#059669;' : 'color:#dc2626;'}">${esc(s.value)}</td>
          <td>${esc(s.remarks || '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `

  // Page 4 — Terms & conditions + detailed client scope of work + signatures
  const page4 = `
    <div class="ip-title-bar">Terms and Conditions of Quotation</div>
    <ol class="ip-list">
      <li>All cheques / drafts must be drawn in favour of <strong>"${companyName}"</strong>.</li>
      <li>Payment Terms — <strong>${esc(pct.adv)}%</strong> against order booking, <strong>${esc(pct.dispatch)}%</strong> before dispatch of material, <strong>${esc(pct.completion)}%</strong> after lift completion.</li>
      <li>Tax &amp; Duties — Quoted prices are exclusive of all taxes.</li>
      <li>Warranty — Warranty means repair, maintenance and replacement, if needed, against manufacturing fault only, for a period of 1 year from the date of completion of the lift.</li>
      <li>Free Maintenance — Free maintenance is provided for a period of up to 12 months, commencing from the date of completion of installation.</li>
      <li>Dispatch &amp; Installation — Dispatch of material will be within 4 weeks from release of material with payment as per the terms decided, and installation will be completed within 6 weeks from the date civil &amp; electrical work is completed at site (dispatch &amp; installation are linked to payment terms).</li>
      <li>If three-phase power supply is not available within 10 days from the date of receipt of material at your site, payment should not be withheld, as this is within the scope of the client.</li>
    </ol>

    <div class="ip-title-bar">Client Scope of Work</div>
    <ol class="ip-list">
      ${CLIENT_SCOPE_OF_WORK_DETAILED.map(t => `<li>${esc(t)}</li>`).join('')}
    </ol>

    <p class="ip-p" style="margin-top:10px;">Thanking You.</p>

    <div class="ip-sig-row">
      <div class="col">
        <div class="ip-stamp-img">${stampImg ? `<img src="${stampImg}" alt="Stamp">` : ''}</div>
        <div class="line">Proposed By<br>${companyName}</div>
      </div>
      <div class="col">
        <div class="line">Accepted By<br>${esc(row.clientName) || ''}</div>
      </div>
    </div>
  `

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${CSS}</style></head><body>
    ${pageWrap(headerImg, footerImg, page1)}
    ${pageWrap(headerImg, footerImg, page2)}
    ${pageWrap(headerImg, footerImg, page3)}
    ${pageWrap(headerImg, footerImg, page4)}
  </body></html>`
}
