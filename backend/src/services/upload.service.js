const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const config = require('../config/env');
const { UploadedFile, Claim, ClaimLine, Remittance, RemittanceFile, RemittanceLine, DenialReason } = require('../models');
const { parse837 } = require('../parsers/edi837.parser');
const { parse835 } = require('../parsers/edi835.parser');
const logger = require('../utils/logger');
const cache = require('../utils/queryCache');

class UploadService {
  async processFile(filePath, fileType, uploadedBy = null) {
    const filename = path.basename(filePath);
    const stats = fs.statSync(filePath);

    const content = fs.readFileSync(filePath, 'utf8');
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    const existing = await UploadedFile.findOne({
      where: { content_hash: contentHash, status: 'parsed' },
    });
    if (existing) {
      logger.info(`Duplicate file detected: ${filename} matches already-processed file ${existing.filename} (${existing.id})`);
      return {
        file: existing,
        recordsCreated: 0,
        duplicate: true,
        message: `File already processed as "${existing.filename}" on ${existing.parsed_at?.toISOString()?.split('T')[0] || 'unknown date'}`,
      };
    }

    const fileRecord = await UploadedFile.create({
      filename, file_type: fileType, file_path: filePath,
      file_size: stats.size, content_hash: contentHash,
      status: 'parsing', uploaded_by: uploadedBy,
    });

    try {
      let result;
      if (fileType === '837') result = await this._process837(content, fileRecord.id);
      else result = await this._process835(content, fileRecord.id);

      fileRecord.status = 'parsed';
      fileRecord.parsed_at = new Date();
      await fileRecord.save();

      try {
        const processedDir = fileType === '837' ? config.upload.processedDir837 : config.upload.processedDir835;
        if (processedDir) {
          const absProcessed = path.resolve(processedDir);
          fs.mkdirSync(absProcessed, { recursive: true });
          const destPath = path.join(absProcessed, filename);
          fs.copyFileSync(filePath, destPath);
          fs.unlinkSync(filePath);
          logger.info(`Moved ${filename} to ${absProcessed}`);
        }
      } catch (moveErr) {
        logger.warn(`Could not move ${filename} to processed dir: ${moveErr.message}`);
      }

      cache.invalidate('dashboard:');

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
    const { claims } = parse837(content);
    let count = 0;

    // Batch: collect all claim records and their lines
    const claimRecords = [];
    const allLines = [];
    for (const { lines, ...claimFields } of claims) {
      claimRecords.push({ ...claimFields, file_id: fileId, status: 'submitted' });
      allLines.push(lines || []);
    }

    if (claimRecords.length > 0) {
      const createdClaims = await Claim.bulkCreate(claimRecords, { returning: true });
      count += createdClaims.length;

      // Create lines for each claim
      const lineRecords = [];
      for (let i = 0; i < createdClaims.length; i++) {
        for (const line of allLines[i]) {
          lineRecords.push({ ...line, claim_id: createdClaims[i].id });
        }
      }
      if (lineRecords.length > 0) {
        await ClaimLine.bulkCreate(lineRecords);
        count += lineRecords.length;
      }
    }

    return { count };
  }

  async _process835(content, fileId) {
    const { file: fileMeta, remittances } = parse835(content);
    let count = 0;

    const remittanceFile = await RemittanceFile.create({ ...fileMeta, file_id: fileId });
    count++;

    // Collect batch data
    const remittanceRecords = [];
    const claimLevelDenials = [];  // { dr, remitIdx, claimId }
    const lineDenialBatches = [];  // { denials: [], remitIdx }

    for (const remittance of remittances) {
      const { denial_reasons, service_lines, ...remitFields } = remittance;
      const match = await this._matchClaim(remitFields.patient_name, remitFields.payer_claim_id);

      const remitData = {
        ...remitFields,
        file_id: fileId,
        claim_id: match?.id || null,
        remittance_file_id: remittanceFile.id,
      };
      remittanceRecords.push(remitData);
      const currentIdx = remittanceRecords.length - 1;

      for (const dr of (denial_reasons || [])) {
        claimLevelDenials.push({ dr, remitIdx: currentIdx, claimId: match?.id || null });
      }

      for (const line of (service_lines || [])) {
        const { denial_reasons: lineDenials, ...lineFields } = line;
        lineDenialBatches.push({
          lineData: lineFields,
          denials: lineDenials || [],
          remitIdx: currentIdx,
          claimId: match?.id || null,
        });
      }

      if (match) {
        const newStatus = remitFields.status === 'paid' ? 'paid' : remitFields.status === 'partial' ? 'partial' : 'denied';
        await match.update({ status: newStatus });
      }
    }

    // Bulk insert all remittances
    if (remittanceRecords.length > 0) {
      const createdRemits = await Remittance.bulkCreate(remittanceRecords, { returning: true });
      count += createdRemits.length;

      // Bulk insert claim-level denial reasons
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

      // Service lines still use individual create (need returned ID for FK),
      // but line-level denial reasons are batched
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

    return { count };
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
