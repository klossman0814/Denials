# EDI 837 Parser — Comprehensive Enhancement

**Date:** 2026-07-22
**Status:** Draft

## 1. Objective

Make the EDI 837 parser completely working and future-proof by:
- Parsing **all meaningful 837 segments** across 837P (Professional), 837I (Institutional), and 837D (Dental) — unified schema
- Using an **HL hierarchy-aware, loop-based single-pass architecture** (same pattern as the 835 parser)
- Expanding the **test fixture** to include realistic multi-claim files for each type
- Fixing the **broken test infrastructure** (chai 6.x ESM vs Jest CJS)
- Ensuring **backward compatibility** with existing consumers (upload service, models)

## 2. Approach: Loop-Based Single-Pass with HL Hierarchy

A single pass through segments with an **HL stack** that tracks the current hierarchy level (Billing Provider → Subscriber → Patient). Context accumulates as we descend and finalizes as we ascend.

### Architecture

```
Single pass → HL stack [{ level: 'BP', data: {} }, { level: 'S', data: {} }, { level: 'P', data: {} }]
            → Each segment routes to the correct active context based on HL depth
            → CLM segment creates a new claim in the current patient context
            → LX/SV1/SV2/SV3 creates a new service line
            → SE finalizes everything
```

### Phase Map

```
Phase 0: Envelope         → ISA → GS → ST
Phase 1: Transaction Hdr  → BHT
Phase 2: Billing Provider → HL*20 → NM1*85 → N3 → N4 → REF → PER
Phase 3: Subscriber       → HL*22 → NM1*IL → N3 → N4 → DMG → REF → SBR
Phase 4: Patient          → HL*23 → NM1*QC → N3 → N4 → DMG → PAT
Phase 5: Claim            → CLM → DTP → REF → AMT → PWK → CN1 → CRC → K3 → HI → NM1 (various) → SBR
  Phase 5a: Service Line  → LX → SV1/SV2/SV3 → TOO → DTP → REF → AMT → HI
Phase 6: Trailers         → SE → GE → IEA
```

### HL Stack Mechanism

The 837 uses HL segments to define the hierarchy:

```
HL*1**20*1    → Billing Provider (level 1, parent none)
HL*2*1*22*0   → Subscriber (level 2, parent 1)
HL*3*2*23*0   → Patient (level 3, parent 2)
```

- `HL[3]` = Hierarchical ID Number (1, 2, 3)
- `HL[4]` = Parent ID Number (blank for root)
- `HL[5]` = Hierarchical Level Code (20=BP, 22=Subscriber, 23=Patient)
- `HL[6]` = Child Indicator (1=has children, 0=no children)

The parser maintains a `hlStack` — when a new HL is encountered, we push a new level. When the next HL has a parent ID matching a previous level, we pop back to that level. A `context` object accumulates data at the current level.

## 3. Output Structure

