# EDI 837 Parser — Comprehensive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the 837 EDI parser with HL hierarchy tracking, unified output schema for 837P/I/D, comprehensive test coverage, and fix broken test infrastructure.

**Architecture:** Single-pass loop-based parser with an HL stack tracking the current hierarchy level (Billing Provider → Subscriber → Patient). Context accumulates as we descend and finalizes as we ascend. Same pattern as the existing 835 parser.

**Tech Stack:** Node.js, Jest, Sequelize (models), PostgreSQL (database)

## Global Constraints

- All test files must use Jest native `expect` — NOT chai (chai 6.x is ESM-only and breaks Jest CJS mode)
- The parser output must be backward-compatible: existing `claims[].claim_id`, `total_charge`, `patient_first_name`, `patient_last_name`, `patient_dob`, `patient_gender`, `subscriber_id`, `payer_name`, `provider_name`, `provider_npi`, `service_date_start`, `service_date_end`, `lines[].line_number`, `procedure_code`, `charge_amount`, `service_date` fields must still be present
- New fields (diagnosis_codes[], refs[], amts[], etc.) are additive — existing consumers ignore them until updated
- All HI diagnosis codes use the format `[{ code: string, qualifier: string, type: string }]`
- All SV* segments must handle procedure code with modifier (e.g., `HC:99213:11` → procedure_code=`99213`, modifier=`11`)
- All three fixture files must be valid syntax that `require()` can load

---

### Task 1: Fix Test Infrastructure — Replace chai with Jest across all test files

**Files:**
- Modify: `tests/edi837.parser.test.js` (all lines)
- Modify: `tests/edi835.parser.test.js` (chai import line only)
- Modify: `tests/claims.test.js` (chai import line only)
- Modify: `tests/dashboard.test.js` (chai import line only)
- Modify: `tests/auth.test.js` (chai import line only)
- Modify: `tests/upload.test.js` (chai import line only)
- Modify: `package.json` (remove chai from devDependencies)

**Interfaces:**
- Consumes: None
- Produces: All tests use Jest native `expect`, chai package removed

- [ ] **Step 1: Replace chai in edi837.parser.test.js**

Current:
```js
const { expect } = require('chai');
```
Replace with:
```js
// chai removed — using Jest native expect
```

Tests use `expect(actual).to.equal(expected)` — replace with `expect(actual).toBe(expected)`. Replace `.to.be.closeTo(a, b)` with `.toBeCloseTo(a, b)`. Replace `.to.have.lengthOf(n)` with `.toHaveLength(n)`.

- [ ] **Step 2: Replace chai in edi835.parser.test.js**

Same change as step 1 — replace chai import with Jest native `expect`.

- [ ] **Step 3: Replace chai in claims.test.js, dashboard.test.js, auth.test.js, upload.test.js**

Same change — find `const { expect } = require('chai')` and replace with Jest native usage. Replace all chai assertions with Jest equivalents:
- `to.equal(x)` → `toBe(x)`
- `to.have.lengthOf(x)` → `toHaveLength(x)`
- `to.be.closeTo(x, p)` → `toBeCloseTo(x, p)`
- `to.be.true` → `toBe(true)`
- `to.be.null` → `toBeNull()`
- `to.deep.equal(x)` → `toEqual(x)`
- `to.include(x)` → `toContain(x)`
- `to.be.above(x)` → `toBeGreaterThan(x)`
- `to.be.below(x)` → `toBeLessThan(x)`
- `to.throw()` → `toThrow()`
- `to.exist` → `toBeDefined()`
- `to.be.ok` → `toBeTruthy()`
- `to.have.property(x)` → `toHaveProperty(x)`

- [ ] **Step 4: Remove chai from package.json and rebuild**

```bash
npm uninstall chai
npm install
```

- [ ] **Step 5: Verify all tests pass (will fail due to pending implementation — verify tests RUN, not that assertions pass)**

Run: `npx jest --forceExit --detectOpenHandles 2>&1`

Expected: No "unexpected token 'export'" errors. Tests may fail on assertions but must not fail on chai import.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: replace chai with Jest native expect across all test files"
```

---

### Task 2: Replace 837P Professional Fixture (sample.837.js)

**Files:**
- Modify: `tests/fixtures/sample.837.js` — Complete replacement

**Interfaces:**
- Consumes: None
- Produces: `module.exports = SAMPLE_837` — a realistic multi-claim 837P string

- [ ] **Step 1: Write the new comprehensive 837P fixture**

```js
// tests/fixtures/sample.837.js
const SAMPLE_837 = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220701*1253*^*00501*000000001*0*P*:~
GS*HC*SENDER*RECEIVER*20220701*1253*1*X*005010X222A1~
ST*837*0001~
BHT*0019*00*12345*20220701*1253*CH~
HL*1**20*1~
NM1*85*2*ACME MEDICAL GROUP*****XX*1234567893~
N3*123 MAIN STREET*SUITE 100~
N4*ANYTOWN*CA*90210~
REF*EI*123456789~
PER*IC*JANE SMITH*TE*5551234567~
HL*2*1*22*1~
SBR*P*18*******CI~
NM1*IL*1*DOE*JOHN****MI*ABC123456~
DMG*D8*19800115*M~
REF*1L*ABC123456~
HL*3*2*23*0~
PAT*19~
NM1*QC*1*DOE*JOHN~
DMG*D8*19800115*M~
CLM*CLM001*250***11:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220701~
DTP*435*D8*20220701~
REF*D9*REF123456~
AMT*F5*20~
HI*BK:I10*BF:E119*BF:I25.1~
NM1*82*1*SMITH*JANE****XX*9876543212~
NM1*77*2*DOWNTOWN CLINIC*****XX*1122334455~
LX*1~
SV1*HC:99213:11*150*UN*1*11**1*N~
DTP*472*D8*20220701~
LX*2~
SV1*HC:99214:11*100*UN*1*11**2*N~
DTP*472*D8*20220702~
HL*4*1*20*1~
NM1*85*2*OTHER BILLING INC*****XX*9999999999~
N3*456 OAK AVE~
N4*METROPOLIS*NY*10001~
REF*EI*987654321~
HL*5*4*22*0~
SBR*P*18*******CI~
NM1*IL*1*SMITH*JANE****MI*XYZ789012~
DMG*D8*19900520*F~
REF*1L*XYZ789012~
PAT*19~
NM1*QC*1*SMITH*JANE~
DMG*D8*19900520*F~
CLM*CLM002*500***11:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220705~
DTP*435*D8*20220705~
HI*BK:J45*BF:J45.1~
NM1*82*1*JONES*ROBERT****XX*5555555555~
LX*1~
SV1*HC:99203:25*200*UN*1*11**1*N~
DTP*472*D8*20220705~
LX*2~
SV1*HC:99204:25*300*UN*1*11**1*N~
DTP*472*D8*20220705~
SE*50*0001~
GE*1*1~
IEA*1*000000001~`;

module.exports = SAMPLE_837;
```

