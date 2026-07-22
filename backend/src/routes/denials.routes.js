const { Router } = require('express');
const controller = require('../controllers/denials.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
router.get('/', authenticate, controller.listDenials);

module.exports = router;
