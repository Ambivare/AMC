import jsPDF from 'jspdf'
import { savePDF } from './saveFile'
import { numberToWords } from '@/composables/useBillingPDF'
import { getStampDataUri } from './pdfLogo'

const METHOD_LABELS = {
  cash: 'CASH', bank_transfer: 'BANK TRANSFER', cheque: 'CHEQUE', upi: 'UPI', other: 'OTHER',
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('en-GB').replaceAll('/', '/')
}

/**
 * Generates the "Authorised Receipt" payment slip matching the printed
 * receipt-book stationery — small landscape page (not A4), not a full invoice.
 */
export async function generatePaymentReceiptPdf({
  company = {},
  receiptNo = '',
  date = '',
  receivedFrom = '',
  amount = 0,
  method = 'cash',
  reference = '',
  billNo = '',
  forText = 'AMC Servicing',
  repairAmcText = 'AMC',
}, ui) {
  // Small landscape "receipt book" size — not A4
  const PW = 220, PH = 100
  const doc = new jsPDF({ unit: 'mm', format: [PW, PH], orientation: 'landscape' })
  const ML = 8, MR = PW - 8

  doc.setDrawColor(15, 23, 42).setLineWidth(0.5).rect(ML - 2, 4, MR - ML + 4, PH - 8)

  // Top-left: No. / Authorised Receipt / Date
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(220, 38, 38)
  doc.text(`No.: ${receiptNo || ''}`, ML + 3, 12)
  doc.setDrawColor(30, 41, 59).setLineWidth(0.3).roundedRect(ML + 22, 8, 42, 7, 2, 2)
  doc.setFontSize(8).setTextColor(15, 23, 42)
  doc.text('AUTHORISED RECEIPT', ML + 43, 12.3, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(9)
  doc.text(`DATE: ${fmtDate(date)}`, ML + 3, 19)

  // Top-right: logo + company block
  const hasLogo = company.logoUrl?.startsWith?.('data:image')
  const logoW = hasLogo ? 12 : 0
  if (hasLogo) {
    try { doc.addImage(company.logoUrl, 'PNG', MR - logoW, 6, logoW, logoW) } catch { /* ignore bad image data */ }
  }
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(29, 78, 216)
  doc.text(company.name || 'TAB Elevators', MR - logoW - (hasLogo ? 3 : 0), 12, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(71, 85, 105)
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')
  const addrLines = doc.splitTextToSize(addr || '', 110)
  let ty = 16
  addrLines.slice(0, 2).forEach(l => { doc.text(l, MR - 3, ty, { align: 'right' }); ty += 3.4 })
  if (company.phone) doc.text(`Mob: ${company.phone}`, MR - 3, ty, { align: 'right' })

  let y = 24
  doc.setDrawColor(15, 23, 42).setLineWidth(0.3).line(ML, y, MR, y)
  y += 4.5
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(194, 65, 12)
  doc.text('Electrical Contractors & Maintenance of All Types of Lifts', PW / 2, y, { align: 'center' })
  y += 4
  doc.setDrawColor(15, 23, 42).line(ML, y, MR, y)
  y += 6

  function labelValueLine(label, value, labelW = 46) {
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(15, 23, 42)
    doc.text(label, ML + 2, y)
    doc.setDrawColor(100, 116, 139).setLineWidth(0.2).line(ML + labelW, y + 0.8, MR - 2, y + 0.8)
    doc.setFont('helvetica', 'bold')
    doc.text(String(value || ''), ML + labelW + 2, y)
    y += 8
  }

  labelValueLine('Received with thanks from :', receivedFrom, 48)
  labelValueLine('Sum of Rupees :', numberToWords(Number(amount) || 0).toUpperCase() + '.', 32)

  // By Cash/Cheque + Date row
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(15, 23, 42)
  doc.text('By Cash / Cheque :', ML + 2, y)
  doc.setDrawColor(100, 116, 139).line(ML + 34, y + 0.8, 150, y + 0.8)
  doc.setFont('helvetica', 'bold')
  doc.text(METHOD_LABELS[method] || String(method || '').toUpperCase(), ML + 36, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Date :', 155, y)
  doc.setDrawColor(100, 116, 139).line(165, y + 0.8, MR - 2, y + 0.8)
  doc.setFont('helvetica', 'bold')
  doc.text(fmtDate(date), 167, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  labelValueLine('Bank Name :', method === 'cheque' || method === 'bank_transfer' ? (reference || '—') : '—', 26)

  // On account row + For
  doc.setFont('helvetica', 'normal').setFontSize(9.5)
  doc.text('On Account of Part / Full Payment against our bill no. :', ML + 2, y)
  doc.setDrawColor(100, 116, 139).line(ML + 78, y + 0.8, 155, y + 0.8)
  doc.setFont('helvetica', 'bold')
  doc.text(String(billNo || '—'), ML + 80, y)
  doc.setFont('helvetica', 'normal')
  doc.text('For :', 160, y)
  doc.setDrawColor(100, 116, 139).line(168, y + 0.8, MR - 2, y + 0.8)
  doc.setFont('helvetica', 'bold')
  doc.text(String(forText || ''), 170, y)
  y += 8

  labelValueLine('Repair / AMC Bill No. :', repairAmcText, 40)

  // Bottom row: amount box + signature
  const boxY = PH - 20
  doc.setDrawColor(15, 23, 42).setLineWidth(0.4).rect(ML, boxY, 40, 10)
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(15, 23, 42)
  doc.text(`Rs. ${Number(amount || 0).toLocaleString('en-IN')}/-`, ML + 3, boxY + 6.5)

  doc.setFont('helvetica', 'bold').setFontSize(9)
  doc.text(`For ${company.name || 'TAB Elevators'}`, MR - 3, boxY + 9, { align: 'right' })

  try {
    const stamp = await getStampDataUri()
    if (stamp) {
      const stampW = 30, stampH = stampW / 1.5
      doc.addImage(stamp, 'PNG', MR - stampW, boxY - 16, stampW, stampH)
    }
  } catch { /* ignore stamp load failure */ }

  const safeName = (receivedFrom || 'receipt').replace(/[^\w-]+/g, '_')
  const filename = `Payment-Receipt-${safeName}-${receiptNo || ''}.pdf`
  await savePDF(doc, filename, ui)
}
