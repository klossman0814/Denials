function splitSegments(content) {
  const normalized = content.replace(/\r?\n/g, '~\n');
  return normalized.split('~').map(s => s.replace(/\r?\n/g, '').trim()).filter(s => s.length > 0);
}

function parseSegment(segment) { return segment.split('*'); }

function getSubElements(element) { return element.split(':'); }

function parseEDIDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  if (cleaned.length < 8) return null;
  // Standard EDI date: CCYYMMDD (8 chars)
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }
  // EDI date with time suffix (e.g. CCYYMMDDHHMM) — take only the date portion
  if (cleaned.length >= 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }
  return null;
}

function parseEDIAmount(amountStr) {
  if (!amountStr) return 0;
  const clean = amountStr.replace(/[^0-9.]/g, '');
  return parseFloat(clean) || 0;
}

module.exports = { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount };
