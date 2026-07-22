const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
router.get('/summary', authenticate, controller.summary);
router.get('/denial-reasons', authenticate, controller.denialReasons);
router.get('/trends', authenticate, controller.trends);
router.get('/payer-breakdown', authenticate, controller.payerBreakdown);
router.get('/aging', authenticate, controller.aging);

module.exports = router;
