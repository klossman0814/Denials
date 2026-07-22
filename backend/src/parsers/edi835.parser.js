const { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount } = require('./edi.utils');

function parse835(content) {
  const segments = splitSegments(content);

  const file = {
    total_payment: 0,
    payment_method: '',
    payment_date: null,
    trace_number: '',
    sender_bank_id: '',
    sender_account: '',
    payer_name: '',
    payer_id_code: '',
    payee_name: '',
    payee_id_code: '',
    payee_tax_id: '',
  };

  const remittances = [];
  let currentRemittance = null;
  let currentLine = null;
  let lineCounter = 0;
  let afterN1 = null;

  function finalizeLine() {
    if (currentRemittance && currentLine) {
      currentRemittance.service_lines.push(currentLine);
      currentLine = null;
    }
  }

  function finalizeClaim() {
    finalizeLine();
    if (currentRemittance) {
      remittances.push(currentRemittance);
      currentRemittance = null;
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const elements = parseSegment(segments[i]);
    const segId = elements[0];

    switch (segId) {
      case 'BPR':
        file.total_payment = parseEDIAmount(elements[2]);
        file.payment_method = elements[4] || '';
        file.payment_date = parseEDIDate(elements[16]) || parseEDIDate(elements[14]);
        file.sender_bank_id = elements[7] || '';
        file.sender_account = elements[9] || '';
        afterN1 = null;
        break;

      case 'TRN':
        file.trace_number = elements[2] || '';
        break;

      case 'N1':
        if (elements[1] === 'PR') {
          file.payer_name = elements[2] || '';
          file.payer_id_code = `${elements[3] || ''}:${elements[4] || ''}`;
          afterN1 = 'PR';
        } else if (elements[1] === 'PE') {
          file.payee_name = elements[2] || '';
          file.payee_id_code = `${elements[3] || ''}:${elements[4] || ''}`;
          afterN1 = 'PE';
        } else {
          afterN1 = null;
        }
        break;

      case 'REF':
        if (afterN1 === 'PE' && elements[1] === 'TJ') {
          file.payee_tax_id = elements[2] || '';
        }
        afterN1 = null;
        break;

      case 'DTM':
        if (elements[1] === '405' && !currentRemittance) {
          if (!file.payment_date) file.payment_date = parseEDIDate(elements[2]);
        }
        if (currentRemittance) {
          if (elements[1] === '232') currentRemittance.service_date_from = parseEDIDate(elements[2]);
          if (elements[1] === '233') currentRemittance.service_date_to = parseEDIDate(elements[2]);
          if (elements[1] === '050') currentRemittance.remittance_date = parseEDIDate(elements[2]);
        }
        if (currentLine && elements[1] === '472') {
          currentLine.service_date = parseEDIDate(elements[2]);
        }
        break;

      case 'CLP':
        finalizeClaim();
        lineCounter = 0;
        currentRemittance = {
          patient_name: '',
          payer_claim_id: elements[7] || elements[1] || '',
          total_charge: parseEDIAmount(elements[3]),
          total_paid: parseEDIAmount(elements[4]),
          adjustment_amount: 0,
          remittance_date: null,
          status: parseFloat(elements[4]) >= parseFloat(elements[3]) ? 'paid' : (parseFloat(elements[4]) > 0 ? 'partial' : 'denied'),
          claim_status_code: elements[2] || '',
          patient_first_name: '',
          patient_last_name: '',
          patient_member_id: '',
          subscriber_id: '',
          rendering_provider_name: '',
          rendering_provider_npi: '',
          billing_provider_name: '',
          billing_provider_npi: '',
          service_date_from: null,
          service_date_to: null,
          denial_reasons: [],
          service_lines: [],
        };
        break;

      case 'NM1':
        if (!currentRemittance) break;
        if (elements[1] === 'QC') {
          currentRemittance.patient_last_name = elements[3] || '';
          currentRemittance.patient_first_name = elements[4] || '';
          currentRemittance.patient_name = `${elements[4] || ''} ${elements[3] || ''}`.trim();
          currentRemittance.patient_member_id = elements[9] || '';
        } else if (elements[1] === '82') {
          currentRemittance.rendering_provider_name = `${elements[4] || ''} ${elements[3] || ''}`.trim();
        } else if (elements[1] === '85') {
          currentRemittance.billing_provider_name = `${elements[4] || ''} ${elements[3] || ''}`.trim();
        } else if (elements[1] === 'IL') {
          currentRemittance.subscriber_id = elements[9] || '';
        }
        break;

      case 'SVC':
        if (!currentRemittance) break;
        finalizeLine();
        lineCounter++;
        const svcElements = getSubElements(elements[1] || '');
        const procCode = svcElements.length >= 3 ? svcElements[2] : (svcElements.length >= 2 ? svcElements[1] : '');
        currentLine = {
          line_number: lineCounter,
          procedure_code: procCode || '',
          modifier: svcElements.length >= 4 ? svcElements.slice(3).filter(Boolean).join(':') : '',
          charge_amount: parseEDIAmount(elements[2]),
          paid_amount: parseEDIAmount(elements[3]),
          unit_count: parseEDIAmount(elements[5]),
          service_date: null,
          line_control_number: '',
          patient_liability: 0,
          denial_reasons: [],
        };
        break;

      case 'CAS':
        if (currentLine) {
          const lineGroupCode = elements[1] || '';
          for (let j = 2; j + 2 < elements.length; j += 3) {
            const code = elements[j];
            const amount = parseEDIAmount(elements[j + 1]);
            const denial = { denial_code: `${lineGroupCode}-${code}`, group_code: lineGroupCode, amount, reason_description: '' };
            currentLine.denial_reasons.push(denial);
          }
        } else if (currentRemittance) {
          const claimGroupCode = elements[1] || '';
          for (let j = 2; j + 2 < elements.length; j += 3) {
            const code = elements[j];
            const amount = parseEDIAmount(elements[j + 1]);
            const denial = { denial_code: `${claimGroupCode}-${code}`, group_code: claimGroupCode, amount, reason_description: '' };
            currentRemittance.denial_reasons.push(denial);
            currentRemittance.adjustment_amount += amount;
          }
        }
        break;

      case 'AMT':
        if (currentLine && elements[1] === 'B6') {
          currentLine.patient_liability = parseEDIAmount(elements[2]);
        }
        break;

      case 'REF':
        if (currentLine && elements[1] === '6R') {
          currentLine.line_control_number = elements[2] || '';
        }
        break;

      case 'SE':
        finalizeClaim();
        break;
    }
  }

  finalizeClaim();

  return { file, remittances };
}

module.exports = { parse835 };
