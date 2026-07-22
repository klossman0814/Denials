const { Router } = require('express');
const controller = require('../controllers/remittances.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
router.get('/', authenticate, controller.listFiles);
router.get('/:id', authenticate, controller.getFile);

module.exports = router;
