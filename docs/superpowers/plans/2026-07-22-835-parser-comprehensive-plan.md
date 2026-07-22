# EDI 835 Parser — Comprehensive Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the EDI 835 parser to parse all meaningful 835 segments (envelope, header, payer/payee, claim, service line, summary), fix the broken test infrastructure, and write comprehensive tests.

**Architecture:** Phase-based state machine tracking loop context through a `phase` integer. Single pass through segments with contextual handlers. Backward compatibility via preserved flat fields on `file` and `remittances` objects.

**Tech Stack:** Node.js, CommonJS modules, Jest (no chai — remove ESM dependency)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/parsers/edi835.parser.js` | Rewrite | Loop-based parser with full segment coverage |
| `src/parsers/edi.utils.js` | Modify | Add DESCRIPTION maps for REF/AMT qualifiers |
| `tests/fixtures/sample.835.js` | Rewrite | Realistic multi-claim 835 test fixture |
| `tests/edi835.parser.test.js` | Rewrite | Comprehensive tests (jest native, no chai) |
| `tests/edi837.parser.test.js` | Modify | Convert chai→jest native |
| `tests/claims.test.js` | Modify | Convert chai→jest native |
| `tests/dashboard.test.js` | Modify | Convert chai→jest native |
| `tests/auth.test.js` | Modify | Convert chai→jest native |
| `tests/upload.test.js` | Modify | Convert chai→jest native |
| `package.json` | Modify | Remove chai dependency |

**Dependency graph:**
```
Task 1 (chai→jest) ──┐
                      ├──→ Task 5 (835 tests) ──→ Task 6 (full verify)
Task 2 (fixture) ─────┤
                      │
Task 3 (utils update) ─→ Task 4 (parser rewrite) ─┘
```

---

## Global Constraints

1. All existing consumers (`upload.service.js`, `models/Remittance.js`, `models/RemittanceFile.js`, `models/DenialReason.js`, `models/RemittanceLine.js`) must work without changes — flat fields on `file` and `remittances` objects must be preserved
2. Parser must handle malformed/partial input without throwing (empty string, missing segments, truncated files)
3. Parser must be a single-pass state machine — no multi-pass
4. Test runner is Jest with `--forceExit --detectOpenHandles`
5. `package.json` test scripts remain: `jest --forceExit --detectOpenHandles`

---

### Task 1: Fix Test Infrastructure (chai→Jest Native)

**Files:**
- Modify: `tests/edi837.parser.test.js` (convert chai to jest native)
- Modify: `tests/claims.test.js` (convert chai to jest native)
- Modify: `tests/dashboard.test.js` (convert chai to jest native)
- Modify: `tests/auth.test.js` (convert chai to jest native)
- Modify: `tests/upload.test.js` (convert chai to jest native)
- Modify: `package.json` (remove chai)

**Interfaces:**
- Consumes: (none — pure refactor)
- Produces: Working Jest test suite without chai dependency

- [ ] **Step 1: Read all test files to understand current chai usage**

Run: `Get-ChildItem -Recurse -Filter "*.test.js" -Path "tests" | ForEach-Object { $_.FullName }`

- [ ] **Step 2: Convert `edi837.parser.test.js` from chai to jest native**

Replace the entire file content:

```js
const { parse837 } = require('../src/parsers/edi837.parser');
const SAMPLE_837 = require('./fixtures/sample.837');

