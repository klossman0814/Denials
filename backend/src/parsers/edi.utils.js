function splitSegments(content) {
  const normalized = content.replace(/\r?\n/g, '~\n');
  return normalized.split('~').map(s => s.replace(/\r?\n/g, '').trim()).filter(s => s.length > 0);
}

function parseSegment(segment) { return segment.split('*'); }

function getSubElements(element) {
  // X12 sub-element separator can be : or > depending on the file
  if (!element) return [];
  const colonSplit = element.split(':');
  if (colonSplit.length > 1) return colonSplit;
  return element.split('>');
}

function parseEDIDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  if (cleaned.length < 8) return null;
  // Standard EDI date: CCYYMMDD (8 chars)
  if (cleaned.length === 8) {
    const y = parseInt(cleaned.substring(0, 4), 10);
    const m = parseInt(cleaned.substring(4, 6), 10);
    const d = parseInt(cleaned.substring(6, 8), 10);
    if (!y || y < 1900 || y > 2200 || !m || m < 1 || m > 12 || !d || d < 1 || d > 31) return null;
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }
  // EDI date with time suffix (e.g. CCYYMMDDHHMM) — take only the date portion
  if (cleaned.length >= 8) {
    const y = parseInt(cleaned.substring(0, 4), 10);
    const m = parseInt(cleaned.substring(4, 6), 10);
    const d = parseInt(cleaned.substring(6, 8), 10);
    if (!y || y < 1900 || y > 2200 || !m || m < 1 || m > 12 || !d || d < 1 || d > 31) return null;
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }
  return null;
}

function parseEDIAmount(amountStr) {
  if (!amountStr) return 0;
  const clean = amountStr.replace(/[^0-9.]/g, '');
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

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

module.exports = { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount, REF_QUALIFIER_DESCRIPTIONS, AMT_QUALIFIER_DESCRIPTIONS, getDescription };