This fixture contains:
- Full envelope (ISA/GS/ST/SE/GE/IEA)
- BHT transaction header
- Two billing providers (HL*1, HL*4) — ACME MEDICAL GROUP and OTHER BILLING INC
- First claim: patient JOHN DOE, subscriber JOHN DOE, claim CLM001 $250
  - Two service lines: 99213 ($150) and 99214 ($100)
  - Three diagnosis codes: I10, E119, I25.1
  - Rendering provider (NM1*82), service facility (NM1*77)
  - REF D9, AMT F5
  - Both service dates
- Second claim: patient JANE SMITH, subscriber JANE SMITH, claim CLM002 $500
  - Two service lines: 99203 ($200) and 99204 ($300)
  - Two diagnosis codes: J45, J45.1
  - Rendering provider (NM1*82)

- [ ] **Step 2: Verify fixture loads**

Run:
```bash
node -e "const f = require('./tests/fixtures/sample.837'); console.log(f.substring(0, 100));"
```
Expected: Prints first 100 characters of the EDI string.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/sample.837.js
git commit -m "test: update 837P fixture with multi-claim comprehensive data"
```

---

### Task 3: Create 837I Institutional Fixture

**Files:**
- Create: `tests/fixtures/sample.837i.js`

**Interfaces:**
- Consumes: None
- Produces: `module.exports = SAMPLE_837I` — a realistic institutional claim string

- [ ] **Step 1: Write the 837I institutional fixture**

```js
// tests/fixtures/sample.837i.js
const SAMPLE_837I = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220715*0953*^*00501*000000002*0*P*:~
GS*HC*SENDER*RECEIVER*20220715*0953*1*X*005010X222A2~
ST*837*0002~
BHT*0019*00*67890*20220715*0953*CH~
HL*1**20*1~
NM1*85*2*GENERAL HOSPITAL*****XX*1111111111~
N3*789 HOSPITAL BLVD~
N4*BIGCITY*CA*90211~
REF*EI*555555555~
HL*2*1*22*1~
SBR*P*18*******MB~
NM1*IL*1*JOHNSON*ROBERT****MI*MEM123456~
DMG*D8*19750310*M~
REF*1L*MEM123456~
HL*3*2*23*0~
PAT*19~
NM1*QC*1*JOHNSON*ROBERT~
DMG*D8*19750310*M~
CLM*CLM003*1500***11:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220710~
DTP*435*D8*20220715~
DTP*096*TM*1430~
CL1*1*5*02~
HI*ABK:E119*ABF:J45*ABJ:I10*ABR:V901*DRG*871~
NM1*71*1*LEE*DAVID****XX*2222222222~
NM1*72*1*WONG*SUSAN****XX*3333333333~
PWK*09*AC*BM~
CN1*01*500~
CRC*AB*Y*1~
LX*1~
SV2*0450*HC:99221*500*UN*1~
DTP*472*D8*20220710~
LX*2~
SV2*0452*HC:99231*400*UN*2~
DTP*472*D8*20220712~
LX*3~
SV2*0459*HC:99238*600*UN*1~
DTP*472*D8*20220715~
SE*35*0002~
GE*1*1~
IEA*1*000000002~`;

module.exports = SAMPLE_837I;
```

This fixture contains:
- Institutional claim with CL1 admission info (type=1, source=5, status=02)
- DTP*434 (admission date), DTP*435 (discharge date), DTP*096 (discharge hour 14:30)
- HI with principal (ABK:E119), other (ABF:J45), admitting (ABJ:I10), external cause (ABR:V901), DRG (871)
- NM1*71 (attending physician) and NM1*72 (operating physician)
- PWK report type, CN1 contract info, CRC condition code
- Three SV2 service lines with revenue codes (0450, 0452, 0459)

- [ ] **Step 2: Verify fixture loads**

Run:
```bash
node -e "const f = require('./tests/fixtures/sample.837i'); console.log(f.substring(0, 100));"
```
Expected: Prints first 100 characters.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/sample.837i.js
git commit -m "test: add 837I institutional fixture"
```

---

### Task 4: Create 837D Dental Fixture

**Files:**
- Create: `tests/fixtures/sample.837d.js`

**Interfaces:**
- Consumes: None
- Produces: `module.exports = SAMPLE_837D` — a realistic dental claim string

- [ ] **Step 1: Write the 837D dental fixture**

```js
// tests/fixtures/sample.837d.js
const SAMPLE_837D = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220720*1400*^*00501*000000003*0*P*:~
GS*HC*SENDER*RECEIVER*20220720*1400*1*X*005010X223A2~
ST*837*0003~
BHT*0019*00*24680*20220720*1400*CH~
HL*1**20*1~
NM1*85*2*DENTAL CARE ASSOCIATES*****XX*4444444444~
N3*321 DENTAL DRIVE~
N4*SMALLVILLE*IL*60601~
REF*EI*777777777~
HL*2*1*22*1~
SBR*P*18*******CI~
NM1*IL*1*BROWN*EMILY****MI*DEN888888~
DMG*D8*19921005*F~
REF*1L*DEN888888~
HL*3*2*23*0~
PAT*19~
NM1*QC*1*BROWN*EMILY~
DMG*D8*19921005*F~
CLM*CLM004*350***11:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220720~
HI*BK:K02.9~
NM1*82*1*MILLER*THOMAS****XX*6666666666~
LX*1~
SV3*AD:CDT:D0120*75*UN*1**1~
TOO*1*2*ML~
DTP*472*D8*20220720~
LX*2~
SV3*AD:CDT:D0270*125*UN*1**1~
TOO*1*30*MOD~
DTP*472*D8*20220720~
LX*3~
SV3*AD:CDT:D0150*150*UN*1**1~
DTP*472*D8*20220720~
SE*25*0003~
GE*1*1~
IEA*1*000000003~`;

module.exports = SAMPLE_837D;
```

