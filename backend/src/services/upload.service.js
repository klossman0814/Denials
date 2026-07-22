const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const config = require('../config/env');
const { UploadedFile, Claim, ClaimLine, Remittance, RemittanceFile, RemittanceLine, DenialReason } = require('../models');
const { parse837 } = require('../parsers/edi837.parser');
const { parse835 } = require('../parsers/edi835.parser');
const logger = require('../utils/logger');

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
    for (const { lines, ...claimFields } of claims) {
      const claim = await Claim.create({ ...claimFields, file_id: fileId, status: 'submitted' });
      count++;
      for (const line of lines) {
        await ClaimLine.create({ ...line, claim_id: claim.id });
        count++;
      }
    }
    return { count };
  }

  async _process835(content, fileId) {
    const { file: fileMeta, remittances } = parse835(content);
    let count = 0;

    const remittanceFile = await RemittanceFile.create({ ...fileMeta, file_id: fileId });
    count++;

    for (const remittance of remittances) {
      const { denial_reasons, service_lines, ...remitFields } = remittance;
      const match = await this._matchClaim(remitFields.patient_name, remitFields.payer_claim_id);

      const remitRecord = await Remittance.create({
        ...remitFields,
        file_id: fileId,
        claim_id: match?.id || null,
        remittance_file_id: remittanceFile.id,
      });
      count++;

      if (match) {
        const newStatus = remitFields.status === 'paid' ? 'paid' : remitFields.status === 'partial' ? 'partial' : 'denied';
        await match.update({ status: newStatus });
      }

      for (const dr of denial_reasons) {
        await DenialReason.create({ ...dr, remittance_id: remitRecord.id, claim_id: match?.id || null });
        count++;
      }

      for (const line of service_lines) {
        const { denial_reasons: lineDenials, ...lineFields } = line;
        const lineRecord = await RemittanceLine.create({
          ...lineFields,
          remittance_id: remitRecord.id,
        });
        count++;

        for (const dr of lineDenials) {
          await DenialReason.create({
            ...dr,
            remittance_id: remitRecord.id,
            remittance_line_id: lineRecord.id,
            claim_id: match?.id || null,
          });
          count++;
        }
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
