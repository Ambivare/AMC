// Blank A4 letterhead — Word (.docx) version of letterheadTemplate.js's HTML
// letterhead. Uses the document's native Header/Footer (repeats on every
// page, body stays empty) so the branding survives edits made in Word.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, VerticalAlign, ShadingType, ImageRun,
  BorderStyle, Header, Footer,
} from 'docx'

const PAGE_W = 11906 // A4 width in twips (210mm)
const PAGE_H = 16838 // A4 height in twips (297mm)
const NAVY = '1A1A2E'
const ORANGE = 'F5A623'
const GRAY = 'CCCCCC'

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER }

async function fetchImageBytes(url) {
  if (!url) return null
  try {
    if (url.startsWith('data:')) {
      const match = /^data:image\/(\w+);base64,(.*)$/.exec(url)
      if (!match) return null
      const [, ext, base64] = match
      const bin = atob(base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return { bytes, type: ext === 'jpeg' ? 'jpg' : ext }
    }
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buf = await resp.arrayBuffer()
    const ext = (url.split('?')[0].split('.').pop() || 'png').toLowerCase()
    const type = ext === 'jpeg' ? 'jpg' : ['jpg', 'png', 'gif', 'bmp'].includes(ext) ? ext : 'png'
    return { bytes: new Uint8Array(buf), type }
  } catch {
    return null
  }
}

// docx table/cell widths must be WidthType.DXA (absolute twips) — PERCENTAGE
// widths render broken/garbled (columns collapse to 1-char-wide vertical
// text) when opened in Google Docs, even though they look fine in Word.
function navyCell(children, widthDxa, align) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 150, right: 150 },
    children: children.length ? children : [new Paragraph({ alignment: align, children: [] })],
  })
}

export async function buildLetterheadDocxBase64(company = {}) {
  const logo = await fetchImageBytes(company.logoUrl)
  const address = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')

  const logoChildren = logo
    ? [new Paragraph({ children: [new ImageRun({ data: logo.bytes, type: logo.type, transformation: { width: 46, height: 46 } })] })]
    : []

  const nameChildren = [
    new Paragraph({ children: [new TextRun({ text: company.name || '', bold: true, size: 30, color: ORANGE })] }),
    new Paragraph({ children: [new TextRun({ text: 'Maintenance & Installation of All Types of Elevators', size: 17, color: GRAY })] }),
  ]

  const contactChildren = [
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ text: 'MOBILE: ', bold: true, color: ORANGE, size: 17 }),
      new TextRun({ text: company.phone || '', color: GRAY, size: 17 }),
    ] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ text: 'EMAIL: ', bold: true, color: ORANGE, size: 17 }),
      new TextRun({ text: company.email || '', color: GRAY, size: 17 }),
    ] }),
  ]

  const HEADER_COLS = [1450, 6300, 4156] // sums to PAGE_W
  const headerMainTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: HEADER_COLS,
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [
        navyCell(logoChildren, HEADER_COLS[0], AlignmentType.LEFT),
        navyCell(nameChildren, HEADER_COLS[1], AlignmentType.LEFT),
        navyCell(contactChildren, HEADER_COLS[2], AlignmentType.RIGHT),
      ],
    })],
  })

  const FOOTER_COLS = [Math.round(PAGE_W / 2), PAGE_W - Math.round(PAGE_W / 2)]
  const footerMainTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: FOOTER_COLS,
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [
        navyCell([new Paragraph({ children: [new TextRun({ text: company.name || '', bold: true, size: 21, color: ORANGE })] })], FOOTER_COLS[0], AlignmentType.LEFT),
        navyCell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [
          new TextRun({ text: (company.phone || '') + '    ', size: 16, color: GRAY }),
          new TextRun({ text: company.email || '', size: 16, color: GRAY }),
        ] })], FOOTER_COLS[1], AlignmentType.RIGHT),
      ],
    })],
  })

  const footerAddrPara = new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: '333333', space: 4 } },
    children: [new TextRun({ text: `${address} | Maintenance & Installation of All Types of Elevators`, size: 14, color: '888888' })],
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          // A hairline bottom margin (instead of exactly 0) keeps the last
          // footer line from being clipped flush against the physical page
          // edge — printers/viewers reserve a sliver of non-printable area.
          margin: { top: 0, bottom: 140, left: 0, right: 0, header: 0, footer: 0 },
        },
      },
      headers: { default: new Header({ children: [headerMainTable] }) },
      footers: { default: new Footer({ children: [footerMainTable, footerAddrPara] }) },
      children: [new Paragraph('')],
    }],
  })

  return Packer.toBase64String(doc)
}
