const { Router } = require('express');
const controller = require('../controllers/upload.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

const router = Router();
router.post('/:type', authenticate, (req, res, next) => {
  upload(req, res, (err) => { if (err) return next(err); controller.uploadFile(req, res, next); });
});
router.get('/files', authenticate, controller.listFiles);
router.get('/files/:id', authenticate, controller.getFile);

module.exports = router;
