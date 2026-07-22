// Hardcoded default AMC Contract PDF template — matches the printed TAB
// Elevators "Lift Annual Maintenance Contract Agreement" stationery.
// Used both as the default shown in Configurations → Contract Format, and
// as the fallback when no custom template has been saved there.
//
// Placeholders substituted in AMCView.vue's generateContractPdf():
//   {{company.logo}} {{company.name}} {{company.address}} {{company.phone}} {{company.email}}
//   {{LETTER_DATE}} {{REF_NO}} {{CLIENT_NAME}} {{CLIENT_ADDRESS}} {{CONTACT_PERSON}} {{CONTACT_PHONE}}
//   {{NUM_LIFTS}} {{LIFT_TYPOLOGY}} {{PASSENGER_TYPE}} {{CONTRACT_TYPE}} {{CONTRACT_PERIOD}}
//   {{LIFT_MAKE}} {{LIFT_DOOR_TYPE}} {{LIFT_LOAD}} {{LIFT_HEIGHT}}
//   {{CONTRACT_VALUE}} {{GST_PERCENT}} {{GST_AMOUNT}} {{TOTAL_VALUE}} {{AMOUNT_WORDS}}
//   {{PAYMENT_TERMS}} {{DURATION}}
// Conditional blocks (comment-delimited, stripped/unwrapped like DISCOUNT_ROW):
//   <!-- NONCOMP_START --> ... <!-- NONCOMP_END -->   (shown when non-comprehensive)
//   <!-- COMP_START --> ... <!-- COMP_END -->         (shown when comprehensive)
export function defaultContractTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Lift Annual Maintenance Contract</title>
<style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c2c2c; line-height: 1.6; }
.page { width: 210mm; height: 297mm; display: flex; flex-direction: column; position: relative; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: avoid; }