```js
{
  metadata: {
    sender_id, receiver_id, date, time, control_number, standards_id,
    gs_sender, gs_receiver, gs_date, gs_time, gs_control_number, gs_version,
    st_transaction_id, st_control_number,
    bht_purpose, bht_reference, bht_date, bht_time, bht_transaction_type,
    interchange_control_number, total_functional_groups
  },
  claims: [{
    // Claim identifiers
    claim_id: '',                          // CLM*01
    claim_filing_type: '',                 // SBR*09 / SBR*01
    pos_code: '',                          // Place of service

    // Patient
    patient_first_name: '', patient_last_name: '', patient_member_id: '',
    patient_dob: null, patient_gender: '',
    patient_relationship_code: '',         // PAT*01

    // Subscriber
    subscriber_first_name: '', subscriber_last_name: '', subscriber_id: '',
    subscriber_relationship_code: '',      // SBR*02

    // Billing Provider
    provider_name: '', provider_npi: '', provider_tax_id: '',
    provider_address: { address1: '', address2: '', city: '', state: '', zip: '' },
    provider_contact: { name: '', phone: '' },

    // Referring Provider (NM1*DN)
    referring_provider_name: '', referring_provider_npi: '',

    // Rendering Provider (NM1*82)
    rendering_provider_name: '', rendering_provider_npi: '',

    // Service Facility (NM1*77)
    service_facility_name: '', service_facility_npi: '',

    // Attending Provider — 837I (NM1*71)
    attending_provider_name: '', attending_provider_npi: '',

    // Operating Physician — 837I (NM1*72)
    operating_provider_name: '', operating_provider_npi: '',

    // Payer
    payer_name: '', payer_id: '',

    // Financial
    total_charge: 0,
    patient_amount_paid: 0,

    // Dates
    service_date_start: null, service_date_end: null,   // DTP*434/435
    admission_date: null, discharge_date: null,          // 837I
    discharge_hour: null,                                // 837I

    // Admission Info — 837I (CL1)
    admit_type_code: '', admit_source_code: '', patient_status_code: '',

    // Diagnosis Codes (HI) — all diagnoses across all HI segments
    diagnosis_codes: [{ code: '', qualifier: '', type: '' }],
    // type: 'principal' | 'other' | 'admitting' | 'external' | 'patient_reason' | 'drg'

    // DRG — 837I (HI*DRG)
    drg_code: '', drg_weight: '', drg_medical_surgical: '',

    // References (all REF segments)
    refs: [{ qualifier: '', value: '', description: '' }],

    // Amounts (all AMT segments)
    amts: [{ qualifier: '', value: 0, description: '' }],

    // Report Types (PWK)
    report_types: [{ code: '', qualifier: '', attachment_transmission_code: '' }],

    // Contract Info (CN1)
    contract_type: '', contract_amount: 0, contract_percentage: 0,

    // Condition Codes (CRC)
    condition_codes: [{ code: '', qualifier: '', value: '' }],

    // File Info (K3)
    file_info: [{ text: '' }],

    // Diagnosis pointers (for service line linkage)
    diagnosis_pointers: [{ pointer: 0 }],

    /* --- Service Lines --- */
    lines: [{
      line_number: 0,
      procedure_code: '',          // SV1*02, SV2*02, SV3*02
      modifier: '',                // Procedure code modifier
      charge_amount: 0,
      unit_count: 0,               // SV1*04, SV2*04, SV3*05
      service_date: null,          // DTP*472

      // Type discriminator
      procedure_type: 'SV1',       // 'SV1' | 'SV2' | 'SV3'

      // 837I — Revenue Code
      revenue_code: '',            // SV2*01

      // 837D — Dental
      oral_cavity_code: '',        // TOO*01
      tooth_code: '',              // TOO*02
      tooth_surface: '',           // TOO*03

      // Line-level references
      diagnosis_code_pointers: [{ pointer: 0 }],
      refs: [{ qualifier: '', value: '' }],
      amts: [{ qualifier: '', value: 0 }],
    }],

    status: 'submitted',
    denial_reasons: [],
  }]
}
```

## 4. Complete Segment Coverage

### 4.1 Envelope (All Types)

| Segment | Data Captured |
|---------|---------------|
| ISA | sender_id, receiver_id, date, time, control_number, standards_id |
| GS | gs_sender, gs_receiver, gs_date, gs_time, gs_control_number, gs_version |
| ST | st_transaction_id, st_control_number |
| SE | total_segments (verify) |
| GE | total_functional_groups |
| IEA | interchange_control_number (verify) |

### 4.2 Transaction Header (All Types)

| Segment | Data Captured |
|---------|---------------|
| BHT | bht_purpose, bht_reference, bht_date, bht_time, bht_transaction_type |

### 4.3 Billing Provider Loop (All Types)

| Segment | Data Captured |
|---------|---------------|
| HL*20 | Hierarchical level (parent tracking) |
| NM1*85 | provider_name, provider_npi |
| N3 | provider_address.address1, .address2 |
| N4 | provider_address.city, .state, .zip |
| REF*EI | provider_tax_id |
| PER | provider_contact.name, .phone |

### 4.4 Subscriber Loop (All Types)

| Segment | Data Captured |
|---------|---------------|
| HL*22 | Hierarchical level |
| NM1*IL | subscriber_first_name, subscriber_last_name, subscriber_id |
| N3 | subscriber address |
| N4 | subscriber city/state/zip |
| DMG | subscriber_dob, subscriber_gender |
| REF | subscriber_id (qualifier 1L, 34, etc.) |
| SBR | subscriber_relationship_code, claim_filing_type |

### 4.5 Patient Loop (All Types)

| Segment | Data Captured |
|---------|---------------|
| HL*23 | Hierarchical level |
| NM1*QC | patient_first_name, patient_last_name, patient_member_id |
| N3 | patient address |
| N4 | patient city/state/zip |
| DMG | patient_dob, patient_gender |
| PAT | patient_relationship_code |