This fixture contains:
- Dental claim with CDT procedure codes (D0120, D0270, D0150)
- TOO tooth segments with oral cavity code, tooth code, and tooth surface
- Three SV3 service lines
- HI diagnosis code (K02.9 — dental caries)
- Rendering provider (NM1*82: THOMAS MILLER)
- Billing provider (NM1*85: DENTAL CARE ASSOCIATES)

- [ ] **Step 2: Verify fixture loads**

Run:
```bash
node -e "const f = require('./tests/fixtures/sample.837d'); console.log(f.substring(0, 100));"
```
Expected: Prints first 100 characters.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/sample.837d.js
git commit -m "test: add 837D dental fixture"
```

---

### Task 5: Rewrite the 837 Parser (HL Stack Architecture)

**Files:**
- Modify: `src/parsers/edi837.parser.js` — Complete rewrite

**Interfaces:**
- Consumes: `require('./edi.utils')` — `splitSegments`, `parseSegment`, `getSubElements`, `parseEDIDate`, `parseEDIAmount`
- Produces: `{ parse837: function(content) => { metadata, claims } }`

- [ ] **Step 1: Write the new parser**

The parser uses an HL stack to track hierarchy. Key data structures:

```js
// HL stack entry
{ level: 0,          // HL ID number
  code: '',          // HL level code: '20' (BP), '22' (Sub), '23' (Pat)
  context: {} }      // Accumulated data at this level
```

```js
// Full parser
const { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount } = require('./edi.utils');

