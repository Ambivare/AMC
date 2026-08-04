import ExcelJS from 'exceljs'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

// ─── Cache ────────────────────────────────────────────────────────────────────
let cachedConfig = null
async function loadConfig() {
  if (cachedConfig) return cachedConfig
  try {
    const configs = await getAll(Collections.CONFIGURATIONS)
    if (configs.length) { cachedConfig = configs[0]; return cachedConfig }
  } catch {}
  return {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function num(v) { return Number(v) || 0 }

function amountWords(n) {
  if (!n) return 'Zero Only'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function toWords(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n] + ' '
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' '
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + toWords(n % 100)
    if (n < 100000) return toWords(Math.floor(n / 1000)) + 'Thousand ' + toWords(n % 1000)
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + 'Lakh ' + toWords(n % 100000)
    return toWords(Math.floor(n / 10000000)) + 'Crore ' + toWords(n % 10000000)
  }
  const intPart = Math.floor(n)
  const decPart = Math.round((n - intPart) * 100)
  let result = toWords(intPart).trim() + ' Only'
  if (decPart) result += ' and ' + toWords(decPart).trim() + ' Paise'
  return 'Rupees ' + result
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const BORDER_THIN = { style: 'thin', color: { argb: 'FF000000' } }
const BORDER_MED  = { style: 'medium', color: { argb: 'FF000000' } }

function border(type = 'thin') {
  const b = type === 'medium' ? BORDER_MED : BORDER_THIN
  return { top: b, left: b, bottom: b, right: b }
}

function applyBorders(ws, startRow, endRow, startCol, endCol, type = 'thin') {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c)
      cell.border = border(type)
    }
  }
}

function headerFont(size = 10, bold = true) {
  return { name: 'Arial', size, bold }
}

function normalFont(size = 10, bold = false) {
  return { name: 'Arial', size, bold }
}

// Load header image as buffer
async function loadHeaderImageBuffer() {
  try {
    const resp = await fetch('/static/header.jpg')
    if (!resp.ok) return null
    const buf = await resp.arrayBuffer()
    return buf
  } catch { return null }
}

// Load footer image as buffer
async function loadFooterImageBuffer() {
  try {
    const resp = await fetch('/static/footer.jpg')
    if (!resp.ok) return null
    return await resp.arrayBuffer()
  } catch { return null }
}

// ─── Doc meta ─────────────────────────────────────────────────────────────────
const DOC_TITLE_MAP = {
  quotation:     'QUOTATION',
  proforma:      'BILL INVOICE',
  taxInvoice:    'TAX INVOICE',
  purchaseOrder: 'PURCHASE ORDER',
  bom:           'BILL OF MATERIALS',
}