### 4.6 Claim Loop (All Types)

| Segment | Data Captured |
|---------|---------------|
| CLM | claim_id, total_charge, pos_code |
| DTP*434 | service_date_start / admission_date |
| DTP*435 | service_date_end / discharge_date |
| DTP*096 | discharge_hour (837I) |
| REF | refs[] — all qualifier+value pairs |
| AMT | amts[] — all qualifier+value pairs |
| PWK | report_types[] |
| CN1 | contract_type, contract_amount, contract_percentage |
| CRC | condition_codes[] |
| K3 | file_info[] |
| HI | **diagnosis_codes[]** — all diagnostic codes |
| NM1*DN | referring_provider_name, referring_provider_npi |
| NM1*82 | rendering_provider_name, rendering_provider_npi |
| NM1*77 | service_facility_name, service_facility_npi |
| NM1*71 | attending_provider_name, attending_provider_npi (837I) |
| NM1*72 | operating_provider_name, operating_provider_npi (837I) |
| CL1 | admit_type_code, admit_source_code, patient_status_code (837I) |

### 4.7 HI Diagnosis Codes — Detailed

The HI segment uses qualifier codes to indicate diagnosis type:

| Qualifier | Diagnosis Type | 837P | 837I | 837D |
|-----------|---------------|:----:|:----:|:----:|
| ABK | Principal Diagnosis | ✓ | ✓ | ✓ |
| ABF | Other Diagnosis | ✓ | ✓ | ✓ |
| ABJ | Admitting Diagnosis | — | ✓ | — |
| ABG | Patient Reason for Visit | ✓ | — | — |
| ABR | External Cause of Injury | — | ✓ | — |
| DRG | DRG | — | ✓ | — |
| APX | DRG Med/Surg | — | ✓ | — |

Each sub-element in the HI segment is parsed as:
```
HI*ABK:I10~ABF:E119~ABF:I25.1
→ [{ code: 'I10', qualifier: 'ABK', type: 'principal' },
    { code: 'E119', qualifier: 'ABF', type: 'other' },
    { code: 'I25.1', qualifier: 'ABF', type: 'other' }]
```

### 4.8 Service Line Loop (Varies by Type)

| Segment | 837P | 837I | 837D | Data Captured |
|---------|:----:|:----:|:----:|---------------|
| LX | ✓ | ✓ | ✓ | line_number |
| SV1 | ✓ | — | — | procedure_code, charge_amount, unit_count, diagnosis_pointers |
| SV2 | — | ✓ | — | revenue_code, procedure_code, charge_amount, unit_count |
| SV3 | — | — | ✓ | procedure_code, charge_amount, unit_count, diagnosis_pointers |
| TOO | — | — | ✓ | oral_cavity_code, tooth_code, tooth_surface |
| DTP*472 | ✓ | ✓ | ✓ | service_date |
| REF | ✓ | ✓ | ✓ | refs[] |
| AMT | ✓ | ✓ | ✓ | amts[] |
| HI | ✓ | ✓ | ✓ | diagnosis_pointers (line-level) |

### 4.9 SV1, SV2, SV3 Sub-Element Breakdown

**SV1 (Professional Service Line):**
```
SV1*HC:99213:11*150*UN*1*11**1:2:3**N~
```
- `SV1*01` = Composite medical procedure (HC:code:modifier)
- `SV1*02` = Monetary amount (charge)
- `SV1*03` = Unit or basis for measurement
- `SV1*04` = Quantity (units)
- `SV1*05-06` = Facility/composite
- `SV1*07` = Diagnosis code pointer (e.g., `1:2:3`)
- `SV1*08-09` = Other

**SV2 (Institutional Service Line):**
```
SV2*0450*HC:93005*150*UN*1*1~
```
- `SV2*01` = Revenue code
- `SV2*02` = Composite medical procedure
- `SV2*03` = Monetary amount
- `SV2*04` = Unit or basis
- `SV2*05` = Quantity

**SV3 (Dental Service Line):**
```
SV3*D0120*HC*150*UN*1*1**1:2~
```
- `SV3*01` = Composite medical procedure (CDT code)
- `SV3*02` = Monetary amount
- `SV3*03` = Unit or basis
- `SV3*04` = Quantity
- `SV3*05-06` = Other
- `SV3*07` = Diagnosis code pointer

## 5. Test Infrastructure Fix

