const uploadService = require('../services/upload.service');
const ediQueue = require('../queue/ediQueue');
const { UploadedFile } = require('../models');
const fs = require('fs');
const crypto = require('crypto');

exports.uploadFile = async (req, res, next) => {
  try {
    const fileType = req.params.type;
    if (!['837', '835'].includes(fileType)) return res.status(400).json({ error: 'Invalid file type' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Check for duplicates first
    const content = fs.readFileSync(req.file.path, 'utf8');
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    const existing = await UploadedFile.findOne({
      where: { content_hash: contentHash, status: 'parsed' },
    });
    if (existing) {
      fs.unlink(req.file.path, () => {});
      return res.status(200).json({
        message: 'File already processed',
        file: existing,
        recordsCreated: 0,
        duplicate: true,
      });
    }

    // Create file record in 'queued' status
    const fileRecord = await UploadedFile.create({
      filename: req.file.filename || req.file.originalname,
      file_type: fileType,
      file_path: req.file.path,
      file_size: req.file.size,
      content_hash: contentHash,
      status: 'queued',
      uploaded_by: req.user?.id || null,
    });

    // Enqueue processing job (or fall back to synchronous processing)
    if (ediQueue) {
      await ediQueue.add({
        filePath: req.file.path,
        fileType,
        uploadedBy: req.user?.id || null,
      });

      res.status(202).json({
        message: 'File queued for processing',
        file: fileRecord,
      });
    } else {
      // No queue available — process synchronously
      fileRecord.status = 'parsing';
      await fileRecord.save();

      const result = await uploadService.processFile(req.file.path, fileType, req.user?.id || null);
      if (result.duplicate) {
        return res.status(200).json({ message: result.message, file: result.file, recordsCreated: 0, duplicate: true });
      }
      res.status(201).json({ message: 'File processed successfully', file: result.file, recordsCreated: result.recordsCreated });
    }
  } catch (error) { next(error); }
};

exports.listFiles = async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows, count } = await UploadedFile.findAndCountAll({
      order: [['uploaded_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });
    res.json({
      files: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) { next(error); }
};
