const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { sequelize } = require('../models');
const logger = require('../utils/logger');

const router = Router();

// 56 columns in the exact requested order
const COLUMNS = [
  'Denial ID', 'EOB Line', 'Transaction ID', 'Unique Patient Identifier', 'MRN',
  'Invoice Number', 'Claims Sequence', 'Patient Accounting System', 'Type of Bill',
  'Authorization Number', 'Discharge Date', '835/Remittance Post Date',
  'Provider NPI', 'Provider Name', 'Department ID', 'Department Name',
  'Facility ID', 'Facility Name', 'Region ID', 'Region',
  'Remitting Invoice Payer ID', 'Remitting Invoice Payer Name',
  'Remitting Invoice Plan ID', 'Remitting Invoice Plan Name',
  'Remitting Invoice Financial Class ID', 'Remitting Invoice Financial Class Name',
  'Primary Payer ID', 'Primary Payer Name', 'Primary Plan ID', 'Primary Plan Name',
  'Primary Financial Class ID', 'Primary Financial Class Name',
  'Revenue Code', 'Date of Service', 'Service Code', 'Modifier', 'Billed Quantity',
  'Account Class', 'Base Class', 'Principal Diagnosis Code', 'Principal Diagnosis Code Name',
  'Diagnosis Code List', 'Denial Order Type', 'Denial Class', 'Denial Category',
  'Claim Adjustment Group Code', 'Claim Adjustment Reason Code (CARC)',
  'Remittance Advice Remark Code (RARC)', 'Denied Payer Type', 'Root Cause',
  'Denial Status', 'Resolution', 'Service Charges', 'Service Denied Charges',
  'Service Allowed Amount', 'Service Payments',
];

const EXTRACT_SELECT = `
  dr.id::text AS "Denial ID",
  rl.line_number AS "EOB Line",
  rf.trace_number AS "Transaction ID",
  c.patient_member_id AS "Unique Patient Identifier",
  (SELECT cr.value FROM claim_references cr WHERE cr.claim_id = c.id AND cr.qualifier = 'EA' LIMIT 1) AS "MRN",
  (SELECT cr.value FROM claim_references cr WHERE cr.claim_id = c.id AND cr.qualifier IN ('D9','F8') LIMIT 1) AS "Invoice Number",
  cl.line_number AS "Claims Sequence",
  NULL AS "Patient Accounting System",
  NULL AS "Type of Bill",
  (SELECT cr.value FROM claim_references cr WHERE cr.claim_id = c.id AND cr.qualifier IN ('G1','9F') LIMIT 1) AS "Authorization Number",
  c.discharge_date AS "Discharge Date",
  COALESCE(r.remittance_date::text, rf.payment_date::text) AS "835/Remittance Post Date",
  c.rendering_provider_npi AS "Provider NPI",
  c.rendering_provider_name AS "Provider Name",
  NULL AS "Department ID",
  NULL AS "Department Name",
  c.service_facility_npi AS "Facility ID",
  c.service_facility_name AS "Facility Name",
  NULL AS "Region ID",
  NULL AS "Region",
  rf.payer_id_code AS "Remitting Invoice Payer ID",
  rf.payer_name AS "Remitting Invoice Payer Name",
  c.payer_id AS "Remitting Invoice Plan ID",
  NULL AS "Remitting Invoice Plan Name",
  NULL AS "Remitting Invoice Financial Class ID",
  NULL AS "Remitting Invoice Financial Class Name",
  c.payer_id AS "Primary Payer ID",
  c.payer_name AS "Primary Payer Name",
  NULL AS "Primary Plan ID",
  NULL AS "Primary Plan Name",
  NULL AS "Primary Financial Class ID",
  NULL AS "Primary Financial Class Name",
  rl.procedure_code AS "Revenue Code",
  rl.service_date AS "Date of Service",
  rl.procedure_code AS "Service Code",
  rl.modifier AS "Modifier",
  rl.unit_count AS "Billed Quantity",
  NULL AS "Account Class",
  NULL AS "Base Class",
  (SELECT d.code FROM claim_diagnoses d WHERE d.claim_id = c.id AND d.diagnosis_type = 'principal' LIMIT 1) AS "Principal Diagnosis Code",
  NULL AS "Principal Diagnosis Code Name",
  (SELECT STRING_AGG(d.code, ', ' ORDER BY d.sequence) FROM claim_diagnoses d WHERE d.claim_id = c.id) AS "Diagnosis Code List",
  NULL AS "Denial Order Type",
  dr.group_code AS "Denial Class",
  NULL AS "Denial Category",
  dr.group_code AS "Claim Adjustment Group Code",
  split_part(dr.denial_code, '-', 2) AS "Claim Adjustment Reason Code (CARC)",
  (SELECT ro.remark_codes FROM remittance_outpatients ro WHERE ro.remittance_id = r.id LIMIT 1) AS "Remittance Advice Remark Code (RARC)",
  NULL AS "Denied Payer Type",
  NULL AS "Root Cause",
  c.status AS "Denial Status",
  NULL AS "Resolution",
  rl.charge_amount AS "Service Charges",
  dr.amount AS "Service Denied Charges",
  COALESCE(rl.paid_amount, 0) + COALESCE(dr.amount, 0) AS "Service Allowed Amount",
  rl.paid_amount AS "Service Payments",
  dr.created_at AS __created_at,
  dr.id::text AS __id
`;