describe('EDI 837 Parser', () => {
  it('should parse metadata from ISA header', () => {
    const result = parse837(SAMPLE_837);
    expect(result.metadata.sender_id).toBe('SENDER');
    expect(result.metadata.control_number).toBe('000000001');
  });

  it('should extract claims from CLM segments', () => {
    const result = parse837(SAMPLE_837);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].claim_id).toBe('CLM001');
    expect(result.claims[0].total_charge).toBeCloseTo(250, 2);
  });

  it('should extract patient info', () => {
    const result = parse837(SAMPLE_837);
    expect(result.claims[0].patient_first_name).toBe('JOHN');
    expect(result.claims[0].patient_last_name).toBe('DOE');
    expect(result.claims[0].patient_dob).toBe('1980-01-15');
    expect(result.claims[0].patient_gender).toBe('M');
  });

  it('should extract subscriber ID', () => {
    expect(parse837(SAMPLE_837).claims[0].subscriber_id).toBe('ABC123456');
  });

  it('should extract service line items', () => {
    const claim = parse837(SAMPLE_837).claims[0];
    expect(claim.lines).toHaveLength(2);
    expect(claim.lines[0].procedure_code).toBe('99213');
    expect(claim.lines[0].charge_amount).toBeCloseTo(150, 2);
    expect(claim.lines[1].procedure_code).toBe('99214');
    expect(claim.lines[1].charge_amount).toBeCloseTo(100, 2);
  });

  it('should handle empty content', () => {
    expect(parse837('').claims).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Convert `tests/auth.test.js`**

Read the existing file first, then replace `const { expect } = require('chai')` with nothing (jest globals), and convert all `expect(...).to.equal(...)` → `expect(...).toBe(...)`, `.to.have.lengthOf` → `.toHaveLength`, `.to.be.closeTo` → `.toBeCloseTo`, `.to.be.true` → `.toBe(true)`, etc.

The actual content depends on what's in the file, so read it first and apply the same pattern as step 2.

- [ ] **Step 4: Convert `tests/claims.test.js`**

Same process as step 3 — read the file, convert chai assertions to jest native.

- [ ] **Step 5: Convert `tests/dashboard.test.js`**

Same process as step 3.

- [ ] **Step 6: Convert `tests/upload.test.js`**

Same process as step 3.

- [ ] **Step 7: Remove chai from package.json**

Edit `package.json` — remove the line `"chai": "^6.2.2"` from `devDependencies`.

- [ ] **Step 8: Run all tests to confirm they pass**

Run: `Set-Location -LiteralPath "C:\Denials\backend"; if ($?) { npx jest --forceExit --detectOpenHandles 2>&1 }`
Expected: All existing test suites pass (may be some 835 tests that still fail due to chai→jest conversion in the 835 test — check the output)

---

### Task 2: Create Comprehensive 835 Test Fixture

**Files:**
- Rewrite: `tests/fixtures/sample.835.js`

**Interfaces:**
- Consumes: (none — standalone data definition)
- Produces: `SAMPLE_835` string constant containing a realistic multi-claim 835 file with all segment types. The file must have exactly the structure the parser expects (tilde-delimited `~`).

- [ ] **Step 1: Write comprehensive 835 test fixture**

Write `tests/fixtures/sample.835.js`:

```js
// Comprehensive 835 test fixture covering all major segment types:
//   Envelope: ISA, GS, ST, SE, GE, IEA
//   Header:   BPR, TRN, DTM*405
//   Payer:    N1*PR, N3, N4, PER
//   Payee:    N1*PE, N3, N4, REF*TJ, PER
//   Claims:   CLP, NM1*QC, NM1*IL, DMG, NM1*82, NM1*85,
//             DTM (232/233/050/652/653), REF (1C/F8), AMT (I)
//             CAS (claim-level)
//   Lines:    SVC, CAS (line-level), DTM*472, REF*6R, AMT*B6, QTY
//   Summary:  PLB
//
// 3 claims:
//   CLM001 — Partial (paid 200 of 250, CO-45 adjustment on 99213 line)
//   CLM002 — Denied (PR-3 write-off, 300 charged 0 paid)
//   CLM003 — Paid in full (500 charged 500 paid)
//
// Total payment: 200 + 0 + 500 = 700

const SAMPLE_835 = [
  'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220715*0953*^*00501*000000002*0*P*:~',
  'GS*HP*SENDER*RECEIVER*20220715*0953*1*X*005010X221A1~',
  'ST*835*0002~',
  'BPR*I*700*C*CHK*********20220716~',
  'TRN*1*PAYREF001*SENDER~',
  'DTM*405*20220716~',
  'N1*PR*PAYER NAME*XV*123456789~',
  'N3*123 MAIN ST*SUITE 100~',
  'N4*METROPOLIS*NY*10001~',
  'PER*IC*JOHN SMITH*TE*5551234567*EM*JSMITH@PAYER.COM~',
  'N1*PE*PROVIDER NAME*XX*987654321~',
  'N3*456 OAK AVE~',
  'N4*ANYTOWN*CA*90210~',
  'REF*TJ*12-3456789~',
  'PER*IC*JANE DOE*TE*5559876543~',
  'CLP*CLM001*1*250*200*50*CO-45*CLM001*11*1~',
  'NM1*QC*1*DOE*JOHN****MI*MEM001~',
  'NM1*IL*1*DOE*JOHN****MI*SUB001~',
  'DMG*D8*19800115*M~',
  'NM1*82*1*SMITH*JANE****XX*1234567893~',
  'NM1*85*2*BILLING CLINIC*****XX*9876543212~',
  'DTM*232*20220701~',
  'DTM*233*20220715~',
  'DTM*050*20220720~',
  'REF*1C*1234567893~',
  'REF*F8*REF123~',
  'AMT*I*50~',
  'CAS*CO*45*50*50~',
  'SVC*HC:99213*150*120***1~',
  'CAS*CO*45*30*30~',
  'DTM*472*20220701~',
  'REF*6R*LN001~',
  'AMT*B6*10~',
  'QTY*CA*1~',
  'SVC*HC:99214*100*80***1~',
  'DTM*472*20220702~',
  'REF*6R*LN002~',
  'AMT*B6*20~',
  'CLP*CLM002*4*300*0*300*PR-3*CLM002*11*1~',
  'NM1*QC*1*SMITH*JANE****MI*MEM002~',
  'NM1*IL*1*SMITH*JANE****MI*SUB002~',
  'DMG*D8*19750620*F~',
  'CAS*PR*3*300*300~',
  'SVC*HC:99215*300*0***1~',
  'CAS*PR*3*300*300~',
  'DTM*472*20220705~',
  'REF*6R*LN003~',
  'CLP*CLM003*3*500*500*0***11*1~',
  'NM1*QC*1*JONES*BOB****MI*MEM003~',
  'NM1*IL*1*JONES*BOB****MI*SUB003~',
  'DMG*D8*19901201*M~',
  'NM1*82*1*LEE*SARAH****XX*1112223334~',
  'SVC*HC:99221*500*500***1~',
  'DTM*472*20220710~',
  'REF*6R*LN004~',
  'PLB*987654321*20220731*50*FB*BONUS001~',
  'SE*56*0002~',
  'GE*1*1~',
  'IEA*1*000000002~',
].join('');

module.exports = SAMPLE_835;
```

- [ ] **Step 2: Verify the fixture loads correctly**

Run: `node -e "const s = require('./tests/fixtures/sample.835'); console.log('Length:', s.length, 'Chars'); console.log('Starts with ISA:', s.startsWith('ISA')); console.log('Ends with ~:', s.endsWith('~')); console.log('Segment count:', s.split('~').length);"`
Expected: Shows valid fixture data with proper structure.

---

### Task 3: Update edi.utils.js with Qualifier Description Maps

**Files:**
- Modify: `src/parsers/edi.utils.js` (add description maps for REF/AMT qualifiers)

**Interfaces:**
- Consumes: (none — expands module exports)
- Produces: Exports `REF_QUALIFIER_DESCRIPTIONS` and `AMT_QUALIFIER_DESCRIPTIONS` maps

- [ ] **Step 1: Add qualifier description maps**

Read `src/parsers/edi.utils.js`, then append after the `parseEDIAmount` function (before `module.exports`):

```js
const REF_QUALIFIER_DESCRIPTIONS = {
  '1C': 'Rendering Provider NPI',
  '72': 'Rendering Provider ID',
  'TJ': 'Payee Tax ID',
  'F8': 'Original Reference Number',
  'PQ': 'Payee Additional ID',
  '1L': 'Subscriber ID',
  'D9': 'Claim Number',
  'EW': 'Prior Authorization Number',
  '9A': 'Repriced Claim Number',
  '4A': 'Claim ID',
  '6R': 'Line Item Control Number',
  'RB': 'Rate Code',
  'G1': 'Prior Authorization',
  'BB': 'Authorization Number',
  '0B': 'State License Number',
  '1A': 'Blue Cross ID',
  '1B': 'Commercial ID',
  '1D': 'Medicaid ID',
  '1G': 'Provider UPIN',
  '1H': 'CHAMPUS ID',
  'E8': 'Medical Record Number',
  'EA': 'Medical Record Identifier',
};

const AMT_QUALIFIER_DESCRIPTIONS = {
  '1': 'Auto Accident Dollar Amount',
  '2': 'Auto Accident Year',
  '3': 'Other Accident Date',
  '4': 'Employment Date',
  '5': 'Last Seen Date',
  '6': 'Treatment Authorized Days',
  'I': 'Interest Amount',
  'B6': 'Patient Liability Amount',
  'F': 'Claim Paid Amount',
  'AU': 'Claim Adjustment Amount',
  'D': 'Auto Accident State',
  'PBY': 'Payments - Billed',
  'NAT': 'National Amount',
  'T': 'Tax',
};

function getDescription(map, qualifier) {
  return map[qualifier] || '';
}
```

Then update the `module.exports`:

```js
module.exports = { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount, REF_QUALIFIER_DESCRIPTIONS, AMT_QUALIFIER_DESCRIPTIONS, getDescription };
```

---

### Task 4: Rewrite edi835.parser.js with Full Loop-Based Architecture

**Files:**
- Rewrite: `src/parsers/edi835.parser.js`

**Interfaces:**
- Consumes: `splitSegments`, `parseSegment`, `getSubElements`, `parseEDIDate`, `parseEDIAmount`, `REF_QUALIFIER_DESCRIPTIONS`, `AMT_QUALIFIER_DESCRIPTIONS`, `getDescription` from `./edi.utils`
- Produces: `parse835(content)` → `{ metadata, file, remittances, provider_adjustments }`

- [ ] **Step 1: Write the complete parser**

```js
const {
  splitSegments,
  parseSegment,
  getSubElements,
  parseEDIDate,
  parseEDIAmount,
  REF_QUALIFIER_DESCRIPTIONS,
  AMT_QUALIFIER_DESCRIPTIONS,
  getDescription,
} = require('./edi.utils');

/**
 * Parse EDI 835 Health Care Claim Payment/Advice
 *
 * Loop-based single-pass state machine:
 *   Phase 0: Envelope (ISA → GS → ST)
 *   Phase 1: Header   (BPR → TRN → DTM 405)
 *   Phase 2: Payer    (N1*PR → N3 → N4 → REF → PER)
 *   Phase 3: Payee    (N1*PE → N3 → N4 → REF → PER)
 *   Phase 4: Claims   (CLP → NM1 → CAS → DTM → REF → AMT → DMG → MIA → MOA)
 *     Phase 4a: SVC   (SVC → CAS → DTM → REF → AMT → QTY)
 *   Phase 5: Summary  (PLB)
 *   Phase 6: Trailers (SE → GE → IEA)
 */
function parse835(content) {
  const segments = splitSegments(content);
  if (segments.length === 0) {
    return { metadata: {}, file: createFile(), remittances: [], provider_adjustments: [] };
  }

  // --- Result containers ---
  const metadata = {};
  const file = createFile();
  const remittances = [];
  const provider_adjustments = [];
  let phase = 0; // 0=envelope, 1=header, 2=payer, 3=payee, 4=claim, 5=summary, 6=trailer
  let loopContext = null; // { type: 'PR'|'PE' }

  // --- Current claim/line being built ---
  let currentRemittance = null;
  let currentLine = null;
  let lineCounter = 0;

  // --- Helpers ---
  function resetFileContext() { loopContext = null; }

  function finalizeLine() {
    if (currentRemittance && currentLine) {
      currentRemittance.service_lines.push(currentLine);
      currentLine = null;
    }
  }

  function finalizeClaim() {
    finalizeLine();
    if (currentRemittance) {
      // Compute patient_name for backward compat
      currentRemittance.patient_name = `${currentRemittance.patient_first_name || ''} ${currentRemittance.patient_last_name || ''}`.trim();
      remittances.push(currentRemittance);
      currentRemittance = null;
    }
  }

  function createFile() {
    return {
      total_payment: 0,
      payment_method: '',
      payment_date: null,
      trace_number: '',
      sender_bank_id: '',
      sender_account: '',
      credit_debit_flag: '',
      payer_name: '',
      payer_id_code: '',
      payee_name: '',
      payee_id_code: '',
      payee_tax_id: '',
      payer: { name: '', id_code: '', id_qualifier: '', address: { address1: '', address2: '', city: '', state: '', zip: '' }, contact: { name: '', phone: '', email: '' } },
      payee: { name: '', id_code: '', id_qualifier: '', address: { address1: '', address2: '', city: '', state: '', zip: '' }, contact: { name: '', phone: '', email: '' }, additional_ids: [] },
    };
  }

  function createRemittance() {
    return {
      payer_claim_id: '',
      total_charge: 0,
      total_paid: 0,
      adjustment_amount: 0,
      status: '',
      claim_status_code: '',
      claim_filing_type: '',
      remittance_date: null,
      patient_name: '',
      patient_first_name: '',
      patient_last_name: '',
      patient_member_id: '',
      subscriber_id: '',
      subscriber_first_name: '',
      subscriber_last_name: '',
      rendering_provider_name: '',
      rendering_provider_npi: '',
      billing_provider_name: '',
      billing_provider_npi: '',
      service_date_from: null,
      service_date_to: null,
      claim_statement_from: null,
      claim_statement_to: null,
      patient_dob: null,
      patient_gender: '',
      refs: [],
      amts: [],
      denial_reasons: [],
      service_lines: [],
      patient: { first_name: '', last_name: '', member_id: '' },
      subscriber: { first_name: '', last_name: '', subscriber_id: '' },
      rendering_provider: { name: '', npi: '' },
      billing_provider: { name: '', npi: '' },
      service_dates: { from: null, to: null },
      inpatient_info: null,
      outpatient_info: null,
    };
  }

  function createLine() {
    lineCounter++;
    return {
      line_number: lineCounter,
      procedure_code: '',
      modifier: '',
      charge_amount: 0,
      paid_amount: 0,
      unit_count: 0,
      service_date: null,
      line_control_number: '',
      patient_liability: 0,
      quantity_adjustments: [],
      denial_reasons: [],
    };
  }

  // --- Main parsing loop ---
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;

    const elements = parseSegment(segment);
    const segId = elements[0];

    switch (segId) {
      // ── Phase 0: Envelope ──
      case 'ISA': {
        metadata.sender_id = (elements[6] || '').trim();
        metadata.receiver_id = (elements[8] || '').trim();
        metadata.date = (elements[9] || '').trim();
        metadata.time = (elements[10] || '').trim();
        metadata.control_number = (elements[13] || '').trim();
        metadata.standards_id = (elements[12] || '').trim();
        phase = 0;
        break;
      }
      case 'GS': {
        metadata.gs_sender = (elements[2] || '').trim();
        metadata.gs_receiver = (elements[3] || '').trim();
        metadata.gs_date = (elements[4] || '').trim();
        metadata.gs_time = (elements[5] || '').trim();
        metadata.gs_control_number = (elements[6] || '').trim();
        metadata.gs_version = (elements[8] || '').trim();
        break;
      }
      case 'ST': {
        metadata.st_transaction_id = (elements[1] || '').trim();
        metadata.st_control_number = (elements[2] || '').trim();
        break;
      }

      // ── Phase 1: Header ──
      case 'BPR': {
        file.total_payment = parseEDIAmount(elements[2]);
        file.credit_debit_flag = elements[3] || '';
        file.payment_method = elements[4] || '';
        file.sender_bank_id = elements[7] || '';
        file.sender_account = elements[9] || '';
        file.payment_date = parseEDIDate(elements[16]) || parseEDIDate(elements[14]) || null;
        phase = 1;
        resetFileContext();
        break;
      }
      case 'TRN': {
        file.trace_number = elements[2] || '';
        break;
      }

      // ── Phase 2: Payer Loop (N1*PR) ──
      // ── Phase 3: Payee Loop (N1*PE) ──
      case 'N1': {
        const n1Entity = elements[1] || '';
        const n1Name = elements[2] || '';
        const n1IdQual = (elements[3] || '').trim();
        const n1Id = (elements[4] || '').trim();
        const idCode = n1IdQual ? `${n1IdQual}:${n1Id}` : '';

        if (n1Entity === 'PR') {
          file.payer_name = n1Name;
          file.payer_id_code = idCode;
          file.payer.name = n1Name;
          file.payer.id_code = n1Id;
          file.payer.id_qualifier = n1IdQual;
          loopContext = { type: 'PR' };
          phase = 2;
        } else if (n1Entity === 'PE') {
          file.payee_name = n1Name;
          file.payee_id_code = idCode;
          file.payee.name = n1Name;
          file.payee.id_code = n1Id;
          file.payee.id_qualifier = n1IdQual;
          loopContext = { type: 'PE' };
          phase = 3;
        } else {
          loopContext = null;
        }
        break;
      }
      case 'N3': {
        if (!loopContext) break;
        const target = loopContext.type === 'PR' ? file.payer : file.payee;
        target.address.address1 = elements[1] || '';
        target.address.address2 = elements[2] || '';
        break;
      }
      case 'N4': {
        if (!loopContext) break;
        const target = loopContext.type === 'PR' ? file.payer : file.payee;
        target.address.city = elements[1] || '';
        target.address.state = elements[2] || '';
        target.address.zip = elements[3] || '';
        break;
      }
      case 'PER': {
        if (!loopContext) break;
        const target = loopContext.type === 'PR' ? file.payer : file.payee;
        target.contact.name = elements[2] || '';
        // PER can have multiple communication numbers at varying positions
        for (let j = 3; j + 1 < elements.length; j += 2) {
          const qual = (elements[j] || '').trim();
          const value = elements[j + 1] || '';
          if (qual === 'TE') target.contact.phone = value;
          else if (qual === 'EM') target.contact.email = value;
          else if (qual === 'FX') ; // fax - not stored currently
        }
        break;
      }
      case 'REF': {
        const refQual = (elements[1] || '').trim();
        const refValue = elements[2] || '';
        const refDesc = getDescription(REF_QUALIFIER_DESCRIPTIONS, refQual);

        if (loopContext && loopContext.type === 'PE') {
          // Payee-level REFs
          if (refQual === 'TJ') {
            file.payee_tax_id = refValue;
          }
          file.payee.additional_ids.push({ qualifier: refQual, value: refValue, description: refDesc });
        } else if (currentRemittance) {
          // Claim-level REFs
          if (refQual === '1C' && !currentRemittance.rendering_provider_npi) {
            currentRemittance.rendering_provider_npi = refValue;
            currentRemittance.rendering_provider.npi = refValue;
          }
          currentRemittance.refs.push({ qualifier: refQual, value: refValue, description: refDesc });
        } else if (currentLine) {
          // Line-level REF
          if (refQual === '6R') {
            currentLine.line_control_number = refValue;
          }
        }
        break;
      }

      // ── DTM (can appear in header, claim, and line contexts) ──
      case 'DTM': {
        const dtmQual = (elements[1] || '').trim();
        const dtmDate = parseEDIDate(elements[2]);

        if (dtmQual === '405' && !file.payment_date) {
          file.payment_date = dtmDate;
        }
        if (currentRemittance) {
          if (dtmQual === '232') { currentRemittance.service_date_from = dtmDate; currentRemittance.service_dates.from = dtmDate; }
          else if (dtmQual === '233') { currentRemittance.service_date_to = dtmDate; currentRemittance.service_dates.to = dtmDate; }
          else if (dtmQual === '050') { currentRemittance.remittance_date = dtmDate; }
          else if (dtmQual === '652') { currentRemittance.claim_statement_from = dtmDate; }
          else if (dtmQual === '653') { currentRemittance.claim_statement_to = dtmDate; }
        }
        if (currentLine && dtmQual === '472') {
          currentLine.service_date = dtmDate;
        }
        break;
      }

      // ── Phase 4: Claims ──
      case 'CLP': {
        finalizeClaim();
        lineCounter = 0;
        phase = 4;

        const clpClaimId = elements[1] || '';
        const clpStatusCode = elements[2] || '';
        const clpCharge = parseEDIAmount(elements[3]);
        const clpPaid = parseEDIAmount(elements[4]);
        const clpAdjust = parseEDIAmount(elements[5]) - parseEDIAmount(elements[2]); // actually element 5 is payment adjustment
        const clpPayerClaimId = elements[7] || clpClaimId;
        const clpFilingType = elements.length > 8 ? (elements[8] || '').trim() : '';

        let status = 'pending';
        if (clpPaid >= clpCharge && clpCharge > 0) status = 'paid';
        else if (clpPaid > 0) status = 'partial';
        else status = 'denied';

        currentRemittance = createRemittance();
        currentRemittance.payer_claim_id = clpPayerClaimId;
        currentRemittance.total_charge = clpCharge;
        currentRemittance.total_paid = clpPaid;
        currentRemittance.adjustment_amount = parseEDIAmount(elements[5]) || 0;
        currentRemittance.status = status;
        currentRemittance.claim_status_code = clpStatusCode;
        currentRemittance.claim_filing_type = clpFilingType;
        break;
      }

      // ── NM1 (patient, subscriber, providers) ──
      case 'NM1': {
        if (!currentRemittance) break;
        const nm1Qual = elements[1] || '';
        const nm1Last = elements[3] || '';
        const nm1First = elements[4] || '';
        const nm1Id = elements[9] || '';

        if (nm1Qual === 'QC') {
          currentRemittance.patient_last_name = nm1Last;
          currentRemittance.patient_first_name = nm1First;
          currentRemittance.patient_member_id = nm1Id;
          currentRemittance.patient.last_name = nm1Last;
          currentRemittance.patient.first_name = nm1First;
          currentRemittance.patient.member_id = nm1Id;
        } else if (nm1Qual === 'IL') {
          currentRemittance.subscriber_id = nm1Id;
          currentRemittance.subscriber.subscriber_id = nm1Id;
          currentRemittance.subscriber.last_name = nm1Last;
          currentRemittance.subscriber.first_name = nm1First;
        } else if (nm1Qual === '82') {
          currentRemittance.rendering_provider_name = `${nm1First} ${nm1Last}`.trim();
          currentRemittance.rendering_provider.name = `${nm1First} ${nm1Last}`.trim();
        } else if (nm1Qual === '85') {
          currentRemittance.billing_provider_name = `${nm1First} ${nm1Last}`.trim();
          currentRemittance.billing_provider.name = `${nm1First} ${nm1Last}`.trim();
        }
        // Extract NPI from element 9 when qualifier is XX
        const nm1IdQual = (elements[8] || '').trim();
        if (nm1IdQual === 'XX') {
          if (nm1Qual === '82') {
            currentRemittance.rendering_provider_npi = nm1Id;
            currentRemittance.rendering_provider.npi = nm1Id;
          } else if (nm1Qual === '85') {
            currentRemittance.billing_provider_npi = nm1Id;
            currentRemittance.billing_provider.npi = nm1Id;
          }
        }
        break;
      }

      // ── DMG (Patient Demographics) ──
      case 'DMG': {
        if (!currentRemittance) break;
        currentRemittance.patient_dob = parseEDIDate(elements[2]);
        currentRemittance.patient_gender = elements[3] || '';
        break;
      }

      // ── AMT (can appear at claim or line level) ──
      case 'AMT': {
        const amtQual = (elements[1] || '').trim();
        const amtValue = parseEDIAmount(elements[2]);

        if (currentLine && amtQual === 'B6') {
          currentLine.patient_liability = amtValue;
        }
        if (currentRemittance) {
          currentRemittance.amts.push({
            qualifier: amtQual,
            value: amtValue,
            description: getDescription(AMT_QUALIFIER_DESCRIPTIONS, amtQual),
          });
        }
        break;
      }

      // ── CAS (Adjustments at claim or line level) ──
      case 'CAS': {
        const casGroupCode = elements[1] || '';

        if (currentLine) {
          for (let j = 2; j + 2 < elements.length; j += 3) {
            const code = elements[j];
            const amount = parseEDIAmount(elements[j + 1]);
            currentLine.denial_reasons.push({
              denial_code: `${casGroupCode}-${code}`,
              group_code: casGroupCode,
              amount,
              reason_description: '',
            });
          }
        } else if (currentRemittance) {
          for (let j = 2; j + 2 < elements.length; j += 3) {
            const code = elements[j];
            const amount = parseEDIAmount(elements[j + 1]);
            currentRemittance.denial_reasons.push({
              denial_code: `${casGroupCode}-${code}`,
              group_code: casGroupCode,
              amount,
              reason_description: '',
            });
          }
        }
        break;
      }

      // ── SVC (Service Line) ──
      case 'SVC': {
        if (!currentRemittance) break;
        finalizeLine();

        const svcElements = getSubElements(elements[1] || '');
        // Composite: typically "HC:CPTCODE" or just "CPTCODE"
        const procCode = svcElements.length >= 2 ? svcElements[1] : (svcElements[0] || '');
        const modifier = svcElements.length >= 3 ? svcElements.slice(2).filter(Boolean).join(':') : '';

        currentLine = createLine();
        currentLine.procedure_code = procCode;
        currentLine.modifier = modifier;
        currentLine.charge_amount = parseEDIAmount(elements[2]);
        currentLine.paid_amount = parseEDIAmount(elements[3]);
        currentLine.unit_count = parseEDIAmount(elements[5]) || 1;
        break;
      }

      // ── QTY (Quantity adjustments at line level) ──
      case 'QTY': {
        if (!currentLine) break;
        const qtyQual = (elements[1] || '').trim();
        const qtyValue = parseEDIAmount(elements[2]);
        currentLine.quantity_adjustments.push({ qualifier: qtyQual, value: qtyValue });
        break;
      }

      // ── MIA (Inpatient Adjudication) ──
      case 'MIA': {
        if (!currentRemittance) break;
        currentRemittance.inpatient_info = {
          covered_days: parseEDIAmount(elements[1]),
          pps_code: elements[2] || '',
          total_covered_days: parseEDIAmount(elements[3]),
          drg: elements[9] || '',
          discharge_status: elements[14] || '',
          total_adjustment: parseEDIAmount(elements[5]),
        };
        break;
      }

      // ── MOA (Outpatient Adjudication) ──
      case 'MOA': {
        if (!currentRemittance) break;
        const remarkCodes = [];
        for (let j = 2; j <= 4; j++) {
          if (elements[j]) remarkCodes.push(elements[j]);
        }
        currentRemittance.outpatient_info = {
          reimbursement: parseEDIAmount(elements[1]),
          remark_codes: remarkCodes,
        };
        break;
      }

      // ── Phase 5: Summary (PLB) ──
      case 'PLB': {
        phase = 5;
        // PLB*provider_id*date*reason_code1*amount1*reason_code2*amount2...
        // Multiple adjustments can appear in a single PLB
        for (let j = 3; j + 1 < elements.length; j += 2) {
          provider_adjustments.push({
            provider_identifier: elements[1] || '',
            adjustment_date: parseEDIDate(elements[2]),
            adjustment_reason_code: elements[j] || '',
            adjustment_amount: parseEDIAmount(elements[j + 1]),
            reference_identification: '',
          });
        }
        break;
      }

      // ── Phase 6: Trailers ──
      case 'SE': {
        finalizeClaim();
        metadata.total_segments = parseInt(elements[1], 10) || 0;
        phase = 6;
        break;
      }
      case 'GE': {
        metadata.total_functional_groups = parseInt(elements[1], 10) || 0;
        break;
      }
      case 'IEA': {
        metadata.interchange_control_number = (elements[2] || '').trim();
        break;
      }
    }
  }

  // Finalize any remaining claim
  finalizeClaim();

  return { metadata, file, remittances, provider_adjustments };
}

module.exports = { parse835 };
```

---

### Task 5: Write Comprehensive 835 Parser Tests

**Files:**
- Rewrite: `tests/edi835.parser.test.js`

**Interfaces:**
- Consumes: `parse835` from `../src/parsers/edi835.parser`, `SAMPLE_835` from `./fixtures/sample.835`
- Produces: Full test coverage of all 835 segments and edge cases

- [ ] **Step 1: Write comprehensive test file**

```js
const { parse835 } = require('../src/parsers/edi835.parser');
const SAMPLE_835 = require('./fixtures/sample.835');

describe('EDI 835 Parser — Comprehensive', () => {
  // ── Envelope ──
  describe('Envelope (ISA/GS/ST/SE/GE/IEA)', () => {
    it('should parse ISA metadata', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.sender_id).toBe('SENDER');
      expect(result.metadata.receiver_id).toBe('RECEIVER');
      expect(result.metadata.date).toBe('220715');
      expect(result.metadata.time).toBe('0953');
      expect(result.metadata.control_number).toBe('000000002');
    });

    it('should parse GS metadata', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.gs_sender).toBe('SENDER');
      expect(result.metadata.gs_receiver).toBe('RECEIVER');
      expect(result.metadata.gs_date).toBe('20220715');
      expect(result.metadata.gs_control_number).toBe('1');
      expect(result.metadata.gs_version).toBe('005010X221A1');
    });

    it('should parse ST header', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.st_transaction_id).toBe('835');
      expect(result.metadata.st_control_number).toBe('0002');
    });

    it('should parse SE trailer', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.total_segments).toBe(56);
    });

    it('should parse IEA control number', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.interchange_control_number).toBe('000000002');
    });
  });

  // ── Header ──
  describe('Header (BPR/TRN/DTM 405)', () => {
    it('should parse BPR payment info', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.total_payment).toBeCloseTo(700, 2);
      expect(result.file.payment_method).toBe('CHK');
      expect(result.file.payment_date).toBe('2022-07-16');
      expect(result.file.credit_debit_flag).toBe('C');
    });

    it('should parse TRN trace number', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.trace_number).toBe('PAYREF001');
    });
  });

  // ── Payer/Payee ──
  describe('Payer/Payee (N1/N3/N4/REF/PER)', () => {
    it('should parse payer info', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.payer.name).toBe('PAYER NAME');
      expect(result.file.payer.id_code).toBe('123456789');
      expect(result.file.payer.id_qualifier).toBe('XV');
      expect(result.file.payer.address.address1).toBe('123 MAIN ST');
      expect(result.file.payer.address.address2).toBe('SUITE 100');
      expect(result.file.payer.address.city).toBe('METROPOLIS');
      expect(result.file.payer.address.state).toBe('NY');
      expect(result.file.payer.address.zip).toBe('10001');
      expect(result.file.payer.contact.name).toBe('JOHN SMITH');
      expect(result.file.payer.contact.phone).toBe('5551234567');
      expect(result.file.payer.contact.email).toBe('JSMITH@PAYER.COM');
    });

    it('should parse payee info', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.payee.name).toBe('PROVIDER NAME');
      expect(result.file.payee.id_code).toBe('987654321');
      expect(result.file.payee.id_qualifier).toBe('XX');
      expect(result.file.payee.address.address1).toBe('456 OAK AVE');
      expect(result.file.payee.address.city).toBe('ANYTOWN');
      expect(result.file.payee.address.state).toBe('CA');
      expect(result.file.payee.address.zip).toBe('90210');
      expect(result.file.payee.contact.name).toBe('JANE DOE');
      expect(result.file.payee.contact.phone).toBe('5559876543');
    });

    it('should parse payee tax ID', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.payee_tax_id).toBe('12-3456789');
      const tjRef = result.file.payee.additional_ids.find(r => r.qualifier === 'TJ');
      expect(tjRef).toBeDefined();
      expect(tjRef.value).toBe('12-3456789');
    });

    // Backward compat — flat fields
    it('should preserve flat payer/payee fields for backward compat', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.payer_name).toBe('PAYER NAME');
      expect(result.file.payee_name).toBe('PROVIDER NAME');
    });
  });

  // ── Claims ──
  describe('Claims (CLP)', () => {
    it('should extract all remittances', () => {
      const result = parse835(SAMPLE_835);
      expect(result.remittances).toHaveLength(3);
    });

    it('should parse CLP fields for partial claim', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.payer_claim_id).toBe('CLM001');
      expect(remit.total_charge).toBeCloseTo(250, 2);
      expect(remit.total_paid).toBeCloseTo(200, 2);
      expect(remit.adjustment_amount).toBeCloseTo(50, 2);
      expect(remit.status).toBe('partial');
      expect(remit.claim_status_code).toBe('1');
      expect(remit.claim_filing_type).toBe('11');
    });

    it('should parse fully denied claim', () => {
      const remit = parse835(SAMPLE_835).remittances[1];
      expect(remit.total_charge).toBeCloseTo(300, 2);
      expect(remit.total_paid).toBeCloseTo(0, 2);
      expect(remit.status).toBe('denied');
    });

    it('should parse fully paid claim', () => {
      const remit = parse835(SAMPLE_835).remittances[2];
      expect(remit.total_charge).toBeCloseTo(500, 2);
      expect(remit.total_paid).toBeCloseTo(500, 2);
      expect(remit.status).toBe('paid');
    });
  });

  // ── Patient / Subscriber / Provider Names ──
  describe('Patient / Subscriber / Provider (NM1)', () => {
    it('should parse patient info from NM1*QC', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.patient_first_name).toBe('JOHN');
      expect(remit.patient_last_name).toBe('DOE');
      expect(remit.patient_member_id).toBe('MEM001');
      expect(remit.patient.first_name).toBe('JOHN');
      expect(remit.patient.last_name).toBe('DOE');
      expect(remit.patient.member_id).toBe('MEM001');
      expect(remit.patient_name).toBe('JOHN DOE');
    });

    it('should parse subscriber info from NM1*IL', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.subscriber_id).toBe('SUB001');
      expect(remit.subscriber.subscriber_id).toBe('SUB001');
    });

    it('should parse rendering provider from NM1*82', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.rendering_provider_name).toBe('JANE SMITH');
      expect(remit.rendering_provider.name).toBe('JANE SMITH');
      expect(remit.rendering_provider_npi).toBe('1234567893');
      expect(remit.rendering_provider.npi).toBe('1234567893');
    });

    it('should parse billing provider from NM1*85', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.billing_provider_name).toBe('BILLING CLINIC');
      expect(remit.billing_provider.name).toBe('BILLING CLINIC');
    });
  });

  // ── Demographics ──
  describe('Patient Demographics (DMG)', () => {
    it('should parse patient DOB and gender', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.patient_dob).toBe('1980-01-15');
      expect(remit.patient_gender).toBe('M');
    });
  });

  // ── Dates ──
  describe('Dates (DTM)', () => {
    it('should parse service dates from DTM 232/233', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.service_date_from).toBe('2022-07-01');
      expect(remit.service_date_to).toBe('2022-07-15');
      expect(remit.service_dates.from).toBe('2022-07-01');
      expect(remit.service_dates.to).toBe('2022-07-15');
    });

    it('should parse remittance date from DTM 050', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.remittance_date).toBe('2022-07-20');
    });
  });

  // ── References ──
  describe('References (REF)', () => {
    it('should collect claim-level REFs', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      const ref1C = remit.refs.find(r => r.qualifier === '1C');
      expect(ref1C).toBeDefined();
      expect(ref1C.value).toBe('1234567893');
      expect(ref1C.description).toBe('Rendering Provider NPI');
      const refF8 = remit.refs.find(r => r.qualifier === 'F8');
      expect(refF8).toBeDefined();
      expect(refF8.value).toBe('REF123');
    });
  });

  // ── Monetary Amounts ──
  describe('Monetary Amounts (AMT)', () => {
    it('should collect claim-level AMTs', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      const amtI = remit.amts.find(a => a.qualifier === 'I');
      expect(amtI).toBeDefined();
      expect(amtI.value).toBeCloseTo(50, 2);
      expect(amtI.description).toBe('Interest Amount');
    });
  });

  // ── Denial Reasons ──
  describe('Denial Reasons (CAS)', () => {
    it('should parse claim-level CAS', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      const co45 = remit.denial_reasons.find(d => d.denial_code === 'CO-45');
      expect(co45).toBeDefined();
      expect(co45.amount).toBeCloseTo(50, 2);
      expect(co45.group_code).toBe('CO');
    });

    it('should parse claim-level CAS on denied claim', () => {
      const remit = parse835(SAMPLE_835).remittances[1];
      const pr3 = remit.denial_reasons.find(d => d.denial_code === 'PR-3');
      expect(pr3).toBeDefined();
      expect(pr3.amount).toBeCloseTo(300, 2);
      expect(pr3.group_code).toBe('PR');
    });
  });

  // ── Service Lines ──
  describe('Service Lines (SVC)', () => {
    it('should parse service lines for partial claim', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.service_lines).toHaveLength(2);
    });

    it('should parse SVC fields', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.line_number).toBe(1);
      expect(line.procedure_code).toBe('99213');
      expect(line.charge_amount).toBeCloseTo(150, 2);
      expect(line.paid_amount).toBeCloseTo(120, 2);
      expect(line.unit_count).toBeCloseTo(1, 2);
    });

    it('should parse line-level CAS', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      const co45 = line.denial_reasons.find(d => d.denial_code === 'CO-45');
      expect(co45).toBeDefined();
      expect(co45.amount).toBeCloseTo(30, 2);
    });

    it('should parse line-level DTM 472', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.service_date).toBe('2022-07-01');
    });

    it('should parse REF 6R line control number', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.line_control_number).toBe('LN001');
    });

    it('should parse AMT B6 patient liability', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.patient_liability).toBeCloseTo(10, 2);
    });

    it('should parse QTY quantity adjustments', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.quantity_adjustments).toHaveLength(1);
      expect(line.quantity_adjustments[0].qualifier).toBe('CA');
      expect(line.quantity_adjustments[0].value).toBeCloseTo(1, 2);
    });

    it('should parse service lines for denied claim', () => {
      const remit = parse835(SAMPLE_835).remittances[1];
      expect(remit.service_lines).toHaveLength(1);
      expect(remit.service_lines[0].procedure_code).toBe('99215');
      expect(remit.service_lines[0].paid_amount).toBeCloseTo(0, 2);
      const pr3 = remit.service_lines[0].denial_reasons.find(d => d.denial_code === 'PR-3');
      expect(pr3).toBeDefined();
      expect(pr3.amount).toBeCloseTo(300, 2);
    });
  });

  // ── Provider Adjustments ──
  describe('Provider Adjustments (PLB)', () => {
    it('should parse PLB provider adjustments', () => {
      const result = parse835(SAMPLE_835);
      expect(result.provider_adjustments).toHaveLength(1);
      expect(result.provider_adjustments[0].adjustment_reason_code).toBe('FB');
      expect(result.provider_adjustments[0].adjustment_amount).toBeCloseTo(50, 2);
    });
  });

  // ── Edge Cases ──
  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const result = parse835('');
      expect(result.remittances).toHaveLength(0);
      expect(result.metadata).toBeDefined();
      expect(result.file).toBeDefined();
      expect(result.provider_adjustments).toHaveLength(0);
    });

    it('should handle content with only headers (no claims)', () => {
      const headerOnly = [
        'ISA*00*          *00*          *ZZ*SENDER*ZZ*RECEIVER*220715*0953*^*00501*000000002*0*P*:~',
        'GS*HP*SENDER*RECEIVER*20220715*0953*1*X*005010X221A1~',
        'ST*835*0002~',
        'SE*3*0002~',
        'GE*1*1~',
        'IEA*1*000000002~',
      ].join('');
      const result = parse835(headerOnly);
      expect(result.metadata.sender_id.trim()).toBe('SENDER');
      expect(result.remittances).toHaveLength(0);
    });

    it('should handle multiple claims', () => {
      const result = parse835(SAMPLE_835);
      expect(result.remittances).toHaveLength(3);
    });
  });
});
```

- [ ] **Step 2: Run 835 parser tests**

Run: `Set-Location -LiteralPath "C:\Denials\backend"; if ($?) { npx jest edi835.parser.test.js --forceExit --detectOpenHandles 2>&1 }`
Expected: All tests pass. If any fail, fix and re-run.

---

### Task 6: Full Integration Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run complete test suite**

Run: `Set-Location -LiteralPath "C:\Denials\backend"; if ($?) { npx jest --forceExit --detectOpenHandles 2>&1 }`
Expected: All suites pass (835 parser, 837 parser, auth, claims, dashboard, upload).

- [ ] **Step 2: Run LSP diagnostics**

Run: `lsp_diagnostics("*")`
Expected: No type errors or warnings.

- [ ] **Step 3: Verify no chai dependency remains**

Run: `node -e "try { require('chai'); console.log('CHAIS STILL INSTALLED'); } catch(e) { console.log('OK: chai not found'); }"` (run from backend dir)
Expected: "OK: chai not found"

- [ ] **Step 4: Update package-lock.json**

Run: `Set-Location -LiteralPath "C:\Denials\backend"; if ($?) { npm install 2>&1 | Out-Null; Write-Output "npm install done" }`
Expected: npm completes without errors.

- [ ] **Step 5: Final test run**

Run: `Set-Location -LiteralPath "C:\Denials\backend"; if ($?) { npx jest --forceExit --detectOpenHandles 2>&1 }`
Expected: All tests pass with clean output.