.header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 14px 30px; display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: center; gap: 16px; }
.header-logo { width: 52px; height: 52px; background: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.header-logo img { width: 100%; height: 100%; object-fit: contain; }
.header-title h1 { font-size: 19px; font-weight: 700; letter-spacing: 1px; color: #f5a623; }
.header-title p { font-size: 10.5px; color: #ccc; margin-top: 2px; }
.header-contact { text-align: right; font-size: 9.5px; color: #ccc; }
.header-contact span { display: block; margin-bottom: 3px; }
.header-contact strong { color: #f5a623; font-size: 10.5px; }

.company-bar { background: #f5a623; color: #1a1a2e; padding: 6px 30px; font-size: 9.5px; font-weight: 600; }

.content { padding: 18px 30px; flex: 1; overflow: hidden; }

.to-section { margin-bottom: 14px; }
.to-section .to-label { font-size: 11px; font-weight: 700; color: #f5a623; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
.to-section .to-name { font-size: 15px; font-weight: 700; color: #1a1a2e; }
.to-section .to-address { font-size: 11.5px; color: #555; }

.contract-box { border: 2px solid #1a1a2e; padding: 10px 18px; margin-bottom: 14px; background: #f8f9fa; }
.contract-box .ref-no { font-size: 10.5px; font-weight: 700; color: #f5a623; letter-spacing: 0.5px; margin-bottom: 3px; }
.contract-box h2 { font-size: 16px; font-weight: 800; color: #1a1a2e; text-transform: uppercase; letter-spacing: 1px; text-align: center; }

.intro { font-size: 11.5px; margin-bottom: 12px; text-align: justify; color: #333; }

.details-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
.details-table th { background: #1a1a2e; color: #f5a623; font-size: 10.5px; padding: 8px 12px; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
.details-table td { padding: 8px 12px; font-size: 11.5px; border-bottom: 1px solid #ddd; background: #fafafa; }
.details-table td:first-child { font-weight: 700; color: #1a1a2e; width: 40%; }

.section-header { background: linear-gradient(90deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 7px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 14px 0 10px 0; border-left: 4px solid #f5a623; }

.terms-list { list-style: none; counter-reset: term; }
.terms-list li { position: relative; padding-left: 32px; margin-bottom: 8px; font-size: 10.3px; text-align: justify; color: #333; line-height: 1.55; }
.terms-list li::before { counter-increment: term; content: counter(term) "."; position: absolute; left: 0; top: 0; font-weight: 800; color: #f5a623; font-size: 12px; width: 26px; text-align: right; }

.notes-box { background: #fff8e6; border-left: 4px solid #f5a623; padding: 12px 16px; margin: 12px 0; }
.notes-box h4 { font-size: 11px; font-weight: 700; color: #1a1a2e; margin-bottom: 6px; text-transform: uppercase; }
.notes-list { list-style: none; }
.notes-list li { font-size: 10.3px; color: #444; margin-bottom: 5px; padding-left: 14px; position: relative; }
.notes-list li::before { content: "▸"; position: absolute; left: 0; color: #f5a623; font-weight: bold; }

.charges-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
.charges-table th { background: #1a1a2e; color: #f5a623; font-size: 10.5px; padding: 9px; text-align: left; }
.charges-table td { padding: 9px; font-size: 11.5px; border-bottom: 1px solid #ddd; }
.charges-table .amount { font-weight: 800; color: #1a1a2e; font-size: 13px; }
.charges-table .total-row td { background: #f5a623; color: #1a1a2e; font-weight: 800; font-size: 13px; }

.sig-section { display: flex; justify-content: space-between; margin-top: 24px; padding-top: 16px; border-top: 2px solid #1a1a2e; }
.sig-box { width: 45%; }
.sig-box .sig-line { border-top: 1px solid #333; margin-top: 32px; padding-top: 5px; font-size: 10.5px; font-weight: 600; color: #1a1a2e; }
.sig-box .sig-role { font-size: 9.5px; color: #777; margin-top: 2px; }

.footer { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 12px 30px; }
.footer-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.footer-brand { font-size: 13px; font-weight: 700; color: #f5a623; letter-spacing: 1px; }
.footer-contact { font-size: 9.5px; color: #ccc; text-align: right; }
.footer-contact span { margin-left: 10px; }
.footer-bottom { border-top: 1px solid #333; padding-top: 6px; font-size: 8.5px; color: #888; text-align: center; }

@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<!-- PAGE 1 -->
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="header-logo">{{company.logo}}</div>
      <div class="header-title">
        <h1>{{company.name}}</h1>
        <p>Maintenance &amp; Installation of All Types of Elevators</p>
      </div>
    </div>
    <div class="header-contact">
      <span><strong>MOBILE:</strong> {{company.phone}}</span>
      <span><strong>EMAIL:</strong> {{company.email}}</span>
    </div>
  </div>
  <div class="company-bar">{{company.address}}</div>

  <div class="content">
    <div class="to-section">
      <div class="to-label">To,</div>
      <div class="to-name">{{CLIENT_NAME}}</div>
      <div class="to-address">{{CLIENT_ADDRESS}}</div>
    </div>

    <div class="contract-box">
      <div class="ref-no">REF. NO: {{REF_NO}}</div>
      <h2>Lift Annual Maintenance Contract Agreement</h2>
    </div>

    <p class="intro">Dear Sir, We would like to undertake the maintenance of the lifts installed at your premises detailed below, under the following terms:</p>

    <table class="details-table">
      <tr><th colspan="2">Lift Installation Details</th></tr>
      <tr><td>Number of Lifts</td><td>{{NUM_LIFTS}}</td></tr>
      <tr><td>Lift Type</td><td>{{LIFT_TYPOLOGY}}</td></tr>
      <tr><td>Passenger Type</td><td>{{PASSENGER_TYPE}}</td></tr>
      <tr><td>Type of Service Contract</td><td>{{CONTRACT_TYPE}}</td></tr>
      <tr><td>Contract Period</td><td><strong>{{CONTRACT_PERIOD}}</strong></td></tr>
    </table>

    <div class="section-header">{{CONTRACT_TYPE}} Maintenance Contract</div>
    <!-- NONCOMP_START -->
    <p class="intro">This Contract includes servicing of the lifts such as examining the ropes and their attachments, examining the motor and gear, examining and lubricating the door locks, cleaning and lubricating the guides, lubricating all moving parts &amp; making minor adjustments so as to keep the lifts and its installation safe and in good working condition.</p>
    <p class="intro">This does not include major repairs, replacements of main machine set, steel wire rope, pulleys, hoist way damages, door closures, up-gradation, modernization and traveling electrical cable — these are chargeable separately. This also covers attending breakdown calls, attending periodical inspection carried out by Authorized Personnel. These jobs will be supervised &amp; attended by our well qualified &amp; trained technicians.</p>
    <!-- NONCOMP_END -->
    <!-- COMP_START -->
    <p class="intro">This Comprehensive Contract includes servicing of the lifts such as examining the ropes and their attachments, examining the motor and gear, examining and lubricating the door locks, cleaning and lubricating the guides, lubricating all moving parts &amp; making minor adjustments so as to keep the lifts and its installation safe and in good working condition.</p>
    <p class="intro">Unlike a non-comprehensive contract, this also covers the cost of spares, components, and labour for repairs and replacements arising out of normal wear and tear (excluding damage due to misuse, negligence, or force majeure). This also covers attending breakdown calls, attending periodical inspection carried out by Authorized Personnel. These jobs will be supervised &amp; attended by our well qualified &amp; trained technicians.</p>
    <!-- COMP_END -->
  </div>

  <div class="footer">
    <div class="footer-top">
      <div class="footer-brand">{{company.name}}</div>
      <div class="footer-contact">
        <span>{{company.phone}}</span>
        <span>{{company.email}}</span>
      </div>
    </div>
    <div class="footer-bottom">{{company.address}} | Maintenance &amp; Installation of All Types of Elevators</div>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="header-logo">{{company.logo}}</div>
      <div class="header-title">
        <h1>{{company.name}}</h1>
        <p>Maintenance &amp; Installation of All Types of Elevators</p>
      </div>
    </div>
    <div class="header-contact">
      <span><strong>MOBILE:</strong> {{company.phone}}</span>
      <span><strong>EMAIL:</strong> {{company.email}}</span>
    </div>
  </div>
  <div class="company-bar">{{company.address}}</div>

  <div class="content">
    <div class="section-header">Terms and Conditions</div>
    <ol class="terms-list">
      <li>Our authorized representative will attend the Maintenance and Servicing of your lift every 45 days on a working day. We will undertake the work of checking up of the installation of the lift, cleaning, oiling and greasing all the parts for which such servicing is necessary. As a part of the contract, we will supply the oil, grease, cotton waste and other required material for the servicing of the lift. We will take proper care of the lift and the accessories provided for the safe and smooth operation of the lift.</li>
      <li>Annual Maintenance Contract does not include major repairs, replacements of main machine set, steel wire rope, pulleys, hoist way damages, door closures, up-gradation, modernization and traveling electrical cable unless covered under a Comprehensive Contract. Cost of supply of the spares/components and the labour charges for the repairs and the replacements will be exclusively borne by you where not covered. The spares/components, after repairs shall not be covered by any guarantee unless expressly given. All implied conditions and warranties of law are hereby excluded. Dismantled old material will become our property. Suitable rebate for the dismantled old material will be given while giving the quotation for the same.</li>
      <li>On receiving a call/information from a responsible person from your site about the non-working of the lift or that the lift is out of order, we will send our Servicing/Maintenance Department staff to attend your complaint during the working hours. In case of any irregularity in the lift, you are requested to switch off the power supply immediately.</li>
      <li>You shall maintain the complete installation particularly inside of the lift car, lift shaft, entrance to the machine room and hoist way entrance clean and hassle free. Machine room should be kept under lock and key. Only our designated Servicing/Maintenance Department staff will enter the machine room.</li>
      <li>The Annual Maintenance Contract charges are exclusive of all Central/Inter Dominion State/Local taxes, Sales Tax, Terminal Octroi, or any other taxes/duties and levies. These, if payable at any time, will be recovered from you.</li>
      <li>The Annual Maintenance Contract will be valid for a period of one year from the date mentioned in the contract. The maintenance of the lift will be continued further subject to renewal of the contract and the payment of the contract charges.</li>
      <li>We shall not be liable for any wear &amp; tear, loss, damage or delay due to any cause beyond our reasonable control including but not limited to acts of government, strikes, lockouts, fire explosion, flood, theft, civil commotions, war, malicious mischief, act of God, or the lift and its parts or the machine room is interfered by the person not authorized by us.</li>
      <li>Outstanding payments due to us on any account will carry interest @ 24%. This, however, shall not affect our rights to terminate the contract.</li>
      <li>You will pay the government fees of Annual Inspection by PWD, Lift Inspector, etc.</li>
    </ol>
    <p class="intro" style="margin-top:14px; font-weight:600; color:#1a1a2e;">We reserve the right to suspend, call back service and/or discontinue any work under this contract with us until all outstanding payments shall have been made as agreed and we are assured of the subsequent payments of all the dues. We also reserve the right to cancel the contract if we find any unauthorized person tampers with the lift.</p>
  </div>

  <div class="footer">
    <div class="footer-top">
      <div class="footer-brand">{{company.name}}</div>
      <div class="footer-contact">
        <span>{{company.phone}}</span>
        <span>{{company.email}}</span>
      </div>
    </div>
    <div class="footer-bottom">{{company.address}} | Maintenance &amp; Installation of All Types of Elevators</div>
  </div>
</div>

<!-- PAGE 3 -->
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="header-logo">{{company.logo}}</div>
      <div class="header-title">
        <h1>{{company.name}}</h1>
        <p>Maintenance &amp; Installation of All Types of Elevators</p>
      </div>
    </div>
    <div class="header-contact">
      <span><strong>MOBILE:</strong> {{company.phone}}</span>
      <span><strong>EMAIL:</strong> {{company.email}}</span>
    </div>
  </div>
  <div class="company-bar">{{company.address}}</div>

  <div class="content">
    <p class="intro">This contract paper will be valid till the stipulated period. If there is a substantial gap between the submission of the paper and signing the Annual Maintenance Contract, the contract charges may vary.</p>

    <div class="section-header">Contract Charges [For One Year Contract]</div>
    <p class="intro">For a minimum period of one year &amp; shall continue thereafter until Agreement is Terminated by 30 days' notice to that effect given in writing by either end. Our charges for maintaining your lift is as under:</p>

    <table class="charges-table">
      <tr><th>Description</th><th style="text-align:right;">Amount (INR)</th></tr>
      <tr><td>Contract Amount — Per Lift ({{CONTRACT_TYPE}})</td><td class="amount" style="text-align:right;">{{CONTRACT_VALUE}}</td></tr>
      <tr><td>GST Extra @ {{GST_PERCENT}}%</td><td class="amount" style="text-align:right;">{{GST_AMOUNT}}</td></tr>
      <tr class="total-row"><td>Total Annual Contract Value (Incl. GST)</td><td style="text-align:right;">{{TOTAL_VALUE}}</td></tr>
    </table>

    <p class="intro" style="font-weight:600; color:#1a1a2e;">In Words: <em>{{AMOUNT_WORDS}}</em></p>
    <p class="intro">The payment shall be made in advance ({{PAYMENT_TERMS}}) in favor of <strong>"{{company.name}}"</strong>.</p>
    <p class="intro">The above charges are based on the current market cost of Labor &amp; materials &amp; shall be revised from time to time.</p>

    <div class="notes-box">
      <h4>Important Notes</h4>
      <ul class="notes-list">
        <li>The agreement does not cover charges for stand by units or Posting Mechanic on Social duty.</li>
        <li>The owner shall provide with proper lighting arrangements in Machine room, Hoist Way, Cabin top, Pit etc.</li>
        <li>This contract does not cover any alteration, Modernization or Modification Jobs.</li>
        <li>To Return {{company.name}} the dismantled material against any repairs/Replacements carried out by us.</li>
        <li>This contract when accepted by you and approved by {{company.name}} shall constitute the contract and prior representations or agreements not incorporated herein will be void. Contract Duration: {{DURATION}}.</li>
      </ul>
    </div>

    <div class="sig-section">
      <div class="sig-box">
        <div class="sig-line">Authorized Company Person</div>
        <div class="sig-role">For {{company.name}}</div>
        <div style="font-size:10.5px; color:#555; margin-top:8px;">Date: {{LETTER_DATE}}</div>
      </div>
      <div class="sig-box" style="text-align:right;">
        <div class="sig-line" style="text-align:right;">Accepted By</div>
        <div class="sig-role" style="text-align:right;">For {{CLIENT_NAME}}</div>
        <div style="font-size:10.5px; color:#555; margin-top:8px; text-align:right;">Date: _____________</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-top">
      <div class="footer-brand">{{company.name}}</div>
      <div class="footer-contact">
        <span>{{company.phone}}</span>
        <span>{{company.email}}</span>
      </div>
    </div>
    <div class="footer-bottom">{{company.address}} | Maintenance &amp; Installation of All Types of Elevators</div>
  </div>
</div>

</body>
</html>`
}