function parse837(content) {
  const segments = splitSegments(content);

  const metadata = {
    sender_id: '', receiver_id: '', date: '', time: '', control_number: '', standards_id: '',
    gs_sender: '', gs_receiver: '', gs_date: '', gs_time: '', gs_control_number: '', gs_version: '',
    st_transaction_id: '', st_control_number: '',
    bht_purpose: '', bht_reference: '', bht_date: '', bht_time: '', bht_transaction_type: '',
    interchange_control_number: '', total_functional_groups: 0,
  };
  const claims = [];

  // HL stack — each entry: { level, code, context }
  const hlStack = [];

  // Current contexts (shorthands to top of stack by type)
  let billingProvider = {};
  let subscriber = {};
  let patient = {};
  let currentClaim = null;
  let currentLine = null;

  // Helper: get context by HL code
  function getContext(code) {
    for (let i = hlStack.length - 1; i >= 0; i--) {
      if (hlStack[i].code === code) return hlStack[i].context;
    }
    return {};
  }

  // Helper: finalize current claim (push to array)
  function finalizeClaim() {
    if (currentClaim) {
      // Merge patient info from patient context and HL hierarchy
      const pat = getContext('23');
      const sub = getContext('22');
      const bp = getContext('20');
      currentClaim.patient_first_name = currentClaim.patient_first_name || pat.first_name || '';
      currentClaim.patient_last_name = currentClaim.patient_last_name || pat.last_name || '';
      currentClaim.patient_dob = currentClaim.patient_dob || pat.dob || null;
      currentClaim.patient_gender = currentClaim.patient_gender || pat.gender || '';
      currentClaim.patient_member_id = currentClaim.patient_member_id || pat.member_id || '';
      currentClaim.subscriber_id = currentClaim.subscriber_id || sub.subscriber_id || '';
      currentClaim.subscriber_first_name = currentClaim.subscriber_first_name || sub.first_name || '';
      currentClaim.subscriber_last_name = currentClaim.subscriber_last_name || sub.last_name || '';
      currentClaim.subscriber_relationship_code = currentClaim.subscriber_relationship_code || sub.relationship_code || '';
      currentClaim.provider_name = currentClaim.provider_name || bp.name || '';
      currentClaim.provider_npi = currentClaim.provider_npi || bp.npi || '';
      currentClaim.provider_tax_id = currentClaim.provider_tax_id || bp.tax_id || '';
      currentClaim.provider_address = currentClaim.provider_address || bp.address || { address1: '', address2: '', city: '', state: '', zip: '' };
      currentClaim.payer_name = currentClaim.payer_name || '';
      currentClaim.payer_id = currentClaim.payer_id || '';
      claims.push(currentClaim);
      currentClaim = null;
      currentLine = null;
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const elements = parseSegment(segments[i]);
    const segId = elements[0];

    switch (segId) {
      // ===== ENVELOPE =====
      case 'ISA':
        metadata.sender_id = (elements[6] || '').trim();
        metadata.receiver_id = (elements[8] || '').trim();
        metadata.date = (elements[9] || '').trim();
        metadata.time = (elements[10] || '').trim();
        metadata.control_number = (elements[13] || '').trim();
        metadata.standards_id = (elements[12] || '').trim();
        break;

      case 'GS':
        metadata.gs_sender = (elements[2] || '').trim();
        metadata.gs_receiver = (elements[3] || '').trim();
        metadata.gs_date = (elements[4] || '').trim();
        metadata.gs_time = (elements[5] || '').trim();
        metadata.gs_control_number = (elements[6] || '').trim();
        metadata.gs_version = (elements[8] || '').trim();
        break;

      case 'ST':
        metadata.st_transaction_id = (elements[1] || '').trim();
        metadata.st_control_number = (elements[2] || '').trim();
        break;

      // ===== TRANSACTION HEADER =====
      case 'BHT':
        metadata.bht_purpose = (elements[1] || '').trim();
        metadata.bht_reference = (elements[3] || '').trim();
        metadata.bht_date = (elements[4] || '').trim();
        metadata.bht_time = (elements[5] || '').trim();
        metadata.bht_transaction_type = (elements[6] || '').trim();
        break;

      // ===== HIERARCHY =====
      case 'HL': {
        const hlId = (elements[1] || '').trim();
        const parentId = (elements[2] || '').trim();
        const hlCode = (elements[3] || '').trim();
        const hasChildren = (elements[4] || '').trim();

        // Pop stack back to parent
        if (parentId) {
          while (hlStack.length > 0 && hlStack[hlStack.length - 1].level !== parentId) {
            hlStack.pop();
          }
        } else {
          hlStack.length = 0; // Root HL — clear stack
        }

        // Push new level
        const context = {};
        hlStack.push({ level: hlId, code: hlCode, context });

        // Refresh shorthand references
        billingProvider = getContext('20');
        subscriber = getContext('22');
        patient = getContext('23');

        // Finalize any in-progress claim when entering a new patient or provider
        if (hlCode === '23' && currentClaim) {
          // Patient level — will create a new claim soon (CLM)
        }
        if (hlCode === '20' && currentClaim) {
          finalizeClaim();
        }
        break;
      }

      // ===== BILLING PROVIDER (HL*20) =====
      case 'NM1': {
        const qual = (elements[1] || '').trim();
        const entityType = (elements[2] || '').trim();
        const last = (elements[3] || '').trim();
        const first = (elements[4] || '').trim();
        const middle = (elements[5] || '').trim();
        const idQual = (elements[8] || '').trim();
        const idCode = (elements[9] || '').trim();

        switch (qual) {
          case '85': // Billing Provider
            billingProvider = getContext('20');
            billingProvider.name = `${first} ${last}`.trim();
            billingProvider.npi = idQual === 'XX' && idCode ? idCode : billingProvider.npi || '';
            billingProvider.last_name = last;
            billingProvider.first_name = first;
            break;
          case 'IL': // Insured/Subscriber
            subscriber = getContext('22');
            subscriber.first_name = first;
            subscriber.last_name = last;
            subscriber.subscriber_id = idCode || subscriber.subscriber_id || '';
            if (currentClaim) {
              currentClaim.subscriber_id = currentClaim.subscriber_id || subscriber.subscriber_id;
              currentClaim.subscriber_first_name = currentClaim.subscriber_first_name || first;
              currentClaim.subscriber_last_name = currentClaim.subscriber_last_name || last;
            }
            break;
          case 'QC': // Patient
            patient = getContext('23');
            patient.first_name = first;
            patient.last_name = last;
            patient.member_id = idCode || '';
            if (currentClaim) {
              currentClaim.patient_first_name = currentClaim.patient_first_name || first;
              currentClaim.patient_last_name = currentClaim.patient_last_name || last;
              currentClaim.patient_member_id = currentClaim.patient_member_id || idCode || '';
            }
            break;
          case '82': // Rendering Provider
            if (currentClaim) {
              currentClaim.rendering_provider_name = `${first} ${last}`.trim();
              currentClaim.rendering_provider_npi = idCode || '';
            }
            break;
          case '77': // Service Facility
            if (currentClaim) {
              currentClaim.service_facility_name = `${first} ${last}`.trim();
              currentClaim.service_facility_npi = idCode || '';
            }
            break;
          case '71': // Attending Provider (837I)
            if (currentClaim) {
              currentClaim.attending_provider_name = `${first} ${last}`.trim();
              currentClaim.attending_provider_npi = idCode || '';
            }
            break;
          case '72': // Operating Physician (837I)
            if (currentClaim) {
              currentClaim.operating_provider_name = `${first} ${last}`.trim();
              currentClaim.operating_provider_npi = idCode || '';
            }
            break;
          case 'DN': // Referring Provider
            if (currentClaim) {
              currentClaim.referring_provider_name = `${first} ${last}`.trim();
              currentClaim.referring_provider_npi = idCode || '';
            }
            break;
          case 'PR': // Payer
            if (currentClaim) {
              currentClaim.payer_name = `${first} ${last}`.trim();
              currentClaim.payer_id = idCode || '';
            }
            break;
        }
        break;
      }

      // ===== ADDRESS =====
      case 'N3': {
        const bp = getContext('20');
        const sub = getContext('22');
        // Store on the current top-of-stack context
        const topContext = hlStack.length > 0 ? hlStack[hlStack.length - 1].context : {};
        topContext.address1 = topContext.address1 || (elements[1] || '').trim();
        topContext.address2 = topContext.address2 || (elements[2] || '').trim();
        break;
      }

      case 'N4': {
        const topContext = hlStack.length > 0 ? hlStack[hlStack.length - 1].context : {};
        topContext.city = topContext.city || (elements[1] || '').trim();
        topContext.state = topContext.state || (elements[2] || '').trim();
        topContext.zip = topContext.zip || (elements[3] || '').trim();
        break;
      }

      // ===== CONTACT =====
      case 'PER': {
        const bp = getContext('20');
        bp.contact_name = bp.contact_name || (elements[2] || '').trim();
        // Find phone in communication numbers
        for (let j = 3; j < elements.length; j += 2) {
          if (elements[j] === 'TE') {
            bp.contact_phone = bp.contact_phone || (elements[j + 1] || '').trim();
            break;
          }
        }
        break;
      }

      // ===== DEMOGRAPHICS =====
      case 'DMG': {
        const topContext = hlStack.length > 0 ? hlStack[hlStack.length - 1].context : {};
        const dmgDate = parseEDIDate(elements[2]);
        const dmgGender = (elements[3] || '').trim();
        topContext.dob = topContext.dob || dmgDate;
        topContext.gender = topContext.gender || dmgGender;

        if (currentClaim) {
          currentClaim.patient_dob = currentClaim.patient_dob || dmgDate;
          currentClaim.patient_gender = currentClaim.patient_gender || dmgGender;
        }
        break;
      }

      // ===== SUBSCRIBER INFO =====
      case 'SBR': {
        sub = getContext('22');
        sub.relationship_code = (elements[2] || '').trim();
        sub.claim_filing_type = (elements[9] || '').trim();
        if (currentClaim) {
          currentClaim.subscriber_relationship_code = currentClaim.subscriber_relationship_code || sub.relationship_code;
          currentClaim.claim_filing_type = currentClaim.claim_filing_type || sub.claim_filing_type;
        }
        break;
      }

      // ===== PATIENT INFO =====
      case 'PAT': {
        const relCode = (elements[1] || '').trim();
        patient = getContext('23');
        patient.relationship_code = relCode;
        if (currentClaim) {
          currentClaim.patient_relationship_code = currentClaim.patient_relationship_code || relCode;
        }
        break;
      }

      // ===== CLAIM =====
      case 'CLM':
        finalizeClaim();
        const bpContext = getContext('20');
        const subContext = getContext('22');
        const patContext = getContext('23');

        currentClaim = {
          // Claim identifiers
          claim_id: (elements[1] || '').trim(),
          total_charge: parseEDIAmount(elements[2]),
          claim_filing_type: subContext.claim_filing_type || '',
          pos_code: (elements[5] || '').trim(),

          // Patient
          patient_first_name: patContext.first_name || '',
          patient_last_name: patContext.last_name || '',
          patient_member_id: patContext.member_id || '',
          patient_dob: patContext.dob || null,
          patient_gender: patContext.gender || '',
          patient_relationship_code: patContext.relationship_code || '',

          // Subscriber
          subscriber_first_name: subContext.first_name || '',
          subscriber_last_name: subContext.last_name || '',
          subscriber_id: subContext.subscriber_id || '',
          subscriber_relationship_code: subContext.relationship_code || '',

          // Billing Provider
          provider_name: bpContext.name || '',
          provider_npi: bpContext.npi || '',
          provider_tax_id: bpContext.tax_id || '',
          provider_address: {
            address1: bpContext.address1 || '',
            address2: bpContext.address2 || '',
            city: bpContext.city || '',
            state: bpContext.state || '',
            zip: bpContext.zip || '',
          },
          provider_contact: {
            name: bpContext.contact_name || '',
            phone: bpContext.contact_phone || '',
          },

          // Providers
          referring_provider_name: '',
          referring_provider_npi: '',
          rendering_provider_name: '',
          rendering_provider_npi: '',
          service_facility_name: '',
          service_facility_npi: '',
          attending_provider_name: '',
          attending_provider_npi: '',
          operating_provider_name: '',
          operating_provider_npi: '',

          // Payer
          payer_name: '',
          payer_id: '',

          // Financial
          patient_amount_paid: 0,

          // Dates
          service_date_start: null,
          service_date_end: null,
          admission_date: null,
          discharge_date: null,
          discharge_hour: null,

          // Admission Info (837I)
          admit_type_code: '',
          admit_source_code: '',
          patient_status_code: '',

          // Diagnosis Codes
          diagnosis_codes: [],

          // DRG (837I)
          drg_code: '',
          drg_weight: '',
          drg_medical_surgical: '',

          // References
          refs: [],
          amts: [],
          report_types: [],
          condition_codes: [],
          file_info: [],

          // Contract Info
          contract_type: '',
          contract_amount: 0,
          contract_percentage: 0,

          // Diagnosis pointers
          diagnosis_pointers: [],

          // Service lines
          lines: [],

          // Status
          status: 'submitted',
          denial_reasons: [],
        };
        break;

      // ===== DATES =====
      case 'DTP': {
        const dateQual = (elements[1] || '').trim();
        const dateVal = parseEDIDate(elements[3]);

        if (currentLine && dateQual === '472') {
          // Line-level service date
          currentLine.service_date = dateVal;
          break;
        }

        if (currentClaim) {
          switch (dateQual) {
            case '434': // Service Date / Admission Date
              currentClaim.service_date_start = currentClaim.service_date_start || dateVal;
              currentClaim.admission_date = currentClaim.admission_date || dateVal;
              break;
            case '435': // End Service Date / Discharge Date
              currentClaim.service_date_end = dateVal;
              currentClaim.discharge_date = dateVal;
              break;
            case '096': // Discharge Hour (837I)
              if (dateVal) currentClaim.discharge_hour = (elements[3] || '').trim();
              break;
          }
        }
        break;
      }

      // ===== REFERENCES =====
      case 'REF': {
        const refQual = (elements[1] || '').trim();
        const refVal = (elements[2] || '').trim();

        if (currentClaim) {
          currentClaim.refs.push({ qualifier: refQual, value: refVal, description: '' });

          // Handle specific qualifiers
          if (refQual === 'EI') {
            const bp = getContext('20');
            bp.tax_id = refVal;
            currentClaim.provider_tax_id = refVal;
          } else if (refQual === '1L' || refQual === '34') {
            const sub = getContext('22');
            if (!sub.subscriber_id) sub.subscriber_id = refVal;
            currentClaim.subscriber_id = currentClaim.subscriber_id || refVal;
          } else if (refQual === 'D9') {
            // Claim reference number — stored in refs[]
          }
        }

        if (currentLine) {
          currentLine.refs.push({ qualifier: refQual, value: refVal });
        }
        break;
      }

      // ===== AMOUNTS =====
      case 'AMT': {
        const amtQual = (elements[1] || '').trim();
        const amtVal = parseEDIAmount(elements[2]);

        if (currentClaim) {
          currentClaim.amts.push({ qualifier: amtQual, value: amtVal, description: '' });
          if (amtQual === 'F5') {
            currentClaim.patient_amount_paid = amtVal;
          }
        }
        if (currentLine) {
          currentLine.amts.push({ qualifier: amtQual, value: amtVal });
        }
        break;
      }

      // ===== DIAGNOSIS CODES =====
      case 'HI': {
        if (!currentClaim) break;

        for (let j = 1; j < elements.length; j++) {
          const subElements = getSubElements(elements[j] || '');
          const qualifier = subElements[0] || '';

          // Handle DRG format (standalone qualifier, code in next element)
          if (qualifier === 'DRG') {
            // DRG code is in the next element
            if (j + 1 < elements.length && elements[j + 1].indexOf(':') === -1) {
              j++;
              currentClaim.drg_code = elements[j];
            }
            // Optional: DRG weight (version:weight)
            if (j + 1 < elements.length) {
              const nextEl = elements[j + 1];
              const nextSub = getSubElements(nextEl);
              if (nextSub.length >= 2 && nextSub[0] !== 'APX') {
                j++;
                const drgWeight = parseEDIAmount(nextSub[1]);
                if (drgWeight > 0) currentClaim.drg_weight = drgWeight;
              }
            }
            // Optional: APX med/surg (APX:value)
            if (j + 1 < elements.length) {
              const nextEl = elements[j + 1];
              if (nextEl.startsWith('APX')) {
                j++;
                currentClaim.drg_medical_surgical = nextEl.split(':')[1] || '';
              }
            }
            continue;
          }

          if (subElements.length >= 2) {
            const code = subElements[1];
            let type = 'other';

            // Map qualifier to diagnosis type
            switch (qualifier) {
              case 'ABK': case 'BK': type = 'principal'; break;
              case 'ABF': case 'BF': type = 'other'; break;
              case 'ABJ': case 'BR': type = 'admitting'; break;
              case 'ABG': type = 'patient_reason'; break;
              case 'ABR': case 'AR': type = 'external_cause'; break;
              default: type = 'other';
            }

            currentClaim.diagnosis_codes.push({ code, qualifier, type });
          }
        }
        break;
      }

      // ===== CLAIM-LEVEL SEGMENTS =====
      case 'CL1': {
        if (!currentClaim) break;
        currentClaim.admit_type_code = (elements[1] || '').trim();
        currentClaim.admit_source_code = (elements[2] || '').trim();
        currentClaim.patient_status_code = (elements[3] || '').trim();
        break;
      }

      case 'PWK': {
        if (!currentClaim) break;
        currentClaim.report_types.push({
          code: (elements[1] || '').trim(),
          qualifier: (elements[2] || '').trim(),
          attachment_transmission_code: (elements[3] || '').trim(),
        });
        break;
      }

      case 'CN1': {
        if (!currentClaim) break;
        currentClaim.contract_type = (elements[1] || '').trim();
        currentClaim.contract_amount = parseEDIAmount(elements[2]);
        break;
      }

      case 'CRC': {
        if (!currentClaim) break;
        currentClaim.condition_codes.push({
          code: (elements[1] || '').trim(),
          qualifier: (elements[2] || '').trim(),
          value: (elements[3] || '').trim(),
        });
        break;
      }

      case 'K3': {
        if (!currentClaim) break;
        currentClaim.file_info.push({ text: (elements[1] || '').trim() });
        break;
      }

      // ===== SERVICE LINES =====
      case 'LX': {
        if (!currentClaim) break;
        currentLine = {
          line_number: parseInt(elements[1], 10) || 0,
          procedure_code: '',
          modifier: '',
          charge_amount: 0,
          unit_count: 0,
          service_date: null,
          procedure_type: 'SV1',
          revenue_code: '',
          oral_cavity_code: '',
          tooth_code: '',
          tooth_surface: '',
          diagnosis_code_pointers: [],
          refs: [],
          amts: [],
        };
        currentClaim.lines.push(currentLine);
        break;
      }

      case 'SV1': {
        if (!currentClaim) break;
        if (!currentLine) {
          currentLine = {
            line_number: currentClaim.lines.length + 1,
            procedure_code: '', modifier: '',
            charge_amount: 0, unit_count: 0,
            service_date: null, procedure_type: 'SV1',
            revenue_code: '', oral_cavity_code: '', tooth_code: '', tooth_surface: '',
            diagnosis_code_pointers: [], refs: [], amts: [],
          };
          currentClaim.lines.push(currentLine);
        }
        currentLine.procedure_type = 'SV1';
        // Parse procedure code: HC:99213:11 → procedure_code=99213, modifier=11
        const procSub = getSubElements(elements[1] || '');
        if (procSub.length >= 2) {
          currentLine.procedure_code = procSub[1] || '';
          if (procSub.length >= 3) currentLine.modifier = procSub[2] || '';
        }
        currentLine.charge_amount = parseEDIAmount(elements[2]);
        currentLine.unit_count = parseEDIAmount(elements[4]);

        // Diagnosis code pointers (e.g., "1:2:3")
        if (elements[7]) {
          const pointers = (elements[7] || '').split(':').filter(Boolean);
          currentLine.diagnosis_code_pointers = pointers.map(p => ({ pointer: parseInt(p, 10) }));
        }
        break;
      }

      case 'SV2': {
        if (!currentClaim) break;
        if (!currentLine) {
          currentLine = {
            line_number: currentClaim.lines.length + 1,
            procedure_code: '', modifier: '',
            charge_amount: 0, unit_count: 0,
            service_date: null, procedure_type: 'SV2',
            revenue_code: '', oral_cavity_code: '', tooth_code: '', tooth_surface: '',
            diagnosis_code_pointers: [], refs: [], amts: [],
          };
          currentClaim.lines.push(currentLine);
        }
        currentLine.procedure_type = 'SV2';
        currentLine.revenue_code = (elements[1] || '').trim();
        // Parse procedure code
        const procSub = getSubElements(elements[2] || '');
        if (procSub.length >= 2) {
          currentLine.procedure_code = procSub[1] || '';
          if (procSub.length >= 3) currentLine.modifier = procSub[2] || '';
        }
        currentLine.charge_amount = parseEDIAmount(elements[3]);
        currentLine.unit_count = parseEDIAmount(elements[5]);
        break;
      }

      case 'SV3': {
        if (!currentClaim) break;
        if (!currentLine) {
          currentLine = {
            line_number: currentClaim.lines.length + 1,
            procedure_code: '', modifier: '',
            charge_amount: 0, unit_count: 0,
            service_date: null, procedure_type: 'SV3',
            revenue_code: '', oral_cavity_code: '', tooth_code: '', tooth_surface: '',
            diagnosis_code_pointers: [], refs: [], amts: [],
          };
          currentClaim.lines.push(currentLine);
        }
        currentLine.procedure_type = 'SV3';
        // Parse CDT code: AD:CDT:D0120 → procedure_code=D0120
        const procSub = getSubElements(elements[1] || '');
        if (procSub.length >= 2) {
          currentLine.procedure_code = procSub[procSub.length - 1] || '';
        }
        currentLine.charge_amount = parseEDIAmount(elements[2]);
        currentLine.unit_count = parseEDIAmount(elements[4]);

        // Diagnosis code pointers
        if (elements[7]) {
          const pointers = (elements[7] || '').split(':').filter(Boolean);
          currentLine.diagnosis_code_pointers = pointers.map(p => ({ pointer: parseInt(p, 10) }));
        }
        break;
      }

      // ===== DENTAL — TOOTH INFO =====
      case 'TOO': {
        if (!currentLine) break;
        currentLine.oral_cavity_code = (elements[1] || '').trim();
        currentLine.tooth_code = (elements[2] || '').trim();
        currentLine.tooth_surface = (elements[3] || '').trim();
        break;
      }

      // ===== TRAILERS =====
      case 'SE':
        finalizeClaim();
        metadata.st_total_segments = parseInt(elements[1], 10) || 0;
        break;

      case 'GE':
        metadata.total_functional_groups = parseInt(elements[1], 10) || 0;
        break;

      case 'IEA':
        metadata.interchange_control_number = (elements[2] || '').trim();
        break;
    }
  }

  // Finalize any remaining claim
  finalizeClaim();

  return { metadata, claims };
}

module.exports = { parse837 };
```

- [ ] **Step 2: Run a quick smoke test**

Run:
```bash
node -e "const { parse837 } = require('./src/parsers/edi837.parser'); const f = require('./tests/fixtures/sample.837'); const r = parse837(f); console.log('Claims:', JSON.stringify(r.claims.length)); console.log('Metadata:', JSON.stringify(r.metadata.sender_id)); console.log('First claim:', JSON.stringify(r.claims[0]?.claim_id)); console.log('Lines:', JSON.stringify(r.claims[0]?.lines?.length));"
```

Expected: Prints claims count (2), metadata sender_id, first claim_id, line count.

- [ ] **Step 3: Run 837P test against parser**

Run: `node -e "const { parse837 } = require('./src/parsers/edi837.parser'); const f = require('./tests/fixtures/sample.837'); const r = parse837(f); console.log(JSON.stringify(r, null, 2));" | head -100`

Expected: Verify output structure matches expected fields.

- [ ] **Step 4: Run 837I test against parser**

Run: `node -e "const { parse837 } = require('./src/parsers/edi837.parser'); const f = require('./tests/fixtures/sample.837i'); const r = parse837(f); console.log('837I claims:', r.claims.length, 'diagnosis:', r.claims[0].diagnosis_codes.length);"`

Expected: 1 claim, admission/discharge dates, HI diagnosis codes parsed.

- [ ] **Step 5: Run 837D test against parser**

Run: `node -e "const { parse837 } = require('./src/parsers/edi837.parser'); const f = require('./tests/fixtures/sample.837d'); const r = parse837(f); console.log('837D claims:', r.claims.length, 'lines:', r.claims[0].lines.length);"`

Expected: 1 claim, tooth info on relevant lines.

- [ ] **Step 6: Commit**

```bash
git add src/parsers/edi837.parser.js
git commit -m "feat: rewrite 837 parser with HL hierarchy and unified 837P/I/D schema"
```

---

### Task 6: Write Comprehensive Parser Tests

**Files:**
- Modify: `tests/edi837.parser.test.js`

**Interfaces:**
- Consumes: `parse837` from `../src/parsers/edi837.parser`, fixtures `sample.837`, `sample.837i`, `sample.837d`
- Produces: Comprehensive test suite

- [ ] **Step 1: Write the full test suite**

```js
const { parse837 } = require('../src/parsers/edi837.parser');
const SAMPLE_837 = require('./fixtures/sample.837');
const SAMPLE_837I = require('./fixtures/sample.837i');
const SAMPLE_837D = require('./fixtures/sample.837d');

describe('EDI 837 Parser', () => {

  // ===== ENVELOPE TESTS =====
  describe('Envelope', () => {
    it('should parse ISA metadata', () => {
      const result = parse837(SAMPLE_837);
      expect(result.metadata.sender_id).toBe('SENDER');
      expect(result.metadata.receiver_id).toBe('RECEIVER');
      expect(result.metadata.date).toBe('220701');
      expect(result.metadata.time).toBe('1253');
      expect(result.metadata.control_number).toBe('000000001');
    });

    it('should parse GS metadata', () => {
      const result = parse837(SAMPLE_837);
      expect(result.metadata.gs_sender).toBe('SENDER');
      expect(result.metadata.gs_receiver).toBe('RECEIVER');
      expect(result.metadata.gs_version).toBe('005010X222A1');
    });

    it('should parse ST metadata', () => {
      const result = parse837(SAMPLE_837);
      expect(result.metadata.st_transaction_id).toBe('837');
      expect(result.metadata.st_control_number).toBe('0001');
    });

    it('should parse BHT metadata', () => {
      const result = parse837(SAMPLE_837);
      expect(result.metadata.bht_purpose).toBe('0019');
      expect(result.metadata.bht_reference).toBe('12345');
      expect(result.metadata.bht_date).toBe('20220701');
      expect(result.metadata.bht_transaction_type).toBe('CH');
    });
  });

  // ===== CLAIM TESTS =====
  describe('Claims', () => {
    it('should extract claims from CLM segments', () => {
      const result = parse837(SAMPLE_837);
      expect(result.claims).toHaveLength(2);
      expect(result.claims[0].claim_id).toBe('CLM001');
      expect(result.claims[0].total_charge).toBeCloseTo(250, 0.01);
      expect(result.claims[1].claim_id).toBe('CLM002');
      expect(result.claims[1].total_charge).toBeCloseTo(500, 0.01);
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

    it('should extract billing provider info', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.provider_name).toBe('ACME MEDICAL GROUP');
      expect(claim.provider_npi).toBe('1234567893');
      expect(claim.provider_tax_id).toBe('123456789');
    });

    it('should extract rendering provider info', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.rendering_provider_name).toBe('JANE SMITH');
      expect(claim.rendering_provider_npi).toBe('9876543212');
    });

    it('should extract service facility info', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.service_facility_name).toBe('DOWNTOWN CLINIC');
      expect(claim.service_facility_npi).toBe('1122334455');
    });

    it('should extract service dates', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.service_date_start).toBe('2022-07-01');
      expect(claim.service_date_end).toBe('2022-07-01');
    });
  });

  // ===== DIAGNOSIS CODE TESTS =====
  describe('Diagnosis Codes', () => {
    it('should extract diagnosis codes from HI segment', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.diagnosis_codes).toHaveLength(3);
      expect(claim.diagnosis_codes[0]).toEqual({ code: 'I10', qualifier: 'BK', type: 'principal' });
      expect(claim.diagnosis_codes[1]).toEqual({ code: 'E119', qualifier: 'BF', type: 'other' });
      expect(claim.diagnosis_codes[2]).toEqual({ code: 'I25.1', qualifier: 'BF', type: 'other' });
    });
  });

  // ===== SERVICE LINE TESTS =====
  describe('Service Lines', () => {
    it('should extract service line items for 837P', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.lines).toHaveLength(2);
      expect(claim.lines[0].procedure_code).toBe('99213');
      expect(claim.lines[0].modifier).toBe('11');
      expect(claim.lines[0].charge_amount).toBeCloseTo(150, 0.01);
      expect(claim.lines[0].unit_count).toBeCloseTo(1, 0.01);
      expect(claim.lines[0].procedure_type).toBe('SV1');
      expect(claim.lines[1].procedure_code).toBe('99214');
      expect(claim.lines[1].charge_amount).toBeCloseTo(100, 0.01);
    });

    it('should extract service dates per line', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.lines[0].service_date).toBe('2022-07-01');
      expect(claim.lines[1].service_date).toBe('2022-07-02');
    });
  });

  // ===== REFERENCE AND AMOUNT TESTS =====
  describe('References and Amounts', () => {
    it('should extract REF entries', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      const refD9 = claim.refs.find(r => r.qualifier === 'D9');
      expect(refD9).toBeDefined();
      expect(refD9.value).toBe('REF123456');
    });

    it('should extract AMT entries', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      const amtF5 = claim.amts.find(a => a.qualifier === 'F5');
      expect(amtF5).toBeDefined();
      expect(amtF5.value).toBeCloseTo(20, 0.01);
    });
  });

  // ===== MULTI-CLAIM TESTS =====
  describe('Multi-Claim', () => {
    it('should handle multiple billing providers', () => {
      const result = parse837(SAMPLE_837);
      expect(result.claims).toHaveLength(2);
      // First claim is from ACME MEDICAL GROUP
      expect(result.claims[0].provider_name).toBe('ACME MEDICAL GROUP');
      // Second claim is from OTHER BILLING INC
      expect(result.claims[1].provider_name).toBe('OTHER BILLING INC');
    });

    it('should handle separate patients per claim', () => {
      const result = parse837(SAMPLE_837);
      expect(result.claims[0].patient_last_name).toBe('DOE');
      expect(result.claims[1].patient_last_name).toBe('SMITH');
    });
  });

  // ===== EMPTY / EDGE CASE TESTS =====
  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      expect(parse837('').claims).toHaveLength(0);
    });
  });

  // ===== 837I INSTITUTIONAL TESTS =====
  describe('837I Institutional', () => {
    it('should parse institutional claims', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim).toBeDefined();
      expect(claim.claim_id).toBe('CLM003');
      expect(claim.total_charge).toBeCloseTo(1500, 0.01);
    });

    it('should parse admission/discharge dates', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.admission_date).toBe('2022-07-10');
      expect(claim.discharge_date).toBe('2022-07-15');
      expect(claim.discharge_hour).toBe('1430');
    });

    it('should parse CL1 admission info', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.admit_type_code).toBe('1');
      expect(claim.admit_source_code).toBe('5');
      expect(claim.patient_status_code).toBe('02');
    });

    it('should parse HI diagnosis codes (837I specifiers)', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.diagnosis_codes.length).toBeGreaterThanOrEqual(4);

      const principal = claim.diagnosis_codes.find(d => d.type === 'principal');
      expect(principal).toBeDefined();
      expect(principal.code).toBe('E119');

      const admitting = claim.diagnosis_codes.find(d => d.type === 'admitting');
      expect(admitting).toBeDefined();
      expect(admitting.code).toBe('I10');

      const external = claim.diagnosis_codes.find(d => d.type === 'external_cause');
      expect(external).toBeDefined();
      expect(external.code).toBe('V901');
    });

    it('should parse DRG info', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.drg_code).toBe('871');
    });

    it('should parse attending and operating physicians', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.attending_provider_name).toBe('DAVID LEE');
      expect(claim.attending_provider_npi).toBe('2222222222');
      expect(claim.operating_provider_name).toBe('SUSAN WONG');
      expect(claim.operating_provider_npi).toBe('3333333333');
    });

    it('should parse SV2 revenue codes', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.lines).toHaveLength(3);
      expect(claim.lines[0].procedure_type).toBe('SV2');
      expect(claim.lines[0].revenue_code).toBe('0450');
      expect(claim.lines[0].procedure_code).toBe('99221');
      expect(claim.lines[1].revenue_code).toBe('0452');
      expect(claim.lines[2].revenue_code).toBe('0459');
    });

    it('should parse PWK report type', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.report_types).toHaveLength(1);
      expect(claim.report_types[0].code).toBe('09');
      expect(claim.report_types[0].qualifier).toBe('AC');
    });

    it('should parse CN1 contract info', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.contract_type).toBe('01');
      expect(claim.contract_amount).toBeCloseTo(500, 0.01);
    });

    it('should parse CRC condition codes', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.condition_codes).toHaveLength(1);
      expect(claim.condition_codes[0].code).toBe('AB');
      expect(claim.condition_codes[0].value).toBe('1');
    });
  });

  // ===== 837D DENTAL TESTS =====
  describe('837D Dental', () => {
    it('should parse dental claims', () => {
      const claim = parse837(SAMPLE_837D).claims[0];
      expect(claim).toBeDefined();
      expect(claim.claim_id).toBe('CLM004');
      expect(claim.total_charge).toBeCloseTo(350, 0.01);
    });

    it('should parse SV3 CDT codes', () => {
      const claim = parse837(SAMPLE_837D).claims[0];
      expect(claim.lines).toHaveLength(3);
      expect(claim.lines[0].procedure_type).toBe('SV3');
      expect(claim.lines[0].procedure_code).toBe('D0120');
      expect(claim.lines[1].procedure_code).toBe('D0270');
      expect(claim.lines[2].procedure_code).toBe('D0150');
    });

    it('should parse TOO tooth information', () => {
      const claim = parse837(SAMPLE_837D).claims[0];
      expect(claim.lines[0].oral_cavity_code).toBe('1');
      expect(claim.lines[0].tooth_code).toBe('2');
      expect(claim.lines[0].tooth_surface).toBe('ML');
      expect(claim.lines[1].tooth_code).toBe('30');
      expect(claim.lines[1].tooth_surface).toBe('MOD');
    });
  });
});
```

- [ ] **Step 2: Run the test suite**

Run: `npx jest tests/edi837.parser.test.js --forceExit --verbose`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/edi837.parser.test.js
git commit -m "test: comprehensive 837 parser test suite (P/I/D, envelope, diagnosis, providers)"
```

