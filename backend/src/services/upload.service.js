const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const config = require('../config/env');
const {
  UploadedFile, Claim, ClaimLine, Remittance, RemittanceFile,
  RemittanceLine, DenialReason,
  ClaimDiagnosis, ClaimReference, ClaimAmount, ClaimCondition,
  ClaimReportType, ClaimFileInfo, ClaimToothInfo,
  RemittanceReference, RemittanceAmount,
  RemittanceInpatient, RemittanceOutpatient, ProviderAdjustment,
} = require('../models');
const { parse837 } = require('../parsers/edi837.parser');
const { parse835 } = require('../parsers/edi835.parser');
const { parseEDIDate } = require('../parsers/edi.utils');
const logger = require('../utils/logger');
const cache = require('../utils/queryCache');

class RetryableError extends Error {
  constructor(message) { super(message); this.retryable = true; }
}

class UploadService {
  async processFile(filePath, fileType, uploadedBy = null) {
    const filename = path.basename(filePath);
    const stats = fs.statSync(filePath);
    const sourceRoot = path.resolve(fileType === '837' ? config.upload.dir837 : config.upload.dir835);
    const fileDir = path.dirname(filePath);
    const relDir = path.relative(sourceRoot, fileDir);
    if (relDir) logger.info(`File in subdirectory: ${path.join(relDir, filename)}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    const existing = await UploadedFile.findOne({
      where: { content_hash: contentHash, status: 'parsed' },
    });
    if (existing) {
      logger.info(`Duplicate file detected: ${filename} matches already-processed file ${existing.filename} (${existing.id})`);
      // Move duplicate to duplicates directory
      try {
        const dupDir = fileType === '837' ? config.upload.duplicatesDir837 : config.upload.duplicatesDir835;
        if (dupDir) {
          const absDupDir = path.resolve(dupDir, relDir);
          fs.mkdirSync(absDupDir, { recursive: true });
          const destPath = path.join(absDupDir, filename);
          fs.copyFileSync(filePath, destPath);
          fs.unlinkSync(filePath);
          this._cleanupEmptyDirs(fileDir, sourceRoot);
          logger.info(`Moved duplicate ${filename} to ${absDupDir}`);
        }
      } catch (moveErr) {
        logger.warn(`Could not move duplicate ${filename}: ${moveErr.message}`);
      }
      return {
        file: existing,
        recordsCreated: 0,
        duplicate: true,
        message: `File already processed as "${existing.filename}" on ${existing.parsed_at?.toISOString()?.split('T')[0] || 'unknown date'}`,
      };
    }

    const supersededFile = await this._findSupersededFile(filePath, fileType, contentHash);

    const fileRecord = await UploadedFile.create({
      filename, file_type: fileType, file_path: filePath,
      file_size: stats.size, content_hash: contentHash,
      status: 'parsing', uploaded_by: uploadedBy,
      supersedes_id: supersededFile?.id || null,
    });

    try {
      let result;
      if (fileType === '837') result = await this._process837(content, fileRecord.id);
      else result = await this._process835(content, fileRecord.id);

      fileRecord.status = 'parsed';
      fileRecord.parsed_at = new Date();
      await fileRecord.save();

      if (supersededFile) {
        await this._markSupersededRecords(fileType, supersededFile.id, fileRecord.id);
        await UploadedFile.update({ status: 'replaced' }, { where: { id: supersededFile.id } });
      }

      try {
        const processedDir = fileType === '837' ? config.upload.processedDir837 : config.upload.processedDir835;
        if (processedDir) {
          const absProcessed = path.resolve(processedDir, relDir);
          fs.mkdirSync(absProcessed, { recursive: true });
          let destFilename = filename;
          if (supersededFile) {
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            destFilename = `${base}.CORRECTED.${Date.now()}${ext}`;
          }
          const destPath = path.join(absProcessed, destFilename);
          fs.copyFileSync(filePath, destPath);
          fs.unlinkSync(filePath);
          this._cleanupEmptyDirs(fileDir, sourceRoot);
          logger.info(`Moved ${filename} to ${absProcessed}${supersededFile ? ' (corrected)' : ''}`);
        }
      } catch (moveErr) {
        logger.warn(`Could not move ${filename} to processed dir: ${moveErr.message}`);
      }

      await cache.invalidate('dashboard:');

      logger.info(`File ${filename} processed: ${result.count} records`);
      return { file: fileRecord, recordsCreated: result.count };
    } catch (error) {
      fileRecord.status = 'error';
      fileRecord.error_message = error.message;
      await fileRecord.save();
      logger.error(`File ${filename} processing failed: ${error.message}`);
      throw error;
    }
  }

  async _process837(content, fileId) {
    const { metadata, claims } = parse837(content);
    let count = 0;

    // Batch: collect all claim records and their lines
    const claimRecords = [];
    const allLines = [];
    const allDiagnoses = [];
    const allRefs = [];
    const allAmts = [];
    const allConditions = [];
    const allReportTypes = [];
    const allFileInfos = [];

    for (const parsedClaim of claims) {
      const { lines, provider_address, provider_contact, diagnosis_codes, refs, amts, condition_codes, report_types, file_info, denial_reasons, ...claimFields } = parsedClaim;

      const flatClaim = {
        ...claimFields,
        file_id: fileId,
        status: 'submitted',
        // Pass BHT date (837 submission date) to each claim
        bht_date: metadata.bht_date ? (parseEDIDate(metadata.bht_date) || metadata.bht_date) : claimFields.bht_date || '',
        // Flatten billing provider address
        provider_address1: provider_address?.address1 || '',
        provider_address2: provider_address?.address2 || '',
        provider_city: provider_address?.city || '',
        provider_state: provider_address?.state || '',
        provider_zip: provider_address?.zip || '',
        // Flatten billing provider contact
        provider_contact_name: provider_contact?.name || '',
        provider_contact_phone: provider_contact?.phone || '',
      };
      claimRecords.push(flatClaim);
      allLines.push(lines || []);

      // Save diagnosis codes
      const diagIdx = allDiagnoses.length;
      if (diagnosis_codes && diagnosis_codes.length > 0) {
        for (let d = 0; d < diagnosis_codes.length; d++) {
          allDiagnoses.push({ ...diagnosis_codes[d], sequence: d + 1 });
        }
      }

      // Save references
      if (refs && refs.length > 0) {
        for (const ref of refs) {
          allRefs.push({ ...ref });
        }
      }

      // Save amounts
      if (amts && amts.length > 0) {
        for (const amt of amts) {
          allAmts.push({ ...amt });
        }
      }

      // Save conditions
      if (condition_codes && condition_codes.length > 0) {
        for (const cond of condition_codes) {
          allConditions.push({ ...cond });
        }
      }

      // Save report types
      if (report_types && report_types.length > 0) {
        for (const rt of report_types) {
          allReportTypes.push({ ...rt });
        }
      }

      // Save file infos
      if (file_info && file_info.length > 0) {
        for (const fi of file_info) {
          allFileInfos.push({ ...fi });
        }
      }
    }

    if (claimRecords.length > 0) {
      const createdClaims = await Claim.bulkCreate(claimRecords, { returning: true });
      count += createdClaims.length;

      // Create lines for each claim
      const lineRecords = [];
      const toothInfoRecords = [];
      for (let i = 0; i < createdClaims.length; i++) {
        for (const line of allLines[i]) {
          const { refs: lineRefs, amts: lineAmts, tooth_info, ...lineFields } = line;
          lineRecords.push({
            ...lineFields,
            claim_id: createdClaims[i].id,
            diagnosis_code_pointers: line.diagnosis_code_pointers
              ? JSON.stringify(line.diagnosis_code_pointers)
              : null,
          });
          // Save tooth info if present
          if (line.tooth_code || line.oral_cavity_code || line.tooth_surface) {
            // tooth info is stored inline on the line itself for simplicity
          }
        }

        // Link child records to this claim
        const diagCount = (allLines[i] || []).length > 0 ? 1 : 0;
        // Use a claim index offset to figure out which diagnoses belong to which claim
      }

      if (lineRecords.length > 0) {
        const createdLines = await ClaimLine.bulkCreate(lineRecords, { returning: true });
        count += lineRecords.length;

        // Save tooth info for lines that have it
        const toothRecords = [];
        for (let i = 0; i < createdLines.length; i++) {
          const line = allLines.flat()[i];
          if (line && (line.tooth_code || line.oral_cavity_code || line.tooth_surface)) {
            toothRecords.push({
              claim_line_id: createdLines[i].id,
              oral_cavity_code: line.oral_cavity_code || '',
              tooth_code: line.tooth_code || '',
              tooth_surface: line.tooth_surface || '',
            });
          }
        }
        if (toothRecords.length > 0) {
          await ClaimToothInfo.bulkCreate(toothRecords);
          count += toothRecords.length;
        }
      }

      // Save all child records with claim FK
      // Map child data to claim indices
      let claimDiagOffset = 0;
      let claimRefOffset = 0;
      let claimAmtOffset = 0;
      let claimCondOffset = 0;
      let claimRtOffset = 0;
      let claimFiOffset = 0;

      const diagRecords = [];
      const refRecords = [];
      const amtRecords = [];
      const condRecords = [];
      const rtRecords = [];
      const fiRecords = [];

      for (let i = 0; i < createdClaims.length; i++) {
        const claimId = createdClaims[i].id;
        // Count how many child records belong to this claim by matching on the original claim
        const parsedClaim = claims[i];

        if (parsedClaim.diagnosis_codes) {
          for (let d = 0; d < parsedClaim.diagnosis_codes.length; d++) {
            diagRecords.push({ ...parsedClaim.diagnosis_codes[d], claim_id: claimId, sequence: d + 1 });
          }
        }
        if (parsedClaim.refs) {
          for (const ref of parsedClaim.refs) {
            refRecords.push({ ...ref, claim_id: claimId });
          }
        }
        if (parsedClaim.amts) {
          for (const amt of parsedClaim.amts) {
            amtRecords.push({ ...amt, claim_id: claimId });
          }
        }
        if (parsedClaim.condition_codes) {
          for (const cond of parsedClaim.condition_codes) {
            condRecords.push({ ...cond, claim_id: claimId });
          }
        }
        if (parsedClaim.report_types) {
          for (const rt of parsedClaim.report_types) {
            rtRecords.push({ ...rt, claim_id: claimId });
          }
        }
        if (parsedClaim.file_info) {
          for (const fi of parsedClaim.file_info) {
            fiRecords.push({ ...fi, claim_id: claimId });
          }
        }
      }

      if (diagRecords.length > 0) { await ClaimDiagnosis.bulkCreate(diagRecords); count += diagRecords.length; }
      if (refRecords.length > 0) { await ClaimReference.bulkCreate(refRecords); count += refRecords.length; }
      if (amtRecords.length > 0) { await ClaimAmount.bulkCreate(amtRecords); count += amtRecords.length; }
      if (condRecords.length > 0) { await ClaimCondition.bulkCreate(condRecords); count += condRecords.length; }
      if (rtRecords.length > 0) { await ClaimReportType.bulkCreate(rtRecords); count += rtRecords.length; }
      if (fiRecords.length > 0) { await ClaimFileInfo.bulkCreate(fiRecords); count += fiRecords.length; }
    }

    return { count };
  }

  async _process835(content, fileId) {
    const { metadata, file: fileMeta, remittances, provider_adjustments } = parse835(content);
    let count = 0;

    // Flatten nested payer/payee objects and include envelope metadata
    const flatFile = {
      total_payment: fileMeta.total_payment,
      payment_method: fileMeta.payment_method,
      payment_date: fileMeta.payment_date,
      trace_number: fileMeta.trace_number,
      sender_bank_id: fileMeta.sender_bank_id,
      sender_account: fileMeta.sender_account,
      payer_name: fileMeta.payer_name,
      payer_id_code: fileMeta.payer_id_code,
      payee_name: fileMeta.payee_name,
      payee_id_code: fileMeta.payee_id_code,
      payee_tax_id: fileMeta.payee_tax_id,
      credit_debit_flag: fileMeta.credit_debit_flag || '',
      // Flatten payer address/contact
      payer_address1: fileMeta.payer?.address?.address1 || '',
      payer_address2: fileMeta.payer?.address?.address2 || '',
      payer_city: fileMeta.payer?.address?.city || '',
      payer_state: fileMeta.payer?.address?.state || '',
      payer_zip: fileMeta.payer?.address?.zip || '',
      payer_contact_name: fileMeta.payer?.contact?.name || '',
      payer_contact_phone: fileMeta.payer?.contact?.phone || '',
      payer_contact_email: fileMeta.payer?.contact?.email || '',
      // Flatten payee address/contact
      payee_address1: fileMeta.payee?.address?.address1 || '',
      payee_address2: fileMeta.payee?.address?.address2 || '',
      payee_city: fileMeta.payee?.address?.city || '',
      payee_state: fileMeta.payee?.address?.state || '',
      payee_zip: fileMeta.payee?.address?.zip || '',
      payee_contact_name: fileMeta.payee?.contact?.name || '',
      payee_contact_phone: fileMeta.payee?.contact?.phone || '',
      payee_contact_email: fileMeta.payee?.contact?.email || '',
      // Envelope metadata
      sender_id: metadata.sender_id || '',
      receiver_id: metadata.receiver_id || '',
      isa_date: metadata.date || '',
      isa_time: metadata.time || '',
      isa_control_number: metadata.control_number || '',
      isa_standards_id: metadata.standards_id || '',
      gs_sender: metadata.gs_sender || '',
      gs_receiver: metadata.gs_receiver || '',
      gs_date: metadata.gs_date || '',
      gs_time: metadata.gs_time || '',
      gs_control_number: metadata.gs_control_number || '',
      gs_version: metadata.gs_version || '',
      st_transaction_id: metadata.st_transaction_id || '',
      st_control_number: metadata.st_control_number || '',
      file_id: fileId,
    };

    const remittanceFile = await RemittanceFile.create(flatFile);
    count++;

    // Collect batch data
    const remittanceRecords = [];
    const claimLevelDenials = [];
    const lineDenialBatches = [];

    for (const remittance of remittances) {
      const {
        denial_reasons, service_lines,
        refs, amts,
        inpatient_info, outpatient_info,
        patient, subscriber, rendering_provider, billing_provider, service_dates,
        ...remitFields
      } = remittance;

      const match = await this._matchClaim(remitFields.patient_name, remitFields.payer_claim_id);

      const remitData = {
        ...remitFields,
        file_id: fileId,
        claim_id: match?.id || null,
        remittance_file_id: remittanceFile.id,
      };
      remittanceRecords.push(remitData);
      const currentIdx = remittanceRecords.length - 1;

      // Store denial reasons
      for (const dr of (denial_reasons || [])) {
        claimLevelDenials.push({ dr, remitIdx: currentIdx, claimId: match?.id || null });
      }

      // Store service lines
      for (const line of (service_lines || [])) {
        const { denial_reasons: lineDenials, quantity_adjustments, ...lineFields } = line;
        lineDenialBatches.push({
          lineData: lineFields,
          denials: lineDenials || [],
          remitIdx: currentIdx,
          claimId: match?.id || null,
        });
      }

      // Update matched claim status and set resolved_at / days_to_resolve
      if (match) {
        const newStatus = remitFields.status === 'paid' ? 'paid' : remitFields.status === 'partial' ? 'partial' : 'denied';
        const updateFields = { status: newStatus };
        // Only set resolved_at once — don't overwrite if already set
        if (!match.resolved_at && newStatus !== 'submitted') {
          updateFields.resolved_at = new Date();
        }
        // Calculate days_to_resolve from 835 adjudication date - 837 submission date
        if (match.days_to_resolve == null) {
          const adjDate = remitFields.remittance_date || remittanceFile.payment_date;
          const subDate = match.bht_date || match.service_date_end || match.service_date_start || (match.created_at ? match.created_at.toISOString().split('T')[0] : null);
          if (adjDate && subDate) {
            const diffMs = new Date(adjDate).getTime() - new Date(subDate).getTime();
            updateFields.days_to_resolve = Math.round(diffMs / (1000 * 60 * 60 * 24));
          }
        }
        await match.update(updateFields);
      }
    }

    // Bulk insert all remittances
    if (remittanceRecords.length > 0) {
      const createdRemits = await Remittance.bulkCreate(remittanceRecords, { returning: true });
      count += createdRemits.length;

      // Claim-level denial reasons
      const drRecords = [];
      for (const item of claimLevelDenials) {
        drRecords.push({
          ...item.dr,
          remittance_id: createdRemits[item.remitIdx].id,
          claim_id: item.claimId,
        });
      }
      if (drRecords.length > 0) {
        await DenialReason.bulkCreate(drRecords);
        count += drRecords.length;
      }

      // Save remittance-level child records
      const refRecords = [];
      const amtRecords = [];
      const inpatientRecords = [];
      const outpatientRecords = [];

      for (let i = 0; i < createdRemits.length; i++) {
        const remitId = createdRemits[i].id;
        const parsedRemit = remittances[i];

        if (parsedRemit.refs) {
          for (const ref of parsedRemit.refs) {
            refRecords.push({ ...ref, remittance_id: remitId });
          }
        }
        if (parsedRemit.amts) {
          for (const amt of parsedRemit.amts) {
            amtRecords.push({ ...amt, remittance_id: remitId });
          }
        }
        if (parsedRemit.inpatient_info) {
          inpatientRecords.push({ ...parsedRemit.inpatient_info, remittance_id: remitId });
        }
        if (parsedRemit.outpatient_info) {
          outpatientRecords.push({
            ...parsedRemit.outpatient_info,
            remittance_id: remitId,
            remark_codes: (parsedRemit.outpatient_info.remark_codes || []).join(','),
          });
        }
      }

      if (refRecords.length > 0) { await RemittanceReference.bulkCreate(refRecords); count += refRecords.length; }
      if (amtRecords.length > 0) { await RemittanceAmount.bulkCreate(amtRecords); count += amtRecords.length; }
      if (inpatientRecords.length > 0) { await RemittanceInpatient.bulkCreate(inpatientRecords); count += inpatientRecords.length; }
      if (outpatientRecords.length > 0) { await RemittanceOutpatient.bulkCreate(outpatientRecords); count += outpatientRecords.length; }

      // Service lines (individual create for returned ID)
      const lineDenialRecords = [];
      for (const item of lineDenialBatches) {
        const lineRecord = await RemittanceLine.create({
          ...item.lineData,
          remittance_id: createdRemits[item.remitIdx].id,
        });
        count++;
        for (const dr of item.denials) {
          lineDenialRecords.push({
            ...dr,
            remittance_id: createdRemits[item.remitIdx].id,
            remittance_line_id: lineRecord.id,
            claim_id: item.claimId,
          });
        }
      }
      if (lineDenialRecords.length > 0) {
        await DenialReason.bulkCreate(lineDenialRecords);
        count += lineDenialRecords.length;
      }
    }

    // Save provider-level adjustments (PLB segment)
    if (provider_adjustments && provider_adjustments.length > 0) {
      const paRecords = provider_adjustments.map(pa => ({
        ...pa,
        remittance_file_id: remittanceFile.id,
      }));
      await ProviderAdjustment.bulkCreate(paRecords);
      count += paRecords.length;
    }

    return { count };
  }

  async _findSupersededFile(filePath, fileType, contentHash) {
    const filename = path.basename(filePath);
    const baseFilename = filename.replace(/^\d+-/, '');
    return await UploadedFile.findOne({
      where: {
        filename: baseFilename,
        file_type: fileType,
        status: 'parsed',
        content_hash: { [Op.ne]: contentHash },
      },
      order: [['uploaded_at', 'DESC']],
    });
  }

  _cleanupEmptyDirs(dir, stopAtRoot) {
    try {
      let current = dir;
      while (current !== stopAtRoot && !path.relative(stopAtRoot, current).startsWith('..')) {
        try {
          const entries = fs.readdirSync(current);
          if (entries.length === 0) {
            fs.rmdirSync(current);
            logger.debug(`Removed empty directory: ${current}`);
            current = path.dirname(current);
          } else {
            break;
          }
        } catch {
          break;
        }
      }
    } catch (err) {
      logger.warn(`Directory cleanup error: ${err.message}`);
    }
  }

  async _markSupersededRecords(fileType, supersededFileId, newFileId) {
    if (fileType === '837') {
      const newClaims = await Claim.findAll({ where: { file_id: newFileId } });
      const claimIds = newClaims.map(c => c.claim_id).filter(Boolean);
      if (claimIds.length === 0) return;
      const oldClaims = await Claim.findAll({
        where: { file_id: supersededFileId, claim_id: { [Op.in]: claimIds } },
      });
      for (const oldClaim of oldClaims) {
        const matchingNew = newClaims.find(c => c.claim_id === oldClaim.claim_id);
        if (matchingNew) {
          oldClaim.superseded_by_id = matchingNew.id;
          oldClaim.status = 'replaced';
          await oldClaim.save();
        }
      }
    } else if (fileType === '835') {
      const newRemits = await Remittance.findAll({ where: { file_id: newFileId } });
      const payerClaimIds = newRemits.map(r => r.payer_claim_id).filter(Boolean);
      if (payerClaimIds.length === 0) return;
      const oldRemits = await Remittance.findAll({
        where: { file_id: supersededFileId, payer_claim_id: { [Op.in]: payerClaimIds } },
      });
      for (const oldRemit of oldRemits) {
        const matchingNew = newRemits.find(r => r.payer_claim_id === oldRemit.payer_claim_id);
        if (matchingNew) {
          oldRemit.superseded_by_id = matchingNew.id;
          oldRemit.status = 'replaced';
          await oldRemit.save();
        }
      }
    }
  }

  async _rematchUnlinkedRemittances() {
    const unlinked = await Remittance.findAll({
      where: { claim_id: null },
      include: [{ model: UploadedFile, where: { file_type: '835' }, attributes: [] }],
    });
    let matched = 0;
    for (const remit of unlinked) {
      const claim = await this._matchClaim(remit.patient_name, remit.payer_claim_id);
      if (claim) {
        remit.claim_id = claim.id;
        await remit.save();
        matched++;
      }
    }
    if (matched > 0) {
      logger.info(`Rematch job: linked ${matched}/${unlinked.length} previously unlinked remittances`);
    }
    return matched;
  }

  async _matchClaim(patientName, claimId) {
    if (!patientName && !claimId) return null;
    const conditions = [];
    if (claimId) conditions.push({ claim_id: claimId });
    if (patientName) {
      const parts = patientName.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        conditions.push({ patient_first_name: parts[0], patient_last_name: parts.slice(1).join(' ') });
      }
    }
    if (conditions.length === 0) return null;
    return await Claim.findOne({ where: { [Op.or]: conditions } });
  }
}

module.exports = new UploadService();
