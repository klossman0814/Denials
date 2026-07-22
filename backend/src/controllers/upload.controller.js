const uploadService = require('../services/upload.service');
const { UploadedFile } = require('../models');

exports.uploadFile = async (req, res, next) => {
  try {
    const fileType = req.params.type;
    if (!['837', '835'].includes(fileType)) return res.status(400).json({ error: 'Invalid file type' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await uploadService.processFile(req.file.path, fileType, req.user?.id || null);
    if (result.duplicate) {
      return res.status(200).json({ message: result.message, file: result.file, recordsCreated: 0, duplicate: true });
    }
    res.status(201).json({ message: 'File processed successfully', file: result.file, recordsCreated: result.recordsCreated });
  } catch (error) { next(error); }
};

exports.listFiles = async (req, res, next) => {
  try {
    const files = await UploadedFile.findAll({ order: [['uploaded_at', 'DESC']], limit: 100 });
    res.json({ files });
  } catch (error) { next(error); }
};
