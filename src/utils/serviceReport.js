import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { savePDF } from './saveFile'
import { numberToWords } from '@/composables/useBillingPDF'
import { getStampDataUri } from './pdfLogo'

// Hardcoded 24-item lift maintenance checklist (matches the printed TAB Elevators
// service report stationery) — two columns of 12 items each.
export const SERVICE_CHECKLIST_LEFT = [
  'Landing Doors Cleaning',
  'Cabin Cleaning',
  'Machine Cleaning',
  'Bottom Track Cleaning',
  'Safety Operating Mechanical & Electrical',
  'Motor',
  'Break',
  'Gear Box',
  'Diverter Pulley',
  'Final Unit Switches (Up-Down)',
  'Electric Control Board',
  'Main Pulley',
]

export const SERVICE_CHECKLIST_RIGHT = [
  'Alarm Bell in Order',
  'Returning Camp',
  'Over Speed Governor Pulley',
  'Landing Electric Locks & Doors',
  'Indicator Lamps',
  'Car Gate & Electrical Switch',
  'Car Frame & Guide Shoes Liner',
  'C.Wt. Frame and C.Wt. Guide Shoes Liner',
  'Main Suspension Ropes',
  'Car Light / Fan & Push Button',
  'Stop Button Function',
  'Level Limit Switch & Reed Switch',
]

export function defaultServiceChecklist() {
  const obj = {}
  SERVICE_CHECKLIST_LEFT.forEach((_, i) => { obj[`l${i}`] = true })
  SERVICE_CHECKLIST_RIGHT.forEach((_, i) => { obj[`r${i}`] = true })
  return obj
}

