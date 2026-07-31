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

// CAS adjustment reason code descriptions (industry-standard)
const CAS_DESCRIPTIONS = {
  'CO': 'Contractual Obligation',
  'PR': 'Patient Responsibility',
  'OA': 'Other Adjustment',
  'PI': 'Payer Initiated',
  'CR': 'Contractual',
  'CO-1': 'Deductible',
  'CO-2': 'Coinsurance',
  'CO-3': 'Co-payment',
  'CO-4': 'Non-covered service',
  'CO-22': 'Payment adjusted based on prior payer(s) payments',
  'CO-23': 'Payment adjusted because charge exceeds fee schedule',
  'CO-29': 'Payment reduced or denied based on time limits',
  'CO-45': 'Charge exceeds fee schedule/maximum allowable',
  'CO-50': 'Payment adjusted based on multiple procedure rule',
  'CO-51': 'Payment denied based on medical necessity',
  'CO-97': 'The benefit for this service is included in the payment/allowance for another service',
  'CO-109': 'Claim/service not covered by this payer/contractor',
  'CO-151': 'Payment denied based on clinical validity',
  'CO-204': 'This service/equipment/drug is not covered under the patient\'s current benefit plan',
  'PR-1': 'Deductible amount',
  'PR-2': 'Coinsurance amount',
  'PR-3': 'Co-payment amount',
  'PR-4': 'Non-covered charge',
  'PR-6': 'Prior payer(s)\'s payment',
  'OA-23': 'Payment adjusted because charge exceeds fee schedule',
  'OA-30': 'Payment adjusted because patient is under age limit',
  'OA-92': 'Payment reduced due to manual review',
  'OA-100': 'Payment made to patient/insured',
  'OA-106': 'Payment adjusted based on a contractual agreement',
  'OA-108': 'Payment adjusted based on a bundling/multiple procedure rule',
  'OA-109': 'Claim/service not covered by this payer/contractor',
  'OA-110': 'Payment adjusted because service not authorized',
  'PI-1': 'Payer responsibility for this claim/service',
  'PI-30': 'Patient is under age limit',
};

function getCasDescription(groupCode, code) {
  const fullCode = `${groupCode}-${code}`;
  return CAS_DESCRIPTIONS[fullCode] || CAS_DESCRIPTIONS[groupCode] || '';
}

