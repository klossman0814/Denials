const { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount } = require('./edi.utils');

function parse837(content) {
  const segments = splitSegments(content);
  const metadata = { sender_id: '', receiver_id: '', date: '', time: '', control_number: '' };
  const claims = [];
  let currentClaim = null;
  let currentLine = null;
  let inClaim = false;
  let patientInfo = {};
  let subscriberInfo = {};

  for (let i = 0; i < segments.length; i++) {
    const elements = parseSegment(segments[i]);
    const segId = elements[0];

    switch (segId) {
      case 'ISA':
        metadata.sender_id = elements[6]?.trim();
        metadata.receiver_id = elements[8]?.trim();
        metadata.date = elements[9]?.trim();
        metadata.time = elements[10]?.trim();
        metadata.control_number = elements[13]?.trim();
        break;
      case 'NM1': {
        const qual = elements[1];
        const entityType = elements[2];
        const last = elements[3] || '';
        const first = elements[4] || '';
        const idCodeQual = elements[8] || '';
        const idCode = elements[9] || '';
        if (qual === 'QC' || qual === 'IL') {
          subscriberInfo = { ...subscriberInfo, last_name: last, first_name: first };
          // For person entities (type 1), element[9] is the subscriber/member ID
          if (entityType === '1' && idCode) {
            subscriberInfo.subscriber_id = idCode;
          }
          if (qual === 'QC') patientInfo = { last_name: last, first_name: first };
        } else if (qual === '82' && currentClaim) currentClaim.provider_npi = idCode;
        else if (qual === '85' && currentClaim) {
          currentClaim.provider_name = `${first} ${last}`.trim();
          currentClaim.provider_npi = currentClaim.provider_npi || idCode;
        } else if (qual === 'PR' && currentClaim) currentClaim.payer_name = `${first} ${last}`.trim();
        break;
      }
      case 'CLM':
        currentClaim = {
          claim_id: elements[1] || '', total_charge: parseEDIAmount(elements[2]),
          patient_first_name: '', patient_last_name: '', patient_dob: null, patient_gender: '',
          subscriber_id: '', payer_name: '', provider_name: '', provider_npi: '',
          service_date_start: null, service_date_end: null, status: 'submitted', lines: [],
        };
        inClaim = true;
        claims.push(currentClaim);
        break;
      case 'DMG':
        // DMG segments often appear before CLM in HL hierarchy
        // Store patient info and apply to current claim when found
        patientInfo.dob = parseEDIDate(elements[2]);
        patientInfo.gender = elements[3] || '';
        if (currentClaim) {
          currentClaim.patient_dob = currentClaim.patient_dob || patientInfo.dob;
          currentClaim.patient_gender = currentClaim.patient_gender || patientInfo.gender;
        }
        break;
      case 'DTP': {
        if (inClaim && currentClaim && elements[3]) {
          const date = parseEDIDate(elements[3]);
          if (!currentClaim.service_date_start) currentClaim.service_date_start = date;
          currentClaim.service_date_end = date;
        }
        break;
      }
      case 'REF':
        // 1L = Member ID number (subscriber) reference
        if (elements[1] === '1L') {
          subscriberInfo.subscriber_id = elements[2] || '';
          if (currentClaim) currentClaim.subscriber_id = subscriberInfo.subscriber_id;
        }
        break;
      case 'LX':
        if (inClaim && currentClaim) {
          currentLine = { line_number: parseInt(elements[1], 10) || 0, procedure_code: '', diagnosis_code: '', charge_amount: 0, service_date: null };
          currentClaim.lines.push(currentLine);
        }
        break;
      case 'SV1':
        if (currentLine && inClaim) {
          const procSub = getSubElements(elements[1]);
          currentLine.procedure_code = procSub.length > 1 ? procSub[1] : '';
          currentLine.charge_amount = parseEDIAmount(elements[2]);
        } else if (inClaim && currentClaim && !currentLine) {
          currentLine = { line_number: 1, procedure_code: '', diagnosis_code: '', charge_amount: 0, service_date: null };
          const procSub = getSubElements(elements[1]);
          currentLine.procedure_code = procSub.length > 1 ? procSub[1] : '';
          currentLine.charge_amount = parseEDIAmount(elements[2]);
          currentClaim.lines.push(currentLine);
        }
        break;
      case 'SE':
        if (currentClaim) {
          currentClaim.patient_first_name = patientInfo.first_name || subscriberInfo.first_name || '';
          currentClaim.patient_last_name = patientInfo.last_name || subscriberInfo.last_name || '';
          currentClaim.subscriber_id = subscriberInfo.subscriber_id || '';
          currentClaim.patient_dob = currentClaim.patient_dob || patientInfo.dob || null;
          currentClaim.patient_gender = currentClaim.patient_gender || patientInfo.gender || '';
        }
        break;
    }
  }

  return { claims, metadata };
}

module.exports = { parse837 };
