// Blank A4 letterhead — reuses the exact header/company-bar/footer markup
// and styling from the AMC Contract PDF (contractTemplate.js) so a printed
// letterhead page always matches the contract's letterhead look, with an
// empty body in between for typing/printing over.
export function buildLetterheadHtml(company = {}) {
  const logoImg = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;">`
    : ''
  const address = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Letterhead</title>
<style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c2c2c; }
.page { width: 210mm; height: 297mm; display: flex; flex-direction: column; position: relative; overflow: hidden; }

.header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 14px 34px; display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: center; gap: 16px; }
.header-logo { width: 56px; height: 56px; background: #fff; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.header-logo img { width: 100%; height: 100%; object-fit: contain; }
.header-title h1 { font-size: 21px; font-weight: 700; letter-spacing: 0.5px; color: #f5a623; white-space: nowrap; }
.header-title p { font-size: 12px; color: #ccc; margin-top: 3px; }
.header-contact { text-align: right; font-size: 12px; color: #ccc; flex-shrink: 0; }
.header-contact span { display: block; margin-bottom: 4px; white-space: nowrap; }
.header-contact strong { color: #f5a623; font-size: 13px; }

.company-bar { background: #f5a623; color: #1a1a2e; padding: 6px 34px; font-size: 12px; font-weight: 600; }

.content { flex: 1; }

.footer { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 12px 34px; }
.footer-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.footer-brand { font-size: 15px; font-weight: 700; color: #f5a623; letter-spacing: 1px; }
.footer-contact { font-size: 11.5px; color: #ccc; text-align: right; }
.footer-contact span { margin-left: 12px; }
.footer-bottom { border-top: 1px solid #333; padding-top: 6px; font-size: 10px; color: #888; text-align: center; }

@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="header-logo">${logoImg}</div>
      <div class="header-title">
        <h1>${company.name || ''}</h1>
        <p>Maintenance &amp; Installation of All Types of Elevators</p>
      </div>
    </div>
    <div class="header-contact">
      <span><strong>MOBILE:</strong> ${company.phone || ''}</span>
      <span><strong>EMAIL:</strong> ${company.email || ''}</span>
    </div>
  </div>
  <div class="company-bar">${address}</div>

  <div class="content"></div>

  <div class="footer">
    <div class="footer-top">
      <div class="footer-brand">${company.name || ''}</div>
      <div class="footer-contact">
        <span>${company.phone || ''}</span>
        <span>${company.email || ''}</span>
      </div>
    </div>
    <div class="footer-bottom">${address} | Maintenance &amp; Installation of All Types of Elevators</div>
  </div>
</div>
</body>
</html>`
}