// Strips characters that are illegal (or awkward — "/" especially, since doc
// numbers like "MQTN/26-27/0001/TE" would otherwise be read as path segments)
// in a downloaded filename on both Android and desktop filesystems.
function sanitizeForFilename(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function getDocMeta(row, templateKey) {
  const docTitle  = DOC_TITLE_MAP[templateKey] || 'DOCUMENT'
  const docNumber = templateKey === 'bom' ? (row.bomNumber || 'BOM') : (row.docNumber || 'DOC')
  const nameForFile = sanitizeForFilename(row.projectName || row.clientName || '')
  const filename  = [sanitizeForFilename(docNumber), nameForFile, docTitle.replace(/\s+/g, '-')]
    .filter(Boolean).join('-') + '.xlsx'
  return { docTitle, docNumber, filename }
}

function getItems(row, templateKey) {
  if (templateKey === 'bom') return row.items || []
  const isLines = Array.isArray(row.lines) && row.lines.length
  return isLines ? row.lines : (row.items || [])
}

// ─── Shared workbook builder ──────────────────────────────────────────────────

async function buildWorkbook(row, templateKey) {
  const config  = await loadConfig()
  const company = config.company || {}
  const { docTitle, docNumber, filename } = getDocMeta(row, templateKey)
  const isBOM   = templateKey === 'bom'
  const isLines = Array.isArray(row.lines) && row.lines.length

  const items   = getItems(row, templateKey)
  const lifts    = (!isBOM && !isLines) ? (num(row.numberOfLifts) || 1) : 1
  const subtotal = isBOM
    ? items.reduce((s, i) => s + num(i.qty) * num(i.unitCost), 0)
    : num(row.subtotal)
  const gstPct  = num(row.gstPercent) || 18
  const gstAmt  = isBOM ? Math.round(subtotal * gstPct / 100) : num(row.gstAmount)
  const total   = isBOM ? (subtotal + gstAmt) : num(row.total)
  const halfGst = Math.round(gstAmt / 2)

  const wb = new ExcelJS.Workbook()
  wb.creator = company.name || 'TAB Elevators'
  wb.created = new Date()

  const ws = wb.addWorksheet('Invoice', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  })

  // ── Column widths (match Quotation template) ──────────────────────────────
  // A=S.No, B=Item Description, C=Qty, D=UOM, E=Rate, F=Amount
  ws.columns = [
    { key: 'sno',   width: 5 },    // A
    { key: 'desc',  width: 48 },   // B
    { key: 'qty',   width: 8 },    // C
    { key: 'uom',   width: 9 },    // D
    { key: 'rate',  width: 14 },   // E
    { key: 'amt',   width: 18 },   // F
  ]

  let currentRow = 1

  // ── Header image (rows 1–7) ──────────────────────────────────────────────
  const imgBuf = await loadHeaderImageBuffer()
  const HEADER_ROWS = 7

  if (imgBuf) {
    // Set header rows tall enough to show the image
    for (let r = 1; r <= HEADER_ROWS; r++) {
      ws.getRow(r).height = imgBuf ? (r === 1 ? 72 : 14) : 14
    }
    ws.getRow(1).height = 72
    for (let r = 2; r <= HEADER_ROWS; r++) ws.getRow(r).height = 4

    // Merge A1:F7 for image
    ws.mergeCells(1, 1, HEADER_ROWS, 6)

    const imgId = wb.addImage({ buffer: imgBuf, extension: 'jpeg' })
    ws.addImage(imgId, {
      tl: { col: 0, row: 0 },
      br: { col: 6, row: HEADER_ROWS },
      editAs: 'oneCell',
    })
    currentRow = HEADER_ROWS + 1
  } else {
    // Fallback: company name header
    ws.getRow(1).height = 36
    ws.mergeCells(1, 1, 3, 6)
    const hCell = ws.getCell(1, 1)
    hCell.value = company.name || 'TAB Elevators'
    hCell.font = { name: 'Arial', size: 18, bold: true }
    hCell.alignment = { vertical: 'middle', horizontal: 'center' }
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 6; c++) {
        ws.getCell(r, c).border = border('thin')
      }
    }
    currentRow = 4
  }

  // ── Ref / To / Date section ──────────────────────────────────────────────
  const addr = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')
  const refNum = docNumber
  const docDate = formatDate(row.date || row.createdAt)
  const dueDate = row.dueDate ? formatDate(row.dueDate) : ''

  // Row: "To, Secretary / Chairman," | "Ref No: [number]"
  const r8 = ws.getRow(currentRow)
  r8.height = 16
  ws.mergeCells(currentRow, 1, currentRow, 3)
  ws.mergeCells(currentRow, 4, currentRow, 6)
  const c8L = ws.getCell(currentRow, 1)
  c8L.value = 'To, Secretary / Chairman,'
  c8L.font = headerFont(10, true)
  c8L.alignment = { horizontal: 'left', vertical: 'middle' }
  const c8R = ws.getCell(currentRow, 4)
  c8R.value = (docTitle === 'QUOTATION' ? 'Ref No : ' : 'Invoice No : ') + refNum
  c8R.font = headerFont(10, true)
  c8R.alignment = { horizontal: 'right', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 1, 6)
  currentRow++

  // Row: project/building name | Date:
  ws.getRow(currentRow).height = 15
  ws.mergeCells(currentRow, 1, currentRow, 3)
  ws.mergeCells(currentRow, 4, currentRow, 6)
  const cnL = ws.getCell(currentRow, 1)
  cnL.value = row.projectName || ''
  cnL.font = headerFont(10, true)
  cnL.alignment = { horizontal: 'left', vertical: 'middle' }
  const cnR = ws.getCell(currentRow, 4)
  cnR.value = 'Date : ' + docDate
  cnR.font = headerFont(10, true)
  cnR.alignment = { horizontal: 'right', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 1, 6)
  currentRow++

  // Row: client address (left) | client name / contact person (right)
  const r9 = ws.getRow(currentRow)
  r9.height = 16
  ws.mergeCells(currentRow, 1, currentRow, 3)
  ws.mergeCells(currentRow, 4, currentRow, 6)
  const c9L = ws.getCell(currentRow, 1)
  c9L.value = row.clientAddress || ''
  c9L.font = normalFont(10)
  c9L.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  const c9R = ws.getCell(currentRow, 4)
  c9R.value = row.clientName || ''
  c9R.font = headerFont(10, true)
  c9R.alignment = { horizontal: 'right', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 1, 6)
  currentRow++

  // Row: GST (left) | Phone (right)
  ws.getRow(currentRow).height = 15
  ws.mergeCells(currentRow, 1, currentRow, 3)
  ws.mergeCells(currentRow, 4, currentRow, 6)
  const c10L = ws.getCell(currentRow, 1)
  c10L.value = row.clientGST ? 'GST No: ' + row.clientGST : (dueDate ? 'Due Date : ' + dueDate : '')
  c10L.font = normalFont(9)
  c10L.alignment = { horizontal: 'left', vertical: 'middle' }
  const c10R = ws.getCell(currentRow, 4)
  c10R.value = row.clientPhone ? 'Ph : ' + row.clientPhone : ''
  c10R.font = normalFont(9, true)
  c10R.alignment = { horizontal: 'right', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 1, 6)
  currentRow++

  // Row: Contact Person (right) | Email (right)
  if (row.contactPerson || row.clientEmail) {
    ws.getRow(currentRow).height = 15
    ws.mergeCells(currentRow, 1, currentRow, 3)
    ws.mergeCells(currentRow, 4, currentRow, 6)
    const cpL = ws.getCell(currentRow, 1)
    cpL.value = row.contactPerson ? 'Contact: ' + row.contactPerson : ''
    cpL.font = normalFont(9)
    cpL.alignment = { horizontal: 'left', vertical: 'middle' }
    const cpR = ws.getCell(currentRow, 4)
    cpR.value = row.clientEmail || ''
    cpR.font = normalFont(9)
    cpR.alignment = { horizontal: 'right', vertical: 'middle' }
    applyBorders(ws, currentRow, currentRow, 1, 6)
    currentRow++
  }

  // Row: Lift Description
  if (row.liftDescription) {
    ws.getRow(currentRow).height = 15
    ws.mergeCells(currentRow, 1, currentRow, 6)
    const ldCell = ws.getCell(currentRow, 1)
    ldCell.value = 'Lift Description : ' + row.liftDescription
    ldCell.font = normalFont(9)
    ldCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    applyBorders(ws, currentRow, currentRow, 1, 6)
    currentRow++
  }

  // Row: Number of Lifts
  if (!isBOM && (row.numberOfLifts || 0) > 1) {
    ws.getRow(currentRow).height = 15
    ws.mergeCells(currentRow, 1, currentRow, 6)
    const nlCell = ws.getCell(currentRow, 1)
    nlCell.value = 'Number of Lifts : ' + row.numberOfLifts
    nlCell.font = normalFont(9, true)
    nlCell.alignment = { horizontal: 'left', vertical: 'middle' }
    applyBorders(ws, currentRow, currentRow, 1, 6)
    currentRow++
  }

  // ── Document title banner ────────────────────────────────────────────────
  ws.getRow(currentRow).height = 22
  ws.mergeCells(currentRow, 1, currentRow, 6)
  const titleCell = ws.getCell(currentRow, 1)
  titleCell.value = docTitle
  titleCell.font = { name: 'Arial', size: 13, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 1, 6)
  currentRow++

  // ── Table headers ────────────────────────────────────────────────────────
  ws.getRow(currentRow).height = 20
  const headers = isBOM
    ? ['S.No', 'Part Name / Description', 'Qty', 'Unit', 'Unit Cost', 'Total']
    : ['S.No', 'ITEM DESCRIPTION', 'QTY', 'UOM', 'RATE', 'AMOUNT']

  headers.forEach((h, idx) => {
    const cell = ws.getCell(currentRow, idx + 1)
    cell.value = h
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    cell.alignment = {
      horizontal: idx === 0 ? 'center' : idx >= 4 ? 'right' : 'left',
      vertical: 'middle',
    }
    cell.border = border('medium')
  })
  currentRow++

  // ── Item rows ─────────────────────────────────────────────────────────────
  const itemStartRow = currentRow
  if (items.length === 0) {
    ws.getRow(currentRow).height = 16
    ws.mergeCells(currentRow, 1, currentRow, 6)
    const ec = ws.getCell(currentRow, 1)
    ec.value = 'No items'
    ec.alignment = { horizontal: 'center', vertical: 'middle' }
    applyBorders(ws, currentRow, currentRow, 1, 6)
    currentRow++
  } else {
    items.forEach((item, idx) => {
      const rw = ws.getRow(currentRow)
      rw.height = 18

      let qty, rate, amount, desc, partNo

      if (isBOM) {
        qty    = num(item.qty)
        rate   = num(item.unitCost)
        amount = qty * rate
        desc   = item.partName || ''
        partNo = item.partNumber || ''
      } else if (isLines) {
        qty    = num(item.qty)
        rate   = num(item.unitPrice)
        amount = qty * rate
        desc   = item.description || ''
      } else {
        qty    = num(item.quantity)
        rate   = num(item.rate)
        amount = qty * rate
        desc   = item.description || ''
      }
      const itemUom = (isBOM || isLines) ? (item.unit || '') : (item.unit || 'Nos')
      const rowData = [idx + 1, isBOM ? (desc + (partNo ? '\n(' + partNo + ')' : '')) : desc, qty, itemUom, rate, amount]

      rowData.forEach((v, ci) => {
        const cell = ws.getCell(currentRow, ci + 1)
        cell.value = v
        cell.font = normalFont(10)
        cell.alignment = {
          horizontal: ci === 0 ? 'center' : ci >= 4 ? 'right' : 'left',
          vertical: 'top',
          wrapText: ci === 1,
        }
        cell.border = border('thin')
      })

      currentRow++
    })
  }

  // ── Totals section ────────────────────────────────────────────────────────
  function addTotalRow(label, value, isGrand = false) {
    ws.getRow(currentRow).height = 18
    const grandFill = isGrand ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } } : null
    const grandColor = isGrand ? { argb: 'FFFFFFFF' } : undefined

    // Merge A-D for label
    ws.mergeCells(currentRow, 1, currentRow, 4)
    const lc = ws.getCell(currentRow, 1)
    lc.value = label
    lc.font = { name: 'Arial', size: 10, bold: true, ...(grandColor && { color: grandColor }) }
    lc.alignment = { horizontal: 'right', vertical: 'middle' }
    lc.border = border(isGrand ? 'medium' : 'thin')
    if (grandFill) lc.fill = grandFill

    // E col
    const ec = ws.getCell(currentRow, 5)
    ec.value = ''
    ec.border = border('thin')
    if (grandFill) ec.fill = grandFill

    // F col = amount
    const vc = ws.getCell(currentRow, 6)
    vc.value = value
    vc.numFmt = '"Rs. "#,##0.00'
    vc.font = { name: 'Arial', size: 10, bold: true, ...(grandColor && { color: grandColor }) }
    vc.alignment = { horizontal: 'right', vertical: 'middle' }
    vc.border = border(isGrand ? 'medium' : 'thin')
    if (grandFill) vc.fill = grandFill
    currentRow++
  }

  // Empty row before totals
  const emptyR = ws.getRow(currentRow)
  emptyR.height = 4
  ws.mergeCells(currentRow, 1, currentRow, 6)
  currentRow++

  const grandTotal = lifts > 1 ? (num(row.grandTotal) || total * lifts) : total

  if (!isBOM) {
    addTotalRow('Subtotal', subtotal)
    if (row.discountEnabled && (row.discountAmount || 0) > 0) {
      addTotalRow(`Discount${row.discountType === 'percent' ? ` (${row.discountValue}%)` : ''}`, num(row.discountAmount))
      addTotalRow('After Discount', num(row.discountedSubtotal || row.subtotal))
    }
    addTotalRow(`CGST (${gstPct / 2}%)`, halfGst)
    addTotalRow(`SGST (${gstPct / 2}%)`, halfGst)
    if (lifts > 1) {
      addTotalRow('Per Lift Total', total)
      // × N Lifts label row
      ws.getRow(currentRow).height = 18
      ws.mergeCells(currentRow, 1, currentRow, 6)
      const multCell = ws.getCell(currentRow, 1)
      multCell.value = `× ${lifts} Lifts`
      multCell.font = { name: 'Arial', size: 10, bold: true, italic: true }
      multCell.alignment = { horizontal: 'right', vertical: 'middle' }
      applyBorders(ws, currentRow, currentRow, 1, 6)
      currentRow++
    }
  }
  addTotalRow('GRAND TOTAL', grandTotal, true)

  // ── Amount in words ───────────────────────────────────────────────────────
  ws.getRow(currentRow).height = 18
  ws.mergeCells(currentRow, 1, currentRow, 6)
  const wordsCell = ws.getCell(currentRow, 1)
  wordsCell.value = 'Amount In Words: ' + amountWords(grandTotal)
  wordsCell.font = { name: 'Arial', size: 9, bold: true, italic: true }
  wordsCell.alignment = { horizontal: 'left', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 1, 6)
  currentRow++

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (row.notes) {
    ws.getRow(currentRow).height = 14
    ws.mergeCells(currentRow, 1, currentRow, 6)
    const nc = ws.getCell(currentRow, 1)
    nc.value = 'Notes: ' + row.notes
    nc.font = normalFont(9)
    nc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    applyBorders(ws, currentRow, currentRow, 1, 6)
    currentRow++
  }

  // ── Section header helper ─────────────────────────────────────────────────
  function addSectionHeader(label) {
    ws.getRow(currentRow).height = 16
    ws.mergeCells(currentRow, 1, currentRow, 6)
    const sc = ws.getCell(currentRow, 1)
    sc.value = label
    sc.font = { name: 'Arial', size: 10, bold: true }
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    sc.alignment = { horizontal: 'left', vertical: 'middle' }
    applyBorders(ws, currentRow, currentRow, 1, 6)
    currentRow++
  }

  function addTextRow(text, indent = false) {
    ws.getRow(currentRow).height = 14
    ws.mergeCells(currentRow, 1, currentRow, 6)
    const tc = ws.getCell(currentRow, 1)
    tc.value = (indent ? '    ' : '') + text
    tc.font = normalFont(9)
    tc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    applyBorders(ws, currentRow, currentRow, 1, 6)
    currentRow++
  }

  function addBlankRow() {
    ws.getRow(currentRow).height = 8
    ws.mergeCells(currentRow, 1, currentRow, 6)
    currentRow++
  }

  // ── Terms & Conditions ────────────────────────────────────────────────────
  addBlankRow()
  addSectionHeader('Terms & Condition')
  const tcLines = (row.termsConditions || []).filter(Boolean)
  if (tcLines.length) {
    tcLines.forEach((l, i) => addTextRow(`${i + 1}. ${l}`, true))
  } else {
    addTextRow('1. All payments shall be payable in favor of "' + (company.name || 'TAB Elevators') + '"', true)
    addTextRow(`2. Validity of this offer : ${row.validUntil ? formatDate(row.validUntil) : '30 Days from Date Of Quotation'}`, true)
    addTextRow('3. This quotation is based on the cost of materials and spares ruling on the date of quotation and subject to revision on any change in cost.', true)
    addTextRow('4. Any additional work not included in the quotation, if found necessary at the time of actual execution, will be intimated to the owner about extra charges.', true)
    addTextRow('Warranty: 5 Years Warranty for any/all the items will be only given if the items are provided by us (except V3F Unit — 1 year warranty) if the AMC contract is given to us for the next 5 years.')
    if (row.freeAmc) addTextRow('Free AMC: 1 Year')
  }

  // ── Payment Terms ─────────────────────────────────────────────────────────
  addBlankRow()
  addSectionHeader('PAYMENT TERMS')
  const ptLines = (row.paymentTerms || []).filter(Boolean)
  if (ptLines.length) {
    ptLines.forEach((l, i) => addTextRow(`${i + 1}. ${l}`, true))
  } else {
    addTextRow('1. 50% Advance at the time of Acceptance of this Quotation', true)
    addTextRow('2. 35% On intimation of materials ready to Dispatch (within 10-15 days from advance payment)', true)
    addTextRow('3. 15% On Completion of work', true)
  }

  // ── Work Schedule ─────────────────────────────────────────────────────────
  addBlankRow()
  addSectionHeader('WORK SCHEDULE')
  const wsLines = (row.workSchedule || []).filter(Boolean)
  if (wsLines.length) {
    wsLines.forEach((l, i) => addTextRow(`${i + 1}. ${l}`, true))
  } else {
    addTextRow('1. Materials will reach at site within 15 to 20 working days from the clearance of Advance Payment', true)
    addTextRow('2. Work will be completed within 15 to 20 working days from the date of all the Materials reached at site', true)
  }

  // ── Acceptance / Signature ────────────────────────────────────────────────
  // empty gap
  ws.getRow(currentRow).height = 12
  ws.mergeCells(currentRow, 1, currentRow, 6)
  currentRow++

  ws.getRow(currentRow).height = 18
  ws.mergeCells(currentRow, 1, currentRow, 3)
  ws.mergeCells(currentRow, 4, currentRow, 6)
  const sigFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
  const sigL = ws.getCell(currentRow, 1)
  sigL.value = 'For ' + (company.name || 'TAB Elevators')
  sigL.font = { name: 'Arial', size: 10, bold: true }
  sigL.fill = sigFill
  sigL.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 1, 3)
  const sigR = ws.getCell(currentRow, 4)
  sigR.value = 'ACCEPTANCE OF QUOTATION'
  sigR.font = { name: 'Arial', size: 10, bold: true }
  sigR.fill = sigFill
  sigR.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 4, 6)
  currentRow++

  // Signature space (3 rows)
  for (let i = 0; i < 3; i++) {
    ws.getRow(currentRow).height = 18
    ws.mergeCells(currentRow, 1, currentRow, 3)
    ws.mergeCells(currentRow, 4, currentRow, 6)
    applyBorders(ws, currentRow, currentRow, 1, 3)
    applyBorders(ws, currentRow, currentRow, 4, 6)
    currentRow++
  }

  // Signature labels
  ws.getRow(currentRow).height = 16
  ws.mergeCells(currentRow, 1, currentRow, 3)
  ws.mergeCells(currentRow, 4, currentRow, 6)
  const slL = ws.getCell(currentRow, 1)
  slL.value = 'Authorised Signatory'
  slL.font = normalFont(9, true)
  slL.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 1, 3)
  const slR = ws.getCell(currentRow, 4)
  slR.value = 'Authorised Signatory with Stamp'
  slR.font = normalFont(9, true)
  slR.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorders(ws, currentRow, currentRow, 4, 6)
  currentRow++

  // ── Footer image ──────────────────────────────────────────────────────────
  const footerBuf = await loadFooterImageBuffer()
  if (footerBuf) {
    const FOOTER_ROWS = 7
    const footerStartRow = currentRow
    ws.getRow(footerStartRow).height = 72
    for (let r = footerStartRow + 1; r < footerStartRow + FOOTER_ROWS; r++) ws.getRow(r).height = 4
    ws.mergeCells(footerStartRow, 1, footerStartRow + FOOTER_ROWS - 1, 6)
    const footerId = wb.addImage({ buffer: footerBuf, extension: 'jpeg' })
    ws.addImage(footerId, {
      tl: { col: 0, row: footerStartRow - 1 },
      br: { col: 6, row: footerStartRow + FOOTER_ROWS - 1 },
      editAs: 'oneCell',
    })
    currentRow += FOOTER_ROWS
  }

  // ── Print settings ────────────────────────────────────────────────────────
  ws.pageSetup.printTitlesRow = `1:${HEADER_ROWS}`

  return { wb, filename }
}

// ─── Main Excel download function ─────────────────────────────────────────────

export async function downloadExcel(row, templateKey) {
  const { wb, filename } = await buildWorkbook(row, templateKey)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Get Excel as ArrayBuffer (for email attachment) ─────────────────────────

export async function getExcelBuffer(row, templateKey) {
  const { wb, filename } = await buildWorkbook(row, templateKey)
  const buf = await wb.xlsx.writeBuffer()
  return { buffer: buf, filename }
}
