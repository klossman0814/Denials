const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { UploadedFile, ClaimLine, RemittanceLine } = require('../models');

const EXTRACT_ROOT = process.env.EXTRACT_DIR || '/app/backend/extracts';

// Source dirs inside the container where processed raw files live
const PROCESSED_DIRS = {
  837: process.env.PROCESSED_DIR_837 || '/incoming/837_processed',
  835: process.env.PROCESSED_DIR_835 || '/incoming/835_processed',
};

// In-memory job store (admin export tool; jobs are lost on restart, acceptable)
const jobs = new Map();

const sanitizeDir = (name) => {
  if (typeof name !== 'string' || !name.trim()) {
    throw Object.assign(new Error('A directory name is required'), { status: 400 });
  }
  const clean = name.trim().replace(/[^A-Za-z0-9._\- ]/g, '').replace(/\.\./g, '').slice(0, 120);
  if (!clean) throw Object.assign(new Error('Directory name contains invalid characters'), { status: 400 });
  return clean;
};

const parseCodes = (codes) => {
  if (!Array.isArray(codes)) throw Object.assign(new Error('codes must be an array'), { status: 400 });
  const list = codes
    .map((c) => String(c).trim().toUpperCase())
    .filter((c) => c.length > 0);
  if (list.length === 0) throw Object.assign(new Error('At least one code is required'), { status: 400 });
  if (list.length > 500) throw Object.assign(new Error('Maximum 500 codes per export'), { status: 400 });
  return list;
};

exports.exportByProcedure = async (req, res, next) => {
  try {
    const { matchMode = 'exact' } = req.body;
    const codes = parseCodes(req.body.codes);
    const dirName = sanitizeDir(req.body.directory);

    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      directory: dirName,
      matchMode: matchMode === 'prefix' ? 'prefix' : 'exact',
      codes,
      progress: { done: 0, total: 0, current: '' },
      result: null,
      error: null,
    };
    jobs.set(jobId, job);

    // Keep only the last 50 jobs in memory
    if (jobs.size > 50) {
      const oldest = [...jobs.keys()].slice(0, jobs.size - 50);
      oldest.forEach((k) => jobs.delete(k));
    }

    res.status(202).json({ jobId, status: 'queued' });

    // Run the export in the background (not awaited)
    runExport(jobId).catch(() => {});
  } catch (error) {
    next(error);
  }
};

exports.getExportJob = (req, res, next) => {
  try {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error) { next(error); }
};

async function runExport(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'running';

  try {
    const mode = job.matchMode;
    const codeClause = mode === 'prefix'
      ? { [Op.or]: job.codes.map((c) => ({ procedure_code: { [Op.startsWith]: c } })) }
      : { procedure_code: { [Op.in]: job.codes } };

    // --- 837 files: claims -> claim_lines ---
    const claimFileIds = await ClaimLine.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('Claim.file_id')), 'file_id']],
      where: codeClause,
      include: [{ model: sequelize.models.Claim, attributes: [], required: true }],
      raw: true,
    });

    // --- 835 files: remittances -> remittance_lines ---
    const remitFileIds = await RemittanceLine.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('Remittance.file_id')), 'file_id']],
      where: codeClause,
      include: [{ model: sequelize.models.Remittance, attributes: [], required: true }],
      raw: true,
    });

    const fileIdSet = new Set([
      ...claimFileIds.map((r) => r.file_id).filter(Boolean),
      ...remitFileIds.map((r) => r.file_id).filter(Boolean),
    ]);

    if (fileIdSet.size === 0) {
      job.status = 'done';
      job.result = {
        directory: job.directory,
        matchMode: mode,
        codes: job.codes,
        totalFiles: 0,
        summary: { '835': { count: 0, files: [] }, '837': { count: 0, files: [] } },
        hostPath: path.join(EXTRACT_ROOT, job.directory),
        message: 'No files found containing the specified codes',
      };
      return;
    }

    const files = await UploadedFile.findAll({
      where: { id: { [Op.in]: [...fileIdSet] } },
      attributes: ['id', 'filename', 'file_type'],
      raw: true,
    });

    const result = { '835': { count: 0, files: [] }, '837': { count: 0, files: [] } };
    const seen = new Set();
    const missingOnDisk = [];
    job.progress.total = files.length;

    for (const f of files) {
      if (!result[f.file_type] || seen.has(f.id)) continue;
      seen.add(f.id);
      job.progress.current = f.filename;

      const outDir = path.join(EXTRACT_ROOT, job.directory, f.file_type);
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, f.filename);

      const srcDir = PROCESSED_DIRS[f.file_type];
      const srcFile = srcDir ? path.join(srcDir, f.filename) : null;
      if (srcFile && fs.existsSync(srcFile)) {
        await fs.promises.copyFile(srcFile, outFile);
      } else {
        const rec = await UploadedFile.findByPk(f.id, { attributes: ['raw_content'] });
        if (!rec || !rec.raw_content) { missingOnDisk.push(f.filename); continue; }
        await fs.promises.writeFile(outFile, rec.raw_content, 'utf8');
      }
      result[f.file_type].count += 1;
      result[f.file_type].files.push(f.filename);
      job.progress.done += 1;
    }

    job.status = 'done';
    job.result = {
      directory: job.directory,
      matchMode: mode,
      codes: job.codes,
      totalFiles: result['835'].count + result['837'].count,
      summary: result,
      hostPath: path.join(EXTRACT_ROOT, job.directory),
      missingOnDisk,
    };
  } catch (error) {
    job.status = 'error';
    job.error = error.message;
  }
}
