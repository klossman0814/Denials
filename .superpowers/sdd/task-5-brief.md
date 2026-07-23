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


