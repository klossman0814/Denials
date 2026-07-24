const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

[config.upload.dir837, config.upload.dir835].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = req.params.type === '837' ? config.upload.dir837 : config.upload.dir835;
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const fileFilter = (req, file, cb) => {
  if (file.originalname.match(/\.(edi|837|835|txt|bak|dat|era)$/i) || file.mimetype === 'text/plain') {
    cb(null, true);
  } else {
    cb(new Error('Only .edi, .837, .835, .txt, .bak, .dat, .era files allowed'), false);
  }
};

const upload = multer({ storage, limits: { fileSize: config.upload.maxFileSize }, fileFilter }).single('file');

module.exports = upload;
