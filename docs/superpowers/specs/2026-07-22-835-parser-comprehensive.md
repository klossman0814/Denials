# EDI 835 Parser — Comprehensive Enhancement

**Date:** 2026-07-22
**Status:** Draft

## 1. Objective

Make the EDI 835 parser completely working and future-proof by:
- Parsing **all meaningful 835 segments** across envelope, header, payer/payee, claim, service line, and summary levels
- Fixing the **broken test infrastructure** (chai 6.x ESM vs Jest CJS)
- Expanding the **test fixture** to a realistic multi-claim 835 file
- Ensuring **backward compatibility** with existing consumers (upload service, models)

## 2. Approach: Loop-Based Structured Parser

Organize parsing by the 835's natural loop hierarchy (selected from Approach B).

### Phase Map

```
Phase 0: Envelope      → ISA → GS → ST
Phase 1: Header        → BPR → TRN → DTM 405
Phase 2: Payer Loop    → N1*PR → N3 → N4 → REF → PER
Phase 3: Payee Loop    → N1*PE → N3 → N4 → REF → PER
Phase 4: Claim Loop    → CLP with NM1 / CAS / DTM / REF / AMT / DMG / MIA / MOA
  Phase 4a: SVC Loop   → SVC with CAS / DTM / REF / AMT / QTY
Phase 5: Summary       → PLB
Phase 6: Trailers      → SE → GE → IEA
```

### Implementation Mechanism

A single pass through segments with a `phase` integer and `loopContext` variable:

- `phase` tracks which structural section we're in (0–6)
- `loopContext` (e.g., `{ type: 'PR' }` or `{ type: 'PE' }`) tells subsequent N3/N4/REF/PER which N1 loop they belong to
- A new CLP finalizes the previous claim; SE finalizes the last claim
- A new SVC finalizes the previous service line

## 3. Output Structure

```js
{
  metadata: {
    sender_id, receiver_id, date, time, control_number, standards_id,
    gs_sender, gs_receiver, gs_date, gs_time, gs_control_number, gs_version,
    st_transaction_id, st_control_number,
    total_segments, total_functional_groups, interchange_control_number
  },
  file: {
    total_payment, payment_method, payment_date, trace_number,
    sender_bank_id, sender_account, credit_debit_flag,
    payer_name, payer_id_code,                // backward compat flat fields
    payee_name, payee_id_code, payee_tax_id,
    payer: {                                   // nested payer block
      name, id_code, id_qualifier,
      address: { address1, address2, city, state, zip },
      contact: { name, phone, email }
    },
    payee: {                                   // nested payee block
      name, id_code, id_qualifier,
      address: { ... },
      contact: { ... },
      additional_ids: [{ qualifier, value }]
    }
  },
  remittances: [{
    patient: { first_name, last_name, member_id },
    subscriber: { first_name, last_name, subscriber_id },
    rendering_provider: { name, npi },
    billing_provider: { name, npi },
    payer_claim_id, total_charge, total_paid, adjustment_amount,
    status, claim_status_code, claim_filing_type,
    service_dates: { from, to },
    remittance_date, claim_statement_dates: { from, to },
    patient_dob, patient_gender,
    refs: [{ qualifier, value, description }],
    amts: [{ qualifier, value, description }],
    inpatient_info: { covered_days, pps_code, drg, discharge_status },
    outpatient_info: { reimbursement, remark_codes },
    denial_reasons: [{ group_code, denial_code, amount }],
    service_lines: [{
      line_number, procedure_code, modifier,
      charge_amount, paid_amount, unit_count,
      service_date, line_control_number, patient_liability,
      quantity_adjustments: [{ qualifier, value }],
      denial_reasons: [{ group_code, denial_code, amount }]
    }]
  }],
  provider_adjustments: [{
    adjustment_identifier, adjustment_reason_code,
    adjustment_amount, date, reference_identification
  }]
}
```

## 4. Complete Segment Coverage

