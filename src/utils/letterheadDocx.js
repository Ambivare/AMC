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

function navyCell(children, widthPct, align) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
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

  const headerMainTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [
        navyCell(logoChildren, 12, AlignmentType.LEFT),
        navyCell(nameChildren, 53, AlignmentType.LEFT),
        navyCell(contactChildren, 35, AlignmentType.RIGHT),
      ],
    })],
  })

  const headerBarTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: ORANGE, color: 'auto' },
        margins: { top: 60, bottom: 60, left: 150, right: 150 },
        children: [new Paragraph({ children: [new TextRun({ text: address, bold: true, size: 17, color: NAVY })] })],
      })],
    })],
  })

  const footerMainTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [
        navyCell([new Paragraph({ children: [new TextRun({ text: company.name || '', bold: true, size: 21, color: ORANGE })] })], 50, AlignmentType.LEFT),
        navyCell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [
          new TextRun({ text: (company.phone || '') + '    ', size: 16, color: GRAY }),
          new TextRun({ text: company.email || '', size: 16, color: GRAY }),
        ] })], 50, AlignmentType.RIGHT),
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
          margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 },
        },
      },
      headers: { default: new Header({ children: [headerMainTable, headerBarTable] }) },
      footers: { default: new Footer({ children: [footerMainTable, footerAddrPara] }) },
      children: [new Paragraph('')],
    }],
  })

  return Packer.toBase64String(doc)
}
