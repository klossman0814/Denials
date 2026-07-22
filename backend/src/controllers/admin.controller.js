const fs = require('fs');
const path = require('path');
const os = require('os');
const { Op } = require('sequelize');
const { Claim, ClaimLine, Remittance, DenialReason, UploadedFile, Setting, sequelize } = require('../models');
const { restartWatcher } = require('../watcher/fileWatcher');
const logger = require('../utils/logger');

function syncEnvFile(settings) {
  const envPath = path.resolve(__dirname, '../../.env');
  try {
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }

    const keyMapping = {
      upload_dir_837: 'UPLOAD_DIR_837',
      upload_dir_835: 'UPLOAD_DIR_835',
    };

    for (const [settingKey, envKey] of Object.entries(keyMapping)) {
      if (settings[settingKey] === undefined) continue;
      const regex = new RegExp(`^${envKey}=.*`, 'm');
      const line = `${envKey}=${settings[settingKey]}`;
      if (regex.test(content)) {
        content = content.replace(regex, line);
      } else {
        content += (content.endsWith(os.EOL) ? '' : os.EOL) + line + os.EOL;
      }
    }

    fs.writeFileSync(envPath, content, 'utf8');
    logger.info('.env file synced with updated settings');
  } catch (err) {
    logger.warn(`Could not sync .env file: ${err.message}`);
  }
}

/**
 * Delete all 837 data: claims, claim lines, denial reasons
 * from 837 files, plus any remittances linked to those claims,
 * plus the 837 uploaded file records.
 */
exports.delete837Data = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const files837 = await UploadedFile.findAll({
      where: { file_type: '837' },
      attributes: ['id'],
      transaction: t,
    });
    const fileIds = files837.map(f => f.id);

    if (fileIds.length === 0) {
      await t.rollback();
      return res.json({ message: 'No 837 data to delete.', deleted: { claims: 0 } });
    }

    const claims = await Claim.findAll({
      where: { file_id: { [Op.in]: fileIds } },
      attributes: ['id'],
      transaction: t,
    });
    const claimIds = claims.map(c => c.id);

    // Delete denial reasons for those claims
    await DenialReason.destroy({
      where: { claim_id: { [Op.in]: claimIds } },
      transaction: t,
    });

    // Delete claim lines for those claims
    await ClaimLine.destroy({
      where: { claim_id: { [Op.in]: claimIds } },
      transaction: t,
    });

    // Delete remittances linked to those claims (and their denial reasons)
    const remittances = await Remittance.findAll({
      where: { claim_id: { [Op.in]: claimIds } },
      attributes: ['id'],
      transaction: t,
    });
    const remittanceIds = remittances.map(r => r.id);
    if (remittanceIds.length > 0) {
      await DenialReason.destroy({
        where: { remittance_id: { [Op.in]: remittanceIds } },
        transaction: t,
      });
      await Remittance.destroy({
        where: { id: { [Op.in]: remittanceIds } },
        transaction: t,
      });
    }

    // Delete the claims
    const deletedClaims = (await Claim.destroy({
      where: { id: { [Op.in]: claimIds } },
      transaction: t,
    }));

    // Delete the 837 uploaded file records
    await UploadedFile.destroy({
      where: { id: { [Op.in]: fileIds } },
      transaction: t,
    });

    await t.commit();
    res.json({ message: 'All 837 data deleted successfully.', deleted: { claims: deletedClaims } });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Delete all 835 data: remittances, their denial reasons,
 * plus the 835 uploaded file records.
 */
exports.delete835Data = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const files835 = await UploadedFile.findAll({
      where: { file_type: '835' },
      attributes: ['id'],
      transaction: t,
    });
    const fileIds = files835.map(f => f.id);

    if (fileIds.length === 0) {
      await t.rollback();
      return res.json({ message: 'No 835 data to delete.', deleted: { remittances: 0 } });
    }

    const remittances = await Remittance.findAll({
      where: { file_id: { [Op.in]: fileIds } },
      attributes: ['id'],
      transaction: t,
    });
    const remittanceIds = remittances.map(r => r.id);

    // Delete denial reasons for those remittances
    await DenialReason.destroy({
      where: { remittance_id: { [Op.in]: remittanceIds } },
      transaction: t,
    });

    // Delete the remittances
    const deletedRemittances = await Remittance.destroy({
      where: { id: { [Op.in]: remittanceIds } },
      transaction: t,
    });

    // Delete the 835 uploaded file records
    await UploadedFile.destroy({
      where: { id: { [Op.in]: fileIds } },
      transaction: t,
    });

    await t.commit();
    res.json({ message: 'All 835 data deleted successfully.', deleted: { remittances: deletedRemittances } });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Clear all uploaded file records (data stays intact).
 */
exports.clearUploadedFiles = async (req, res, next) => {
  try {
    const deleted = await UploadedFile.destroy({ where: {} });
    res.json({ message: 'All uploaded file records cleared.', deleted: { files: deleted } });
  } catch (error) {
    next(error);
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await Setting.findAll();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json({ settings: result });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const { upload_dir_837, upload_dir_835 } = req.body;

    if (!upload_dir_837 && !upload_dir_835) {
      return res.status(400).json({ error: 'Provide at least upload_dir_837 or upload_dir_835' });
    }

    const entries = {};
    if (upload_dir_837) entries['upload_dir_837'] = upload_dir_837;
    if (upload_dir_835) entries['upload_dir_835'] = upload_dir_835;

    // Reject Windows-style paths (C:\...) — they don't work inside Docker
    const isWindowsPath = (p) => /^[A-Za-z]:\\/.test(p);
    for (const [key, dirPath] of Object.entries(entries)) {
      if (isWindowsPath(dirPath)) {
        return res.status(400).json({
          error: `Windows absolute paths (like "${dirPath}") are not supported. Use the Docker mount path instead (e.g., /incoming/837).`
        });
      }
    }

    const warnings = [];

    for (const [key, dirPath] of Object.entries(entries)) {
      try {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          warnings.push(`Directory did not exist for ${key}, created it.`);
        }
      } catch (err) {
        return res.status(400).json({
          error: `Cannot access directory for ${key}: ${dirPath} — ${err.message}`
        });
      }
    }

    // Upsert settings in DB
    for (const [key, value] of Object.entries(entries)) {
      await Setting.upsert({ key, value });
    }

    // Sync to .env
    syncEnvFile(entries);

    // Restart watcher with merged paths (old + new)
    const allSettings = await Setting.findAll();
    const current = {};
    allSettings.forEach(s => { current[s.key] = s.value; });
    const config = require('../config/env');
    const dir837 = current.upload_dir_837 || config.upload.dir837;
    const dir835 = current.upload_dir_835 || config.upload.dir835;
    restartWatcher(dir837, dir835);

    // Return updated settings
    const result = {};
    allSettings.forEach(s => { result[s.key] = s.value; });
    res.json({
      settings: result,
      ...(warnings.length > 0 && { warning: warnings.join(' ') }),
    });
  } catch (error) {
    next(error);
  }
};