const EXTRACT_FROM = `
FROM denial_reasons dr
LEFT JOIN remittance_lines rl ON rl.id = dr.remittance_line_id
LEFT JOIN remittances r ON r.id = dr.remittance_id
LEFT JOIN remittance_files rf ON rf.id = r.remittance_file_id
LEFT JOIN claims c ON c.id = dr.claim_id
LEFT JOIN claim_lines cl ON cl.id = dr.claim_line_id
`;

const CHUNK_SIZE = 25000;

// CSV injection defense: neutralize formula-leading characters (=, +, -, @)
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@]/.test(str)) str = "'" + str;
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

router.get('/count', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await sequelize.query('SELECT COUNT(*) AS cnt FROM denial_reasons', { type: sequelize.QueryTypes.SELECT, plain: true });
    res.json({ count: parseInt(result.cnt, 10) });
  } catch (error) { next(error); }
});

router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  const client = await sequelize.connectionManager.getConnection();
  try {
    const totalResult = await client.query('SELECT COUNT(*) AS cnt FROM denial_reasons');
    const total = parseInt(totalResult.rows[0].cnt, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="denial-extract-${new Date().toISOString().split('T')[0]}.csv"`);

    // UTF-8 BOM (Excel) + header row
    res.write('\uFEFF');
    res.write(COLUMNS.map(escapeCSV).join(',') + '\r\n');

    let rowsWritten = 0;
    let cursorCreated = null;
    let cursorId = null;

    for (;;) {
      let where = '';
      const params = [];
      if (cursorCreated !== null) {
        params.push(cursorCreated, cursorId);
        where = 'WHERE (dr.created_at < $1 OR (dr.created_at = $1 AND dr.id::text < $2))';
      }
      const sql = `SELECT ${EXTRACT_SELECT} ${EXTRACT_FROM} ${where} ORDER BY dr.created_at DESC, dr.id::text DESC LIMIT ${CHUNK_SIZE}`;
      const result = await client.query(sql, params);
      const rows = result.rows;
      if (rows.length === 0) break;

      for (const row of rows) {
        const csvRow = COLUMNS.map(col => escapeCSV(row[col])).join(',');
        res.write(csvRow + '\r\n');
      }
      rowsWritten += rows.length;

      const last = rows[rows.length - 1];
      cursorCreated = last.__created_at;
      cursorId = last.__id;
      if (rows.length < CHUNK_SIZE) break;
    }

    res.end();
    logger.info(`Denial extract downloaded by ${req.user?.username || 'unknown'}: ${rowsWritten}/${total} rows`);
  } catch (error) {
    if (!res.headersSent) next(error);
    else { res.destroy(); logger.error(`Denial extract failed: ${error.message}`); }
  } finally {
    sequelize.connectionManager.releaseConnection(client);
  }
});

module.exports = router;