**Problem:** chai 6.x ships ESM-only (`export`), but Jest runs in CJS mode.

**Fix:** Replace `const { expect } = require('chai')` with Jest's native `expect` across all test files. This avoids any ESM/CJS compatibility issues.

**Files affected:**
- `tests/edi837.parser.test.js`
- `tests/edi835.parser.test.js` (already done in 835 plan — verify)
- `tests/claims.test.js`
- `tests/dashboard.test.js`
- `tests/auth.test.js`
- `tests/upload.test.js`

## 6. Test Fixtures

### 6.1 sample.837.js — 837P Professional (Multi-Claim)

Replace the current simple fixture with a realistic multi-claim 837P file:
- Full ISA/GS/ST/SE/GE/IEA envelope
- 2 claims with different patients
- Multiple service lines per claim
- Billing provider, subscriber, patient HL hierarchy
- DMG demographics, HI diagnosis codes
- SBR subscriber info, REF references
- Rendering and referring provider NM1 segments
- N3/N4 addresses

### 6.2 sample.837i.js — 837I Institutional (New)

Realistic institutional claim fixture:
- CL1 admission info (type, source, patient status)
- HI with principal, other, admitting diagnoses
- HI*DRG with DRG code
- DTP*434 (admission), DTP*435 (discharge), DTP*096 (discharge hour)
- NM1*71 (attending), NM1*72 (operating)
- SV2 revenue codes
- PWK, CRC, CN1

### 6.3 sample.837d.js — 837D Dental (New)

Realistic dental claim fixture:
- SV3 with CDT procedure codes
- TOO tooth segments
- DTP*472 service dates
- Subscriber/patient hierarchy
- HI diagnosis codes

## 7. Test Cases

| Group | Tests |
|-------|-------|
| **Envelope** | ISA metadata, GS metadata, ST/SE control number, GE/IEA |
| **Transaction Header** | BHT purpose, reference, date |
| **Billing Provider** | NM1*85 name, NPI, N3/N4 address, REF tax ID, PER contact |
| **Subscriber** | NM1*IL name, subscriber ID, DMG, SBR relationship |
| **Patient** | NM1*QC name, DOB, gender, PAT relationship |
| **Claim** | CLM fields, DTP dates, REF/AMT arrays, PWK, CN1, CRC |
| **Diagnosis Codes** | HI parsing — principal, other, admitting, DRG, all qualifiers |
| **Service Lines** | SV1 (P), SV2 (I), SV3 (D) — codes, charges, units, modifiers |
| **Dental** | TOO tooth info, SV3 CDT codes |
| **Provider References** | NM1*DN, *82, *77, *71, *72 |
| **Edge Cases** | Empty file, no claims, multi-claim, malformed, missing segments, single HL |
| **Backward Compat** | Existing assertions (claims, patient info, lines, subscriber ID, empty) |

## 8. Backward Compatibility

The `claims` array retains all existing flat fields:
- `claim_id`, `total_charge`, `status`, `patient_dob`, `patient_gender`
- `patient_first_name`, `patient_last_name`
- `subscriber_id`
- `payer_name`, `provider_name`, `provider_npi`
- `service_date_start`, `service_date_end`
- `lines[].line_number`, `procedure_code`, `charge_amount`, `service_date`

Existing consumers (`upload.service.js` → `_process837()`, `Claim` model, `ClaimLine` model) keep working without changes.

New fields are additive and will be ignored by existing consumers until they choose to use them.

## 9. File Changes

| File | Action | Reason |
|------|--------|--------|
| `src/parsers/edi837.parser.js` | **Rewrite** | HL stack loop-based architecture, full coverage |
| `tests/fixtures/sample.837.js` | **Replace** | Comprehensive 837P multi-claim fixture |
| `tests/fixtures/sample.837i.js` | **New** | 837I institutional fixture |
| `tests/fixtures/sample.837d.js` | **New** | 837D dental fixture |
| `tests/edi837.parser.test.js` | **Rewrite** | Comprehensive tests, Jest native expect |
| `tests/edi835.parser.test.js` | Update | chai→jest if not already done |
| `tests/claims.test.js` | Update | chai→jest native expect |
| `tests/dashboard.test.js` | Update | chai→jest native expect |
| `tests/auth.test.js` | Update | chai→jest native expect |
| `tests/upload.test.js` | Update | chai→jest native expect |
| `package.json` | Update | Remove chai dependency |

---

*End of design document.*