export function defaultServiceChecklistRemarks() {
  const obj = {}
  SERVICE_CHECKLIST_LEFT.forEach((_, i) => { obj[`l${i}`] = '' })
  SERVICE_CHECKLIST_RIGHT.forEach((_, i) => { obj[`r${i}`] = '' })
  return obj
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Generates the landscape A4 "Service Report" PDF matching the printed
 * stationery: header, site/date, 24-item Particulars/Status/Remarks
 * checklist, remark, technician + customer signatures (with a passport-style
 * photo of the signing person), and the standard disclaimer line.
 */
export async function generateServiceReportPdf({
  company = {},
  siteName = '',
  reportNo = '',
  date = '',
  checklist = {},
  checklistRemarks = {},
  remarks = '',
  technicianName = '',
  technicianSignature = '',
  customerName = '',
  customerSignature = '',
  personPhoto = '',
}, ui) {
  const PW = 297, PH = 236, ML = 10, MR = 287
  const doc = new jsPDF({ unit: 'mm', format: [PW, PH], orientation: 'landscape' })
  const CW = MR - ML
  const stamp = await getStampDataUri()

  // Logo top-right
  if (company.logoUrl?.startsWith?.('data:image')) {
    try { doc.addImage(company.logoUrl, 'PNG', MR - 18, 6, 18, 18) } catch { /* ignore bad image data */ }
  }

  let y = 14
  // Company name — left
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(15, 23, 42)
  doc.text(company.name || 'TAB Elevators', ML, y)

  // Company address / phone / email — left, stacked below the name (logo stays
  // isolated in its own top-right corner so long addresses can never collide with it).
  // Hardcoded — do not source from Configurations (unreliable in the field).
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(71, 85, 105)
  const addr = 'S.No. 30/14, Uniti Industries, Behind Panchamukhi Hanuman Mandir, Narhe Dhayari Road, Narhe, Pune, Maharashtra 411041'
  y += 5
  const addrLines = doc.splitTextToSize(addr, 190)
  addrLines.slice(0, 2).forEach(l => { doc.text(l, ML, y); y += 3.6 })
  const contactLine = 'Mob: 9545802273 / 9765569919   |   tabelevatorsandsystems@gmail.com'
  doc.text(contactLine, ML, y); y += 3.6

  y += 3
  doc.setDrawColor(15, 23, 42).setLineWidth(0.4).line(ML, y, MR, y)
  y += 6

  // Title bar
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(15, 23, 42)
  doc.text('SERVICE REPORT', PW / 2, y, { align: 'center' })
  doc.setFontSize(11).setTextColor(220, 38, 38)
  if (reportNo) doc.text(String(reportNo), MR, y, { align: 'right' })
  y += 5
  doc.setDrawColor(203, 213, 225).setLineWidth(0.2).line(ML, y, MR, y)
  y += 6

  // Site / date row
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(15, 23, 42)
  doc.text('Name of Site:', ML, y)
  doc.setFont('helvetica', 'normal')
  doc.text(siteName || '—', ML + 26, y)
  doc.setFont('helvetica', 'bold')
  doc.text('Date:', 190, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fmtDate(date), 190 + 12, y)
  y += 6
  doc.setDrawColor(203, 213, 225).line(ML, y, MR, y)
  y += 7

  // ── Checklist table — Particulars / Status / Remarks, 2 groups of 12 ───────
  const rows = SERVICE_CHECKLIST_LEFT.map((label, i) => {
    const lOk = checklist[`l${i}`] !== false
    const rOk = checklist[`r${i}`] !== false
    return [
      label, lOk ? 'OK' : 'X', checklistRemarks[`l${i}`] || '',
      SERVICE_CHECKLIST_RIGHT[i], rOk ? 'OK' : 'X', checklistRemarks[`r${i}`] || '',
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Particulars', 'Status', 'Remarks', 'Particulars', 'Status', 'Remarks']],
    body: rows,
    theme: 'grid',
    margin: { left: ML, right: ML },
    styles: { fontSize: 9.8, cellPadding: 2.4, textColor: [30, 41, 59], lineColor: [148, 163, 184], lineWidth: 0.15 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9.5, halign: 'left' },
    columnStyles: {
      0: { cellWidth: 74 },
      1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 46 },
      3: { cellWidth: 74 },
      4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 46 },
    },
    didParseCell(data) {
      if (data.section === 'head' && (data.column.index === 1 || data.column.index === 4)) {
        data.cell.styles.halign = 'center'
      }
      if (data.section === 'body' && (data.column.index === 1 || data.column.index === 4)) {
        data.cell.styles.textColor = data.cell.raw === 'X' ? [220, 38, 38] : [16, 129, 76]
      }
    },
  })

  y = doc.lastAutoTable.finalY + 6

  // Remark
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(15, 23, 42)
  doc.text('Remark:', ML, y)
  doc.setFont('helvetica', 'normal').setFontSize(9.5)
  const remarkLines = doc.splitTextToSize(remarks || '—', CW - 20)
  doc.text(remarkLines, ML + 18, y)
  y += Math.max(6, remarkLines.length * 4.5) + 6

  // Signature boxes + passport-style photo of the signing person
  const sigH = 30
  const photoW = 22
  const gapSmall = 6
  const sigW = (CW - 10 - gapSmall - photoW) / 2

  function drawSigBox(x, label, sigData, name) {
    doc.setDrawColor(148, 163, 184).setLineWidth(0.2).rect(x, y, sigW, sigH)
    if (sigData?.startsWith?.('data:image')) {
      try { doc.addImage(sigData, 'PNG', x + 3, y + 2, sigW - 6, sigH - 12) } catch { /* ignore bad image data */ }
    }
    doc.setDrawColor(100, 116, 139).line(x + 3, y + sigH - 8, x + sigW - 3, y + sigH - 8)
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(15, 23, 42)
    doc.text(label, x + 3, y + sigH - 3)
    if (name) doc.text(name, x + sigW - 3, y + sigH - 3, { align: 'right' })
  }
  drawSigBox(ML, 'Technician Signature', technicianSignature, technicianName)

  // Company stamp — placed directly on the technician signature area, no border box
  if (stamp?.startsWith?.('data:image')) {
    const stampW = 17, stampH = stampW * (835 / 735)
    try { doc.addImage(stamp, 'PNG', ML + sigW - stampW - 3, y + 1, stampW, stampH) } catch { /* ignore bad image data */ }
  }

  const customerBoxX = ML + sigW + 10
  drawSigBox(customerBoxX, 'Customer Signature', customerSignature, customerName)

  const photoX = customerBoxX + sigW + gapSmall
  doc.setDrawColor(148, 163, 184).setLineWidth(0.2).rect(photoX, y, photoW, sigH)
  if (personPhoto?.startsWith?.('data:image')) {
    try { doc.addImage(personPhoto, 'JPEG', photoX + 1, y + 1, photoW - 2, sigH - 2) } catch { /* ignore bad image data */ }
  } else {
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(148, 163, 184)
    doc.text('PHOTO', photoX + photoW / 2, y + sigH / 2, { align: 'center' })
  }
  y += sigH + 6

  // Disclaimer
  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(100, 116, 139)
  doc.text('Incase Of Power Supply Is Not Available, Only Oiling/greasing & General Checkup Will Be Done.', PW / 2, y, { align: 'center' })

  const safeName = (siteName || 'site').replace(/[^\w-]+/g, '_')
  const filename = `Service-Report-${safeName}-${date || ''}.pdf`
  await savePDF(doc, filename, ui)
}

export { numberToWords }