---

### Task 7: Full Integration Verification

**Files:**
- None — verify all tests pass together

- [ ] **Step 1: Run full test suite**

Run: `npx jest --forceExit --detectOpenHandles --verbose 2>&1`

Expected: All tests pass across all test files. No chai errors.

- [ ] **Step 2: Verify backward compatibility with upload service**

Verify that the current fixture (which the upload service uses in tests) still parses the same essential fields.

Run:
```bash
node -e "
const { parse837 } = require('./src/parsers/edi837.parser');
const f = require('./tests/fixtures/sample.837');
const r = parse837(f);
// Verify upload.service.js _process837 compatible fields
const claim = r.claims[0];
console.log('claim_id:', claim.claim_id);
console.log('total_charge:', claim.total_charge);
console.log('patient_first_name:', claim.patient_first_name);
console.log('patient_last_name:', claim.patient_last_name);
console.log('subscriber_id:', claim.subscriber_id);
console.log('service_date_start:', claim.service_date_start);
console.log('lines[0].procedure_code:', claim.lines[0].procedure_code);
console.log('lines[0].charge_amount:', claim.lines[0].charge_amount);
console.log('All backward-compat fields present:', 
  claim.claim_id === 'CLM001' &&
  claim.patient_first_name === 'JOHN' &&
  claim.lines[0].procedure_code === '99213'
);
"
```

Expected: All backward-compatible fields present and match expected values.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: complete 837 parser comprehensive enhancement"
```