/**
 * Parse EDI 835 Health Care Claim Payment/Advice
 *
 * Loop-based single-pass state machine:
 *   Phase 0: Envelope (ISA -> GS -> ST)
 *   Phase 1: Header   (BPR -> TRN -> DTM 405)
 *   Phase 2: Payer    (N1*PR -> N3 -> N4 -> REF -> PER)
 *   Phase 3: Payee    (N1*PE -> N3 -> N4 -> REF -> PER)
 *   Phase 4: Claims   (CLP -> NM1 -> CAS -> DTM -> REF -> AMT -> DMG -> MIA -> MOA)
 *     Phase 4a: SVC   (SVC -> CAS -> DTM -> REF -> AMT -> QTY)
 *   Phase 5: Summary  (PLB)
 *   Phase 6: Trailers (SE -> GE -> IEA)
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
  const provider_summaries = [];
  const file_lq_codes = [];
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
      patient_responsibility: 0,
      amount_paid_other_payer: 0,
      adjustment_amount: 0,
      status: '',
      claim_status_code: '',
      claim_filing_type: '',
      remittance_date: null,
      patient_name: '',
      patient_first_name: '',
      patient_middle_initial: '',
      patient_last_name: '',
      patient_suffix: '',
      patient_member_id: '',
      subscriber_id: '',
      subscriber_first_name: '',
      subscriber_middle_initial: '',
      subscriber_last_name: '',
      subscriber_suffix: '',
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
      lq_codes: [],
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
      refs: [],
    };
  }

  // --- Main parsing loop ---
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;

    const elements = parseSegment(segment);
    const segId = elements[0];

    switch (segId) {
      // -- Phase 0: Envelope --
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

      // -- Phase 1: Header --
      case 'BPR': {
        file.total_payment = parseEDIAmount(elements[2]);
        file.credit_debit_flag = elements[3] || '';
        file.payment_method = elements[4] || '';
        file.payment_format_code = elements[5] || '';
        file.payment_format_desc = elements[6] || '';
        file.sender_bank_id = elements[7] || '';
        file.receiver_bank_id = elements[8] || '';
        file.sender_account = elements[9] || '';
        file.receiver_account = elements[10] || '';
        file.payment_date = parseEDIDate(elements[16]) || parseEDIDate(elements[14]) || null;
        phase = 1;
        resetFileContext();
        break;
      }
      case 'TRN': {
        file.trace_number = elements[2] || '';
        break;
      }

      // -- Phase 2: Payer Loop (N1*PR) --
      // -- Phase 3: Payee Loop (N1*PE) --
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
          else if (qual === 'ED') target.contact.email = target.contact.email || value;
          else if (qual === 'FX') target.contact.fax = value;
          else if (qual === 'UR') target.contact.url = value;
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
        } else if (currentLine) {
          // Line-level REF — check before claim-level since line is inside a claim
          if (refQual === '6R') {
            currentLine.line_control_number = refValue;
          } else if (refQual === 'LU') {
            currentLine.refs.push({ qualifier: refQual, value: refValue, description: refDesc });
          }
        } else if (currentRemittance) {
          // Claim-level REFs
          if (refQual === '1C' && !currentRemittance.rendering_provider_npi) {
            currentRemittance.rendering_provider_npi = refValue;
            currentRemittance.rendering_provider.npi = refValue;
          }
          currentRemittance.refs.push({ qualifier: refQual, value: refValue, description: refDesc });
        }
        break;
      }

      // -- DTM (can appear in header, claim, and line contexts) --
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

      // -- Phase 4: Claims --
      case 'CLP': {
        finalizeClaim();
        lineCounter = 0;
        phase = 4;
        loopContext = null; // Clear payer/payee context when entering claims

        const clpClaimId = elements[1] || '';
        const clpStatusCode = elements[2] || '';
        const clpCharge = parseEDIAmount(elements[3]);
        const clpPaid = parseEDIAmount(elements[4]);
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
        currentRemittance.patient_responsibility = parseEDIAmount(elements[5]) || 0;
        currentRemittance.amount_paid_other_payer = parseEDIAmount(elements[6]) || 0;
        currentRemittance.status = status;
        currentRemittance.claim_status_code = clpStatusCode;
        currentRemittance.claim_filing_type = clpFilingType;
        break;
      }

      // -- NM1 (patient, subscriber, providers) --
      case 'NM1': {
        if (!currentRemittance) break;
        const nm1Qual = elements[1] || '';
        const nm1Last = elements[3] || '';
        const nm1First = elements[4] || '';
        const nm1Middle = elements[5] || '';
        const nm1Suffix = elements[7] || '';
        const nm1Id = elements[9] || '';
        const nm1IdQual = (elements[8] || '').trim();

        if (nm1Qual === 'QC') {
          currentRemittance.patient_last_name = nm1Last;
          currentRemittance.patient_first_name = nm1First;
          currentRemittance.patient_middle_initial = nm1Middle;
          currentRemittance.patient_suffix = nm1Suffix;
          currentRemittance.patient_member_id = nm1Id;
          currentRemittance.patient.last_name = nm1Last;
          currentRemittance.patient.first_name = nm1First;
          currentRemittance.patient.member_id = nm1Id;
        } else if (nm1Qual === 'IL') {
          currentRemittance.subscriber_id = nm1Id;
          currentRemittance.subscriber.subscriber_id = nm1Id;
          currentRemittance.subscriber.last_name = nm1Last;
          currentRemittance.subscriber.first_name = nm1First;
          currentRemittance.subscriber_middle_initial = nm1Middle;
          currentRemittance.subscriber_suffix = nm1Suffix;
        } else if (nm1Qual === '82') {
          currentRemittance.rendering_provider_name = `${nm1First} ${nm1Last}`.trim();
          currentRemittance.rendering_provider.name = `${nm1First} ${nm1Last}`.trim();
          if (nm1IdQual === 'XX') {
            currentRemittance.rendering_provider_npi = nm1Id;
            currentRemittance.rendering_provider.npi = nm1Id;
          }
        } else if (nm1Qual === '85') {
          currentRemittance.billing_provider_name = `${nm1First} ${nm1Last}`.trim();
          currentRemittance.billing_provider.name = `${nm1First} ${nm1Last}`.trim();
          if (nm1IdQual === 'XX') {
            currentRemittance.billing_provider_npi = nm1Id;
            currentRemittance.billing_provider.npi = nm1Id;
          }
        }
        break;
      }

      // -- DMG (Patient Demographics) --
      case 'DMG': {
        if (!currentRemittance) break;
        currentRemittance.patient_dob = parseEDIDate(elements[2]);
        currentRemittance.patient_gender = elements[3] || '';
        break;
      }

      // -- AMT (can appear at claim or line level) --
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

      // -- CAS (Adjustments at claim or line level) --
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
              reason_description: getCasDescription(casGroupCode, code),
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
              reason_description: getCasDescription(casGroupCode, code),
            });
          }
        }
        break;
      }

      // -- SVC (Service Line) --
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

      // -- QTY (Quantity adjustments at line level) --
      case 'QTY': {
        if (!currentLine) break;
        const qtyQual = (elements[1] || '').trim();
        const qtyValue = parseEDIAmount(elements[2]);
        currentLine.quantity_adjustments.push({ qualifier: qtyQual, value: qtyValue });
        break;
      }

      // -- MIA (Inpatient Adjudication) --
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

      // -- MOA (Outpatient Adjudication) --
      case 'MOA': {
        if (!currentRemittance) break;
        const remarkCodes = [];
        for (let j = 2; j <= 9; j++) {
          if (elements[j]) remarkCodes.push(elements[j]);
        }
        currentRemittance.outpatient_info = {
          reimbursement: parseEDIAmount(elements[1]),
          remark_codes: remarkCodes,
        };
        break;
      }

      // -- Phase 5: Summary (PLB) --
      case 'PLB': {
        phase = 5;
        // PLB*provider_id*date*reason_code1*amount1*reason_code2*amount2...
        // Reason code is a composite: "FB:50" where FB=group, 50=specific code
        for (let j = 3; j + 1 < elements.length; j += 2) {
          const reasonSub = getSubElements(elements[j] || '');
          provider_adjustments.push({
            provider_identifier: elements[1] || '',
            adjustment_date: parseEDIDate(elements[2]),
            adjustment_reason_code: reasonSub[0] || '',
            adjustment_reason_subcode: reasonSub[1] || '',
            adjustment_amount: parseEDIAmount(elements[j + 1]),
            reference_identification: '',
          });
        }
        break;
      }

      // -- TS3/TS2: Provider Summary (Medicare/Medicaid 835s) --
      case 'TS3': {
        phase = 5;
        const fiscalPeriod = (elements[2] || '').trim();
        const fpDate = parseEDIDate(fiscalPeriod);
        provider_summaries.push({
          provider_identifier: elements[1] || '',
          fiscal_period_start: fpDate ? `${fpDate.slice(0, 7)}-01` : null,
          fiscal_period_end: fpDate ? `${fpDate.slice(0, 7)}-${String(Math.min(28, parseInt(fpDate.slice(8, 10), 10) || 28)).padStart(2, '0')}` : null,
          total_claim_count: parseInt(elements[3], 10) || 0,
          total_charge_amount: parseEDIAmount(elements[5]),
          total_payment_amount: parseEDIAmount(elements[7]),
          total_patient_responsibility: parseEDIAmount(elements[9]),
          total_provider_adjustment: parseEDIAmount(elements[10]),
          total_adjustment_amount: parseEDIAmount(elements[11]),
        });
        break;
      }

      // -- LQ: Industry/Remark Code (e.g., LQ*HE*N290 for claim remarks) --
      case 'LQ': {
        const lqQual = (elements[1] || '').trim();
        const lqCode = (elements[2] || '').trim();
        const lqDesc = (elements[3] || '').trim();
        if (currentRemittance) {
          currentRemittance.lq_codes.push({ qualifier: lqQual, code: lqCode, description: lqDesc });
        } else {
          file_lq_codes.push({ qualifier: lqQual, code: lqCode, description: lqDesc });
        }
        break;
      }

      // -- Phase 6: Trailers --
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

  return { metadata, file, remittances, provider_adjustments, provider_summaries, lq_codes: file_lq_codes };
}

module.exports = { parse835 };