import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { savePDF } from './saveFile'
import { numberToWords } from '@/composables/useBillingPDF'

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

function fmtDate(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Generates the landscape A4 "Service Report" PDF matching the printed
 * stationery: header, site/date, 2-column 24-item checklist, remark,
 * technician + customer signatures, and the standard disclaimer line.
 */
export async function generateServiceReportPdf({
  company = {},
  siteName = '',
  reportNo = '',
  date = '',
  checklist = {},
  remarks = '',
  technicianName = '',
  technicianSignature = '',
  customerName = '',
  customerSignature = '',
}, ui) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const PW = 297, ML = 10, MR = 287
  const CW = MR - ML

  if (company.logoUrl?.startsWith?.('data:image')) {
    try { doc.addImage(company.logoUrl, 'PNG', MR - 18, 6, 18, 18) } catch { /* ignore bad image data */ }
  }

  let y = 12
  // Company name + address
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(15, 23, 42)
  doc.text(company.name || 'TAB Elevators', ML, y)
  y += 5
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(71, 85, 105)
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')
  const phones = [company.phone].filter(Boolean).join(' / ')
  if (addr) { doc.text(doc.splitTextToSize(addr, CW)[0], ML, y); y += 4 }
  if (phones) { doc.text(`Mob: ${phones}`, ML, y); y += 4 }

  y += 2
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

  // ── Checklist table (2 columns of 12) ──────────────────────────────────────
  const rows = SERVICE_CHECKLIST_LEFT.map((label, i) => [
    label, checklist[`l${i}`] === false ? 'X' : 'OK',
    SERVICE_CHECKLIST_RIGHT[i], checklist[`r${i}`] === false ? 'X' : 'OK',
  ])

  autoTable(doc, {
    startY: y,
    head: [],
    body: rows,
    theme: 'grid',
    margin: { left: ML, right: ML },
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 41, 59], lineColor: [148, 163, 184], lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 105 },
      1: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 105 },
      3: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.column.index === 1 || data.column.index === 3) {
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

  // Signature boxes
  const sigW = (CW - 10) / 2
  const sigH = 26
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
  drawSigBox(ML + sigW + 10, 'Customer Signature', customerSignature, customerName)
  y += sigH + 6

  // Disclaimer
  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(100, 116, 139)
  doc.text('Incase Of Power Supply Is Not Available, Only Oiling/greasing & General Checkup Will Be Done.', PW / 2, y, { align: 'center' })

  const safeName = (siteName || 'site').replace(/[^\w-]+/g, '_')
  const filename = `Service-Report-${safeName}-${date || ''}.pdf`
  await savePDF(doc, filename, ui)
}

export { numberToWords }