| Segment | Loop | Data Captured |
|---------|------|---------------|
| ISA | Envelope | sender_id, receiver_id, date, time, control_number, standards_id |
| GS | Envelope | gs_sender, gs_receiver, gs_date, gs_time, gs_control_number, gs_version |
| ST | Envelope | st_transaction_id, st_control_number |
| BPR | Header | total_payment, credit_debit_flag, payment_method, sender_bank_id, sender_account, payment_date, payment_effective_date |
| TRN | Header | trace_number, originator_id |
| DTM 405 | Header | payment_date (fallback) |
| N1\*PR | Payer | payer_name, payer_id_code |
| N3 | Payer/Payee | address1, address2 |
| N4 | Payer/Payee | city, state, zip |
| REF | Payer/Payee | additional_ids (all qualifiers) |
| PER | Payer/Payee | contact_name, communication (phone/email/fax) |
| N1\*PE | Payee | payee_name, payee_id_code |
| REF\*TJ | Payee | payee_tax_id |
| CLP | Claim | payer_claim_id, claim_status_code, total_charge, total_paid, adjustment_amt, claim_filing_type |
| NM1\*QC | Claim | patient.first_name, patient.last_name, patient.member_id |
| NM1\*IL | Claim | subscriber.first_name, subscriber.last_name, subscriber.subscriber_id |
| NM1\*82 | Claim | rendering_provider.name, rendering_provider.npi |
| NM1\*85 | Claim | billing_provider.name, billing_provider.npi |
| DMG | Claim | patient_dob, patient_gender |
| DTM 232/233 | Claim | service_dates.from, .to |
| DTM 050 | Claim | remittance_date |
| DTM 652/653 | Claim | claim_statement_period |
| REF (all) | Claim | refs[] — all qualifier+value pairs |
| AMT (all) | Claim | amts[] — all qualifier+value pairs |
| CAS | Claim | denial_reasons[], adjustment_amount |
| MIA | Claim | inpatient_info: covered_days, pps_code, drg, discharge_status |
| MOA | Claim | outpatient_info: reimbursement, remark_codes |
| SVC | Line | procedure_code, modifier, charge_amount, paid_amount, unit_count |
| DTM 472 | Line | service_date |
| CAS | Line | denial_reasons[] (line-level) |
| REF\*6R | Line | line_control_number |
| AMT\*B6 | Line | patient_liability |
| QTY | Line | quantity_adjustments[] |
| PLB | Summary | provider_adjustments[] — reason_code, amount, date, ref |
| SE | Trailer | total_segments (verify) |
| GE | Trailer | total_functional_groups |
| IEA | Trailer | interchange_control_number (verify) |

## 5. Test Infrastructure Fix

**Problem:** chai 6.x ships ESM-only (`export`), but Jest runs in CJS mode.

**Fix:** Replace `const { expect } = require('chai')` with Jest's native `expect` across all test files. This avoids any ESM/CJS compatibility issues and removes an unnecessary dependency.

**Files affected:**
- `tests/edi835.parser.test.js`
- `tests/edi837.parser.test.js`
- `tests/claims.test.js`
- `tests/dashboard.test.js`
- `tests/auth.test.js`
- `tests/upload.test.js`

## 6. Test Strategy

### Fixture: Realistic Multi-Claim 835
- Full ISA/GS/ST/SE/GE/IEA envelope
- 2–3 claims with different statuses (paid, denied, partial)  
- Multiple service lines per claim
- CAS at both claim level and line level
- Payer N3/N4/PER
- Payee N3/N4/REF/PER
- Multiple REF/AMT varieties
- DMG patient demographics
- PLB provider-level adjustments
- MIA/MOA where applicable

### Test Cases
| Group | Tests |
|-------|-------|
| Envelope | ISA metadata, GS metadata, ST/SE control number match |
| Header | BPR amounts, method, date, TRN, DTM 405 |
| Payer/Payee | N1 names, N3/N4 addresses, PER contact, REF ids |
| Claims | CLP fields, NM1 names, DMG demos, DTM dates, REF/AMT arrays |
| CAS | Claim-level AND line-level denial codes/amounts |
| Service Lines | SVC codes/charges, DTM 472, REF 6R, AMT B6, QTY, line-level CAS |
| Summary | PLB provider adjustments |
| Edge Cases | Empty file, no claims, multi-claim, malformed, missing segments |
| Backward Compat | Existing assertions must still pass |

## 7. Backward Compatibility

The `file` object retains its flat fields:
- `file.payer_name` → same as `file.payer.name`
- `file.payee_name` → same as `file.payee.name`
- `file.payee_tax_id` → same as matching `file.payee.additional_ids[]`

The `remittances` retain:
- `remittance.patient_name` → from `patient.first_name + patient.last_name`
- `remittance.patient_first_name`, `patient_last_name`, `patient_member_id`
- `remittance.subscriber_id`
- `remittance.rendering_provider_name`
- `remittance.billing_provider_name`
- `remittance.service_date_from`, `service_date_to`

Existing consumers (`upload.service.js`, `models/Remittance.js`) keep working without changes.

## 8. File Changes

| File | Action | Reason |
|------|--------|--------|
| `src/parsers/edi835.parser.js` | **Rewrite** | Loop-based architecture with full coverage |
| `src/parsers/edi.utils.js` | Minor update | Maybe add description lookup for REF/AMT qualifiers |
| `tests/fixtures/sample.835.js` | **Rewrite** | Full realistic multi-claim 835 fixture |
| `tests/edi835.parser.test.js` | **Rewrite** | Comprehensive tests, chai→jest native |
| `tests/edi837.parser.test.js` | Update | chai→jest native |
| `tests/claims.test.js` | Update | chai→jest native |
| `tests/dashboard.test.js` | Update | chai→jest native |
| `tests/auth.test.js` | Update | chai→jest native |
| `tests/upload.test.js` | Update | chai→jest native |
| `package.json` | Update | Remove chai dependency |

---

*End of design document.*